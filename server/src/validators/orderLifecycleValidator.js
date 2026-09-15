const { z } = require('zod');

const cancelOrderSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'], {
    required_error: 'Order status is required',
    invalid_type_error: 'Invalid order status transition',
  }),
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  cancellationReason: z.string().trim().max(500).optional(),
});

module.exports = {
  cancelOrderSchema,
  updateOrderStatusSchema,
};
