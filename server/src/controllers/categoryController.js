const Category = require('../models/Category');
const Product = require('../models/Product');
const { NotFoundError, ConflictError } = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * List all active categories (Public)
 * GET /api/categories
 */
const getAllCategories = async (req, res, next) => {
  try {
    const filter = req.user && req.user.role === 'ADMIN' ? {} : { isActive: true };
    const categories = await Category.find(filter).sort({ name: 1 });

    return sendSuccess(res, { categories, count: categories.length }, 'Categories fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get category details by slug (Public)
 * GET /api/categories/:slug
 */
const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) {
      return next(new NotFoundError(`Category with slug '${req.params.slug}' not found`));
    }

    return sendSuccess(res, { category }, 'Category details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Create new category (Admin only)
 * POST /api/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const existing = await Category.findOne({ name });
    if (existing) {
      return next(new ConflictError(`A category with the name '${name}' already exists`));
    }

    const category = await Category.create({ name, description });

    return sendSuccess(res, { category }, 'Category created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update existing category (Admin only)
 * PATCH /api/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(new NotFoundError(`Category with ID '${req.params.id}' not found`));
    }

    if (req.body.name && req.body.name !== category.name) {
      const existing = await Category.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
      if (existing) {
        return next(new ConflictError(`A category with the name '${req.body.name}' already exists`));
      }
      category.name = req.body.name;
    }

    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    await category.save();

    return sendSuccess(res, { category }, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete category (Admin only - safeguards against deleting categories with active products)
 * DELETE /api/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(new NotFoundError(`Category with ID '${req.params.id}' not found`));
    }

    // Safety invariant: Disallow deleting categories with active products
    const associatedProducts = await Product.countDocuments({ category: category._id, isActive: true });
    if (associatedProducts > 0) {
      return next(
        new ConflictError(
          `Cannot delete category '${category.name}': it currently contains ${associatedProducts} active product(s). Please reassign or delete these products first.`
        )
      );
    }

    await Category.findByIdAndDelete(category._id);

    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
