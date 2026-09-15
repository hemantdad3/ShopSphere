const mongoose = require('mongoose');
const Order = require('../models/Order');
const cartService = require('./cartService');
const inventoryService = require('./inventoryService');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/AppError');

/**
 * Generate a unique human-friendly order identifier (e.g. ORD-LX7Q1-ABCD)
 */
const generateOrderNumber = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestampPart}-${randomPart}`;
};

/**
 * Create a new checkout order with atomic inventory reservation and snapshot freezing.
 *
 * 1. Authoritatively reads user's cart.
 * 2. Enforces stock and availability invariants.
 * 3. Atomically reserves product inventory (prevents overselling under high concurrency).
 * 4. Creates Order with 15-minute reservation TTL.
 * 5. Clears user cart upon successful reservation.
 *
 * @param {string} userId - Authenticated customer ObjectId
 * @param {object} shippingAddress - Validated shipping address snapshot
 * @returns {Promise<object>} Created pending Order document
 */
const createCheckoutOrder = async (userId, shippingAddress) => {
  // 1. Authoritative Cart Calculation
  const cart = await cartService.getOrCreateCart(userId);
  const calculatedCart = await cartService.calculateCart(cart);

  // 2. Validate Cart State
  if (!calculatedCart.items || calculatedCart.items.length === 0) {
    throw new BadRequestError('Cannot proceed to checkout: your cart is empty', 'EMPTY_CART');
  }

  if (calculatedCart.summary.hasStockIssues || !calculatedCart.summary.isValidForCheckout) {
    const degradedItem = calculatedCart.items.find((i) => !i.isAvailable);
    const reason = degradedItem
      ? degradedItem.issueReason
      : 'One or more items in your cart have stock or availability issues';
    throw new BadRequestError(
      `Cannot proceed to checkout: ${reason}. Please update your cart.`,
      'CART_STOCK_ISSUE'
    );
  }

  // 3. Prepare Items for Atomic Reservation
  const itemsToReserve = calculatedCart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    name: item.name,
  }));

  // Atomically reserve inventory (rolls back automatically if any item in batch fails)
  await inventoryService.reserveInventory(itemsToReserve);

  try {
    // 4. Calculate Shipping Fee & Final Order Total
    // Standard rule: Free shipping for orders >= ₹1,000, else ₹99
    const subtotal = calculatedCart.summary.subtotal;
    const discountTotal = calculatedCart.summary.discountTotal;
    const shippingFee = subtotal >= 1000 ? 0 : 99;
    const totalAmount = subtotal - discountTotal + shippingFee;

    // 5. Build Immutable Item Snapshots
    const itemSnapshots = calculatedCart.items.map((item) => ({
      product: item.productId,
      name: item.name,
      slug: item.slug,
      image: item.image,
      price: item.unitPrice,
      discount: item.discountPercent || 0,
      finalPrice: item.finalPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }));

    // 6. Set 15-Minute Reservation Expiration Window
    const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 7. Persist Order
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customer: userId,
      items: itemSnapshots,
      shippingAddress,
      subtotal,
      discountTotal,
      shippingFee,
      totalAmount,
      orderStatus: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      reservationExpiresAt,
    });

    // 8. Clear User's Cart
    cart.items = [];
    await cart.save();

    return order;
  } catch (creationErr) {
    // In the rare event of order document persistence failure, release reserved inventory
    console.error('[OrderService ⚠️] Order persistence failed, releasing reserved inventory:', creationErr);
    await inventoryService.releaseInventory(itemsToReserve);
    throw creationErr;
  }
};

/**
 * Retrieve single order by ID with ownership enforcement
 */
const getOrderById = async (userId, orderId, userRole = 'CUSTOMER') => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new NotFoundError(`Order with ID '${orderId}' not found`);
  }

  const order = await Order.findById(orderId).populate('customer', 'name email');
  if (!order) {
    throw new NotFoundError(`Order with ID '${orderId}' not found`);
  }

  // Authorization check: only order owner or ADMIN can view
  if (userRole !== 'ADMIN' && order.customer._id.toString() !== userId.toString()) {
    throw new ForbiddenError('You do not have permission to view this order');
  }

  return order;
};

/**
 * Retrieve paginated order history for the current customer
 */
const getCustomerOrders = async (userId, options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { customer: userId };

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    orders,
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

module.exports = {
  generateOrderNumber,
  createCheckoutOrder,
  getOrderById,
  getCustomerOrders,
};
