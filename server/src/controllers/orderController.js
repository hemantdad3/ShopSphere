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

/**
 * Cancel order by customer or admin with automated inventory restock
 * POST /api/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(
      req.user._id,
      req.params.id,
      reason,
      req.user.role
    );
    return sendSuccess(res, { order }, 'Order cancelled successfully and inventory restored');
  } catch (err) {
    next(err);
  }
};

/**
 * Admin update order fulfillment status
 * PATCH /api/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatusByAdmin(req.params.id, req.body);
    return sendSuccess(res, { order }, `Order status updated to '${order.orderStatus}'`);
  } catch (err) {
    next(err);
  }
};

/**
 * Admin retrieve all orders across customers with filters & pagination
 * GET /api/orders/admin/all
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { orders, pagination } = await orderService.getAllOrdersForAdmin(req.query);
    return sendSuccess(res, { orders, pagination }, 'All orders retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkout,
  getOrderById,
  getMyOrders,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
};
