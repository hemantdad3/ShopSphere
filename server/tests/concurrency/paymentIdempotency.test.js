const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const crypto = require('crypto');
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

const runPaymentIdempotencyTest = async () => {
  console.log('\n================================================================');
  console.log('  SHOPSPHERE CONCURRENCY SUITE: PAYMENT IDEMPOTENCY LOCK RACE');
  console.log('   (Simultaneous Client Verification Callback & Gateway Webhook)');
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
    // Step 1: Create Test Customer, Category, Product
    // ----------------------------------------------------
    console.log('[1] Setting up customer, product, and initial inventory...');
    const customerEmail = `idem_buyer_${testSuffix}@shopsphere.test`;
    const password = 'Password123!';

    const customer = await User.create({
      name: 'Idempotent Buyer',
      email: customerEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    const category = await Category.create({
      name: `Idempotency Category ${testSuffix}`,
      description: 'Category for payment lock tests',
    });

    const INITIAL_STOCK = 10;
    const product = await Product.create({
      name: `High Tech Smartwatch ${testSuffix}`,
      description: 'Smartwatch for concurrency testing',
      price: 12000,
      discount: 0,
      category: category._id,
      stock: INITIAL_STOCK,
      isActive: true,
      images: [{ url: 'https://ik.imagekit.io/test/watch.jpg', fileId: 'watch' }],
    });

    // Authenticate customer
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password }),
    });
    const rawCookie = loginRes.headers.get('set-cookie');
    const authCookie = rawCookie ? rawCookie.split(';')[0] : '';
    assert(Boolean(authCookie), 'Customer authenticated with active cookie');

    // ----------------------------------------------------
    // Step 2: Add Product to Cart & Checkout (Order in PENDING_PAYMENT)
    // ----------------------------------------------------
    console.log('\n[2] Executing checkout to generate PENDING_PAYMENT order...');
    await fetch(`${BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ productId: product._id.toString(), quantity: 1 }),
    });

    const checkoutRes = await fetch(`${BASE_URL}/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        shippingAddress: {
          fullName: 'Idempotent Buyer',
          phone: '9876543210',
          addressLine1: 'Lock Avenue 101',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India',
        },
      }),
    });

    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.status === 201, 'Checkout succeeded and created order (HTTP 201)');
    const order = checkoutData.data.order;
    assert(order.orderStatus === 'PENDING_PAYMENT', 'Order initialized in PENDING_PAYMENT state');
    assert(order.paymentStatus === 'PENDING', 'Order initialized with paymentStatus PENDING');

    // Verify stock decremented by 1 upon reservation
    const stockAfterCheckout = (await Product.findById(product._id)).stock;
    assert(
      stockAfterCheckout === INITIAL_STOCK - 1,
      `Stock reserved down to ${INITIAL_STOCK - 1} (${INITIAL_STOCK} - 1)`
    );

    // ----------------------------------------------------
    // Step 3: Initiate Payment to link Razorpay Order ID
    // ----------------------------------------------------
    console.log('\n[3] Initiating Razorpay payment session...');
    const initRes = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ orderId: order._id }),
    });
    const initData = await initRes.json();
    assert(initRes.status === 200, 'POST /payments/initiate returns HTTP 200');
    const rzpOrderId = initData.data.payment.razorpayOrderId;
    assert(Boolean(rzpOrderId), 'Razorpay Order ID generated and linked');

    // ----------------------------------------------------
    // Step 4: Prepare Simultaneous Verification & Webhook Payloads
    // ----------------------------------------------------
    console.log('\n[4] Preparing cryptographically signed Client & Webhook payloads...');
    const rzpPaymentId = `pay_race_${testSuffix}`;

    // A. Generate Client Verification Signature (HMAC SHA256 of `order_id|payment_id`)
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_razorpay_secret';
    const clientPayloadText = `${rzpOrderId}|${rzpPaymentId}`;
    const clientSignature = crypto.createHmac('sha256', keySecret).update(clientPayloadText).digest('hex');

    // B. Generate Webhook Event Payload & Webhook Signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
    const webhookEventPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_idempotency_test',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            entity: 'payment',
            amount: 1200000,
            currency: 'INR',
            status: 'captured',
            order_id: rzpOrderId,
            method: 'card',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });
    const webhookSignature = crypto.createHmac('sha256', webhookSecret).update(webhookEventPayload).digest('hex');

    // ----------------------------------------------------
    // Step 5: DISPATCH SIMULTANEOUS PAYMENT FINALIZATION (RACE CONDITION)
    // ----------------------------------------------------
    console.log('\n[5] FIRING SIMULTANEOUS CLIENT VERIFY & GATEWAY WEBHOOK (RACE)...');

    const [clientRes, webhookRes] = await Promise.all([
      // Path 1: Client redirect verification
      fetch(`${BASE_URL}/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: authCookie },
        body: JSON.stringify({
          orderId: order._id,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: clientSignature,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json(), source: 'CLIENT' })),

      // Path 2: Razorpay server-to-server webhook
      fetch(`${BASE_URL}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': webhookSignature,
        },
        body: webhookEventPayload,
      }).then(async (r) => ({ status: r.status, data: await r.json(), source: 'WEBHOOK' })),
    ]);

    console.log(`   - Client Verify HTTP Response: ${clientRes.status}`);
    console.log(`   - Gateway Webhook HTTP Response: ${webhookRes.status}`);

    assert(clientRes.status === 200, 'Client verification endpoint returned HTTP 200 OK');
    assert(webhookRes.status === 200, 'Webhook reconciliation endpoint returned HTTP 200 OK');

    // ----------------------------------------------------
    // Step 6: Verify Atomic Idempotency Invariants in MongoDB
    // ----------------------------------------------------
    console.log('\n[6] Verifying Database State & Idempotency Guarantees...');

    const finalizedOrder = await Order.findById(order._id);
    assert(finalizedOrder.orderStatus === 'CONFIRMED', 'Order transitioned to CONFIRMED');
    assert(finalizedOrder.paymentStatus === 'PAID', 'Order transitioned to PAID');
    assert(Boolean(finalizedOrder.paidAt), 'paidAt timestamp successfully recorded');
    assert(
      finalizedOrder.paymentDetails.razorpayPaymentId === rzpPaymentId,
      'Razorpay payment ID accurately recorded'
    );

    // Verify stock was NOT decremented again during payment finalization
    const stockAfterPayment = (await Product.findById(product._id)).stock;
    assert(
      stockAfterPayment === stockAfterCheckout,
      `Inventory stock remained stable at ${stockAfterCheckout} (no double decrement during payment finalization)`
    );

    // ----------------------------------------------------
    // Step 7: Test Replay Attack / Subsequent Redundant Verify Call
    // ----------------------------------------------------
    console.log('\n[7] Testing Redundant Replay Verification Call...');
    const replayRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        orderId: order._id,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: clientSignature,
      }),
    });

    const replayData = await replayRes.json();
    assert(replayRes.status === 200, 'Redundant verification call succeeds gracefully (HTTP 200)');
    assert(
      replayData.data.alreadyProcessed === true,
      'Redundant verification explicitly returns alreadyProcessed: true (Idempotency Proof)'
    );

    // ----------------------------------------------------
    // Cleanup Fixtures
    // ----------------------------------------------------
    console.log('\n[8] Cleaning up test fixtures...');
    await Order.deleteOne({ _id: order._id });
    await Cart.deleteOne({ user: customer._id });
    await User.deleteOne({ _id: customer._id });
    await Product.deleteOne({ _id: product._id });
    await Category.deleteOne({ _id: category._id });

    console.log('\n================================================================');
    console.log(`PAYMENT IDEMPOTENCY TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (localServer) localServer.close();
    await disconnectDB();

    return { suite: 'paymentIdempotency', passed, failed };
  } catch (err) {
    console.error('Fatal error during payment idempotency test run:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    return { suite: 'paymentIdempotency', passed, failed: failed + 1 };
  }
};

if (require.main === module) {
  runPaymentIdempotencyTest().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runPaymentIdempotencyTest;
