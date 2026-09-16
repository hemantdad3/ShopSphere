const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * Executive Dashboard Analytics using unified MongoDB $facet aggregation
 */
const getDashboardMetrics = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Order & Financial Metrics in single round-trip
  const [orderAggregation] = await Order.aggregate([
    {
      $facet: {
        totalRevenue: [
          { $match: { paymentStatus: 'PAID' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ],
        todayRevenue: [
          { $match: { paymentStatus: 'PAID', createdAt: { $gte: startOfToday } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ],
        monthRevenue: [
          { $match: { paymentStatus: 'PAID', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ],
        statusCounts: [
          { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        ],
        totalOrders: [
          { $count: 'count' },
        ],
        recentOrders: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: 'customer',
              foreignField: '_id',
              as: 'customerDetails',
            },
          },
          {
            $project: {
              orderNumber: 1,
              totalAmount: 1,
              orderStatus: 1,
              paymentStatus: 1,
              createdAt: 1,
              customer: {
                $let: {
                  vars: { cust: { $arrayElemAt: ['$customerDetails', 0] } },
                  in: {
                    _id: '$$cust._id',
                    name: '$$cust.name',
                    email: '$$cust.email',
                  },
                },
              },
            },
          },
        ],
      },
    },
  ]);

  // 2. Inventory Health Metrics
  const [inventoryAggregation] = await Product.aggregate([
    {
      $facet: {
        totalProducts: [{ $match: { isActive: true } }, { $count: 'count' }],
        lowStock: [{ $match: { isActive: true, stock: { $gt: 0, $lte: 5 } } }, { $count: 'count' }],
        outOfStock: [{ $match: { isActive: true, stock: { $lte: 0 } } }, { $count: 'count' }],
      },
    },
  ]);

  // 3. Customer Insights
  const [customerAggregation] = await User.aggregate([
    {
      $facet: {
        totalCustomers: [{ $match: { role: 'CUSTOMER' } }, { $count: 'count' }],
        newSignups: [
          { $match: { role: 'CUSTOMER', createdAt: { $gte: thirtyDaysAgo } } },
          { $count: 'count' },
        ],
      },
    },
  ]);

  // Format Status Counts mapping
  const orderStatusMap = {
    PENDING_PAYMENT: 0,
    CONFIRMED: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  (orderAggregation?.statusCounts || []).forEach((item) => {
    if (orderStatusMap.hasOwnProperty(item._id)) {
      orderStatusMap[item._id] = item.count;
    }
  });

  return {
    revenue: {
      total: orderAggregation?.totalRevenue[0]?.total || 0,
      today: orderAggregation?.todayRevenue[0]?.total || 0,
      month: orderAggregation?.monthRevenue[0]?.total || 0,
    },
    orders: {
      total: orderAggregation?.totalOrders[0]?.count || 0,
      breakdown: orderStatusMap,
      recent: orderAggregation?.recentOrders || [],
    },
    inventory: {
      totalProducts: inventoryAggregation?.totalProducts[0]?.count || 0,
      lowStockCount: inventoryAggregation?.lowStock[0]?.count || 0,
      outOfStockCount: inventoryAggregation?.outOfStock[0]?.count || 0,
    },
    customers: {
      totalCustomers: customerAggregation?.totalCustomers[0]?.count || 0,
      newSignupsLast30Days: customerAggregation?.newSignups[0]?.count || 0,
    },
  };
};

/**
 * Admin Customer Management with order metrics and spend aggregation
 */
const getAdminCustomers = async (options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const total = await User.countDocuments({ role: 'CUSTOMER' });

  const customers = await User.aggregate([
    { $match: { role: 'CUSTOMER' } },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'customer',
        as: 'orders',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
        totalOrders: { $size: '$orders' },
        totalSpent: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$orders',
                  as: 'o',
                  cond: { $eq: ['$$o.paymentStatus', 'PAID'] },
                },
              },
              as: 'paidOrder',
              in: '$$paidOrder.totalAmount',
            },
          },
        },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    customers,
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

/**
 * Get products below inventory safety threshold
 */
const getLowStockInventory = async (threshold = 5) => {
  const limitThreshold = Math.max(0, parseInt(threshold, 10) || 5);

  const products = await Product.find({
    isActive: true,
    stock: { $lte: limitThreshold },
  })
    .populate('category', 'name slug')
    .sort({ stock: 1 });

  return products;
};

module.exports = {
  getDashboardMetrics,
  getAdminCustomers,
  getLowStockInventory,
};
