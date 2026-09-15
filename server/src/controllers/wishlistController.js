const wishlistService = require('../services/wishlistService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Retrieve authenticated customer's wishlist
 * GET /api/wishlist
 */
const getWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.getWishlist(req.user._id);
    return sendSuccess(res, { wishlist }, 'Wishlist retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Add a product to wishlist
 * POST /api/wishlist/:productId
 */
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const wishlist = await wishlistService.addToWishlist(req.user._id, productId);
    return sendSuccess(res, { wishlist }, 'Product added to wishlist successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Remove a product from wishlist
 * DELETE /api/wishlist/:productId
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const wishlist = await wishlistService.removeFromWishlist(req.user._id, productId);
    return sendSuccess(res, { wishlist }, 'Product removed from wishlist successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Move a product from wishlist directly to cart
 * POST /api/wishlist/:productId/move-to-cart
 */
const moveToCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { cart, wishlist } = await wishlistService.moveToCart(req.user._id, productId);
    return sendSuccess(res, { cart, wishlist }, 'Product moved to cart successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
