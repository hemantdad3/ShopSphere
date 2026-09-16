const express = require('express');
const orderController = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { checkoutSchema } = require('../validators/orderValidator');
const {
  cancelOrderSchema,
  updateOrderStatusSchema,
} = require('../validators/orderLifecycleValidator');
const { checkoutLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All order endpoints require authentication
router.use(protect);

router.post('/checkout', checkoutLimiter, validate({ body: checkoutSchema }), orderController.checkout);
router.get('/my-orders', orderController.getMyOrders);

// Admin-only global order listing (placed before /:id to avoid param capture)
router.get('/admin/all', restrictTo('ADMIN'), orderController.getAllOrders);

// Order status update (Admin only)
router.patch(
  '/:id/status',
  restrictTo('ADMIN'),
  validate({ body: updateOrderStatusSchema }),
  orderController.updateOrderStatus
);

// Cancel order (Customer or Admin)
router.post(
  '/:id/cancel',
  validate({ body: cancelOrderSchema }),
  orderController.cancelOrder
);

// Order details by ID
router.get('/:id', orderController.getOrderById);

module.exports = router;
