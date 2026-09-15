const cartService = require('../services/cartService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Get current user's cart with live authoritative calculation
 * GET /api/cart
 */
const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user._id);
    return sendSuccess(res, { cart }, 'Cart retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Add an item to user's cart
 * POST /api/cart/items
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const cart = await cartService.addItemToCart(req.user._id, productId, quantity);
    return sendSuccess(res, { cart }, 'Item added to cart successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update quantity of an existing item in cart
 * PATCH /api/cart/items/:productId
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const cart = await cartService.updateItemQuantity(req.user._id, productId, quantity);
    return sendSuccess(res, { cart }, 'Cart item updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Remove an item from cart
 * DELETE /api/cart/items/:productId
 */
const removeCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const cart = await cartService.removeItemFromCart(req.user._id, productId);
    return sendSuccess(res, { cart }, 'Item removed from cart successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Clear all items from cart
 * DELETE /api/cart
 */
const clearCart = async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.user._id);
    return sendSuccess(res, { cart }, 'Cart cleared successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
