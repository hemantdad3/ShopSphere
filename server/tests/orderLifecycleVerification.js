const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 8: ORDER LIFECYCLE & FULFILLMENT VERIFICATION');
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
    const adminEmail = `admin_cycle_${testSuffix}@shopsphere.com`;
    const aliceEmail = `alice_cycle_${testSuffix}@shopsphere.com`;
    const bobEmail = `bob_cycle_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const adminUser = await User.create({
      name: 'Store Administrator',
      email: adminEmail,
      passwordHash: password,
      role: 'ADMIN',
    });

    const aliceUser = await User.create({
      name: 'Alice Cycle',
      email: aliceEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const bobUser = await User.create({
      name: 'Bob Intruder',
      email: bobEmail,
      passwordHash: password,
      role: 'CUSTOMER',
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
    // 2. Setup Category & Test Products
    // -------------------------------------------------------------
    const category = await Category.create({
      name: `Cycle Cat ${testSuffix}`,
      slug: `cycle-cat-${testSuffix}`,
    });

    const productA = await Product.create({
      name: `Mechanical Keyboard ${testSuffix}`,
      description: 'High-performance mechanical keyboard with RGB backlighting',
      sku: `KB-${testSuffix}`,
      price: 5000,
      stock: 10,
      category: category._id,
      images: [{ url: 'https://images.example.com/kb.jpg', fileId: 'f1' }],
    });

    const productB = await Product.create({
      name: `Gaming Mouse ${testSuffix}`,
      description: 'Ergonomic wireless gaming mouse with optical sensor',
      sku: `MO-${testSuffix}`,
      price: 2500,
      stock: 5,
      category: category._id,
      images: [{ url: 'https://images.example.com/mouse.jpg', fileId: 'f2' }],
    });

    const shippingAddress = {
      fullName: 'Alice Cycle',
      phone: '9876543210',
      addressLine1: '42 Baker Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    };

    console.log('\n--- Test Group 1: PENDING_PAYMENT Order Cancellation & Restock ---');

    // 1. Alice adds Product A (qty: 2) to cart and checks out
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ productId: productA._id.toString(), quantity: 2 }),
    });

    const checkoutRes1 = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ shippingAddress }),
    });
    const checkoutData1 = await checkoutRes1.json();
    const order1Id = checkoutData1.data.order._id;

    assert(checkoutRes1.status === 201, 'Order 1 created in PENDING_PAYMENT state');

    // Verify stock reserved: Product A stock was 10, now 8
    const productAAfterCheckout = await Product.findById(productA._id);
    assert(
      productAAfterCheckout.stock === 8,
      'Inventory reserved upon checkout (stock: 10 -> 8)'
    );

    // 2. Validation rule: cancellation reason < 5 chars rejected
    const invalidCancelRes = await fetch(`${BASE_URL}/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'no' }),
    });
    assert(
      invalidCancelRes.status === 400,
      'Zod validation rejects cancellation reason shorter than 5 characters'
    );

    // 3. Customer Bob tries to cancel Alice's order -> 403 Forbidden
    const bobCancelRes = await fetch(`${BASE_URL}/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bobCookie },
      body: JSON.stringify({ reason: 'Malicious cancellation attempt by another user' }),
    });
    assert(
      bobCancelRes.status === 403,
      'Forbidden: Customer Bob cannot cancel Alice order'
    );

    // 4. Alice cancels her order with valid reason
    const validCancelRes = await fetch(`${BASE_URL}/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'Changed mind, want different model' }),
    });
    const validCancelData = await validCancelRes.json();

    assert(validCancelRes.status === 200, 'Alice successfully cancelled order 1');
    assert(
      validCancelData.data.order.orderStatus === 'CANCELLED',
      'Order 1 status changed to CANCELLED'
    );
    assert(
      validCancelData.data.order.paymentStatus === 'FAILED',
      'Unpaid order paymentStatus updated to FAILED'
    );
    assert(
      validCancelData.data.order.cancellationReason === 'Changed mind, want different model',
      'Cancellation reason recorded on order'
    );

    // Verify stock restored: Product A stock should be back to 10
    const productAAfterCancel = await Product.findById(productA._id);
    assert(
      productAAfterCancel.stock === 10,
      'Stock automatically restored upon cancellation (stock: 8 -> 10)'
    );

    // 5. Attempting to cancel already cancelled order returns 400 ALREADY_CANCELLED
    const repeatCancelRes = await fetch(`${BASE_URL}/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'Cancelling again should fail' }),
    });
    const repeatCancelData = await repeatCancelRes.json();
    assert(
      repeatCancelRes.status === 400 && repeatCancelData.code === 'ALREADY_CANCELLED',
      'Disallow redundant cancellation of ALREADY_CANCELLED order'
    );

    console.log('\n--- Test Group 2: Paid/CONFIRMED Order Cancellation & Refund ---');

    // 6. Alice checks out order 2 (Product A: qty 1, stock: 10 -> 9)
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ productId: productA._id.toString(), quantity: 1 }),
    });
    const checkoutRes2 = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ shippingAddress }),
    });
    const checkoutData2 = await checkoutRes2.json();
    const order2Id = checkoutData2.data.order._id;

    // Simulate successful payment confirmation
    await Order.findByIdAndUpdate(order2Id, {
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      paidAt: new Date(),
    });

    const stockBeforeCancel2 = (await Product.findById(productA._id)).stock;
    assert(stockBeforeCancel2 === 9, 'Stock reserved for order 2 (stock: 9)');

    // Alice cancels CONFIRMED & PAID order
    const cancelPaidRes = await fetch(`${BASE_URL}/orders/${order2Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'Ordered by mistake, requesting refund' }),
    });
    const cancelPaidData = await cancelPaidRes.json();

    assert(cancelPaidRes.status === 200, 'Alice cancelled CONFIRMED order');
    assert(
      cancelPaidData.data.order.orderStatus === 'CANCELLED',
      'Order 2 status is CANCELLED'
    );
    assert(
      cancelPaidData.data.order.paymentStatus === 'REFUNDED',
      'Payment status transitioned to REFUNDED'
    );
    assert(
      cancelPaidData.data.order.refundDetails &&
        cancelPaidData.data.order.refundDetails.status === 'PROCESSED' &&
        cancelPaidData.data.order.refundDetails.amount === cancelPaidData.data.order.totalAmount,
      'Refund details recorded with PROCESSED status and exact order amount'
    );

    const stockAfterCancel2 = (await Product.findById(productA._id)).stock;
    assert(
      stockAfterCancel2 === 10,
      'Stock restored after cancelling confirmed order (stock: 9 -> 10)'
    );

    console.log('\n--- Test Group 3: Admin Fulfillment Lifecycle (CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED) ---');

    // 7. Create Order 3 with Product B (stock: 5 -> 3, qty: 2)
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ productId: productB._id.toString(), quantity: 2 }),
    });
    const checkoutRes3 = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ shippingAddress }),
    });
    const checkoutData3 = await checkoutRes3.json();
    const order3Id = checkoutData3.data.order._id;

    // Simulate payment confirmation
    await Order.findByIdAndUpdate(order3Id, {
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      paidAt: new Date(),
    });

    // 8. Non-admin (Alice) tries to update order status -> 403 Forbidden
    const unauthStatusRes = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ status: 'PROCESSING' }),
    });
    assert(
      unauthStatusRes.status === 403,
      'Customer cannot call admin status update endpoint (403 Forbidden)'
    );

    // 9. Admin updates status to PROCESSING
    const toProcessingRes = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'PROCESSING' }),
    });
    const toProcessingData = await toProcessingRes.json();
    assert(
      toProcessingRes.status === 200 && toProcessingData.data.order.orderStatus === 'PROCESSING',
      'Admin successfully transitioned order to PROCESSING'
    );

    // 10. Customer tries to cancel while PROCESSING -> 400 ORDER_IN_PROCESSING
    const aliceCancelProcessingRes = await fetch(`${BASE_URL}/orders/${order3Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'Too late to cancel by customer' }),
    });
    const aliceCancelProcessingData = await aliceCancelProcessingRes.json();
    assert(
      aliceCancelProcessingRes.status === 400 &&
        aliceCancelProcessingData.code === 'ORDER_IN_PROCESSING',
      'Customer directly blocked from cancelling order in PROCESSING'
    );

    // 11. Admin updates status to SHIPPED with carrier and tracking info
    const toShippedRes = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        status: 'SHIPPED',
        carrier: 'BlueDart Express',
        trackingNumber: 'BD-987654321IN',
      }),
    });
    const toShippedData = await toShippedRes.json();
    assert(
      toShippedRes.status === 200 &&
        toShippedData.data.order.orderStatus === 'SHIPPED' &&
        toShippedData.data.order.carrier === 'BlueDart Express' &&
        toShippedData.data.order.trackingNumber === 'BD-987654321IN' &&
        toShippedData.data.order.shippedAt,
      'Admin transitioned order to SHIPPED with carrier, trackingNumber, and shippedAt timestamp'
    );

    // 12. Disallow cancellation once SHIPPED (both customer & admin)
    const customerCancelShippedRes = await fetch(`${BASE_URL}/orders/${order3Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
      body: JSON.stringify({ reason: 'Cancel shipped order' }),
    });
    const customerCancelShippedData = await customerCancelShippedRes.json();
    assert(
      customerCancelShippedRes.status === 400 &&
        customerCancelShippedData.code === 'CANNOT_CANCEL_SHIPPED_ORDER',
      'Customer blocked from cancelling SHIPPED order (CANNOT_CANCEL_SHIPPED_ORDER)'
    );

    // 13. Admin updates status to DELIVERED
    const toDeliveredRes = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    const toDeliveredData = await toDeliveredRes.json();
    assert(
      toDeliveredRes.status === 200 &&
        toDeliveredData.data.order.orderStatus === 'DELIVERED' &&
        toDeliveredData.data.order.deliveredAt,
      'Admin transitioned order to DELIVERED with deliveredAt timestamp'
    );

    console.log('\n--- Test Group 4: State Machine Protection (Disallow Illegal Transitions) ---');

    // 14. Disallow backward transitions from DELIVERED (e.g. back to PROCESSING or CONFIRMED)
    const backwardRes1 = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'PROCESSING' }),
    });
    assert(
      backwardRes1.status === 400,
      'State machine blocks backward transition from terminal DELIVERED to PROCESSING'
    );

    // 15. Disallow cancellation from DELIVERED
    const backwardRes2 = await fetch(`${BASE_URL}/orders/${order3Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      backwardRes2.status === 400,
      'State machine blocks cancellation transition from terminal DELIVERED state'
    );

    console.log('\n--- Test Group 5: Admin Global Order Listing & Filtering ---');

    // 16. Customer tries to access admin order list -> 403 Forbidden
    const unauthAdminListRes = await fetch(`${BASE_URL}/orders/admin/all`, {
      headers: { Cookie: aliceCookie },
    });
    assert(
      unauthAdminListRes.status === 403,
      'Customer forbidden from accessing admin all-orders list'
    );

    // 17. Admin accesses global order list
    const adminListRes = await fetch(`${BASE_URL}/orders/admin/all`, {
      headers: { Cookie: adminCookie },
    });
    const adminListData = await adminListRes.json();
    assert(
      adminListRes.status === 200 &&
        Array.isArray(adminListData.data.orders) &&
        adminListData.data.orders.length >= 3 &&
        adminListData.data.pagination &&
        adminListData.data.orders[0].customer &&
        adminListData.data.orders[0].customer.email,
      'Admin successfully retrieves all orders with populated customer data and pagination'
    );

    // 18. Admin filters by status=DELIVERED
    const adminFilterRes = await fetch(
      `${BASE_URL}/orders/admin/all?status=DELIVERED`,
      { headers: { Cookie: adminCookie } }
    );
    const adminFilterData = await adminFilterRes.json();
    const allAreDelivered = adminFilterData.data.orders.every(
      (o) => o.orderStatus === 'DELIVERED'
    );
    assert(
      adminFilterRes.status === 200 &&
        adminFilterData.data.orders.length >= 1 &&
        allAreDelivered,
      'Admin order list filters accurately by status=DELIVERED'
    );

    // 19. Admin filters by status=CANCELLED
    const adminFilterCancelledRes = await fetch(
      `${BASE_URL}/orders/admin/all?status=CANCELLED`,
      { headers: { Cookie: adminCookie } }
    );
    const adminFilterCancelledData = await adminFilterCancelledRes.json();
    const allAreCancelled = adminFilterCancelledData.data.orders.every(
      (o) => o.orderStatus === 'CANCELLED'
    );
    assert(
      adminFilterCancelledRes.status === 200 &&
        adminFilterCancelledData.data.orders.length >= 2 &&
        allAreCancelled,
      'Admin order list filters accurately by status=CANCELLED'
    );

    // -------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------
    await Order.deleteMany({ _id: { $in: [order1Id, order2Id, order3Id] } });
    await Cart.deleteMany({ user: { $in: [aliceUser._id, bobUser._id, adminUser._id] } });
    await Product.deleteMany({ _id: { $in: [productA._id, productB._id] } });
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
