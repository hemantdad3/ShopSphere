const paymentService = require('../services/paymentService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Initiate Razorpay payment for a pending order
 * POST /api/payments/initiate
 */
const initiate = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const paymentData = await paymentService.initiatePayment(req.user._id, orderId);
    return sendSuccess(res, { payment: paymentData }, 'Payment initiated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Client payment verification callback with cryptographic signature check
 * POST /api/payments/verify
 */
const verify = async (req, res, next) => {
  try {
    const result = await paymentService.verifyClientPayment(req.user._id, req.body);
    return sendSuccess(
      res,
      {
        order: result.order,
        alreadyProcessed: result.alreadyProcessed,
      },
      'Payment verified and order confirmed successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handle incoming asynchronous Razorpay Webhook events
 * POST /api/payments/webhook
 */
const webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const result = await paymentService.handleWebhookEvent(req.rawBody, signature);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Record explicit payment failure and restock reserved inventory
 * POST /api/payments/failure
 */
const recordFailure = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;
    const order = await paymentService.handlePaymentFailure(orderId, reason);
    return sendSuccess(
      res,
      { order },
      'Payment failure recorded and reserved inventory returned to catalog'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  initiate,
  verify,
  webhook,
  recordFailure,
};
