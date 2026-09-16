const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 10: ADMIN DASHBOARD & METRICS VERIFICATION');
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
    // 1. Setup Users: Admin, Customer Alice, Customer Bob
    // -------------------------------------------------------------
    const adminEmail = `admin_dash_${testSuffix}@shopsphere.com`;
    const aliceEmail = `alice_dash_${testSuffix}@shopsphere.com`;
    const bobEmail = `bob_dash_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const adminUser = await User.create({
      name: 'Executive Admin',
      email: adminEmail,
      passwordHash: password,
      role: 'ADMIN',
    });

    const aliceUser = await User.create({
      name: 'Alice Shopper',
      email: aliceEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const bobUser = await User.create({
      name: 'Bob Buyer',
      email: bobEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    // Login Admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie');

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

    assert(
      adminCookie && aliceCookie && bobCookie,
      'Admin and customer test accounts authenticated with cookies'
    );

    // -------------------------------------------------------------
    // 2. Setup Category & Test Products (Normal, Low Stock, Out of Stock)
    // -------------------------------------------------------------
    const category = await Category.create({
      name: `Dashboard Cat ${testSuffix}`,
      slug: `dashboard-cat-${testSuffix}`,
    });

    const normalProduct = await Product.create({
      name: `Normal Stock Item ${testSuffix}`,
      description: 'Healthy inventory item with ample units in stock',
      sku: `NORM-${testSuffix}`,
      price: 3000,
      stock: 25,
      category: category._id,
      images: [{ url: 'https://images.example.com/norm.jpg', fileId: 'norm_1' }],
    });

    const lowStockProduct = await Product.create({
      name: `Low Stock Item ${testSuffix}`,
      description: 'Item nearing depletion requiring warehouse reorder',
      sku: `LOW-${testSuffix}`,
      price: 1500,
      stock: 3,
      category: category._id,
      images: [{ url: 'https://images.example.com/low.jpg', fileId: 'low_1' }],
    });

    const outOfStockProduct = await Product.create({
      name: `Out of Stock Item ${testSuffix}`,
      description: 'Item completely depleted and out of inventory',
      sku: `OOS-${testSuffix}`,
      price: 800,
      stock: 0,
      category: category._id,
      images: [{ url: 'https://images.example.com/oos.jpg', fileId: 'oos_1' }],
    });

    // -------------------------------------------------------------
    // 3. Setup Test Orders
    // -------------------------------------------------------------
    const shippingAddress = {
      fullName: 'Alice Shopper',
      phone: '9876543210',
      addressLine1: '500 Tech Blvd',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
    };

    // Order 1: Alice, DELIVERED, PAID, 3000
    const order1 = await Order.create({
      orderNumber: `ORD-DASH-${testSuffix}-1`,
      customer: aliceUser._id,
      items: [
        {
          product: normalProduct._id,
          name: normalProduct.name,
          price: 3000,
          finalPrice: 3000,
          quantity: 1,
          lineTotal: 3000,
        },
      ],
      shippingAddress,
      subtotal: 3000,
      totalAmount: 3000,
      orderStatus: 'DELIVERED',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      deliveredAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Order 2: Bob, CONFIRMED, PAID, 6000
    const order2 = await Order.create({
      orderNumber: `ORD-DASH-${testSuffix}-2`,
      customer: bobUser._id,
      items: [
        {
          product: normalProduct._id,
          name: normalProduct.name,
          price: 3000,
          finalPrice: 3000,
          quantity: 2,
          lineTotal: 6000,
        },
      ],
      shippingAddress: { ...shippingAddress, fullName: 'Bob Buyer' },
      subtotal: 6000,
      totalAmount: 6000,
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Order 3: Alice, PENDING_PAYMENT, PENDING, 1500 (Unpaid)
    const order3 = await Order.create({
      orderNumber: `ORD-DASH-${testSuffix}-3`,
      customer: aliceUser._id,
      items: [
        {
          product: lowStockProduct._id,
          name: lowStockProduct.name,
          price: 1500,
          finalPrice: 1500,
          quantity: 1,
          lineTotal: 1500,
        },
      ],
      shippingAddress,
      subtotal: 1500,
      totalAmount: 1500,
      orderStatus: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    console.log('\n--- Test Group 1: Strict RBAC Protection on Admin Endpoints ---');

    // Customer Alice tries to call admin dashboard
    const aliceDashRes = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Cookie: aliceCookie },
    });
    assert(
      aliceDashRes.status === 403,
      'Customer calling GET /api/admin/dashboard blocked with 403 Forbidden'
    );

    // Customer Bob tries to call admin user directory
    const bobUsersRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Cookie: bobCookie },
    });
    assert(
      bobUsersRes.status === 403,
      'Customer calling GET /api/admin/users blocked with 403 Forbidden'
    );

    // Customer Alice tries to call low-stock inventory
    const aliceLowStockRes = await fetch(`${BASE_URL}/admin/inventory/low-stock`, {
      headers: { Cookie: aliceCookie },
    });
    assert(
      aliceLowStockRes.status === 403,
      'Customer calling GET /api/admin/inventory/low-stock blocked with 403 Forbidden'
    );

    // Customer Bob tries to update order status via admin route
    const bobUpdateRes = await fetch(`${BASE_URL}/admin/orders/${order2._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ status: 'PROCESSING' }),
    });
    assert(
      bobUpdateRes.status === 403,
      'Customer calling PATCH /api/admin/orders/:id/status blocked with 403 Forbidden'
    );

    console.log('\n--- Test Group 2: Executive Dashboard Metrics ($facet Aggregation) ---');

    const adminDashRes = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Cookie: adminCookie },
    });
    const adminDashData = await adminDashRes.json();

    assert(
      adminDashRes.status === 200 && adminDashData.success,
      'Admin successfully retrieves executive dashboard metrics'
    );

    const { revenue, orders, inventory, customers } = adminDashData.data.metrics;

    // Revenue assertions
    assert(
      revenue && revenue.total >= 9000 && revenue.today >= 9000 && revenue.month >= 9000,
      'Revenue metrics aggregate paid orders accurately (total >= 9000 INR)'
    );

    // Order metrics assertions
    assert(
      orders &&
        orders.total >= 3 &&
        orders.breakdown.DELIVERED >= 1 &&
        orders.breakdown.CONFIRMED >= 1 &&
        orders.breakdown.PENDING_PAYMENT >= 1,
      'Order distribution breakdown reports exact counts across statuses'
    );

    assert(
      Array.isArray(orders.recent) &&
        orders.recent.length >= 3 &&
        orders.recent[0].orderNumber &&
        orders.recent[0].customer &&
        orders.recent[0].customer.email,
      'Recent orders list populated with order numbers and customer profiles'
    );

    // Inventory metrics assertions
    assert(
      inventory &&
        inventory.totalProducts >= 3 &&
        inventory.lowStockCount >= 1 &&
        inventory.outOfStockCount >= 1,
      'Inventory metrics correctly track low-stock (<=5) and out-of-stock (0) counts'
    );

    // Customer metrics assertions
    assert(
      customers &&
        customers.totalCustomers >= 2 &&
        customers.newSignupsLast30Days >= 2,
      'Customer analytics track total customer accounts and recent 30-day signups'
    );

    console.log('\n--- Test Group 3: Low-Stock Inventory API ---');

    const lowStockRes = await fetch(`${BASE_URL}/admin/inventory/low-stock?threshold=5`, {
      headers: { Cookie: adminCookie },
    });
    const lowStockData = await lowStockRes.json();

    assert(
      lowStockRes.status === 200 && Array.isArray(lowStockData.data.products),
      'Admin retrieves low-stock inventory list'
    );

    const lowStockIds = lowStockData.data.products.map((p) => p._id.toString());
    assert(
      lowStockIds.includes(lowStockProduct._id.toString()) &&
        lowStockIds.includes(outOfStockProduct._id.toString()) &&
        !lowStockIds.includes(normalProduct._id.toString()),
      'Low-stock list includes depleted/low products (stock <= 5) and excludes healthy products'
    );

    console.log('\n--- Test Group 4: Customer Administration & Spend Aggregation ---');

    const usersRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    const usersData = await usersRes.json();

    assert(
      usersRes.status === 200 &&
        Array.isArray(usersData.data.customers) &&
        usersData.data.pagination &&
        usersData.data.pagination.total >= 2,
      'Admin retrieves paginated registered customer directory'
    );

    const aliceRecord = usersData.data.customers.find(
      (u) => u._id.toString() === aliceUser._id.toString()
    );
    const bobRecord = usersData.data.customers.find(
      (u) => u._id.toString() === bobUser._id.toString()
    );

    assert(
      aliceRecord && aliceRecord.totalOrders === 2 && aliceRecord.totalSpent === 3000,
      'Customer Alice metrics aggregated accurately: 2 total orders, 3000 INR paid spend'
    );

    assert(
      bobRecord && bobRecord.totalOrders === 1 && bobRecord.totalSpent === 6000,
      'Customer Bob metrics aggregated accurately: 1 total order, 6000 INR paid spend'
    );

    console.log('\n--- Test Group 5: Fulfillment Operations via Admin Route ---');

    // Transition Order 2 from CONFIRMED -> PROCESSING
    const toProcessingRes = await fetch(`${BASE_URL}/admin/orders/${order2._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'PROCESSING' }),
    });
    const toProcessingData = await toProcessingRes.json();
    assert(
      toProcessingRes.status === 200 &&
        toProcessingData.data.order.orderStatus === 'PROCESSING',
      'Admin transitions order from CONFIRMED to PROCESSING via admin route'
    );

    // Transition Order 2 from PROCESSING -> SHIPPED with carrier & tracking
    const toShippedRes = await fetch(`${BASE_URL}/admin/orders/${order2._id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        status: 'SHIPPED',
        carrier: 'Delhivery Surface',
        trackingNumber: `DLH-${testSuffix}`,
      }),
    });
    const toShippedData = await toShippedRes.json();
    assert(
      toShippedRes.status === 200 &&
        toShippedData.data.order.orderStatus === 'SHIPPED' &&
        toShippedData.data.order.carrier === 'Delhivery Surface' &&
        toShippedData.data.order.trackingNumber === `DLH-${testSuffix}`,
      'Admin transitions order to SHIPPED with carrier and trackingNumber'
    );

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    await Order.deleteMany({ _id: { $in: [order1._id, order2._id, order3._id] } });
    await Product.deleteMany({ _id: { $in: [normalProduct._id, lowStockProduct._id, outOfStockProduct._id] } });
    await Category.deleteMany({ _id: category._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, aliceUser._id, bobUser._id] } });
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
