const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { registerSchema, loginSchema } = require('../../src/validators/authValidator');
const { createProductSchema, updateProductSchema } = require('../../src/validators/productValidator');
const { checkoutSchema, shippingAddressSchema } = require('../../src/validators/orderValidator');
const { createReviewSchema } = require('../../src/validators/reviewValidator');

const runValidationUnitTests = async () => {
  console.log('\n================================================================');
  console.log('       SHOPSPHERE UNIT SUITE: ZOD VALIDATION SCHEMAS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    // ----------------------------------------------------
    // Test 1: Authentication Registration Schema
    // ----------------------------------------------------
    console.log('[1] Testing User Registration Schema Validation...');
    const validRegister = registerSchema.safeParse({
      name: 'John Doe',
      email: 'John.Doe@Example.com',
      password: 'Password123!',
    });
    assert(validRegister.success, 'Valid registration payload passes validation');
    assert(validRegister.data?.email === 'john.doe@example.com', 'Normalizes email to lowercase');

    const shortName = registerSchema.safeParse({
      name: 'J',
      email: 'john@example.com',
      password: 'Password123!',
    });
    assert(!shortName.success, 'Rejects name shorter than 2 characters');

    const badEmail = registerSchema.safeParse({
      name: 'John Doe',
      email: 'not-an-email',
      password: 'Password123!',
    });
    assert(!badEmail.success, 'Rejects malformed email string');

    const weakPasswordNoNumber = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'onlyletters',
    });
    assert(!weakPasswordNoNumber.success, 'Rejects password lacking numbers');

    const weakPasswordShort = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'p1',
    });
    assert(!weakPasswordShort.success, 'Rejects password shorter than 8 characters');

    // ----------------------------------------------------
    // Test 2: Authentication Login Schema
    // ----------------------------------------------------
    console.log('\n[2] Testing User Login Schema Validation...');
    const validLogin = loginSchema.safeParse({
      email: 'john@example.com',
      password: 'Password123!',
    });
    assert(validLogin.success, 'Valid login payload passes');

    const emptyPassword = loginSchema.safeParse({
      email: 'john@example.com',
      password: '',
    });
    assert(!emptyPassword.success, 'Rejects empty password on login');

    // ----------------------------------------------------
    // Test 3: Shipping Address & Checkout Schema
    // ----------------------------------------------------
    console.log('\n[3] Testing Shipping Address & Checkout Schema...');
    const validAddress = {
      fullName: 'Rahul Sharma',
      phone: '9876543210', // Valid 10-digit Indian mobile
      addressLine1: 'Flat 402, Green Meadows',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001', // Valid 6-digit Indian PIN
      country: 'India',
    };

    const validCheckout = checkoutSchema.safeParse({ shippingAddress: validAddress });
    assert(validCheckout.success, 'Valid checkout shipping address passes');

    const invalidPhone = shippingAddressSchema.safeParse({
      ...validAddress,
      phone: '1234567890', // Invalid starting digit for Indian mobile
    });
    assert(!invalidPhone.success, 'Rejects Indian phone number not starting with 6-9');

    const shortPhone = shippingAddressSchema.safeParse({
      ...validAddress,
      phone: '987654321', // 9 digits
    });
    assert(!shortPhone.success, 'Rejects phone number with fewer than 10 digits');

    const invalidPincode = shippingAddressSchema.safeParse({
      ...validAddress,
      pincode: '56000', // 5 digits
    });
    assert(!invalidPincode.success, 'Rejects PIN code with fewer than 6 digits');

    const shortAddress1 = shippingAddressSchema.safeParse({
      ...validAddress,
      addressLine1: 'Abc', // Less than 5 chars
    });
    assert(!shortAddress1.success, 'Rejects addressLine1 under 5 characters');

    // ----------------------------------------------------
    // Test 4: Product Creation & Mutation Schema
    // ----------------------------------------------------
    console.log('\n[4] Testing Product Validation Schemas...');
    const validProductPayload = {
      name: 'Premium Ergonomic Office Chair',
      description: 'Ergonomic mesh chair with lumbar support and 3D adjustable armrests.',
      price: '15999', // coerced to number
      discount: '15',
      category: '507f1f77bcf86cd799439011', // Valid 24-char ObjectId
      stock: '25',
    };

    const validProduct = createProductSchema.safeParse(validProductPayload);
    assert(validProduct.success, 'Valid product payload passes with string number coercion');
    assert(typeof validProduct.data?.price === 'number', 'Coerces price string to number');
    assert(typeof validProduct.data?.stock === 'number', 'Coerces stock string to integer');

    const negativePrice = createProductSchema.safeParse({
      ...validProductPayload,
      price: -100,
    });
    assert(!negativePrice.success, 'Rejects negative product price');

    const excessiveDiscount = createProductSchema.safeParse({
      ...validProductPayload,
      discount: 150, // > 100%
    });
    assert(!excessiveDiscount.success, 'Rejects discount exceeding 100%');

    const invalidCategory = createProductSchema.safeParse({
      ...validProductPayload,
      category: 'not-an-object-id',
    });
    assert(!invalidCategory.success, 'Rejects invalid MongoDB ObjectId format for category');

    const negativeStock = createProductSchema.safeParse({
      ...validProductPayload,
      stock: -5,
    });
    assert(!negativeStock.success, 'Rejects negative stock quantity');

    // ----------------------------------------------------
    // Test 5: Customer Review Schema
    // ----------------------------------------------------
    console.log('\n[5] Testing Customer Review Schema Validation...');
    const validReview = createReviewSchema.safeParse({
      rating: 5,
      title: 'Outstanding quality!',
      comment: 'Very comfortable chair, exceeded expectations for long workdays.',
    });
    assert(validReview.success, 'Valid 5-star review passes');

    const outOfBoundsHigh = createReviewSchema.safeParse({
      rating: 6,
      comment: 'Super great!',
    });
    assert(!outOfBoundsHigh.success, 'Rejects rating greater than 5');

    const outOfBoundsLow = createReviewSchema.safeParse({
      rating: 0,
      comment: 'Terrible!',
    });
    assert(!outOfBoundsLow.success, 'Rejects rating lower than 1');

    const fractionalRating = createReviewSchema.safeParse({
      rating: 4.5,
      comment: 'Good product!',
    });
    assert(!fractionalRating.success, 'Rejects non-integer fractional rating (e.g. 4.5)');

    const shortComment = createReviewSchema.safeParse({
      rating: 4,
      comment: 'Bad', // < 5 chars
    });
    assert(!shortComment.success, 'Rejects review comment shorter than 5 characters');

    console.log('\n----------------------------------------------------------------');
    console.log(`VALIDATION SCHEMAS TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('----------------------------------------------------------------\n');

    return { suite: 'validationSchemas', passed, failed };
  } catch (error) {
    console.error('Fatal error in validationSchemas unit tests:', error);
    return { suite: 'validationSchemas', passed, failed: failed + 1 };
  }
};

if (require.main === module) {
  runValidationUnitTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runValidationUnitTests;
