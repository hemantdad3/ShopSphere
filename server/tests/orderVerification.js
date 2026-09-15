const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const { connectDB, disconnectDB } = require('../src/config/db');
const { cleanupExpiredReservations } = require('../src/workers/reservationCleanupWorker');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 6: CHECKOUT & INVENTORY RESERVATION TEST');
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

    // 1. Setup Test Customers (Customer A and Customer B for concurrency & RBAC)
    const custAEmail = `cust_a_${testSuffix}@shopsphere.com`;
    const custBEmail = `cust_b_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const userA = await User.create({
      name: 'Customer Alice',
      email: custAEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const userB = await User.create({
      name: 'Customer Bob',
      email: custBEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    // Login both users to acquire cookies
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custAEmail, password }),
    });
    const cookieA = loginARes.headers.get('set-cookie')?.split(';')[0];

    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: custBEmail, password }),
    });
    const cookieB = loginBRes.headers.get('set-cookie')?.split(';')[0];

    // Seed test category
    const category = await Category.create({
      name: `Checkout Cat ${testSuffix}`,
      description: 'Checkout test category',
    });

    // Seed Product 1: Stock = 10, Price = 10000, Discount = 10%
    const prod1 = await Product.create({
      name: `Checkout Prod 1 ${testSuffix}`,
      description: 'Test product for reservation',
      price: 10000,
      discount: 10,
      category: category._id,
      stock: 10,
      images: [{ url: 'https://ik.imagekit.io/test/p1.jpg', fileId: 'p1' }],
    });

    // Seed Product 2 (Limited Stock = 1 for Concurrency Race Condition)
    const prodRace = await Product.create({
      name: `Race Condition Gadget ${testSuffix}`,
      description: 'Only 1 unit in stock for concurrency race',
      price: 15000,
      discount: 0,
      category: category._id,
      stock: 1,
      images: [{ url: 'https://ik.imagekit.io/test/race.jpg', fileId: 'race' }],
    });

    const validAddress = {
      fullName: 'Alice Johnson',
      phone: '9876543210',
      addressLine1: '42 MG Road, Indiranagar',
      addressLine2: 'Flat 4B',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      country: 'India',
    };

    // ----------------------------------------------------
    // Test 1: Authentication Guard on Checkout
    // ----------------------------------------------------
    console.log('[1] Testing Authentication Guards...');
    const unauthRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingAddress: validAddress }),
    });
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, 'POST /orders/checkout without token returns HTTP 401');
    assert(unauthData.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    // ----------------------------------------------------
    // Test 2: Pre-condition Validation (Empty Cart & Address Validation)
    // ----------------------------------------------------
    console.log('\n[2] Testing Checkout Validation & Empty Cart Guard...');
    // Empty Cart
    const emptyCartRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ shippingAddress: validAddress }),
    });
    const emptyCartData = await emptyCartRes.json();
    assert(emptyCartRes.status === 400, 'Checkout with empty cart returns HTTP 400 Bad Request');
    assert(emptyCartData.code === 'EMPTY_CART', 'Error code is EMPTY_CART');

    // Add item to cart first
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ productId: prod1._id.toString(), quantity: 2 }),
    });

    // Invalid phone number in shipping address
    const invalidPhoneAddress = { ...validAddress, phone: '12345' };
    const invalidPhoneRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ shippingAddress: invalidPhoneAddress }),
    });
    assert(invalidPhoneRes.status === 400, 'Invalid phone number fails Zod schema with HTTP 400');

    // Invalid pincode in shipping address
    const invalidPinAddress = { ...validAddress, pincode: 'ABC123' };
    const invalidPinRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ shippingAddress: invalidPinAddress }),
    });
    assert(invalidPinRes.status === 400, 'Invalid pincode fails Zod schema with HTTP 400');

    // ----------------------------------------------------
    // Test 3: Successful Checkout & Atomic Inventory Reservation
    // ----------------------------------------------------
    console.log('\n[3] Testing Atomic Inventory Reservation & Snapshot Freezing...');
    const checkoutRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ shippingAddress: validAddress }),
    });
    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.status === 201, 'POST /orders/checkout returns HTTP 201 Created');

    const createdOrder = checkoutData.data.order;
    assert(createdOrder.orderStatus === 'PENDING_PAYMENT', 'Order status is PENDING_PAYMENT');
    assert(createdOrder.paymentStatus === 'PENDING', 'Payment status is PENDING');
    assert(createdOrder.orderNumber.startsWith('ORD-'), 'Order number has ORD- prefix');
    assert(createdOrder.items.length === 1, 'Order has 1 item snapshot');

    const snapshot = createdOrder.items[0];
    assert(snapshot.quantity === 2, 'Snapshot quantity is 2');
    assert(snapshot.price === 10000, 'Snapshot price is 10000');
    assert(snapshot.discount === 10, 'Snapshot discount is 10');
    assert(snapshot.finalPrice === 9000, 'Snapshot finalPrice is 9000');
    assert(snapshot.lineTotal === 18000, 'Snapshot lineTotal is 18000');
    assert(createdOrder.subtotal === 20000, 'Order subtotal is 20000');
    assert(createdOrder.discountTotal === 2000, 'Order discountTotal is 2000');
    assert(createdOrder.shippingFee === 0, 'Order shippingFee is 0 (subtotal >= 1000)');
    assert(createdOrder.totalAmount === 18000, 'Order totalAmount is 18000');

    // INVENTORY CHECK: MongoDB stock must be decremented from 10 to 8
    const updatedProd1 = await Product.findById(prod1._id);
    assert(updatedProd1.stock === 8, 'Product 1 stock atomically decremented from 10 to 8');

    // CART CHECK: Customer cart must be emptied
    const userACart = await Cart.findOne({ user: userA._id });
    assert(userACart.items.length === 0, 'Customer cart was cleanly cleared upon checkout');

    // TTL CHECK: reservationExpiresAt is in the future (~15 mins)
    const expiryTime = new Date(createdOrder.reservationExpiresAt).getTime();
    const nowTime = Date.now();
    const diffMins = (expiryTime - nowTime) / 1000 / 60;
    assert(diffMins >= 14 && diffMins <= 16, 'reservationExpiresAt is set to 15 minutes from now');

    // ----------------------------------------------------
    // Test 4: High-Concurrency Overselling Prevention
    // ----------------------------------------------------
    console.log('\n[4] Testing High-Concurrency Overselling Prevention (Race Condition)...');
    // Both Alice and Bob add the same single unit of prodRace (Stock = 1) to cart
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ productId: prodRace._id.toString(), quantity: 1 }),
    });

    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ productId: prodRace._id.toString(), quantity: 1 }),
    });

    // Alice and Bob hit checkout simultaneously
    const [resAlice, resBob] = await Promise.all([
      fetch(`${BASE_URL}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ shippingAddress: validAddress }),
      }),
      fetch(`${BASE_URL}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieB },
        body: JSON.stringify({ shippingAddress: { ...validAddress, fullName: 'Bob Smith' } }),
      }),
    ]);

    const statusCodes = [resAlice.status, resBob.status].sort();
    assert(
      statusCodes[0] === 201 && statusCodes[1] === 409,
      'Concurrent checkout on last unit: exactly one succeeds (201) and one fails (409 Conflict)'
    );

    // Verify stock is strictly 0 and NOT negative!
    const finalRaceProd = await Product.findById(prodRace._id);
    assert(finalRaceProd.stock === 0, 'Database stock is exactly 0 (no overselling)');

    // ----------------------------------------------------
    // Test 5: 15-Minute Reservation Expiration & Auto-Restock Worker
    // ----------------------------------------------------
    console.log('\n[5] Testing Reservation Expiration & Automatic Inventory Restock...');
    // Artificially expire the order created in Test 3 (which reserved 2 units of prod1)
    await Order.findByIdAndUpdate(createdOrder._id, {
      reservationExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    // Run the reservation cleanup worker
    const processedCount = await cleanupExpiredReservations();
    assert(processedCount >= 1, 'Cleanup worker identified and processed expired order');

    // Verify order was transitioned to CANCELLED and restocked
    const cancelledOrder = await Order.findById(createdOrder._id);
    assert(cancelledOrder.orderStatus === 'CANCELLED', 'Expired order transitioned to CANCELLED');
    assert(cancelledOrder.paymentStatus === 'FAILED', 'Payment status marked FAILED');
    assert(
      cancelledOrder.cancellationReason.includes('15-minute TTL'),
      'Cancellation reason specifies 15-minute TTL expiration'
    );

    // Verify inventory was restored! (prod1 was 8, should now be restored to 10)
    const restockedProd1 = await Product.findById(prod1._id);
    assert(restockedProd1.stock === 10, 'Product 1 stock automatically restored from 8 back to 10');

    // ----------------------------------------------------
    // Test 6: Customer Order Queries & Ownership Enforcement
    // ----------------------------------------------------
    console.log('\n[6] Testing Customer Order History & Ownership Authorization...');
    // Alice views her order history
    const myOrdersRes = await fetch(`${BASE_URL}/orders/my-orders`, {
      headers: { Cookie: cookieA },
    });
    const myOrdersData = await myOrdersRes.json();
    assert(myOrdersRes.status === 200, 'GET /orders/my-orders returns HTTP 200 OK');
    assert(myOrdersData.data.orders.length >= 1, 'Customer has at least 1 order in history');

    // Alice views her specific order
    const getOrderRes = await fetch(`${BASE_URL}/orders/${createdOrder._id}`, {
      headers: { Cookie: cookieA },
    });
    const getOrderData = await getOrderRes.json();
    assert(getOrderRes.status === 200, 'Customer Alice can retrieve her own order details');
    assert(getOrderData.data.order._id === createdOrder._id, 'Retrieved order ID matches');

    // Bob attempts to view Alice's order -> Must return HTTP 403 Forbidden!
    const intruderRes = await fetch(`${BASE_URL}/orders/${createdOrder._id}`, {
      headers: { Cookie: cookieB },
    });
    const intruderData = await intruderRes.json();
    assert(intruderRes.status === 403, 'Bob viewing Alice order returns HTTP 403 Forbidden');
    assert(intruderData.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    console.log('\n[Cleanup] Cleaning up test records...');
    await Order.deleteMany({ customer: { $in: [userA._id, userB._id] } });
    await Cart.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Product.deleteMany({ _id: { $in: [prod1._id, prodRace._id] } });
    await Category.deleteOne({ _id: category._id });

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (localServer) localServer.close();
    await disconnectDB();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during order verification:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
