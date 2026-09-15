require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { connectDB, disconnectDB } = require('../src/config/db');

const BASE_URL = 'http://localhost:5000/api/auth';

const runTests = async () => {
  console.log('\n======================================================');
  console.log('       SHOPSPHERE PHASE 2: AUTHENTICATION & RBAC TEST');
  console.log('======================================================\n');

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
    await connectDB();

    const testEmail = `testuser_${Date.now()}@shopsphere.com`;
    const testPassword = 'Password123!';
    const newPassword = 'NewPassword456!';
    let authCookie = '';
    let resetToken = '';

    // ----------------------------------------------------
    // Test 1: User Registration (Happy Path)
    // ----------------------------------------------------
    console.log('[1] Testing User Registration...');
    const regRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: testEmail,
        password: testPassword,
      }),
    });

    const regData = await regRes.json();
    const setCookie = regRes.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
    }

    assert(regRes.status === 201, 'Registration returns HTTP 201 Created', `Status: ${regRes.status}`);
    assert(regData.success === true, 'Response has success: true');
    assert(regData.data.user.email === testEmail, 'User email matches input');
    assert(regData.data.user.role === 'CUSTOMER', 'Default role is CUSTOMER');
    assert(!regData.data.user.passwordHash, 'Security invariant: passwordHash is not returned');
    assert(setCookie && setCookie.includes('HttpOnly'), 'JWT transported in HTTP-only cookie');

    // ----------------------------------------------------
    // Test 2: Duplicate Registration (Conflict)
    // ----------------------------------------------------
    console.log('\n[2] Testing Duplicate Registration Rejection...');
    const dupRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: testEmail,
        password: testPassword,
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, 'Duplicate email returns HTTP 409 Conflict', `Status: ${dupRes.status}`);
    assert(dupData.success === false, 'Duplicate error has success: false');

    // ----------------------------------------------------
    // Test 3: Validation Error (Weak Password)
    // ----------------------------------------------------
    console.log('\n[3] Testing Schema Validation (Short Password)...');
    const valRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid User',
        email: 'invalid@shopsphere.com',
        password: 'short',
      }),
    });
    const valData = await valRes.json();
    assert(valRes.status === 400, 'Invalid payload returns HTTP 400 Bad Request');
    assert(valData.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // ----------------------------------------------------
    // Test 4: Login with Incorrect Password
    // ----------------------------------------------------
    console.log('\n[4] Testing Login with Invalid Credentials...');
    const badLoginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401, 'Wrong password returns HTTP 401 Unauthorized');
    assert(badLoginData.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    // ----------------------------------------------------
    // Test 5: Login with Valid Credentials
    // ----------------------------------------------------
    console.log('\n[5] Testing Login with Valid Credentials...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    const loginCookieHeader = loginRes.headers.get('set-cookie');
    if (loginCookieHeader) {
      authCookie = loginCookieHeader.split(';')[0];
    }
    assert(loginRes.status === 200, 'Valid login returns HTTP 200 OK');
    assert(loginData.success === true, 'Login response has success: true');
    assert(!loginData.data.user.passwordHash, 'Password hash is excluded from login payload');

    // ----------------------------------------------------
    // Test 6: Protected Route GET /api/auth/me
    // ----------------------------------------------------
    console.log('\n[6] Testing Protected Profile Endpoint (/api/auth/me)...');
    // Without cookie
    const noAuthMeRes = await fetch(`${BASE_URL}/me`);
    assert(noAuthMeRes.status === 401, 'Request without cookie returns HTTP 401 Unauthorized');

    // With valid cookie
    const authMeRes = await fetch(`${BASE_URL}/me`, {
      headers: { Cookie: authCookie },
    });
    const authMeData = await authMeRes.json();
    assert(authMeRes.status === 200, 'Request with valid cookie returns HTTP 200 OK');
    assert(authMeData.data.user.email === testEmail, 'Returned user email matches session');

    // ----------------------------------------------------
    // Test 7: Role Authorization (RBAC: restrictTo)
    // ----------------------------------------------------
    console.log('\n[7] Testing Role Authorization (restrictTo ADMIN)...');
    // Customer accessing admin route
    const customerAdminRes = await fetch(`${BASE_URL}/admin-test`, {
      headers: { Cookie: authCookie },
    });
    const customerAdminData = await customerAdminRes.json();
    assert(customerAdminRes.status === 403, 'Customer accessing admin route returns HTTP 403 Forbidden');
    assert(customerAdminData.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // Promote user to ADMIN in database
    await User.updateOne({ email: testEmail }, { role: 'ADMIN' });

    // Admin accessing admin route
    const realAdminRes = await fetch(`${BASE_URL}/admin-test`, {
      headers: { Cookie: authCookie },
    });
    const realAdminData = await realAdminRes.json();
    assert(realAdminRes.status === 200, 'Admin accessing admin route returns HTTP 200 OK');
    assert(realAdminData.success === true, 'Admin response has success: true');

    // ----------------------------------------------------
    // Test 8: Password Reset Flow
    // ----------------------------------------------------
    console.log('\n[8] Testing Password Reset Flow...');
    const forgotRes = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json();
    assert(forgotRes.status === 200, 'Forgot password returns HTTP 200 OK');

    // Retrieve the reset token directly from database for automated test execution
    const userWithToken = await User.findOne({ email: testEmail }).select('+passwordResetToken');
    assert(userWithToken.passwordResetToken !== undefined, 'Password reset token was hashed and stored in DB');
    assert(userWithToken.passwordResetExpires > Date.now(), 'Token has valid future expiration');

    // Reset password using the development return token or newly generated token
    resetToken = forgotData.data.resetToken;
    const resetRes = await fetch(`${BASE_URL}/reset-password/${resetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    assert(resetRes.status === 200, 'Reset password returns HTTP 200 OK');

    // Verify old password fails
    const oldLoginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert(oldLoginRes.status === 401, 'Old password fails with HTTP 401 Unauthorized');

    // Verify new password succeeds
    const newLoginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    assert(newLoginRes.status === 200, 'New password succeeds with HTTP 200 OK');

    // ----------------------------------------------------
    // Test 9: Logout
    // ----------------------------------------------------
    console.log('\n[9] Testing Logout...');
    const logoutRes = await fetch(`${BASE_URL}/logout`, { method: 'POST' });
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert(logoutRes.status === 200, 'Logout returns HTTP 200 OK');
    assert(logoutCookie && logoutCookie.includes('loggedout'), 'Logout response expires the cookie');

    // Clean up test user
    await User.deleteOne({ email: testEmail });

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    await disconnectDB();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
