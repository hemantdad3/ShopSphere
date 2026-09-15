const mongoose = require('mongoose');
const slugify = require('slugify');

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    fileId: {
      type: String,
      required: [true, 'Image fileId is required'],
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters long'],
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'], // Financial invariant
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product must belong to a category'],
      index: true,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be negative'], // Inventory invariant
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer',
      },
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot exceed 5.0'],
      set: (val) => Math.round(val * 10) / 10, // Round to 1 decimal place (e.g. 4.7)
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound Indexes for High-Performance Queries
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: 'text', description: 'text' });

// Virtual: Calculated effective price after discount
productSchema.virtual('finalPrice').get(function () {
  if (this.discount && this.discount > 0) {
    return Math.round(this.price * (1 - this.discount / 100));
  }
  return this.price;
});

// Pre-save hook: auto-generate unique slug
productSchema.pre('save', async function () {
  if (this.isModified('name')) {
    const baseSlug = slugify(this.name, { lower: true, strict: true });
    // Check for collision
    const existing = await this.constructor.findOne({ slug: baseSlug, _id: { $ne: this._id } });
    if (existing) {
      this.slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    } else {
      this.slug = baseSlug;
    }
  }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
