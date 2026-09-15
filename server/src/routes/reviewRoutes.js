const express = require('express');
const reviewController = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createReviewSchema } = require('../validators/reviewValidator');

const router = express.Router({ mergeParams: true });

// Nested on /api/products/:productId/reviews
router
  .route('/')
  .get(reviewController.getProductReviews)
  .post(protect, validate({ body: createReviewSchema }), reviewController.createReview);

// Direct review deletion: DELETE /api/reviews/:id
router.delete('/:id', protect, reviewController.deleteReview);

module.exports = router;
