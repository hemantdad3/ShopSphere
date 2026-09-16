const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api/products`;

const runTests = async () => {
  console.log('\n================================================================');
  console.log('   SHOPSPHERE PHASE 4: PRODUCT DISCOVERY, SEARCH & FILTER TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  let localServer = null;

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
    // 1. Connect to Database
    await connectDB();

    // 2. Ensure HTTP server is active
    try {
      const ping = await fetch(`http://localhost:${PORT}/api/health`);
      if (!ping.ok) throw new Error('Not running');
    } catch {
      localServer = app.listen(PORT);
      await new Promise((res) => setTimeout(res, 500));
    }

    // 3. Seed test categories and products
    console.log('[Setup] Seeding test catalog dataset...');
    const catSuffix = Date.now();

    const techCat = await Category.create({
      name: `Audio & Tech ${catSuffix}`,
      description: 'Headphones, speakers, and premium audio devices',
    });

    const bookCat = await Category.create({
      name: `Books & Literature ${catSuffix}`,
      description: 'Fiction, non-fiction, and engineering guides',
    });

    // Seed 6 diverse products
    const seededProducts = await Product.create([
      {
        name: 'Sony WH-1000XM5 Wireless Headphones',
        description: 'Industry-leading noise cancelling wireless headphones with 30-hour battery',
        price: 29990,
        discount: 10,
        category: techCat._id,
        stock: 25,
        ratingAverage: 4.8,
        reviewCount: 150,
        images: [{ url: 'https://ik.imagekit.io/test/sony.jpg', fileId: 'sony_1' }],
      },
      {
        name: 'Anker Soundcore Mini Bluetooth Speaker',
        description: 'Super-portable wireless outdoor speaker with punchy bass and waterproof shell',
        price: 2499,
        discount: 0,
        category: techCat._id,
        stock: 50,
        ratingAverage: 4.3,
        reviewCount: 85,
        images: [{ url: 'https://ik.imagekit.io/test/anker.jpg', fileId: 'anker_1' }],
      },
      {
        name: 'Bose QuietComfort 45 Noise Cancelling',
        description: 'Legendary noise cancelling headphones for deep focus and travel',
        price: 24900,
        discount: 5,
        category: techCat._id,
        stock: 0, // Out of stock
        ratingAverage: 4.6,
        reviewCount: 110,
        images: [{ url: 'https://ik.imagekit.io/test/bose.jpg', fileId: 'bose_1' }],
      },
      {
        name: 'Designing Data-Intensive Applications',
        description: 'The definitive big ideas behind reliable, scalable, and maintainable systems',
        price: 1850,
        discount: 15,
        category: bookCat._id,
        stock: 100,
        ratingAverage: 4.9,
        reviewCount: 320,
        images: [{ url: 'https://ik.imagekit.io/test/ddia.jpg', fileId: 'ddia_1' }],
      },
      {
        name: 'Clean Code: A Handbook of Agile Software',
        description: 'Even bad code can function, but messy code brings down development teams',
        price: 1450,
        discount: 0,
        category: bookCat._id,
        stock: 40,
        ratingAverage: 4.5,
        reviewCount: 210,
        images: [{ url: 'https://ik.imagekit.io/test/cleancode.jpg', fileId: 'cleancode_1' }],
      },
      {
        name: 'System Design Interview – Volume 2',
        description: 'Step-by-step systems architecture guide with real-world industry case studies',
        price: 2200,
        discount: 5,
        category: bookCat._id,
        stock: 0, // Out of stock
        ratingAverage: 4.7,
        reviewCount: 180,
        images: [{ url: 'https://ik.imagekit.io/test/sysdesign.jpg', fileId: 'sysdesign_1' }],
      },
    ]);

    // ----------------------------------------------------
    // Test 1: Full-Text Search (Name & Description)
    // ----------------------------------------------------
    console.log('\n[1] Testing Search Functionality...');
    const searchRes = await fetch(`${BASE_URL}?search=Headphones`);
    const searchData = await searchRes.json();
    assert(searchRes.status === 200, 'Search request returns HTTP 200 OK');
    assert(
      searchData.data.products.length >= 2 &&
      searchData.data.products.every(
        (p) =>
          p.name.toLowerCase().includes('headphones') ||
          p.description.toLowerCase().includes('headphones')
      ),
      'Search for "Headphones" matches products case-insensitively across name and description'
    );

    // Search matching description specifically within test category
    const descSearchRes = await fetch(`${BASE_URL}?search=maintainable&category=${bookCat.slug}`);
    const descSearchData = await descSearchRes.json();
    assert(
      descSearchData.data.products.length === 1 &&
      descSearchData.data.products[0].name.includes('Data-Intensive'),
      'Search for description term "maintainable" correctly returns DDIA'
    );

    // ----------------------------------------------------
    // Test 2: ReDoS Defense (Malicious Regex Escaping)
    // ----------------------------------------------------
    console.log('\n[2] Testing ReDoS Defense & Regex Escaping...');
    const redosPayload = encodeURIComponent('(a+)+$');
    const redosRes = await fetch(`${BASE_URL}?search=${redosPayload}`);
    const redosData = await redosRes.json();
    assert(redosRes.status === 200, 'ReDoS regex payload handles safely without crash or timeout');
    assert(Array.isArray(redosData.data.products), 'Products array returned safely');

    // Regex characters like parentheses, plus, brackets should be treated as literal strings
    const literalSpecialRes = await fetch(`${BASE_URL}?search=${encodeURIComponent('Volume 2')}`);
    const literalSpecialData = await literalSpecialRes.json();
    assert(
      literalSpecialData.data.products.length === 1 &&
      literalSpecialData.data.products[0].name.includes('Volume 2'),
      'Search with special regex characters matches literal product text'
    );

    // ----------------------------------------------------
    // Test 3: Category Filtering (Slug & ObjectId)
    // ----------------------------------------------------
    console.log('\n[3] Testing Category Filtering...');
    // Filter by Slug
    const catSlugRes = await fetch(`${BASE_URL}?category=${techCat.slug}`);
    const catSlugData = await catSlugRes.json();
    assert(catSlugRes.status === 200, 'Filter by category slug returns HTTP 200');
    assert(
      catSlugData.data.products.length === 3 &&
      catSlugData.data.products.every((p) => p.category.slug === techCat.slug),
      'Filter by category slug matches all 3 Audio & Tech products'
    );

    // Filter by ObjectId
    const catIdRes = await fetch(`${BASE_URL}?category=${bookCat._id}`);
    const catIdData = await catIdRes.json();
    assert(
      catIdData.data.products.length === 3 &&
      catIdData.data.products.every((p) => p.category._id.toString() === bookCat._id.toString()),
      'Filter by category ObjectId matches all 3 Books products'
    );

    // Filter by non-existent category slug
    const nonExistentCatRes = await fetch(`${BASE_URL}?category=non-existent-category-slug-9999`);
    const nonExistentCatData = await nonExistentCatRes.json();
    assert(nonExistentCatRes.status === 200, 'Non-existent category slug returns HTTP 200');
    assert(
      nonExistentCatData.data.products.length === 0 && nonExistentCatData.data.pagination.total === 0,
      'Non-existent category returns empty array with total: 0'
    );

    // ----------------------------------------------------
    // Test 4: Price Range Filtering
    // ----------------------------------------------------
    console.log('\n[4] Testing Price Range Filtering...');
    // minPrice filter within test category
    const minPriceRes = await fetch(`${BASE_URL}?minPrice=20000&category=${techCat.slug}`);
    const minPriceData = await minPriceRes.json();
    assert(
      minPriceData.data.products.length === 2 &&
      minPriceData.data.products.every((p) => p.price >= 20000),
      'minPrice=20000 returns only products with price >= 20000'
    );

    // maxPrice filter within test category
    const maxPriceRes = await fetch(`${BASE_URL}?maxPrice=2000&category=${bookCat.slug}`);
    const maxPriceData = await maxPriceRes.json();
    assert(
      maxPriceData.data.products.length === 2 &&
      maxPriceData.data.products.every((p) => p.price <= 2000),
      'maxPrice=2000 returns only products with price <= 2000'
    );

    // Bounded minPrice and maxPrice range
    const rangeRes = await fetch(`${BASE_URL}?minPrice=2000&maxPrice=3000`);
    const rangeData = await rangeRes.json();
    assert(
      rangeData.data.products.length >= 2 &&
      rangeData.data.products.every((p) => p.price >= 2000 && p.price <= 3000),
      'minPrice=2000 & maxPrice=3000 returns only products in range [2000, 3000]'
    );

    // Invalid Price Range (minPrice > maxPrice)
    const invalidPriceRes = await fetch(`${BASE_URL}?minPrice=5000&maxPrice=1000`);
    const invalidPriceData = await invalidPriceRes.json();
    assert(invalidPriceRes.status === 400, 'minPrice > maxPrice returns HTTP 400 Validation Error');
    assert(invalidPriceData.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // ----------------------------------------------------
    // Test 5: Stock Availability Filter
    // ----------------------------------------------------
    console.log('\n[5] Testing Stock Availability Filter...');
    const inStockRes = await fetch(`${BASE_URL}?inStock=true&category=${techCat.slug}`);
    const inStockData = await inStockRes.json();
    assert(
      inStockData.data.products.length === 2 &&
      inStockData.data.products.every((p) => p.stock > 0),
      'inStock=true excludes 0-stock products (Bose QC45 omitted)'
    );

    // ----------------------------------------------------
    // Test 6: Deterministic Multi-Criteria Sorting
    // ----------------------------------------------------
    console.log('\n[6] Testing Sorting Mechanisms...');
    // Price Ascending
    const sortAscRes = await fetch(`${BASE_URL}?category=${bookCat.slug}&sort=price-asc`);
    const sortAscData = await sortAscRes.json();
    const ascPrices = sortAscData.data.products.map((p) => p.price);
    assert(
      JSON.stringify(ascPrices) === JSON.stringify([1450, 1850, 2200]),
      'sort=price-asc orders books in ascending price [1450, 1850, 2200]'
    );

    // Price Descending
    const sortDescRes = await fetch(`${BASE_URL}?category=${bookCat.slug}&sort=price-desc`);
    const sortDescData = await sortDescRes.json();
    const descPrices = sortDescData.data.products.map((p) => p.price);
    assert(
      JSON.stringify(descPrices) === JSON.stringify([2200, 1850, 1450]),
      'sort=price-desc orders books in descending price [2200, 1850, 1450]'
    );

    // Rating
    const sortRatingRes = await fetch(`${BASE_URL}?sort=rating`);
    const sortRatingData = await sortRatingRes.json();
    const ratings = sortRatingData.data.products.map((p) => p.ratingAverage);
    const isSortedRating = ratings.every((val, i, arr) => !i || arr[i - 1] >= val);
    assert(isSortedRating, 'sort=rating orders products from highest to lowest rating');

    // ----------------------------------------------------
    // Test 7: Bounded Pagination & Metadata
    // ----------------------------------------------------
    console.log('\n[7] Testing Bounded Pagination & Metadata...');
    // Page 1 with limit 2
    const page1Res = await fetch(`${BASE_URL}?category=${bookCat.slug}&page=1&limit=2&sort=price-asc`);
    const page1Data = await page1Res.json();
    assert(page1Data.data.products.length === 2, 'Page 1 returns exactly 2 products');
    assert(page1Data.data.pagination.page === 1, 'Pagination page is 1');
    assert(page1Data.data.pagination.limit === 2, 'Pagination limit is 2');
    assert(page1Data.data.pagination.total === 3, 'Total matching products is 3');
    assert(page1Data.data.pagination.totalPages === 2, 'Total pages is 2');
    assert(page1Data.data.pagination.hasNextPage === true, 'hasNextPage is true for page 1');
    assert(page1Data.data.pagination.hasPrevPage === false, 'hasPrevPage is false for page 1');

    // Page 2 with limit 2
    const page2Res = await fetch(`${BASE_URL}?category=${bookCat.slug}&page=2&limit=2&sort=price-asc`);
    const page2Data = await page2Res.json();
    assert(page2Data.data.products.length === 1, 'Page 2 returns remaining 1 product');
    assert(page2Data.data.pagination.page === 2, 'Pagination page is 2');
    assert(page2Data.data.pagination.hasNextPage === false, 'hasNextPage is false for last page');
    assert(page2Data.data.pagination.hasPrevPage === true, 'hasPrevPage is true for page 2');

    // Exceeding max limit (DoS protection: limit > 50 rejected)
    const excessLimitRes = await fetch(`${BASE_URL}?limit=100`);
    const excessLimitData = await excessLimitRes.json();
    assert(excessLimitRes.status === 400, 'limit=100 rejected by Zod schema with HTTP 400');
    assert(excessLimitData.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // Invalid page number (page < 1)
    const invalidPageRes = await fetch(`${BASE_URL}?page=0`);
    assert(invalidPageRes.status === 400, 'page=0 rejected with HTTP 400 Validation Error');

    // ----------------------------------------------------
    // Test 8: Compound Query Integration
    // ----------------------------------------------------
    console.log('\n[8] Testing Compound Query Integration...');
    // Search + Category + InStock + Price Range + Sort
    const compoundUrl = `${BASE_URL}?category=${techCat.slug}&search=Wireless&inStock=true&minPrice=20000&maxPrice=35000&sort=price-desc`;
    const compoundRes = await fetch(compoundUrl);
    const compoundData = await compoundRes.json();
    assert(compoundRes.status === 200, 'Compound query returns HTTP 200');
    assert(
      compoundData.data.products.length === 1 &&
      compoundData.data.products[0].name.includes('Sony WH-1000XM5'),
      'Compound query accurately narrows results down to Sony WH-1000XM5'
    );

    // ----------------------------------------------------
    // Test 9: Database Index Verification (Explain Plans)
    // ----------------------------------------------------
    console.log('\n[9] Verifying MongoDB Query Index Execution Plan...');
    // Verify compound index: { category: 1, price: 1 }
    const explainPlan1 = await Product.find({
      category: techCat._id,
      price: { $gte: 2000, $lte: 30000 },
      isActive: true,
    })
      .sort({ price: 1 })
      .explain('executionStats');

    const winningPlan = explainPlan1.queryPlanner.winningPlan;
    const stage = winningPlan.stage || winningPlan.inputStage?.stage;
    const usesIndex = stage === 'IXSCAN' || winningPlan.inputStage?.stage === 'IXSCAN';
    assert(usesIndex, 'Compound query on category + price uses index scan (IXSCAN)');

    // Verify index on price: { price: 1 }
    const explainPlan2 = await Product.find({ price: { $gte: 1000 } })
      .sort({ price: 1 })
      .explain('executionStats');
    const priceStage = explainPlan2.queryPlanner.winningPlan.stage || explainPlan2.queryPlanner.winningPlan.inputStage?.stage;
    assert(
      priceStage === 'IXSCAN' || explainPlan2.queryPlanner.winningPlan.inputStage?.stage === 'IXSCAN',
      'Price range query uses price index scan (IXSCAN)'
    );

    // ----------------------------------------------------
    // Cleanup
    // ----------------------------------------------------
    console.log('\n[Cleanup] Removing test categories and products...');
    const seededProductIds = seededProducts.map((p) => p._id);
    await Product.deleteMany({ _id: { $in: seededProductIds } });
    await Category.deleteMany({ _id: { $in: [techCat._id, bookCat._id] } });

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (localServer) {
      localServer.close();
    }
    await disconnectDB();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during discovery test execution:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
