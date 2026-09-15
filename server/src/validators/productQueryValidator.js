const { z } = require('zod');

const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => val === true || val === 'true'),
  sort: z
    .enum(['newest', 'price-asc', 'price-desc', 'rating', 'popularity'])
    .optional()
    .default('newest'),
}).refine(
  (data) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  },
  {
    message: 'minPrice cannot be greater than maxPrice',
    path: ['minPrice'],
  }
);

module.exports = {
  productQuerySchema,
};
