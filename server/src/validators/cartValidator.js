const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const addToCartSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .regex(objectIdRegex, 'Invalid Product ID format'),
  quantity: z.coerce
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(10, 'Maximum 10 units allowed per item')
    .optional()
    .default(1),
});

const updateCartItemSchema = z.object({
  quantity: z.coerce
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .min(0, 'Quantity cannot be negative')
    .max(10, 'Maximum 10 units allowed per item'),
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
};
