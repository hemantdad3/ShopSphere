const express = require('express');
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadMultipleImages } = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  createProductSchema,
  updateProductSchema,
} = require('../validators/productValidator');
const { productQuerySchema } = require('../validators/productQueryValidator');

const router = express.Router();

// Public Routes
router.get('/', validate({ query: productQuerySchema }), productController.getAllProducts);
router.get('/:idOrSlug', productController.getProductByIdOrSlug);

// Admin-Only Routes
router.post(
  '/',
  protect,
  restrictTo('ADMIN'),
  uploadMultipleImages('images', 5),
  validate({ body: createProductSchema }),
  productController.createProduct
);

router.patch(
  '/:id',
  protect,
  restrictTo('ADMIN'),
  uploadMultipleImages('images', 5),
  validate({ body: updateProductSchema }),
  productController.updateProduct
);

router.delete('/:id', protect, restrictTo('ADMIN'), productController.deleteProduct);

module.exports = router;
