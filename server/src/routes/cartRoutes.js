const express = require('express');
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  addToCartSchema,
  updateCartItemSchema,
} = require('../validators/cartValidator');

const router = express.Router();

// All cart endpoints require user authentication
router.use(protect);

router.get('/', cartController.getCart);
router.post('/items', validate({ body: addToCartSchema }), cartController.addToCart);
router.patch('/items/:productId', validate({ body: updateCartItemSchema }), cartController.updateCartItem);
router.delete('/items/:productId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;
