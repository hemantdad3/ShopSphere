const { z } = require('zod');

const createReviewSchema = z.object({
  rating: z
    .number({
      required_error: 'Rating is required',
      invalid_type_error: 'Rating must be a number',
    })
    .int('Rating must be an integer between 1 and 5')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  title: z.string().trim().max(100, 'Title cannot exceed 100 characters').optional(),
  comment: z
    .string({
      required_error: 'Review comment is required',
    })
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(1000, 'Review comment cannot exceed 1000 characters'),
});

module.exports = {
  createReviewSchema,
};
