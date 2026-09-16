const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { sanitizeNoSQL, sanitizeXSS } = require('../src/middleware/security');
const app = require('../src/app');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const runSecurityTests = async () => {
  console.log('\n================================================================');
  console.log('       SHOPSPHERE PHASE 13: SECURITY HARDENING VERIFICATION');
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
    await connectDB();

    try {
      const ping = await fetch(`${BASE_URL}/health`);
      if (!ping.ok) throw new Error('Not running');
    } catch {
      localServer = app.listen(PORT);
      await new Promise((res) => setTimeout(res, 500));
    }

    // ----------------------------------------------------
    // Test Group 1: Helmet HTTP Security Headers
    // ----------------------------------------------------
    console.log('[1] Testing Helmet HTTP Security Headers...');
    const healthRes = await fetch(`${BASE_URL}/health`);

    assert(
      healthRes.headers.get('x-content-type-options') === 'nosniff',
      'X-Content-Type-Options is set to "nosniff" (MIME type sniffing defense)'
    );

    assert(
      healthRes.headers.get('x-powered-by') === null,
      'X-Powered-By header is completely omitted (fingerprinting protection)'
    );

    const hstsHeader = healthRes.headers.get('strict-transport-security');
    assert(
      hstsHeader !== null && hstsHeader.includes('max-age='),
      'Strict-Transport-Security (HSTS) header is present with max-age'
    );

    const cspHeader = healthRes.headers.get('content-security-policy');
    assert(
      cspHeader !== null && cspHeader.includes("default-src 'self'"),
      'Content-Security-Policy (CSP) configured with restrictive default-src'
    );

    assert(
      cspHeader !== null && cspHeader.includes('https://checkout.razorpay.com'),
      'CSP allows Razorpay payment checkout script domain'
    );

    // ----------------------------------------------------
    // Test Group 2: Unit Sanitizer Algorithms
    // ----------------------------------------------------
    console.log('\n[2] Testing Unit Sanitization Algorithms...');

    // NoSQL Injection Unit Test
    const maliciousPayload = {
      email: { $gt: '' },
      nested: {
        'admin.role': 'ADMIN',
        normalKey: 'safeValue',
        deep: { $ne: null },
      },
    };

    sanitizeNoSQL(maliciousPayload);

    assert(
      maliciousPayload.email === undefined || Object.keys(maliciousPayload.email).length === 0,
      'sanitizeNoSQL removes operator keys starting with "$"'
    );
    assert(
      maliciousPayload.nested['admin.role'] === undefined,
      'sanitizeNoSQL removes keys containing dotted notation ("admin.role")'
    );
    assert(
      maliciousPayload.nested.normalKey === 'safeValue',
      'sanitizeNoSQL preserves legitimate non-operator keys'
    );
    assert(
      maliciousPayload.nested.deep.$ne === undefined,
      'sanitizeNoSQL recursively cleans deep nested operators'
    );

    // XSS Sanitizer Unit Test
    const xssPayload = {
      comment: 'This is <script>alert("hacked")</script>awesome!',
      password: 'Special<Characters>&Safe#123', // Passwords should NOT be altered
    };

    sanitizeXSS(xssPayload);

    assert(
      !xssPayload.comment.includes('<script>'),
      'sanitizeXSS removes executable <script> tags from string input'
    );
    assert(
      xssPayload.comment === 'This is awesome!',
      'sanitizeXSS preserves valid surrounding text'
    );
    assert(
      xssPayload.password === 'Special<Characters>&Safe#123',
      'sanitizeXSS preserves exact characters in password fields'
    );

    // ----------------------------------------------------
    // Test Group 3: Live NoSQL Query Injection HTTP Defense
    // ----------------------------------------------------
    console.log('\n[3] Testing Live NoSQL Injection HTTP Attack Defense...');

    // Attacker sends { "email": { "$gt": "" }, "password": "Password123!" }
    const injectionRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { $gt: '' },
        password: 'Password123!',
      }),
    });

    const injectionData = await injectionRes.json();

    assert(
      injectionRes.status === 400,
      'NoSQL injection payload rejected with HTTP 400 Bad Request (not 200 or 500)'
    );
    assert(
      injectionData.success === false || injectionData.status === 'fail',
      'API returns structured validation failure envelope'
    );
    assert(
      injectionData.message.toLowerCase().includes('email') ||
        (injectionData.errors && JSON.stringify(injectionData.errors).includes('email')),
      'Validation catches stripped/missing email parameter after NoSQL operator removal'
    );

    // ----------------------------------------------------
    // Test Group 4: Sliding Window Rate Limiting Defense
    // ----------------------------------------------------
    console.log('\n[4] Testing Rate Limiting on Authentication Endpoint...');

    const rateLimitResponses = [];
    const testClientId = `test_client_${Date.now()}`;
    const testHeader = {
      'Content-Type': 'application/json',
      'x-test-rate-limit': 'true', // Activates test threshold of 3 requests
      'x-test-client-id': testClientId, // Isolated client identifier
    };

    // Fire 4 rapid requests (threshold is 3)
    for (let i = 1; i <= 4; i++) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: testHeader,
        body: JSON.stringify({
          email: 'nonexistent@shopsphere.test',
          password: 'Password123!',
        }),
      });
      rateLimitResponses.push({
        iteration: i,
        status: res.status,
        data: await res.json(),
      });
    }

    const firstThree = rateLimitResponses.slice(0, 3);
    const fourth = rateLimitResponses[3];

    assert(
      firstThree.every((r) => r.status === 401 || r.status === 400),
      'First 3 requests within threshold process normally (HTTP 401/400)'
    );

    assert(
      fourth.status === 429,
      'Fourth request exceeding threshold blocked with HTTP 429 Too Many Requests'
    );

    assert(
      fourth.data.code === 'AUTH_RATE_LIMIT_EXCEEDED' || fourth.data.code === 'TOO_MANY_REQUESTS',
      'HTTP 429 response returns standardized error code envelope'
    );

    assert(
      fourth.data.message.toLowerCase().includes('too many'),
      'HTTP 429 response provides polite user retry guidance'
    );

    // ----------------------------------------------------
    // Test Group 5: Query Optimization & .lean() Profiling
    // ----------------------------------------------------
    console.log('\n[5] Testing Query Optimization (.lean() Performance & Virtuals)...');

    const queryStartTime = Date.now();
    const catalogRes = await fetch(`${BASE_URL}/products?limit=12`);
    const queryLatencyMs = Date.now() - queryStartTime;
    const catalogData = await catalogRes.json();

    assert(catalogRes.status === 200, 'GET /api/products returns HTTP 200 OK');
    assert(
      Array.isArray(catalogData.data.products),
      'Returns valid products array from .lean() optimized query'
    );
    assert(
      queryLatencyMs < 250,
      `Read query round-trip latency is performant (${queryLatencyMs}ms < 250ms)`
    );

    if (catalogData.data.products.length > 0) {
      const sample = catalogData.data.products[0];
      assert(
        typeof sample.finalPrice === 'number',
        'finalPrice is properly computed on plain lean product documents'
      );
    }

    console.log('\n================================================================');
    console.log(`SECURITY VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (localServer) localServer.close();
    await disconnectDB();

    return { suite: 'securityVerification', passed, failed };
  } catch (err) {
    console.error('Fatal error during security verification test run:', err);
    if (localServer) localServer.close();
    await disconnectDB();
    return { suite: 'securityVerification', passed, failed: failed + 1 };
  }
};

if (require.main === module) {
  runSecurityTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runSecurityTests;
