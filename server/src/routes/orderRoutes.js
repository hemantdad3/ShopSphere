const express = require('express');
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { checkoutSchema } = require('../validators/orderValidator');

const router = express.Router();

// All order endpoints require authentication
router.use(protect);

router.post('/checkout', validate({ body: checkoutSchema }), orderController.checkout);
router.get('/my-orders', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);

module.exports = router;
