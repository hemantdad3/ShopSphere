const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

/**
 * Find existing cart or initialize an empty cart for user
 */
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

/**
 * Authoritative Server-Side Cart Calculation & Live Stock Validation
 *
 * Re-reads live active prices, discounts, and inventory from the database.
 * Client-submitted totals or unit prices are never trusted.
 *
 * @param {object} cartDoc - Mongoose Cart document
 * @returns {object} Calculated cart with item-level metrics and inventory status
 */
const calculateCart = async (cartDoc) => {
  // Populate product details
  await cartDoc.populate({
    path: 'items.product',
    select: 'name slug price discount stock isActive images',
  });

  let subtotal = 0;
  let discountTotal = 0;
  let finalTotal = 0;
  let totalItems = 0;
  let hasStockIssues = false;

  const calculatedItems = cartDoc.items.map((item) => {
    const product = item.product;

    // 1. Missing or inactive product check
    if (!product || !product.isActive) {
      hasStockIssues = true;
      return {
        _id: item._id,
        productId: product ? product._id : null,
        name: product ? product.name : 'Unavailable Product',
        slug: product ? product.slug : null,
        image: product && product.images && product.images.length > 0 ? product.images[0].url : null,
        quantity: item.quantity,
        unitPrice: 0,
        finalPrice: 0,
        lineSubtotal: 0,
        lineTotal: 0,
        lineDiscount: 0,
        availableStock: 0,
        isAvailable: false,
        issueReason: !product ? 'Product no longer exists' : 'Product is currently inactive',
      };
    }

    // 2. Out of stock check
    if (product.stock <= 0) {
      hasStockIssues = true;
      return {
        _id: item._id,
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images && product.images.length > 0 ? product.images[0].url : null,
        quantity: item.quantity,
        unitPrice: product.price,
        finalPrice: product.finalPrice,
        lineSubtotal: 0,
        lineTotal: 0,
        lineDiscount: 0,
        availableStock: 0,
        isAvailable: false,
        issueReason: 'Product is currently out of stock',
      };
    }

    // 3. Requested quantity exceeds current stock check
    const isOverStock = item.quantity > product.stock;
    if (isOverStock) {
      hasStockIssues = true;
    }

    const unitPrice = product.price;
    const finalUnitPrice =
      product.discount > 0
        ? Math.round(product.price * (1 - product.discount / 100))
        : product.price;

    const lineSubtotal = unitPrice * item.quantity;
    const lineTotal = finalUnitPrice * item.quantity;
    const lineDiscount = lineSubtotal - lineTotal;

    if (!isOverStock) {
      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      finalTotal += lineTotal;
      totalItems += item.quantity;
    }

    return {
      _id: item._id,
      productId: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images && product.images.length > 0 ? product.images[0].url : null,
      quantity: item.quantity,
      unitPrice,
      discountPercent: product.discount || 0,
      finalPrice: finalUnitPrice,
      lineSubtotal,
      lineTotal,
      lineDiscount,
      availableStock: product.stock,
      isAvailable: !isOverStock,
      issueReason: isOverStock
        ? `Requested ${item.quantity} units, but only ${product.stock} available in stock`
        : null,
    };
  });

  return {
    _id: cartDoc._id,
    user: cartDoc.user,
    items: calculatedItems,
    summary: {
      totalItems,
      subtotal,
      discountTotal,
      finalTotal,
      hasStockIssues,
      isValidForCheckout: calculatedItems.length > 0 && !hasStockIssues,
    },
    updatedAt: cartDoc.updatedAt,
  };
};

/**
 * Get user's cart with live authoritative calculation
 */
const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  return calculateCart(cart);
};

/**
 * Add an item to user's cart
 */
const addItemToCart = async (userId, productId, quantity = 1) => {
  // Verify product exists and is active
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new NotFoundError('Product not found or is no longer available');
  }

  // Stock invariant
  if (product.stock <= 0) {
    throw new BadRequestError('Product is currently out of stock');
  }

  if (quantity > product.stock) {
    throw new BadRequestError(
      `Requested quantity (${quantity}) exceeds available stock (${product.stock})`
    );
  }

  const cart = await getOrCreateCart(userId);

  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  if (existingItemIndex > -1) {
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    if (newQuantity > 10) {
      throw new BadRequestError('Cannot add more than 10 units of this item in your cart');
    }
    if (newQuantity > product.stock) {
      throw new BadRequestError(
        `Cannot add ${quantity} more. Total in cart (${newQuantity}) exceeds available stock (${product.stock})`
      );
    }
    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  return calculateCart(cart);
};

/**
 * Update quantity of an existing item in cart
 */
const updateItemQuantity = async (userId, productId, quantity) => {
  const cart = await getOrCreateCart(userId);

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  if (itemIndex === -1) {
    throw new NotFoundError('Product is not in your cart');
  }

  // Quantity 0 removes item from cart
  if (quantity === 0) {
    cart.items.splice(itemIndex, 1);
    await cart.save();
    return calculateCart(cart);
  }

  // Verify stock
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new BadRequestError('Product is no longer available');
  }

  if (quantity > product.stock) {
    throw new BadRequestError(
      `Requested quantity (${quantity}) exceeds available stock (${product.stock})`
    );
  }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();
  return calculateCart(cart);
};

/**
 * Remove single item from cart
 */
const removeItemFromCart = async (userId, productId) => {
  const cart = await getOrCreateCart(userId);

  const initialLength = cart.items.length;
  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId.toString()
  );

  if (cart.items.length === initialLength) {
    throw new NotFoundError('Product is not in your cart');
  }

  await cart.save();
  return calculateCart(cart);
};

/**
 * Clear all items from cart
 */
const clearCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return calculateCart(cart);
};

module.exports = {
  getOrCreateCart,
  calculateCart,
  getCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  clearCart,
};
