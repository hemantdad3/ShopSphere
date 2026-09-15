const Order = require('../models/Order');
const razorpayService = require('./razorpayService');
const inventoryService = require('./inventoryService');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/AppError');

/**
 * Initiate Razorpay payment for a pending order
 *
 * 1. Verifies order exists, belongs to user, and is PENDING_PAYMENT.
 * 2. Verifies 15-minute reservation TTL has not elapsed.
 * 3. Converts amount to paise.
 * 4. Creates Razorpay order and links razorpayOrderId to the Order.
 *
 * @param {string} userId - Authenticated customer ObjectId
 * @param {string} orderId - MongoDB Order ObjectId
 * @returns {Promise<object>} Razorpay checkout parameters
 */
const initiatePayment = async (userId, orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order with ID '${orderId}' not found`);
  }

  // Ownership verification
  if (order.customer.toString() !== userId.toString()) {
    throw new ForbiddenError('You do not have permission to pay for this order');
  }

  // State checks
  if (order.orderStatus !== 'PENDING_PAYMENT' || order.paymentStatus === 'PAID') {
    throw new BadRequestError(
      `Order is in '${order.orderStatus}' status and cannot be paid for`,
      'ORDER_NOT_PAYABLE'
    );
  }

  // 15-Minute Reservation Expiration Check
  if (new Date(order.reservationExpiresAt) <= new Date()) {
    throw new BadRequestError(
      'Order payment reservation window (15-min TTL) has expired. Please initiate a new checkout.',
      'RESERVATION_EXPIRED'
    );
  }

  // Razorpay requires amounts in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(order.totalAmount * 100);

  // Generate Razorpay Order
  const razorpayOrder = await razorpayService.createRazorpayOrder(amountInPaise, order.orderNumber);

  // Link Razorpay Order ID to MongoDB document
  order.paymentDetails.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: 'INR',
    keyId: razorpayService.getKeyId(),
    totalAmount: order.totalAmount,
  };
};

/**
 * Finalize payment with atomic idempotency lock.
 *
 * Both the client callback verification and asynchronous webhook handler
 * call this centralized method. The atomic conditional update (`paymentStatus: { $ne: 'PAID' }`)
 * guarantees exactly-once finalization under concurrent execution.
 *
 * @param {string} orderId
 * @param {string} razorpayPaymentId
 * @param {string} signature
 * @param {string} source - 'CLIENT' or 'WEBHOOK'
 * @returns {Promise<{ order: object, alreadyProcessed: boolean }>}
 */
const finalizePaymentSuccess = async (orderId, razorpayPaymentId, signature, source = 'CLIENT') => {
  // Atomic Conditional Update: Only proceed if paymentStatus is NOT already PAID
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $ne: 'PAID' },
    },
    {
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      'paymentDetails.razorpayPaymentId': razorpayPaymentId,
      'paymentDetails.razorpaySignature': signature,
    },
    { returnDocument: 'after' }
  );

  if (order) {
    console.log(
      `[PaymentService 💳] Order '${order.orderNumber}' finalized as CONFIRMED via ${source} (PaymentId: ${razorpayPaymentId})`
    );
    return { order, alreadyProcessed: false };
  }

  // If order was null, check if it was already processed previously (Idempotent No-op)
  const existingOrder = await Order.findById(orderId);
  if (existingOrder && existingOrder.paymentStatus === 'PAID') {
    console.log(
      `[PaymentService ℹ️] Order '${existingOrder.orderNumber}' was already marked PAID. Idempotent return.`
    );
    return { order: existingOrder, alreadyProcessed: true };
  }

  throw new BadRequestError('Order is not eligible for payment completion', 'ORDER_NOT_PAYABLE');
};

/**
 * Verify client payment callback using cryptographic HMAC SHA256 signature
 */
const verifyClientPayment = async (
  userId,
  { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order with ID '${orderId}' not found`);
  }

  // Ownership verification
  if (order.customer.toString() !== userId.toString()) {
    throw new ForbiddenError('You do not have permission to verify this order');
  }

  // Cryptographic Signature Verification
  const isValid = razorpayService.verifySignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  );

  if (!isValid) {
    throw new BadRequestError(
      'Payment verification failed: invalid cryptographic signature',
      'INVALID_SIGNATURE'
    );
  }

  return finalizePaymentSuccess(orderId, razorpayPaymentId, razorpaySignature, 'CLIENT');
};

/**
 * Handle asynchronous Razorpay Webhook events
 *
 * Verifies webhook signature against raw request body, then reconciles payment idempotently.
 */
const handleWebhookEvent = async (rawBody, signatureHeader) => {
  const isValid = razorpayService.verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    throw new BadRequestError('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    throw new BadRequestError('Malformed webhook JSON payload', 'INVALID_PAYLOAD');
  }

  const eventType = event.event;
  console.log(`[PaymentService 🔔] Received Razorpay Webhook event: ${eventType}`);

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = event.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;

    if (razorpayOrderId) {
      const order = await Order.findOne({ 'paymentDetails.razorpayOrderId': razorpayOrderId });
      if (order) {
        await finalizePaymentSuccess(order._id, razorpayPaymentId, signatureHeader, 'WEBHOOK');
      }
    }
  } else if (eventType === 'payment.failed') {
    const paymentEntity = event.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const errorDesc = paymentEntity?.error_description || 'Payment failed via gateway';

    if (razorpayOrderId) {
      const order = await Order.findOne({ 'paymentDetails.razorpayOrderId': razorpayOrderId });
      if (order && order.orderStatus === 'PENDING_PAYMENT') {
        await handlePaymentFailure(order._id, errorDesc);
      }
    }
  }

  return { status: 'success', received: true };
};

/**
 * Handle explicit payment failure: transition order to FAILED/CANCELLED and release inventory
 */
const handlePaymentFailure = async (orderId, reason = 'Payment failed by customer') => {
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    },
    {
      orderStatus: 'CANCELLED',
      paymentStatus: 'FAILED',
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
    { returnDocument: 'after' }
  );

  if (order) {
    // Release reserved inventory immediately back to products
    await inventoryService.releaseInventory(order.items);
    console.log(
      `[PaymentService ❌] Order '${order.orderNumber}' payment failed (${reason}). Released reserved inventory.`
    );
  }

  return order;
};

module.exports = {
  initiatePayment,
  verifyClientPayment,
  finalizePaymentSuccess,
  handleWebhookEvent,
  handlePaymentFailure,
};
