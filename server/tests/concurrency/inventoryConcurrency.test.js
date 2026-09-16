const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Category = require('../../src/models/Category');
const Product = require('../../src/models/Product');
const Cart = require('../../src/models/Cart');
const Order = require('../../src/models/Order');
const { connectDB, disconnectDB } = require('../../src/config/db');
const app = require('../../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runInventoryConcurrencyTest = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE CONCURRENCY SUITE: HIGH-CONTENTION CHECKOUT RACE');
  console.log('       (Simulating 10 Simultaneous Checkouts for 3 Items)');
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

  const testSuffix = Date.now();
  const NUM_USERS = 10;
  const INITIAL_STOCK = 3;

  try {
    await connectDB();

    try {
      const ping = await fetch(`${BASE_URL}/health`);
      if (!ping.ok) throw new Error('Not running');
    } catch {
      localServer = app.listen(PORT);
      await new Promise((res) => setTimeout(res, 500));
    }

    // ----------------------------------------------------
    // Step 1: Create Test Category & Product with Initial Stock = 3
    // ----------------------------------------------------
    console.log(`[1] Creating Test Product with strictly ${INITIAL_STOCK} units of inventory...`);
    const category = await Category.create({
      name: `Concurrency Category ${testSuffix}`,
      description: 'Category for high-concurrency race testing',
    });

    const product = await Product.create({
      name: `Ultra Rare Collector Item ${testSuffix}`,
      description: 'Limited edition item with strictly 3 units in existence',
      price: 5000,
      discount: 0,
      category: category._id,
      stock: INITIAL_STOCK,
      isActive: true,
      images: [{ url: 'https://ik.imagekit.io/test/rare.jpg', fileId: 'rare' }],
    });

    assert(product.stock === INITIAL_STOCK, `Product successfully created with initial stock = ${INITIAL_STOCK}`);

    // ----------------------------------------------------
    // Step 2: Create and Authenticate 10 Distinct Customers
    // ----------------------------------------------------
    console.log(`\n[2] Registering and Authenticating ${NUM_USERS} distinct customer sessions...`);
    const customerSessions = [];
    const password = 'Password123!';

    for (let i = 0; i < NUM_USERS; i++) {
      const email = `concurrent_user_${i}_${testSuffix}@shopsphere.test`;
      await User.create({
        name: `Concurrent User ${i}`,
        email,
        passwordHash: password,
        role: 'CUSTOMER',
      });

      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const rawCookie = loginRes.headers.get('set-cookie');
      const cookie = rawCookie ? rawCookie.split(';')[0] : '';
      const loginData = await loginRes.json();
      const userId = loginData.data.user._id;

      customerSessions.push({ index: i, email, userId, cookie });
    }

    assert(
      customerSessions.length === NUM_USERS && customerSessions.every((s) => s.cookie.length > 0),
      `Successfully generated active authenticated cookie sessions for all ${NUM_USERS} customers`
    );

    // ----------------------------------------------------
    // Step 3: Populate Each Customer's Cart with 1 Item
    // ----------------------------------------------------
    console.log(`\n[3] Adding 1 unit of the limited product to all ${NUM_USERS} customer carts...`);
    for (const session of customerSessions) {
      const addRes = await fetch(`${BASE_URL}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookie,
        },
        body: JSON.stringify({
          productId: product._id.toString(),
          quantity: 1,
        }),
      });

      const addData = await addRes.json();
      if (!addRes.ok) {
        throw new Error(`User ${session.index} failed to add to cart: ${addData.message}`);
      }
    }

    assert(true, `All ${NUM_USERS} customers have 1 unit in their active cart`);

    // Verify stock in database is still INITIAL_STOCK before checkout (items in cart do not reserve stock)
    const preCheckProduct = await Product.findById(product._id);
    assert(
      preCheckProduct.stock === INITIAL_STOCK,
      `Pre-checkout database stock remains ${INITIAL_STOCK} (cart presence does not lock stock)`
    );

    // ----------------------------------------------------
    // Step 4: Fire 10 Simultaneous Checkouts via Promise.all
    // ----------------------------------------------------
    console.log(`\n[4] FIRING ${NUM_USERS} SIMULTANEOUS CHECKOUT REQUESTS (RACE CONDITION SIMULATION)...`);

    const checkoutPayload = {
      shippingAddress: {
        fullName: 'Concurrent Buyer',
        phone: '9876543210',
        addressLine1: 'Race Condition Boulevard 404',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      },
    };

    const startTime = Date.now();

    // Dispatch all 10 checkouts simultaneously
    const checkoutResults = await Promise.all(
      customerSessions.map(async (session) => {
        try {
          const res = await fetch(`${BASE_URL}/orders/checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: session.cookie,
            },
            body: JSON.stringify(checkoutPayload),
          });

          const data = await res.json();
          return {
            userId: session.userId,
            index: session.index,
            status: res.status,
            data,
          };
        } catch (err) {
          return {
            userId: session.userId,
            index: session.index,
            status: 500,
            error: err.message,
          };
        }
      })
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`   --> All ${NUM_USERS} requests completed in ${elapsedMs}ms.`);

    // ----------------------------------------------------
    // Step 5: Assert Concurrency & Inventory Invariants
    // ----------------------------------------------------
    console.log('\n[5] Evaluating Concurrency Safety & Atomicity Invariants...');

    const successfulCheckouts = checkoutResults.filter((r) => r.status === 201);
    const rejectedCheckouts = checkoutResults.filter((r) => r.status === 409 || r.status === 400);

    console.log(`   - Successful Checkouts (HTTP 201): ${successfulCheckouts.length}`);
    console.log(`   - Rejected Checkouts (HTTP 409/400): ${rejectedCheckouts.length}`);

    // Invariant 1: Exactly INITIAL_STOCK orders succeed
    assert(
      successfulCheckouts.length === INITIAL_STOCK,
      `EXACTLY ${INITIAL_STOCK} checkouts succeeded with HTTP 201 Created`,
      `Actual successes: ${successfulCheckouts.length}`
    );

    // Invariant 2: Exactly (NUM_USERS - INITIAL_STOCK) orders fail
    assert(
      rejectedCheckouts.length === NUM_USERS - INITIAL_STOCK,
      `EXACTLY ${NUM_USERS - INITIAL_STOCK} checkouts were rejected due to stock exhaustion`,
      `Actual rejections: ${rejectedCheckouts.length}`
    );

    // Invariant 3: All rejected responses contain informative stock error codes
    const validErrorCodes = ['OUT_OF_STOCK', 'CART_STOCK_ISSUE'];
    const allRejectedHaveStockCode = rejectedCheckouts.every(
      (r) => validErrorCodes.includes(r.data?.code) || (r.data?.message && r.data.message.toLowerCase().includes('stock'))
    );
    assert(
      allRejectedHaveStockCode,
      'All rejected checkouts returned appropriate stock conflict or availability error codes'
    );

    // Invariant 4: Database Product stock is strictly 0 (never negative)
    const postCheckProduct = await Product.findById(product._id);
    console.log(`   - Final MongoDB Product Stock: ${postCheckProduct.stock}`);
    assert(
      postCheckProduct.stock === 0,
      'Final Product stock in MongoDB is strictly 0 (ZERO OVERSELLING INVARIANT)',
      `Actual stock: ${postCheckProduct.stock}`
    );
    assert(
      postCheckProduct.stock >= 0,
      'Final Product stock is NON-NEGATIVE (strictly stock >= 0)',
      `Actual stock: ${postCheckProduct.stock}`
    );

    // Invariant 5: Exactly INITIAL_STOCK orders exist in MongoDB for this product
    const ordersInDb = await Order.find({ 'items.product': product._id });
    assert(
      ordersInDb.length === INITIAL_STOCK,
      `Database contains exactly ${INITIAL_STOCK} Order documents referencing this product`,
      `Actual order count: ${ordersInDb.length}`
    );

    // Invariant 6: All created orders are in PENDING_PAYMENT with 15-minute TTL
    const allPendingWithTtl = ordersInDb.every(
      (o) => o.orderStatus === 'PENDING_PAYMENT' && Boolean(o.reservationExpiresAt)
    );
    assert(allPendingWithTtl, 'All successful orders are in PENDING_PAYMENT state with active 15-min TTL');

    // ----------------------------------------------------
    // Cleanup Fixtures
    // ----------------------------------------------------
    console.log('\n[6] Cleaning up test fixtures...');
    await Order.deleteMany({ 'items.product': product._id });
    await Cart.deleteMany({ user: { $in: customerSessions.map((s) => s.userId) } });
    await User.deleteMany({ _id: { $in: customerSessions.map((s) => s.userId) } });
    await Product.deleteOne({ _id: product._id });
    await Category.deleteOne({ _id: category._id });

    console.log('\n================================================================');
    console.log(`CONCURRENCY TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (localServer) localServer.close();
    await disconnectDB();

    return { suite: 'inventoryConcurrency', passed, failed };
  } catch (err) {
    console.error('Fatal error during inventory concurrency test run:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    return { suite: 'inventoryConcurrency', passed, failed: failed + 1 };
  }
};

if (require.main === module) {
  runInventoryConcurrencyTest().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runInventoryConcurrencyTest;
