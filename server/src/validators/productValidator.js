const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(3, 'Product name must be at least 3 characters long')
    .max(120, 'Product name cannot exceed 120 characters'),
  description: z
    .string({ required_error: 'Product description is required' })
    .trim()
    .min(10, 'Product description must be at least 10 characters long')
    .max(3000, 'Product description cannot exceed 3000 characters'),
  price: z.coerce
    .number({ required_error: 'Product price is required' })
    .min(0, 'Price cannot be negative'),
  discount: z.coerce
    .number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .optional()
    .default(0),
  category: z
    .string({ required_error: 'Category ID is required' })
    .regex(objectIdRegex, 'Invalid Category ID format'),
  stock: z.coerce
    .number({ required_error: 'Stock count is required' })
    .int('Stock must be an integer')
    .min(0, 'Stock cannot be negative'),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  category: z.string().regex(objectIdRegex, 'Invalid Category ID format').optional(),
  stock: z.coerce.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').optional(),
  isActive: z.coerce.boolean().optional(),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
};
