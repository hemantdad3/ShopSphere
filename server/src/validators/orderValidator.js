const { z } = require('zod');

const indianPhoneRegex = /^[6-9]\d{9}$/;
const indianPincodeRegex = /^\d{6}$/;

const shippingAddressSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(indianPhoneRegex, 'Please provide a valid 10-digit Indian phone number'),
  addressLine1: z
    .string({ required_error: 'Address Line 1 is required' })
    .trim()
    .min(5, 'Address Line 1 must be at least 5 characters')
    .max(200, 'Address Line 1 cannot exceed 200 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(200, 'Address Line 2 cannot exceed 200 characters')
    .optional()
    .default(''),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City cannot exceed 100 characters'),
  state: z
    .string({ required_error: 'State is required' })
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(100, 'State cannot exceed 100 characters'),
  pincode: z
    .string({ required_error: 'Pincode is required' })
    .trim()
    .regex(indianPincodeRegex, 'Please provide a valid 6-digit PIN code'),
  country: z
    .string()
    .trim()
    .default('India'),
});

const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
});

module.exports = {
  shippingAddressSchema,
  checkoutSchema,
};
