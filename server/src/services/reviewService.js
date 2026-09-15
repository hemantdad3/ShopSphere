const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} = require('../utils/AppError');

/**
 * Submit a customer product review with Verified Purchaser validation
 */
const createReview = async (userId, productId, { rating, title, comment }) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw new NotFoundError(`Product with ID '${productId}' not found`);
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    throw new NotFoundError(`Product with ID '${productId}' not found or is unavailable`);
  }

  // Verified Buyer Gate: User must have received this product in a DELIVERED order
  const deliveredOrder = await Order.findOne({
    customer: userId,
    orderStatus: 'DELIVERED',
    'items.product': productId,
  });

  if (!deliveredOrder) {
    throw new ForbiddenError(
      'Only verified purchasers who have received this product (delivered order) can submit a review',
      'NOT_VERIFIED_PURCHASER'
    );
  }

  // Check for duplicate review (Single review per customer per product)
  const existingReview = await Review.findOne({ user: userId, product: productId });
  if (existingReview) {
    throw new ConflictError(
      'You have already submitted a review for this product',
      'DUPLICATE_REVIEW'
    );
  }

  // Create review
  const review = await Review.create({
    user: userId,
    product: productId,
    order: deliveredOrder._id,
    rating,
    title: title || '',
    comment,
    isVerifiedPurchase: true,
  });

  // Automatically recalculate product ratingAverage and reviewCount
  await Review.calcAverageRatings(productId);

  await review.populate('user', 'name');
  return review;
};

/**
 * Public retrieval of product reviews with pagination
 */
const getProductReviews = async (productId, options = {}) => {
  if (!mongoose.isValidObjectId(productId)) {
    throw new NotFoundError(`Product with ID '${productId}' not found`);
  }

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { product: productId };
  const total = await Review.countDocuments(filter);
  const reviews = await Review.find(filter)
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    reviews,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Delete review by author or store administrator
 */
const deleteReview = async (userId, reviewId, userRole = 'CUSTOMER') => {
  if (!mongoose.isValidObjectId(reviewId)) {
    throw new NotFoundError(`Review with ID '${reviewId}' not found`);
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw new NotFoundError(`Review with ID '${reviewId}' not found`);
  }

  // Authorization check
  if (userRole !== 'ADMIN' && review.user.toString() !== userId.toString()) {
    throw new ForbiddenError('You do not have permission to delete this review');
  }

  const productId = review.product;
  await review.deleteOne();

  // Atomically recompute Product rating metrics
  await Review.calcAverageRatings(productId);

  return { success: true };
};

module.exports = {
  createReview,
  getProductReviews,
  deleteReview,
};
