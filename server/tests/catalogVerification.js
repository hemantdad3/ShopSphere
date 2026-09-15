const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');

const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('\n======================================================');
  console.log('   SHOPSPHERE PHASE 3: CATEGORY & PRODUCT MANAGEMENT TEST');
  console.log('======================================================\n');

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
    await connectDB();

    try {
      const ping = await fetch(`${BASE_URL}/health`);
      if (!ping.ok) throw new Error('Not running');
    } catch {
      localServer = app.listen(5000);
      await new Promise((res) => setTimeout(res, 500));
    }

    // 1. Setup Admin and Customer Users
    const adminEmail = `admin_${Date.now()}@shopsphere.com`;
    const customerEmail = `customer_${Date.now()}@shopsphere.com`;
    const password = 'Password123!';

    await User.create({
      name: 'Store Admin',
      email: adminEmail,
      passwordHash: password,
      role: 'ADMIN',
    });

    await User.create({
      name: 'Regular Customer',
      email: customerEmail,
      passwordHash: password,
      role: 'CUSTOMER',
    });

    // 2. Obtain session cookies
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0];

    const customerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password }),
    });
    const customerCookie = customerLoginRes.headers.get('set-cookie')?.split(';')[0];

    // ----------------------------------------------------
    // Test 1: Category Access Control
    // ----------------------------------------------------
    console.log('[1] Testing Category RBAC...');
    const catName = `Electronics ${Date.now()}`;

    // Customer should be blocked from creating categories
    const custCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({ name: catName, description: 'Electronic gadgets' }),
    });
    const custCatData = await custCatRes.json();
    assert(custCatRes.status === 403, 'Customer creating category returns HTTP 403 Forbidden');
    assert(custCatData.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Admin creates category successfully
    const adminCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ name: catName, description: 'Electronic gadgets and devices' }),
    });
    const adminCatData = await adminCatRes.json();
    assert(adminCatRes.status === 201, 'Admin creating category returns HTTP 201 Created');
    assert(adminCatData.data.category.name === catName, 'Category name matches input');
    assert(adminCatData.data.category.slug.startsWith('electronics-'), 'Category slug was auto-generated');
    const categoryId = adminCatData.data.category._id;
    const categorySlug = adminCatData.data.category.slug;

    // ----------------------------------------------------
    // Test 2: Public Category Discovery
    // ----------------------------------------------------
    console.log('\n[2] Testing Public Category Discovery...');
    const allCatRes = await fetch(`${BASE_URL}/categories`);
    const allCatData = await allCatRes.json();
    assert(allCatRes.status === 200, 'Public GET /categories returns HTTP 200 OK');
    assert(Array.isArray(allCatData.data.categories), 'Categories returned as array');

    const singleCatRes = await fetch(`${BASE_URL}/categories/${categorySlug}`);
    const singleCatData = await singleCatRes.json();
    assert(singleCatRes.status === 200, 'Public GET /categories/:slug returns HTTP 200 OK');
    assert(singleCatData.data.category.slug === categorySlug, 'Category slug matches requested slug');

    // ----------------------------------------------------
    // Test 3: Product Validation & RBAC
    // ----------------------------------------------------
    console.log('\n[3] Testing Product Validation & RBAC...');
    const prodName = `Noise Cancelling Headphones ${Date.now()}`;

    // Customer cannot create product
    const custProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie,
      },
      body: JSON.stringify({
        name: prodName,
        description: 'Premium active noise cancelling over-ear headphones with 30-hour battery life.',
        price: 14999,
        category: categoryId,
        stock: 50,
      }),
    });
    assert(custProdRes.status === 403, 'Customer creating product returns HTTP 403 Forbidden');

    // Negative price validation rejection
    const negPriceRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: prodName,
        description: 'Valid description for testing negative price validation rules.',
        price: -500,
        category: categoryId,
        stock: 10,
      }),
    });
    const negPriceData = await negPriceRes.json();
    assert(negPriceRes.status === 400, 'Negative price rejected with HTTP 400 Bad Request');
    assert(negPriceData.code === 'VALIDATION_ERROR', 'Validation error code is returned');

    // Negative stock validation rejection
    const negStockRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: prodName,
        description: 'Valid description for testing negative stock validation rules.',
        price: 999,
        category: categoryId,
        stock: -5,
      }),
    });
    assert(negStockRes.status === 400, 'Negative stock rejected with HTTP 400 Bad Request');

    // ----------------------------------------------------
    // Test 4: Product Creation with Image Upload Pipeline
    // ----------------------------------------------------
    console.log('\n[4] Testing Admin Product Creation & Media Pipeline...');
    // Create product as admin (with multipart mock or direct JSON)
    const validProdRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: prodName,
        description: 'Premium active noise cancelling over-ear headphones with 30-hour battery life.',
        price: 12000,
        discount: 10, // 10% discount
        category: categoryId,
        stock: 25,
      }),
    });
    const validProdData = await validProdRes.json();
    assert(validProdRes.status === 201, 'Valid product created with HTTP 201 Created');
    assert(validProdData.data.product.name === prodName, 'Product name matches input');
    assert(validProdData.data.product.price === 12000, 'Product price stored accurately');
    assert(validProdData.data.product.stock === 25, 'Product stock stored accurately');
    assert(validProdData.data.product.slug.includes('noise-cancelling'), 'Product slug auto-generated');
    const productId = validProdData.data.product._id;
    const productSlug = validProdData.data.product.slug;

    // ----------------------------------------------------
    // Test 5: Public Product Detail & Virtual Field
    // ----------------------------------------------------
    console.log('\n[5] Testing Product Retrieval & Virtual Price Calculation...');
    const getProdRes = await fetch(`${BASE_URL}/products/${productSlug}`);
    const getProdData = await getProdRes.json();
    assert(getProdRes.status === 200, 'GET /products/:slug returns HTTP 200 OK');
    assert(getProdData.data.product.finalPrice === 10800, 'Virtual finalPrice calculates 10% discount correctly (12000 -> 10800)');
    assert(getProdData.data.product.category.name === catName, 'Category was populated cleanly');

    // ----------------------------------------------------
    // Test 6: Category Deletion Safeguard
    // ----------------------------------------------------
    console.log('\n[6] Testing Category Deletion Safeguard (Active Products Invariant)...');
    const delCatFailRes = await fetch(`${BASE_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    const delCatFailData = await delCatFailRes.json();
    assert(delCatFailRes.status === 409, 'Deleting category with active products returns HTTP 409 Conflict');
    assert(delCatFailData.code === 'CONFLICT', 'Error code is CONFLICT');

    // ----------------------------------------------------
    // Test 7: Product Update
    // ----------------------------------------------------
    console.log('\n[7] Testing Product Update (PATCH /products/:id)...');
    const updateProdRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        stock: 50,
        price: 11000,
      }),
    });
    const updateProdData = await updateProdRes.json();
    assert(updateProdRes.status === 200, 'PATCH /products/:id returns HTTP 200 OK');
    assert(updateProdData.data.product.stock === 50, 'Updated stock is 50');
    assert(updateProdData.data.product.price === 11000, 'Updated price is 11000');

    // ----------------------------------------------------
    // Test 8: Product & Category Deletion Cleanup
    // ----------------------------------------------------
    console.log('\n[8] Testing Product & Empty Category Deletion...');
    // Delete product
    const delProdRes = await fetch(`${BASE_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert(delProdRes.status === 200, 'DELETE /products/:id returns HTTP 200 OK');

    // Now deleting the empty category should succeed
    const delCatSuccessRes = await fetch(`${BASE_URL}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert(delCatSuccessRes.status === 200, 'DELETE /categories/:id on empty category returns HTTP 200 OK');

    // Clean up test users
    await User.deleteMany({ email: { $in: [adminEmail, customerEmail] } });

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    if (localServer) localServer.close();
    await disconnectDB();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
