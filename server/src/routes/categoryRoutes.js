const express = require('express');
const categoryController = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/categoryValidator');

const router = express.Router();

// Public Routes
router.get('/', categoryController.getAllCategories);
router.get('/:slug', categoryController.getCategoryBySlug);

// Admin-Only Routes
router.post(
  '/',
  protect,
  restrictTo('ADMIN'),
  validate({ body: createCategorySchema }),
  categoryController.createCategory
);

router.patch(
  '/:id',
  protect,
  restrictTo('ADMIN'),
  validate({ body: updateCategorySchema }),
  categoryController.updateCategory
);

router.delete('/:id', protect, restrictTo('ADMIN'), categoryController.deleteCategory);

module.exports = router;
