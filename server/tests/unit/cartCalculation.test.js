const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { calculateCart } = require('../../src/services/cartService');

const runCartCalculationUnitTests = async () => {
  console.log('\n================================================================');
  console.log('    SHOPSPHERE UNIT SUITE: AUTHORITATIVE CART CALCULATION');
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
    // Helper to mock cartDoc without requiring live database round-trips
    const createMockCartDoc = (items) => ({
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      items,
      populate: async () => {}, // Mock populate as items are already populated
    });

    // ----------------------------------------------------
    // Test 1: Authoritative Price, Discount, and Subtotal Math
    // ----------------------------------------------------
    console.log('[1] Testing Accurate Math & Discount Computations...');
    const productA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Mechanical Keyboard',
      slug: 'mechanical-keyboard',
      price: 2000,
      discount: 10, // 10% discount -> finalPrice = 1800
      stock: 10,
      isActive: true,
      images: [{ url: 'https://example.com/kb.jpg' }],
    };

    const productB = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Gaming Mouse',
      slug: 'gaming-mouse',
      price: 800,
      discount: 0, // No discount -> finalPrice = 800
      stock: 15,
      isActive: true,
      images: [{ url: 'https://example.com/mouse.jpg' }],
    };

    const mockCart1 = createMockCartDoc([
      { _id: new mongoose.Types.ObjectId(), product: productA, quantity: 2 }, // 2 * 1800 = 3600 (subtotal 4000, discount 400)
      { _id: new mongoose.Types.ObjectId(), product: productB, quantity: 3 }, // 3 * 800 = 2400 (subtotal 2400, discount 0)
    ]);

    const result1 = await calculateCart(mockCart1);

    assert(result1.summary.totalItems === 5, 'totalItems accurately sums quantities (2 + 3 = 5)');
    assert(result1.summary.subtotal === 6400, 'subtotal accurately computed from original prices (4000 + 2400 = 6400)');
    assert(result1.summary.discountTotal === 400, 'discountTotal accurately calculated (400 + 0 = 400)');
    assert(result1.summary.finalTotal === 6000, 'finalTotal reflects subtotal minus discount (6400 - 400 = 6000)');
    assert(result1.summary.hasStockIssues === false, 'hasStockIssues is false for well-stocked items');
    assert(result1.items[0].finalPrice === 1800, 'Calculates correct discounted unit price (1800)');
    assert(result1.items[0].lineSubtotal === 4000, 'Calculates correct line subtotal');
    assert(result1.items[0].lineTotal === 3600, 'Calculates correct line total');

    // ----------------------------------------------------
    // Test 2: Stock Degradation - Requested Quantity Exceeds Stock
    // ----------------------------------------------------
    console.log('\n[2] Testing Requested Quantity Exceeding Inventory...');
    const scarceProduct = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Limited Edition Keycap',
      slug: 'limited-edition-keycap',
      price: 500,
      discount: 0,
      stock: 2, // Only 2 in stock
      isActive: true,
      images: [],
    };

    const mockCart2 = createMockCartDoc([
      { _id: new mongoose.Types.ObjectId(), product: scarceProduct, quantity: 5 }, // Wants 5, only 2 available
    ]);

    const result2 = await calculateCart(mockCart2);

    assert(result2.summary.hasStockIssues === true, 'hasStockIssues flagged true when quantity exceeds stock');
    assert(result2.items[0].isAvailable === false, 'isAvailable marked false on overstocked item');
    assert(result2.items[0].availableStock === 2, 'Reports accurate availableStock to client');
    assert(
      result2.items[0].issueReason.includes('only 2 available'),
      'Provides human-readable issueReason for UX feedback'
    );
    assert(result2.summary.finalTotal === 0, 'Unavailable items excluded from finalTotal');

    // ----------------------------------------------------
    // Test 3: Completely Out of Stock Product (Stock === 0)
    // ----------------------------------------------------
    console.log('\n[3] Testing Out of Stock Handling (Stock === 0)...');
    const zeroStockProduct = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Sold Out Item',
      slug: 'sold-out-item',
      price: 1200,
      discount: 0,
      stock: 0,
      isActive: true,
      images: [],
    };

    const mockCart3 = createMockCartDoc([
      { _id: new mongoose.Types.ObjectId(), product: zeroStockProduct, quantity: 1 },
    ]);

    const result3 = await calculateCart(mockCart3);

    assert(result3.summary.hasStockIssues === true, 'hasStockIssues flagged true for 0 stock');
    assert(result3.items[0].isAvailable === false, 'Item marked unavailable');
    assert(result3.items[0].issueReason.includes('out of stock'), 'Reports "out of stock" issue reason');
    assert(result3.summary.finalTotal === 0, 'Zero stock items excluded from finalTotal');

    // ----------------------------------------------------
    // Test 4: Inactive and Deleted Product Handling
    // ----------------------------------------------------
    console.log('\n[4] Testing Inactive & Deleted Products...');
    const inactiveProduct = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Deactivated Item',
      slug: 'deactivated-item',
      price: 999,
      discount: 0,
      stock: 10,
      isActive: false, // Inactive
      images: [],
    };

    const mockCart4 = createMockCartDoc([
      { _id: new mongoose.Types.ObjectId(), product: inactiveProduct, quantity: 1 },
      { _id: new mongoose.Types.ObjectId(), product: null, quantity: 1 }, // Deleted from DB
    ]);

    const result4 = await calculateCart(mockCart4);

    assert(result4.summary.hasStockIssues === true, 'hasStockIssues flagged true for inactive/deleted items');
    assert(result4.items[0].isAvailable === false, 'Inactive product marked unavailable');
    assert(result4.items[1].isAvailable === false, 'Deleted product marked unavailable');
    assert(result4.items[1].issueReason.includes('no longer exists'), 'Deleted product explains reason');

    // ----------------------------------------------------
    // Test 5: Client-Side Price Tampering Defense (Zero-Trust Principle)
    // ----------------------------------------------------
    console.log('\n[5] Testing Zero-Trust Pricing Defense...');
    // Attacker tries to inject client-side prices or discounts directly into the item
    const tamperedProduct = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Luxury Laptop',
      slug: 'luxury-laptop',
      price: 80000, // Genuine price
      discount: 5,  // Genuine discount: 5% -> 76,000
      stock: 5,
      isActive: true,
      images: [],
    };

    const mockCart5 = createMockCartDoc([
      {
        _id: new mongoose.Types.ObjectId(),
        product: tamperedProduct,
        quantity: 1,
        // Injected malicious properties by client
        price: 1,
        unitPrice: 1,
        finalPrice: 1,
        discount: 99,
        lineTotal: 1,
      },
    ]);

    const result5 = await calculateCart(mockCart5);

    assert(result5.items[0].unitPrice === 80000, 'Authoritative calculation ignores client injected unitPrice (uses 80000)');
    assert(result5.items[0].finalPrice === 76000, 'Authoritative calculation ignores client injected finalPrice (uses 76000)');
    assert(result5.summary.finalTotal === 76000, 'Final cart total strictly reflects database authoritative price');

    console.log('\n----------------------------------------------------------------');
    console.log(`CART CALCULATION TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('----------------------------------------------------------------\n');

    return { suite: 'cartCalculation', passed, failed };
  } catch (error) {
    console.error('Fatal error in cartCalculation unit tests:', error);
    return { suite: 'cartCalculation', passed, failed: failed + 1 };
  }
};

if (require.main === module) {
  runCartCalculationUnitTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runCartCalculationUnitTests;
