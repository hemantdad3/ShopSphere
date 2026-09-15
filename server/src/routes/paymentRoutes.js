const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  initiatePaymentSchema,
  verifyPaymentSchema,
  paymentFailureSchema,
} = require('../validators/paymentValidator');

const router = express.Router();

// Public Webhook route (authenticated cryptographically via HMAC SHA256 header)
router.post('/webhook', paymentController.webhook);

// Customer Authenticated Routes
router.use(protect);

router.post('/initiate', validate({ body: initiatePaymentSchema }), paymentController.initiate);
router.post('/verify', validate({ body: verifyPaymentSchema }), paymentController.verify);
router.post('/failure', validate({ body: paymentFailureSchema }), paymentController.recordFailure);

module.exports = router;
