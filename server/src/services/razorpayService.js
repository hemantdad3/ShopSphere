const crypto = require('crypto');
const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';

const isLiveConfigured = Boolean(
  keyId &&
  keySecret &&
  !keyId.includes('xxxx') &&
  !keyId.includes('your_') &&
  !keySecret.includes('xxxx')
);

let razorpayInstance = null;

if (isLiveConfigured) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    console.log('[RazorpayService] Initialized with live Razorpay credentials.');
  } catch (err) {
    console.warn('[RazorpayService ⚠️] Failed to initialize live Razorpay SDK, falling back to mock adapter:', err.message);
  }
} else {
  console.log('[RazorpayService] Running in development mock adapter mode.');
}

/**
 * Get public Razorpay Key ID for client checkout modal
 */
const getKeyId = () => {
  return isLiveConfigured && razorpayInstance ? keyId : 'rzp_test_mock_key_id';
};

/**
 * Create an order on Razorpay with amount specified in paise
 *
 * @param {number} amountInPaise - Order total in paise (e.g. ₹100 = 10000 paise)
 * @param {string} receipt - Internal order reference (orderNumber)
 * @returns {Promise<object>} Created Razorpay order
 */
const createRazorpayOrder = async (amountInPaise, receipt) => {
  if (isLiveConfigured && razorpayInstance) {
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
    };
    return razorpayInstance.orders.create(options);
  }

  // Development Mock Adapter
  return {
    id: `order_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    entity: 'order',
    amount: amountInPaise,
    amount_paid: 0,
    amount_due: amountInPaise,
    currency: 'INR',
    receipt,
    status: 'created',
    attempts: 0,
    created_at: Math.floor(Date.now() / 1000),
  };
};

/**
 * Cryptographically verify Razorpay client payment signature using HMAC SHA256.
 * Uses timing-safe buffer comparison to defend against timing attacks.
 *
 * @param {string} razorpayOrderId
 * @param {string} razorpayPaymentId
 * @param {string} razorpaySignature
 * @returns {boolean} True if signature is cryptographically valid
 */
const verifySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const secret = keySecret || 'mock_razorpay_secret';
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(text).digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(razorpaySignature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

/**
 * Cryptographically verify Razorpay Webhook HMAC SHA256 signature against the raw body.
 *
 * @param {string} rawBody - Raw unparsed HTTP request body string
 * @param {string} signatureHeader - Value of 'x-razorpay-signature' header
 * @returns {boolean} True if webhook signature is genuine
 */
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!rawBody || !signatureHeader) {
    return false;
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

/**
 * Test Helper: Generate a valid signature for mock client verification
 */
const generateMockSignature = (razorpayOrderId, razorpayPaymentId) => {
  const secret = keySecret || 'mock_razorpay_secret';
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  return crypto.createHmac('sha256', secret).update(text).digest('hex');
};

/**
 * Test Helper: Generate a valid signature for mock webhook payload
 */
const generateMockWebhookSignature = (rawBody) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
};

module.exports = {
  getKeyId,
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  generateMockSignature,
  generateMockWebhookSignature,
};
