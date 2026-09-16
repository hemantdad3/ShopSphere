const adminService = require('../services/adminService');
const orderService = require('../services/orderService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Get executive operational dashboard metrics
 * GET /api/admin/dashboard
 */
const getDashboardMetrics = async (req, res, next) => {
  try {
    const metrics = await adminService.getDashboardMetrics();
    return sendSuccess(res, { metrics }, 'Admin dashboard metrics retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get all orders across the platform with filtering & pagination
 * GET /api/admin/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { orders, pagination } = await orderService.getAllOrdersForAdmin(req.query);
    return sendSuccess(res, { orders, pagination }, 'All orders retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Admin transition of order fulfillment status
 * PATCH /api/admin/orders/:id/status
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
 * Get registered customers with aggregated order and spend metrics
 * GET /api/admin/users
 */
const getCustomers = async (req, res, next) => {
  try {
    const { customers, pagination } = await adminService.getAdminCustomers(req.query);
    return sendSuccess(res, { customers, pagination }, 'Registered customers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get products below inventory safety threshold
 * GET /api/admin/inventory/low-stock
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const products = await adminService.getLowStockInventory(req.query.threshold);
    return sendSuccess(res, { products }, 'Low stock inventory retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardMetrics,
  getAllOrders,
  updateOrderStatus,
  getCustomers,
  getLowStockProducts,
};
