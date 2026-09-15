const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 5: SHOPPING CART ENGINE TEST');
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

    // 1. Setup Test Users & Categories
    const testSuffix = Date.now();
    const customerEmail = `cart_customer_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const customerUser = await User.create({
      name: 'Cart Customer',
      email: customerEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    // Customer login to obtain auth cookie
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password }),
    });
    const authCookie = loginRes.headers.get('set-cookie')?.split(';')[0];

    const testCat = await Category.create({
      name: `Cart Cat ${testSuffix}`,
      description: 'Cart test category',
    });

    // Seed test products
    // Product 1: Price 10000, Discount 10% (finalPrice = 9000), Stock = 15
    const product1 = await Product.create({
      name: `Product One ${testSuffix}`,
      description: 'High end test device',
      price: 10000,
      discount: 10,
      category: testCat._id,
      stock: 15,
      images: [{ url: 'https://ik.imagekit.io/test/p1.jpg', fileId: 'p1' }],
    });

    // Product 2: Price 2500, Discount 0% (finalPrice = 2500), Stock = 5
    const product2 = await Product.create({
      name: `Product Two ${testSuffix}`,
      description: 'Mid range test accessory',
      price: 2500,
      discount: 0,
      category: testCat._id,
      stock: 5,
      images: [{ url: 'https://ik.imagekit.io/test/p2.jpg', fileId: 'p2' }],
    });

    // Product 3: Out of stock product
    const outOfStockProduct = await Product.create({
      name: `Product OOS ${testSuffix}`,
      description: 'Sold out test product',
      price: 5000,
      discount: 0,
      category: testCat._id,
      stock: 0,
      images: [{ url: 'https://ik.imagekit.io/test/p3.jpg', fileId: 'p3' }],
    });

    // Product 4: Inactive product
    const inactiveProduct = await Product.create({
      name: `Product Inactive ${testSuffix}`,
      description: 'Deactivated test product',
      price: 3000,
      discount: 0,
      category: testCat._id,
      stock: 10,
      isActive: false,
      images: [{ url: 'https://ik.imagekit.io/test/p4.jpg', fileId: 'p4' }],
    });

    // ----------------------------------------------------
    // Test 1: Authentication Guard on Cart Endpoints
    // ----------------------------------------------------
    console.log('[1] Testing Cart Authentication Guard...');
    const unauthRes = await fetch(`${BASE_URL}/cart`);
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, 'GET /cart without token returns HTTP 401 Unauthorized');
    assert(unauthData.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    const unauthPostRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product1._id.toString(), quantity: 1 }),
    });
    assert(unauthPostRes.status === 401, 'POST /cart/items without token returns HTTP 401 Unauthorized');

    // ----------------------------------------------------
    // Test 2: Initial Empty Cart Retrieval
    // ----------------------------------------------------
    console.log('\n[2] Testing Initial Empty Cart Retrieval...');
    const emptyCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Cookie: authCookie },
    });
    const emptyCartData = await emptyCartRes.json();
    assert(emptyCartRes.status === 200, 'GET /cart for new user returns HTTP 200 OK');
    assert(emptyCartData.data.cart.items.length === 0, 'Cart items array is empty');
    assert(emptyCartData.data.cart.summary.totalItems === 0, 'totalItems is 0');
    assert(emptyCartData.data.cart.summary.subtotal === 0, 'subtotal is 0');
    assert(emptyCartData.data.cart.summary.finalTotal === 0, 'finalTotal is 0');
    assert(emptyCartData.data.cart.summary.isValidForCheckout === false, 'Empty cart is not valid for checkout');

    // ----------------------------------------------------
    // Test 3: Adding Item to Cart (Authoritative Price Calculation)
    // ----------------------------------------------------
    console.log('\n[3] Testing Adding Items & Authoritative Pricing...');
    const addP1Res = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ productId: product1._id.toString(), quantity: 2 }),
    });
    const addP1Data = await addP1Res.json();
    assert(addP1Res.status === 201, 'POST /cart/items returns HTTP 201 Created');
    assert(addP1Data.data.cart.items.length === 1, 'Cart now contains 1 distinct item');

    const item1 = addP1Data.data.cart.items[0];
    assert(item1.quantity === 2, 'Item quantity is 2');
    assert(item1.unitPrice === 10000, 'Item unit price is 10000');
    assert(item1.finalPrice === 9000, 'Item final price after 10% discount is 9000');
    assert(item1.lineSubtotal === 20000, 'Item lineSubtotal is 20000 (2 * 10000)');
    assert(item1.lineTotal === 18000, 'Item lineTotal is 18000 (2 * 9000)');
    assert(item1.lineDiscount === 2000, 'Item lineDiscount is 2000');
    assert(addP1Data.data.cart.summary.totalItems === 2, 'Summary totalItems is 2');
    assert(addP1Data.data.cart.summary.subtotal === 20000, 'Summary subtotal is 20000');
    assert(addP1Data.data.cart.summary.discountTotal === 2000, 'Summary discountTotal is 2000');
    assert(addP1Data.data.cart.summary.finalTotal === 18000, 'Summary finalTotal is 18000');
    assert(addP1Data.data.cart.summary.isValidForCheckout === true, 'Cart with valid item is ready for checkout');

    // ----------------------------------------------------
    // Test 4: Adding Duplicate Product Increments Quantity
    // ----------------------------------------------------
    console.log('\n[4] Testing Duplicate Product Addition Increments Quantity...');
    const addP1AgainRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ productId: product1._id.toString(), quantity: 1 }),
    });
    const addP1AgainData = await addP1AgainRes.json();
    assert(addP1AgainRes.status === 201, 'Adding duplicate product returns HTTP 201');
    assert(addP1AgainData.data.cart.items.length === 1, 'Still 1 distinct item in cart');
    assert(addP1AgainData.data.cart.items[0].quantity === 3, 'Quantity incremented to 3 (2 + 1)');
    assert(addP1AgainData.data.cart.summary.finalTotal === 27000, 'Final total recalculated to 27000 (3 * 9000)');

    // ----------------------------------------------------
    // Test 5: Adding Second Product
    // ----------------------------------------------------
    console.log('\n[5] Testing Adding Multiple Distinct Products...');
    const addP2Res = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({ productId: product2._id.toString(), quantity: 1 }),
    });
    const addP2Data = await addP2Res.json();
    assert(addP2Res.status === 201, 'Add Product 2 returns HTTP 201');
    assert(addP2Data.data.cart.items.length === 2, 'Cart now contains 2 distinct items');
    // Summary: 3 of P1 (27000) + 1 of P2 (2500) = 29500
    assert(addP2Data.data.cart.summary.totalItems === 4, 'Summary totalItems is 4 (3 + 1)');
    assert(addP2Data.data.cart.summary.subtotal === 32500, 'Summary subtotal is 32500 (30000 + 2500)');
    assert(addP2Data.data.cart.summary.finalTotal === 29500, 'Summary finalTotal is 29500');

    // ----------------------------------------------------
    // Test 6: Invariant & Validation Guards
    // ----------------------------------------------------
    console.log('\n[6] Testing Validation & Stock Invariant Guards...');
    // Out of stock product
    const addOOSRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: outOfStockProduct._id.toString(), quantity: 1 }),
    });
    assert(addOOSRes.status === 400, 'Adding out of stock product returns HTTP 400 Bad Request');

    // Inactive product
    const addInactiveRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: inactiveProduct._id.toString(), quantity: 1 }),
    });
    assert(addInactiveRes.status === 404, 'Adding inactive product returns HTTP 404 Not Found');

    // Non-existent product
    const fakeId = new mongoose.Types.ObjectId();
    const addFakeRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: fakeId.toString(), quantity: 1 }),
    });
    assert(addFakeRes.status === 404, 'Adding non-existent product returns HTTP 404 Not Found');

    // Invalid product ID format
    const addInvalidRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: 'invalid-id-format', quantity: 1 }),
    });
    assert(addInvalidRes.status === 400, 'Invalid ObjectId format returns HTTP 400 Validation Error');

    // Quantity exceeding item purchase cap (> 10)
    const addExcessRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: product1._id.toString(), quantity: 11 }),
    });
    assert(addExcessRes.status === 400, 'Quantity > 10 returns HTTP 400 Validation Error');

    // Quantity exceeding stock (Product 2 has stock: 5, requested: 6)
    const addExceedStockRes = await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: product2._id.toString(), quantity: 6 }),
    });
    assert(addExceedStockRes.status === 400, 'Quantity exceeding stock returns HTTP 400 Bad Request');

    // ----------------------------------------------------
    // Test 7: Live Authoritative Price Recalculation (Price Tampering Defense)
    // ----------------------------------------------------
    console.log('\n[7] Testing Authoritative Dynamic Price Recalculation...');
    // Simulate store admin changing Product 1: Price 10000 -> 15000, Discount 10% -> 20% (finalPrice = 12000)
    await Product.findByIdAndUpdate(product1._id, { price: 15000, discount: 20 });

    // Customer re-reads cart
    const reCalcRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Cookie: authCookie },
    });
    const reCalcData = await reCalcRes.json();
    const updatedP1 = reCalcData.data.cart.items.find((i) => i.productId.toString() === product1._id.toString());
    assert(updatedP1.unitPrice === 15000, 'Product 1 unit price dynamically recalculated to 15000');
    assert(updatedP1.finalPrice === 12000, 'Product 1 final price dynamically recalculated to 12000 (20% off)');
    assert(updatedP1.lineTotal === 36000, 'Product 1 line total recalculated to 36000 (3 * 12000)');
    // Total: 3 of P1 (36000) + 1 of P2 (2500) = 38500
    assert(reCalcData.data.cart.summary.finalTotal === 38500, 'Cart summary reflects live price update (38500)');

    // ----------------------------------------------------
    // Test 8: Live Inventory Degradation Detection
    // ----------------------------------------------------
    console.log('\n[8] Testing Live Stock Degradation & Checkout Gating...');
    // Simulate concurrent purchase draining Product 2 stock to 0
    await Product.findByIdAndUpdate(product2._id, { stock: 0 });

    const degradedCartRes = await fetch(`${BASE_URL}/cart`, {
      headers: { Cookie: authCookie },
    });
    const degradedCartData = await degradedCartRes.json();
    const p2Degraded = degradedCartData.data.cart.items.find((i) => i.productId.toString() === product2._id.toString());
    assert(p2Degraded.isAvailable === false, 'Drained product is flagged as isAvailable: false');
    assert(p2Degraded.issueReason.includes('out of stock'), 'Issue reason explains out of stock');
    assert(degradedCartData.data.cart.summary.hasStockIssues === true, 'Cart flags hasStockIssues: true');
    assert(degradedCartData.data.cart.summary.isValidForCheckout === false, 'Degraded cart blocks checkout (isValidForCheckout: false)');

    // Restore product 2 stock
    await Product.findByIdAndUpdate(product2._id, { stock: 5 });

    // ----------------------------------------------------
    // Test 9: Update Item Quantity (PATCH /cart/items/:productId)
    // ----------------------------------------------------
    console.log('\n[9] Testing Updating Item Quantity...');
    const updateQtyRes = await fetch(`${BASE_URL}/cart/items/${product1._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ quantity: 2 }),
    });
    const updateQtyData = await updateQtyRes.json();
    assert(updateQtyRes.status === 200, 'PATCH /cart/items/:productId returns HTTP 200 OK');
    const p1UpdatedQty = updateQtyData.data.cart.items.find((i) => i.productId.toString() === product1._id.toString());
    assert(p1UpdatedQty.quantity === 2, 'Product 1 quantity updated to 2');
    assert(updateQtyData.data.cart.summary.totalItems === 3, 'Summary totalItems is 3 (2 + 1)');
    assert(updateQtyData.data.cart.summary.isValidForCheckout === true, 'Cart is valid for checkout again');

    // Setting quantity to 0 removes the item
    const updateQtyZeroRes = await fetch(`${BASE_URL}/cart/items/${product2._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ quantity: 0 }),
    });
    const updateQtyZeroData = await updateQtyZeroRes.json();
    assert(updateQtyZeroRes.status === 200, 'Setting quantity to 0 returns HTTP 200');
    assert(
      !updateQtyZeroData.data.cart.items.some((i) => i.productId.toString() === product2._id.toString()),
      'Setting quantity to 0 removes product from cart'
    );
    assert(updateQtyZeroData.data.cart.items.length === 1, 'Only Product 1 remains in cart');

    // ----------------------------------------------------
    // Test 10: Remove Item from Cart (DELETE /cart/items/:productId)
    // ----------------------------------------------------
    console.log('\n[10] Testing Removing Item from Cart...');
    const removeRes = await fetch(`${BASE_URL}/cart/items/${product1._id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    const removeData = await removeRes.json();
    assert(removeRes.status === 200, 'DELETE /cart/items/:productId returns HTTP 200 OK');
    assert(removeData.data.cart.items.length === 0, 'Cart is now empty after removing last item');

    // ----------------------------------------------------
    // Test 11: Clear Cart (DELETE /cart)
    // ----------------------------------------------------
    console.log('\n[11] Testing Clearing Cart...');
    // Add an item first
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: product1._id.toString(), quantity: 1 }),
    });
    // Clear cart
    const clearRes = await fetch(`${BASE_URL}/cart`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    const clearData = await clearRes.json();
    assert(clearRes.status === 200, 'DELETE /cart returns HTTP 200 OK');
    assert(clearData.data.cart.items.length === 0, 'Cart items cleared to 0');
    assert(clearData.data.cart.summary.finalTotal === 0, 'Cart finalTotal reset to 0');

    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    console.log('\n[Cleanup] Cleaning up test records...');
    await Cart.deleteOne({ user: customerUser._id });
    await User.deleteOne({ _id: customerUser._id });
    await Product.deleteMany({
      _id: { $in: [product1._id, product2._id, outOfStockProduct._id, inactiveProduct._id] },
    });
    await Category.deleteOne({ _id: testCat._id });

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
    console.error('Fatal error during cart test execution:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
