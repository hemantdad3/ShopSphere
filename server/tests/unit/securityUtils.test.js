const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../src/models/User');
const { signToken } = require('../../src/utils/jwt');

const runSecurityUnitTests = async () => {
  console.log('\n================================================================');
  console.log('       SHOPSPHERE UNIT SUITE: SECURITY & JWT UTILITIES');
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
    const rawPassword = 'SecurePassword123!';
    const wrongPassword = 'WrongPassword456!';

    // ----------------------------------------------------
    // Test 1: Bcrypt Hashing with Salt
    // ----------------------------------------------------
    console.log('[1] Testing Bcrypt Hashing and Salting...');
    const saltRounds = 12;
    const hash1 = await bcrypt.hash(rawPassword, saltRounds);
    const hash2 = await bcrypt.hash(rawPassword, saltRounds);

    assert(hash1 !== rawPassword, 'Hashed password is not plaintext');
    assert(hash1.startsWith('$2a$') || hash1.startsWith('$2b$'), 'Hash has standard bcrypt format');
    assert(hash1 !== hash2, 'Different salt produces unique hashes for identical plain passwords');

    // ----------------------------------------------------
    // Test 2: Bcrypt Constant-Time Comparison
    // ----------------------------------------------------
    console.log('\n[2] Testing Bcrypt Verification...');
    const matchValid = await bcrypt.compare(rawPassword, hash1);
    const matchInvalid = await bcrypt.compare(wrongPassword, hash1);
    const matchEmpty = await bcrypt.compare('', hash1);

    assert(matchValid === true, 'bcrypt.compare returns true for correct plaintext password');
    assert(matchInvalid === false, 'bcrypt.compare returns false for incorrect password');
    assert(matchEmpty === false, 'bcrypt.compare returns false for empty string');

    // ----------------------------------------------------
    // Test 3: User Model Instance Methods
    // ----------------------------------------------------
    console.log('\n[3] Testing User Model Password Methods...');
    const mockUser = new User({
      name: 'Test Customer',
      email: 'security_test@example.com',
      passwordHash: hash1, // pre-hashed
      role: 'CUSTOMER',
    });

    const instanceMatch = await mockUser.comparePassword(rawPassword);
    const instanceMismatch = await mockUser.comparePassword(wrongPassword);

    assert(instanceMatch === true, 'user.comparePassword() resolves true for valid password');
    assert(instanceMismatch === false, 'user.comparePassword() resolves false for invalid password');

    // ----------------------------------------------------
    // Test 4: JWT Token Signing & Payload Claims
    // ----------------------------------------------------
    console.log('\n[4] Testing JWT Token Generation...');
    const testId = '64fa1b2c3d4e5f6a7b8c9d0e';
    const testRole = 'CUSTOMER';
    const token = signToken(testId, testRole);

    assert(typeof token === 'string' && token.length > 20, 'signToken returns a valid string');
    const tokenParts = token.split('.');
    assert(tokenParts.length === 3, 'Token has standard 3-part header.payload.signature structure');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert(decoded.id === testId, 'Decoded token preserves correct subject user id');
    assert(decoded.role === testRole, 'Decoded token preserves correct user role');
    assert(typeof decoded.exp === 'number' && decoded.exp > decoded.iat, 'Token includes valid expiration timestamp');

    // ----------------------------------------------------
    // Test 5: JWT Tampering & Signature Rejection
    // ----------------------------------------------------
    console.log('\n[5] Testing JWT Tampering Defense...');
    // Create tampered payload claiming ADMIN role
    const forgedHeader = tokenParts[0];
    const forgedPayload = Buffer.from(JSON.stringify({ id: testId, role: 'ADMIN' })).toString('base64url');
    const forgedToken = `${forgedHeader}.${forgedPayload}.${tokenParts[2]}`;

    let tamperingCaught = false;
    try {
      jwt.verify(forgedToken, process.env.JWT_SECRET);
    } catch (err) {
      tamperingCaught = err.name === 'JsonWebTokenError';
    }
    assert(tamperingCaught, 'Tampered token payload rejected with JsonWebTokenError');

    // Tampered secret
    let wrongSecretCaught = false;
    try {
      jwt.verify(token, 'totally_wrong_secret_key_123456789');
    } catch (err) {
      wrongSecretCaught = err.name === 'JsonWebTokenError';
    }
    assert(wrongSecretCaught, 'Token signed with different secret rejected with JsonWebTokenError');

    // ----------------------------------------------------
    // Test 6: Expired JWT Handling
    // ----------------------------------------------------
    console.log('\n[6] Testing Expired Token Rejection...');
    const expiredToken = jwt.sign({ id: testId, role: testRole }, process.env.JWT_SECRET, { expiresIn: '1ms' });
    // Wait 50ms to ensure expiration
    await new Promise((res) => setTimeout(res, 50));

    let expiredCaught = false;
    try {
      jwt.verify(expiredToken, process.env.JWT_SECRET);
    } catch (err) {
      expiredCaught = err.name === 'TokenExpiredError';
    }
    assert(expiredCaught, 'Expired token rejected with TokenExpiredError');

    // ----------------------------------------------------
    // Test 7: Password Changed After Token Issued Invariant
    // ----------------------------------------------------
    console.log('\n[7] Testing Password Changed After Token Invariant...');
    const tokenIssuedAt = Math.floor(Date.now() / 1000); // Now in seconds

    // Case A: User has not changed password
    mockUser.passwordChangedAt = undefined;
    assert(
      mockUser.changedPasswordAfter(tokenIssuedAt) === false,
      'changedPasswordAfter returns false when passwordChangedAt is not set'
    );

    // Case B: Password changed before token was issued
    mockUser.passwordChangedAt = new Date((tokenIssuedAt - 100) * 1000);
    assert(
      mockUser.changedPasswordAfter(tokenIssuedAt) === false,
      'changedPasswordAfter returns false when password changed BEFORE token issuance'
    );

    // Case C: Password changed after token was issued (Token invalidated)
    mockUser.passwordChangedAt = new Date((tokenIssuedAt + 100) * 1000);
    assert(
      mockUser.changedPasswordAfter(tokenIssuedAt) === true,
      'changedPasswordAfter returns true when password changed AFTER token issuance (invalidating token)'
    );

    // ----------------------------------------------------
    // Test 8: Password Reset Token Cryptographic Generation
    // ----------------------------------------------------
    console.log('\n[8] Testing Password Reset Token Generation...');
    const resetToken = mockUser.createPasswordResetToken();

    assert(typeof resetToken === 'string' && resetToken.length === 64, 'Reset token is 64-char hex string (32 bytes)');
    assert(typeof mockUser.passwordResetToken === 'string', 'Hashed reset token saved on user instance');
    assert(mockUser.passwordResetExpires > Date.now(), 'Reset expiration set in the future');

    // Verify SHA-256 match
    const expectedHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    assert(mockUser.passwordResetToken === expectedHash, 'Database stores correct SHA-256 hash of plaintext token');

    console.log('\n----------------------------------------------------------------');
    console.log(`SECURITY UTILITIES TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('----------------------------------------------------------------\n');

    return { suite: 'securityUtils', passed, failed };
  } catch (error) {
    console.error('Fatal error in securityUtils unit tests:', error);
    return { suite: 'securityUtils', passed, failed: failed + 1 };
  }
};

// Allow standalone execution
if (require.main === module) {
  runSecurityUnitTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runSecurityUnitTests;
