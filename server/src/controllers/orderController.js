const orderService = require('../services/orderService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Initiate checkout: reserves stock and creates order with 15-min TTL
 * POST /api/orders/checkout
 */
const checkout = async (req, res, next) => {
  try {
    const { shippingAddress } = req.body;
    const order = await orderService.createCheckoutOrder(req.user._id, shippingAddress);
    return sendSuccess(res, { order }, 'Checkout initiated. Inventory reserved for 15 minutes.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get order details by ID
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.user._id, req.params.id, req.user.role);
    return sendSuccess(res, { order }, 'Order details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get authenticated customer's paginated order history
 * GET /api/orders/my-orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { orders, pagination } = await orderService.getCustomerOrders(req.user._id, req.query);
    return sendSuccess(res, { orders, pagination }, 'Orders retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkout,
  getOrderById,
  getMyOrders,
};
