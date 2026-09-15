const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All wishlist endpoints require customer authentication
router.use(protect);

router.get('/', wishlistController.getWishlist);
router.post('/:productId', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);
router.post('/:productId/move-to-cart', wishlistController.moveToCart);

module.exports = router;
