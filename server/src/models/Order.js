const mongoose = require('mongoose');

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name snapshot is required'],
    },
    slug: {
      type: String,
    },
    image: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, 'Product unit MRP snapshot is required'],
      min: [0, 'Price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    finalPrice: {
      type: Number,
      required: [true, 'Final unit price paid snapshot is required'],
      min: [0, 'Final price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    lineTotal: {
      type: Number,
      required: [true, 'Line total is required'],
      min: [0, 'Line total cannot be negative'],
    },
  },
  { _id: true }
);

const shippingAddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
  },
  { _id: false }
);

const paymentDetailsSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a customer'],
      index: true,
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: [true, 'Order must have at least one item'],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: [true, 'Shipping address is required'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: [0, 'Discount total cannot be negative'],
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: [0, 'Shipping fee cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    orderStatus: {
      type: String,
      enum: {
        values: ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        message: 'Invalid order status',
      },
      default: 'PENDING_PAYMENT',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
        message: 'Invalid payment status',
      },
      default: 'PENDING',
      index: true,
    },
    paymentDetails: {
      type: paymentDetailsSchema,
      default: {},
    },
    reservationExpiresAt: {
      type: Date,
      required: [true, 'Reservation expiration date is required'],
      index: true,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
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

// Compound indexes for optimal querying
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, reservationExpiresAt: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
