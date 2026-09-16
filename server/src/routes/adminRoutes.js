const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateOrderStatusSchema } = require('../validators/orderLifecycleValidator');

const router = express.Router();

// Strict RBAC: All admin routes require authentication and ADMIN role
router.use(protect, restrictTo('ADMIN'));

router.get('/dashboard', adminController.getDashboardMetrics);
router.get('/orders', adminController.getAllOrders);
router.patch('/orders/:id/status', validate({ body: updateOrderStatusSchema }), adminController.updateOrderStatus);
router.get('/users', adminController.getCustomers);
router.get('/inventory/low-stock', adminController.getLowStockProducts);

module.exports = router;
