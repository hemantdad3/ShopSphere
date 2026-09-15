const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const Wishlist = require('../src/models/Wishlist');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 9: REVIEWS & WISHLIST ENGINE VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  let localServer = null;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    await connectDB();

    try {
      const ping = await fetch(`${BASE_URL}/health`);
      if (!ping.ok) throw new Error('Not running');
    } catch {
      localServer = app.listen(PORT);
      await new Promise((res) => setTimeout(res, 500));
    }

    const testSuffix = Date.now();

    // -------------------------------------------------------------
    // 1. Setup Users: Alice (Customer), Bob (Customer), Admin
    // -------------------------------------------------------------
    const aliceEmail = `alice_rev_${testSuffix}@shopsphere.com`;
    const bobEmail = `bob_rev_${testSuffix}@shopsphere.com`;
    const adminEmail = `admin_rev_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const aliceUser = await User.create({
      name: 'Alice Reviewer',
      email: aliceEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const bobUser = await User.create({
      name: 'Bob Reviewer',
      email: bobEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const adminUser = await User.create({
      name: 'Admin Reviewer',
      email: adminEmail,
      passwordHash: password,
      role: 'ADMIN',
    });

    // Login Alice
    const aliceLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, password }),
    });
    const aliceCookie = aliceLoginRes.headers.get('set-cookie');

    // Login Bob
    const bobLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bobEmail, password }),
    });
    const bobCookie = bobLoginRes.headers.get('set-cookie');

    // Login Admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie');

    assert(
      aliceCookie && bobCookie && adminCookie,
      'Test users and admin authenticated successfully with session cookies'
    );

    // -------------------------------------------------------------
    // 2. Setup Category & Test Product
    // -------------------------------------------------------------
    const category = await Category.create({
      name: `Review Cat ${testSuffix}`,
      slug: `review-cat-${testSuffix}`,
    });

    const product = await Product.create({
      name: `Ergonomic Wireless Keyboard ${testSuffix}`,
      description: 'Split mechanical ergonomic keyboard with programmable keys',
      sku: `KB-REV-${testSuffix}`,
      price: 4500,
      stock: 20,
      category: category._id,
      images: [{ url: 'https://images.example.com/kb-rev.jpg', fileId: 'rev_1' }],
    });

    console.log('\n--- Test Group 1: Verified Buyer Review Gating ---');

    // 1. Unpurchased Review Attempt: Alice has not bought the product
    const unpurchasedRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 5,
        title: 'Premature review',
        comment: 'Looks great in pictures, hope it works well!',
      }),
    });
    const unpurchasedData = await unpurchasedRes.json();
    assert(
      unpurchasedRes.status === 403 && unpurchasedData.code === 'NOT_VERIFIED_PURCHASER',
      'Unpurchased customer blocked with 403 NOT_VERIFIED_PURCHASER'
    );

    // 2. Undelivered Order Review Attempt: Alice orders the product, order is CONFIRMED (not yet DELIVERED)
    const orderAlice = await Order.create({
      orderNumber: `ORD-TEST-${testSuffix}-A`,
      customer: aliceUser._id,
      items: [
        {
          product: product._id,
          name: product.name,
          price: product.price,
          finalPrice: product.price,
          quantity: 1,
          lineTotal: product.price,
        },
      ],
      shippingAddress: {
        fullName: 'Alice Reviewer',
        phone: '9876543210',
        addressLine1: '100 Silicon Ave',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      subtotal: product.price,
      totalAmount: product.price,
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const undeliveredRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 5,
        title: 'Still in transit',
        comment: 'Waiting for package to arrive soon.',
      }),
    });
    const undeliveredData = await undeliveredRes.json();
    assert(
      undeliveredRes.status === 403 && undeliveredData.code === 'NOT_VERIFIED_PURCHASER',
      'Customer with undelivered CONFIRMED order blocked with 403 NOT_VERIFIED_PURCHASER'
    );

    // 3. Admin transitions Alice order to DELIVERED
    orderAlice.orderStatus = 'DELIVERED';
    orderAlice.deliveredAt = new Date();
    await orderAlice.save();

    // 4. Validation rules: invalid rating or short comment rejected
    const invalidRatingRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 6, // Exceeds max 5
        comment: 'Valid comment length here',
      }),
    });
    assert(
      invalidRatingRes.status === 400,
      'Zod schema rejects rating > 5 with HTTP 400'
    );

    const shortCommentRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 5,
        comment: 'bad', // Less than 5 chars
      }),
    });
    assert(
      shortCommentRes.status === 400,
      'Zod schema rejects comment shorter than 5 characters with HTTP 400'
    );

    // 5. Alice submits valid 5-star review
    const validReviewAliceRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 5,
        title: 'Outstanding mechanical feel',
        comment: 'Super comfortable layout, great tactile switches, and high quality build.',
      }),
    });
    const validReviewAliceData = await validReviewAliceRes.json();

    assert(
      validReviewAliceRes.status === 201 && validReviewAliceData.success,
      'Alice successfully submitted verified purchaser review (201 Created)'
    );
    assert(
      validReviewAliceData.data.review.isVerifiedPurchase === true,
      'Review marked isVerifiedPurchase: true'
    );
    assert(
      validReviewAliceData.data.review.user && validReviewAliceData.data.review.user.name === 'Alice Reviewer',
      'Author name populated on review response'
    );

    // Check Product ratingAverage and reviewCount in DB
    const productAfterReview1 = await Product.findById(product._id);
    assert(
      productAfterReview1.ratingAverage === 5.0 && productAfterReview1.reviewCount === 1,
      'Product rating automatically updated to 5.0 with reviewCount: 1'
    );

    console.log('\n--- Test Group 2: Duplicate Review Defense & Rating Aggregation ---');

    // 6. Duplicate review defense: Alice attempts to submit second review
    const duplicateRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({
        rating: 4,
        title: 'Second review attempt',
        comment: 'Trying to review again should be rejected by compound unique index.',
      }),
    });
    const duplicateData = await duplicateRes.json();
    assert(
      duplicateRes.status === 409 && duplicateData.code === 'DUPLICATE_REVIEW',
      'Duplicate review by same customer blocked with 409 DUPLICATE_REVIEW'
    );

    // 7. Bob orders product, gets it DELIVERED, and submits a 3-star review
    const orderBob = await Order.create({
      orderNumber: `ORD-TEST-${testSuffix}-B`,
      customer: bobUser._id,
      items: [
        {
          product: product._id,
          name: product.name,
          price: product.price,
          finalPrice: product.price,
          quantity: 1,
          lineTotal: product.price,
        },
      ],
      shippingAddress: {
        fullName: 'Bob Reviewer',
        phone: '9876543211',
        addressLine1: '200 Tech Park',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      },
      subtotal: product.price,
      totalAmount: product.price,
      orderStatus: 'DELIVERED',
      paymentStatus: 'PAID',
      deliveredAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const validReviewBobRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({
        rating: 3,
        title: 'Decent, but keys are loud',
        comment: 'The build is solid but typing noise is noticeable in quiet offices.',
      }),
    });
    const validReviewBobData = await validReviewBobRes.json();
    const bobReviewId = validReviewBobData.data.review._id;

    assert(
      validReviewBobRes.status === 201,
      'Bob successfully submitted verified 3-star review'
    );

    // Verify rating recalculation: (5 + 3) / 2 = 4.0
    const productAfterReview2 = await Product.findById(product._id);
    assert(
      productAfterReview2.ratingAverage === 4.0 && productAfterReview2.reviewCount === 2,
      'Aggregation pipeline recalculated Product ratingAverage to 4.0 and reviewCount to 2'
    );

    // 8. Public Review Listing (GET /api/products/:productId/reviews)
    const publicReviewsRes = await fetch(`${BASE_URL}/products/${product._id}/reviews`);
    const publicReviewsData = await publicReviewsRes.json();
    assert(
      publicReviewsRes.status === 200 &&
        Array.isArray(publicReviewsData.data.reviews) &&
        publicReviewsData.data.reviews.length === 2 &&
        publicReviewsData.data.pagination.total === 2,
      'Public endpoint retrieves all product reviews with pagination metadata'
    );

    console.log('\n--- Test Group 3: Review Deletion & Recalculation ---');

    // 9. Unauthorized deletion: Alice attempts to delete Bob's review -> 403 Forbidden
    const unauthDeleteRes = await fetch(`${BASE_URL}/reviews/${bobReviewId}`, {
      method: 'DELETE',
      headers: { Cookie: aliceCookie },
    });
    assert(
      unauthDeleteRes.status === 403,
      'Customer Alice blocked from deleting Bob review (403 Forbidden)'
    );

    // 10. Bob deletes his own review -> 200 OK
    const bobDeleteRes = await fetch(`${BASE_URL}/reviews/${bobReviewId}`, {
      method: 'DELETE',
      headers: { Cookie: bobCookie },
    });
    assert(bobDeleteRes.status === 200, 'Bob successfully deleted his own review');

    // Product rating recalculates: only Alice 5-star remains
    const productAfterBobDelete = await Product.findById(product._id);
    assert(
      productAfterBobDelete.ratingAverage === 5.0 && productAfterBobDelete.reviewCount === 1,
      'Product rating automatically recalculated to 5.0 after review deletion'
    );

    // 11. Admin deletes Alice review (Administrative moderation override)
    const aliceReviewId = validReviewAliceData.data.review._id;
    const adminDeleteRes = await fetch(`${BASE_URL}/reviews/${aliceReviewId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert(adminDeleteRes.status === 200, 'Admin successfully moderated/deleted Alice review');

    // Product rating resets cleanly to 0
    const productAfterAdminDelete = await Product.findById(product._id);
    assert(
      productAfterAdminDelete.ratingAverage === 0 && productAfterAdminDelete.reviewCount === 0,
      'Product rating reset to 0.0 with reviewCount: 0 when all reviews removed'
    );

    console.log('\n--- Test Group 4: Customer Wishlist Engine ---');

    // 12. Wishlist Authentication Guard
    const unauthWishlistRes = await fetch(`${BASE_URL}/wishlist`);
    assert(
      unauthWishlistRes.status === 401,
      'Unauthenticated GET /api/wishlist returns HTTP 401'
    );

    // 13. Initial empty wishlist
    const initialWishlistRes = await fetch(`${BASE_URL}/wishlist`, {
      headers: { Cookie: aliceCookie },
    });
    const initialWishlistData = await initialWishlistRes.json();
    assert(
      initialWishlistRes.status === 200 &&
        Array.isArray(initialWishlistData.data.wishlist.products) &&
        initialWishlistData.data.wishlist.products.length === 0,
      'Initial customer wishlist is empty array'
    );

    // 14. Add product to wishlist
    const addToWishlistRes = await fetch(`${BASE_URL}/wishlist/${product._id}`, {
      method: 'POST',
      headers: { Cookie: aliceCookie },
    });
    const addToWishlistData = await addToWishlistRes.json();
    assert(
      addToWishlistRes.status === 201 &&
        addToWishlistData.data.wishlist.products.length === 1 &&
        addToWishlistData.data.wishlist.products[0]._id.toString() === product._id.toString(),
      'Product added to wishlist with populated product details'
    );

    // 15. Idempotent addition ($addToSet): Adding again does not create duplicate
    const repeatAddRes = await fetch(`${BASE_URL}/wishlist/${product._id}`, {
      method: 'POST',
      headers: { Cookie: aliceCookie },
    });
    const repeatAddData = await repeatAddRes.json();
    assert(
      repeatAddData.data.wishlist.products.length === 1,
      'Duplicate wishlist addition is idempotent ($addToSet prevents duplicates)'
    );

    // 16. Move to Cart: transfers item from wishlist to active cart
    const moveToCartRes = await fetch(`${BASE_URL}/wishlist/${product._id}/move-to-cart`, {
      method: 'POST',
      headers: { Cookie: aliceCookie },
    });
    const moveToCartData = await moveToCartRes.json();
    assert(
      moveToCartRes.status === 200 &&
        moveToCartData.data.wishlist.products.length === 0 &&
        moveToCartData.data.cart.items.length === 1 &&
        moveToCartData.data.cart.items[0].productId.toString() === product._id.toString(),
      'move-to-cart successfully added product to cart and removed from wishlist'
    );

    // 17. Add back to wishlist and remove
    await fetch(`${BASE_URL}/wishlist/${product._id}`, {
      method: 'POST',
      headers: { Cookie: aliceCookie },
    });
    const removeWishlistRes = await fetch(`${BASE_URL}/wishlist/${product._id}`, {
      method: 'DELETE',
      headers: { Cookie: aliceCookie },
    });
    const removeWishlistData = await removeWishlistRes.json();
    assert(
      removeWishlistRes.status === 200 &&
        removeWishlistData.data.wishlist.products.length === 0,
      'DELETE /api/wishlist/:productId cleanly removes item from wishlist'
    );

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    await Review.deleteMany({ product: product._id });
    await Wishlist.deleteMany({ user: { $in: [aliceUser._id, bobUser._id, adminUser._id] } });
    await Cart.deleteMany({ user: { $in: [aliceUser._id, bobUser._id, adminUser._id] } });
    await Order.deleteMany({ _id: { $in: [orderAlice._id, orderBob._id] } });
    await Product.deleteMany({ _id: product._id });
    await Category.deleteMany({ _id: category._id });
    await User.deleteMany({ _id: { $in: [aliceUser._id, bobUser._id, adminUser._id] } });
  } catch (err) {
    console.error('Fatal Test Execution Error:', err);
    failed++;
  } finally {
    if (localServer) {
      localServer.close();
    }
    await disconnectDB();

    console.log('\n================================================================');
    console.log(`   TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
