const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const { connectDB, disconnectDB } = require('../src/config/db');
const {
  generateMockSignature,
  generateMockWebhookSignature,
} = require('../src/services/razorpayService');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 7: RAZORPAY PAYMENT & WEBHOOK RECONCILIATION');
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

    // 1. Setup Customers Alice & Bob
    const aliceEmail = `alice_pay_${testSuffix}@shopsphere.com`;
    const bobEmail = `bob_pay_${testSuffix}@shopsphere.com`;
    const password = 'Password123!';

    const alice = await User.create({
      name: 'Alice Payer',
      email: aliceEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const bob = await User.create({
      name: 'Bob Intruder',
      email: bobEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const loginAliceRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, password }),
    });
    const cookieAlice = loginAliceRes.headers.get('set-cookie')?.split(';')[0];

    const loginBobRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bobEmail, password }),
    });
    const cookieBob = loginBobRes.headers.get('set-cookie')?.split(';')[0];

    // Setup Category & Product
    const category = await Category.create({
      name: `Payment Category ${testSuffix}`,
      description: 'Category for payment testing',
    });

    const product = await Product.create({
      name: `Premium Keyboard ${testSuffix}`,
      description: 'High end mechanical keyboard',
      price: 10000,
      discount: 10, // finalPrice = 9000
      category: category._id,
      stock: 10,
      images: [{ url: 'https://ik.imagekit.io/test/kb.jpg', fileId: 'kb' }],
    });

    const validAddress = {
      fullName: 'Alice Payer',
      phone: '9876543210',
      addressLine1: '123 Residency Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560025',
      country: 'India',
    };

    // Helper: Checkout an order for Alice
    const createOrderForAlice = async (qty = 1) => {
      // Clear cart
      await Cart.findOneAndUpdate({ user: alice._id }, { items: [] }, { upsert: true });
      // Add to cart
      await fetch(`${BASE_URL}/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
        body: JSON.stringify({ productId: product._id.toString(), quantity: qty }),
      });
      // Checkout
      const res = await fetch(`${BASE_URL}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
        body: JSON.stringify({ shippingAddress: validAddress }),
      });
      const data = await res.json();
      return data.data.order;
    };

    // ----------------------------------------------------
    // Test 1: Authentication Guards
    // ----------------------------------------------------
    console.log('[1] Testing Payment Authentication Guards...');
    const unauthInitRes = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: new mongoose.Types.ObjectId().toString() }),
    });
    assert(unauthInitRes.status === 401, 'POST /payments/initiate without token returns HTTP 401');

    const unauthVerifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: new mongoose.Types.ObjectId().toString(),
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'sig_1',
      }),
    });
    assert(unauthVerifyRes.status === 401, 'POST /payments/verify without token returns HTTP 401');

    // ----------------------------------------------------
    // Test 2: Payment Initiation & Paise Conversion
    // ----------------------------------------------------
    console.log('\n[2] Testing Payment Initiation & Paise Conversion...');
    const order1 = await createOrderForAlice(2); // 2 * 9000 = 18000 INR
    assert(order1.totalAmount === 18000, 'Order 1 total is 18000 INR');

    const initRes = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({ orderId: order1._id }),
    });
    const initData = await initRes.json();
    assert(initRes.status === 200, 'POST /payments/initiate returns HTTP 200 OK');
    assert(initData.data.payment.amount === 1800000, 'Amount correctly converted to paise (18000 * 100 = 1,800,000)');
    assert(initData.data.payment.currency === 'INR', 'Currency is INR');
    assert(Boolean(initData.data.payment.razorpayOrderId), 'Razorpay Order ID is generated');
    assert(Boolean(initData.data.payment.keyId), 'Public keyId returned for client checkout');

    // Verify order in MongoDB has razorpayOrderId saved
    const updatedOrder1 = await Order.findById(order1._id);
    assert(
      updatedOrder1.paymentDetails.razorpayOrderId === initData.data.payment.razorpayOrderId,
      'razorpayOrderId persisted to Order document in MongoDB'
    );

    const rzpOrderId1 = initData.data.payment.razorpayOrderId;

    // Cross-customer access check: Bob cannot pay for Alice's order
    const bobPayAliceRes = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieBob },
      body: JSON.stringify({ orderId: order1._id }),
    });
    assert(bobPayAliceRes.status === 403, 'Bob paying for Alice order returns HTTP 403 Forbidden');

    // ----------------------------------------------------
    // Test 3: Client Payment Verification (HMAC SHA256 Signature Check)
    // ----------------------------------------------------
    console.log('\n[3] Testing Client Callback Signature Verification (Happy Path)...');
    const rzpPaymentId1 = `pay_${Date.now()}_abc`;
    const validSignature1 = generateMockSignature(rzpOrderId1, rzpPaymentId1);

    const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({
        orderId: order1._id,
        razorpayOrderId: rzpOrderId1,
        razorpayPaymentId: rzpPaymentId1,
        razorpaySignature: validSignature1,
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, 'POST /payments/verify returns HTTP 200 OK');
    assert(verifyData.data.order.orderStatus === 'CONFIRMED', 'Order status transitioned to CONFIRMED');
    assert(verifyData.data.order.paymentStatus === 'PAID', 'Payment status transitioned to PAID');
    assert(Boolean(verifyData.data.order.paidAt), 'paidAt timestamp recorded');
    assert(
      verifyData.data.order.paymentDetails.razorpayPaymentId === rzpPaymentId1,
      'Payment ID recorded on order'
    );

    // ----------------------------------------------------
    // Test 4: Cryptographic Signature Tampering Defense
    // ----------------------------------------------------
    console.log('\n[4] Testing Cryptographic Signature Tampering Defense...');
    const order2 = await createOrderForAlice(1);
    const init2Res = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({ orderId: order2._id }),
    });
    const init2Data = await init2Res.json();
    const rzpOrderId2 = init2Data.data.payment.razorpayOrderId;
    const rzpPaymentId2 = `pay_${Date.now()}_tamper`;

    // Send forged signature
    const forgedSignature = 'bad_forged_hex_signature_9999999999999999999999999999999999999999999999999999999999999999';
    const tamperedRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({
        orderId: order2._id,
        razorpayOrderId: rzpOrderId2,
        razorpayPaymentId: rzpPaymentId2,
        razorpaySignature: forgedSignature,
      }),
    });
    const tamperedData = await tamperedRes.json();
    assert(tamperedRes.status === 400, 'Forged signature rejected with HTTP 400 Bad Request');
    assert(tamperedData.code === 'INVALID_SIGNATURE', 'Error code is INVALID_SIGNATURE');

    // Confirm Order in DB was NOT marked as PAID
    const order2AfterTamper = await Order.findById(order2._id);
    assert(order2AfterTamper.paymentStatus === 'PENDING', 'Payment status remains PENDING in MongoDB');
    assert(order2AfterTamper.orderStatus === 'PENDING_PAYMENT', 'Order status remains PENDING_PAYMENT');

    // ----------------------------------------------------
    // Test 5: Asynchronous Webhook Reconciliation
    // ----------------------------------------------------
    console.log('\n[5] Testing Asynchronous Webhook Reconciliation...');
    const order3 = await createOrderForAlice(1);
    const init3Res = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({ orderId: order3._id }),
    });
    const init3Data = await init3Res.json();
    const rzpOrderId3 = init3Data.data.payment.razorpayOrderId;
    const rzpPaymentId3 = `pay_webhook_${Date.now()}`;

    // Construct legitimate Razorpay Webhook event payload
    const webhookPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test_123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId3,
            entity: 'payment',
            amount: 900000,
            currency: 'INR',
            status: 'captured',
            order_id: rzpOrderId3,
            method: 'upi',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const webhookSignature = generateMockWebhookSignature(webhookPayload);

    // Send Webhook request
    const webhookRes = await fetch(`${BASE_URL}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': webhookSignature,
      },
      body: webhookPayload,
    });
    const webhookData = await webhookRes.json();
    assert(webhookRes.status === 200, 'Webhook returns HTTP 200 OK');
    assert(webhookData.status === 'success', 'Webhook response reports success');

    // Verify order was reconciled to CONFIRMED and PAID
    const order3AfterWebhook = await Order.findById(order3._id);
    assert(order3AfterWebhook.orderStatus === 'CONFIRMED', 'Order reconciled to CONFIRMED via webhook');
    assert(order3AfterWebhook.paymentStatus === 'PAID', 'Order paymentStatus reconciled to PAID');
    assert(
      order3AfterWebhook.paymentDetails.razorpayPaymentId === rzpPaymentId3,
      'Webhook paymentId recorded on order'
    );

    // Invalid Webhook Signature rejection
    const badWebhookRes = await fetch(`${BASE_URL}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_forged_webhook_signature',
      },
      body: webhookPayload,
    });
    assert(badWebhookRes.status === 400, 'Forged webhook signature rejected with HTTP 400');

    // ----------------------------------------------------
    // Test 6: Dual-Path Concurrency & Idempotency Lock
    // ----------------------------------------------------
    console.log('\n[6] Testing Dual-Path Concurrency & Idempotency Lock...');
    const order4 = await createOrderForAlice(1);
    const init4Res = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({ orderId: order4._id }),
    });
    const init4Data = await init4Res.json();
    const rzpOrderId4 = init4Data.data.payment.razorpayOrderId;
    const rzpPaymentId4 = `pay_race_${Date.now()}`;

    const clientSig4 = generateMockSignature(rzpOrderId4, rzpPaymentId4);

    const raceWebhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId4,
            order_id: rzpOrderId4,
          },
        },
      },
    });
    const webhookSig4 = generateMockWebhookSignature(raceWebhookPayload);

    // Client verification and Webhook fire simultaneously
    const [clientRaceRes, webhookRaceRes] = await Promise.all([
      fetch(`${BASE_URL}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
        body: JSON.stringify({
          orderId: order4._id,
          razorpayOrderId: rzpOrderId4,
          razorpayPaymentId: rzpPaymentId4,
          razorpaySignature: clientSig4,
        }),
      }),
      fetch(`${BASE_URL}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': webhookSig4,
        },
        body: raceWebhookPayload,
      }),
    ]);

    assert(clientRaceRes.status === 200, 'Client verification in race returns HTTP 200');
    assert(webhookRaceRes.status === 200, 'Webhook in race returns HTTP 200');

    // Verify order is cleanly CONFIRMED and exactly PAID
    const order4Final = await Order.findById(order4._id);
    assert(order4Final.orderStatus === 'CONFIRMED', 'Order is CONFIRMED without duplicate transition');
    assert(order4Final.paymentStatus === 'PAID', 'Payment status is PAID');

    // ----------------------------------------------------
    // Test 7: Payment Failure & Inventory Restock
    // ----------------------------------------------------
    console.log('\n[7] Testing Payment Failure & Immediate Inventory Restock...');
    // Initial product stock before order
    const prodBeforeOrder = await Product.findById(product._id);
    const initialStock = prodBeforeOrder.stock;

    // Create order for 2 units (stock will drop by 2)
    const orderFail = await createOrderForAlice(2);
    const prodAfterReserve = await Product.findById(product._id);
    assert(prodAfterReserve.stock === initialStock - 2, 'Stock dropped by 2 after checkout reservation');

    // Customer cancels payment
    const failRes = await fetch(`${BASE_URL}/payments/failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAlice },
      body: JSON.stringify({
        orderId: orderFail._id,
        reason: 'Payment modal closed by user',
      }),
    });
    assert(failRes.status === 200, 'POST /payments/failure returns HTTP 200 OK');

    // Verify order transitioned to CANCELLED / FAILED
    const cancelledOrder = await Order.findById(orderFail._id);
    assert(cancelledOrder.orderStatus === 'CANCELLED', 'Order status marked CANCELLED');
    assert(cancelledOrder.paymentStatus === 'FAILED', 'Payment status marked FAILED');
    assert(
      cancelledOrder.cancellationReason.includes('modal closed'),
      'Cancellation reason recorded accurately'
    );

    // INVENTORY RESTOCK CHECK: Product stock must be restored back to initialStock!
    const prodAfterRestock = await Product.findById(product._id);
    assert(
      prodAfterRestock.stock === initialStock,
      `Product stock immediately restored back to ${initialStock}`
    );

    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    console.log('\n[Cleanup] Cleaning up test records...');
    await Order.deleteMany({ customer: { $in: [alice._id, bob._id] } });
    await Cart.deleteMany({ user: { $in: [alice._id, bob._id] } });
    await User.deleteMany({ _id: { $in: [alice._id, bob._id] } });
    await Product.deleteOne({ _id: product._id });
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
    console.error('Fatal error during payment verification:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
