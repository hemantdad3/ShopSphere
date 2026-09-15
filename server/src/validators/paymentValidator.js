const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const initiatePaymentSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .regex(objectIdRegex, 'Invalid Order ID format'),
});

const verifyPaymentSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .regex(objectIdRegex, 'Invalid Order ID format'),
  razorpayOrderId: z
    .string({ required_error: 'Razorpay Order ID is required' })
    .min(1, 'Razorpay Order ID cannot be empty'),
  razorpayPaymentId: z
    .string({ required_error: 'Razorpay Payment ID is required' })
    .min(1, 'Razorpay Payment ID cannot be empty'),
  razorpaySignature: z
    .string({ required_error: 'Razorpay Signature is required' })
    .min(1, 'Razorpay Signature cannot be empty'),
});

const paymentFailureSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .regex(objectIdRegex, 'Invalid Order ID format'),
  reason: z
    .string()
    .trim()
    .optional()
    .default('Payment cancelled by customer'),
});

module.exports = {
  initiatePaymentSchema,
  verifyPaymentSchema,
  paymentFailureSchema,
};
