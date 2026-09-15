const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const APIFeatures = require('../utils/apiFeatures');
const { NotFoundError, BadRequestError } = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const { uploadImage, deleteImage } = require('../services/imageService');

/**
 * Get all active products with Search, Category Filter, Price Range, Sorting, and Pagination
 * GET /api/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    const baseFilter = req.user && req.user.role === 'ADMIN' ? {} : { isActive: true };
    let categoryFilter = {};

    // 1. Resolve Category query if provided (supports slug or ObjectId)
    if (req.query.category && req.query.category.trim()) {
      const catParam = req.query.category.trim();
      if (mongoose.isValidObjectId(catParam)) {
        categoryFilter = { category: catParam };
      } else {
        const matchedCategory = await Category.findOne({
          slug: catParam.toLowerCase(),
          isActive: true,
        });

        if (matchedCategory) {
          categoryFilter = { category: matchedCategory._id };
        } else {
          // Category slug does not exist: Return empty result set with valid pagination metadata
          return sendSuccess(
            res,
            {
              products: [],
              pagination: {
                total: 0,
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 12,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
              },
            },
            'Products retrieved successfully'
          );
        }
      }
    }

    // 2. Count total matching documents for pagination metadata (executes before skip/limit)
    const countFeatures = new APIFeatures(Product.find(baseFilter), req.query)
      .search()
      .filter(categoryFilter);
    const total = await countFeatures.query.countDocuments();

    // 3. Execute search, filtering, sorting, and bounded pagination
    const features = new APIFeatures(Product.find(baseFilter), req.query)
      .search()
      .filter(categoryFilter)
      .sort()
      .paginate();

    const products = await features.query.populate('category', 'name slug');

    // 4. Calculate pagination metadata
    const { page, limit } = features.pagination;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return sendSuccess(
      res,
      {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      },
      'Products retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get single product by ID or Slug (Public)
 * GET /api/products/:idOrSlug
 */
const getProductByIdOrSlug = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    let product;

    if (mongoose.isValidObjectId(idOrSlug)) {
      product = await Product.findById(idOrSlug).populate('category', 'name slug');
    }

    if (!product) {
      product = await Product.findOne({ slug: idOrSlug, isActive: true }).populate('category', 'name slug');
    }

    if (!product) {
      return next(new NotFoundError(`Product '${idOrSlug}' not found`));
    }

    return sendSuccess(res, { product }, 'Product details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create new product with image uploads (Admin only)
 * POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    // 1. Verify category existence
    const category = await Category.findById(req.body.category);
    if (!category || !category.isActive) {
      return next(new BadRequestError('Invalid category: specified category does not exist or is inactive'));
    }

    // 2. Handle image uploads if present
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageResult = await uploadImage(file.buffer, file.originalname);
        uploadedImages.push(imageResult);
      }
    } else if (req.file) {
      const imageResult = await uploadImage(req.file.buffer, req.file.originalname);
      uploadedImages.push(imageResult);
    }

    // 3. Create product record
    const productData = {
      ...req.body,
      images: uploadedImages,
    };

    const product = await Product.create(productData);
    await product.populate('category', 'name slug');

    return sendSuccess(res, { product }, 'Product created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update product (Admin only)
 * PATCH /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new NotFoundError(`Product with ID '${req.params.id}' not found`));
    }

    // Verify category if updated
    if (req.body.category && req.body.category !== product.category.toString()) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return next(new BadRequestError('Invalid category: specified category does not exist'));
      }
      product.category = req.body.category;
    }

    // Upload new images if uploaded
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageResult = await uploadImage(file.buffer, file.originalname);
        product.images.push(imageResult);
      }
    } else if (req.file) {
      const imageResult = await uploadImage(req.file.buffer, req.file.originalname);
      product.images.push(imageResult);
    }

    // Update fields
    const allowedFields = ['name', 'description', 'price', 'discount', 'stock', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();
    await product.populate('category', 'name slug');

    return sendSuccess(res, { product }, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete product and clean up images (Admin only)
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new NotFoundError(`Product with ID '${req.params.id}' not found`));
    }

    // Clean up images from CDN
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        await deleteImage(img.fileId);
      }
    }

    await Product.findByIdAndDelete(product._id);

    return sendSuccess(res, null, 'Product and associated media deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllProducts,
  getProductByIdOrSlug,
  createProduct,
  updateProduct,
  deleteProduct,
};
