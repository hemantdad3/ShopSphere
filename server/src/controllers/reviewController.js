const reviewService = require('../services/reviewService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Submit a product review (Verified Buyer only)
 * POST /api/products/:productId/reviews
 */
const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const review = await reviewService.createReview(req.user._id, productId, req.body);
    return sendSuccess(res, { review }, 'Review submitted successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get reviews for a product (Public)
 * GET /api/products/:productId/reviews
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { reviews, pagination } = await reviewService.getProductReviews(productId, req.query);
    return sendSuccess(res, { reviews, pagination }, 'Reviews retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a review (Author or Admin only)
 * DELETE /api/reviews/:id
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    await reviewService.deleteReview(req.user._id, id, req.user.role);
    return sendSuccess(res, null, 'Review deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  deleteReview,
};
