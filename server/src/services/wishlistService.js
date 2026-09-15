const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const cartService = require('./cartService');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

/**
 * Get or initialize customer's wishlist with populated active product details
 */
const getWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId }).populate({
    path: 'products',
    match: { isActive: true },
    select: 'name slug price discount stock images ratingAverage reviewCount',
  });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [] });
  }

  // Filter out any null references (e.g. deleted or inactive products)
  wishlist.products = wishlist.products.filter(Boolean);

  return wishlist;
};

/**
 * Add a product to customer's wishlist (idempotent via $addToSet)
 */
const addToWishlist = async (userId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw new NotFoundError(`Product with ID '${productId}' not found`);
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found or unavailable`);
  }

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $addToSet: { products: productId } },
    { upsert: true, returnDocument: 'after' }
  ).populate({
    path: 'products',
    match: { isActive: true },
    select: 'name slug price discount stock images ratingAverage reviewCount',
  });

  return wishlist;
};

/**
 * Remove a product from customer's wishlist ($pull)
 */
const removeFromWishlist = async (userId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw new NotFoundError(`Product with ID '${productId}' not found`);
  }

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { products: productId } },
    { returnDocument: 'after' }
  ).populate({
    path: 'products',
    match: { isActive: true },
    select: 'name slug price discount stock images ratingAverage reviewCount',
  });

  return wishlist || { user: userId, products: [] };
};

/**
 * Move a product from customer's wishlist to their active shopping cart
 */
const moveToCart = async (userId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw new NotFoundError(`Product with ID '${productId}' not found`);
  }

  // 1. Add item to cart with authoritative validation
  const cart = await cartService.addItemToCart(userId, productId, 1);

  // 2. Remove item from wishlist
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { products: productId } },
    { returnDocument: 'after' }
  ).populate({
    path: 'products',
    match: { isActive: true },
    select: 'name slug price discount stock images ratingAverage reviewCount',
  });

  return {
    cart,
    wishlist: wishlist || { user: userId, products: [] },
  };
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
