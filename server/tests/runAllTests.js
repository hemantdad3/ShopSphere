const path = require('path');
const { fork } = require('child_process');

const SUITES = [
  {
    name: 'Unit Tests (Security, Cart Math, Zod Schemas)',
    file: path.resolve(__dirname, 'unit/runUnitTests.js'),
    category: 'UNIT',
  },
  {
    name: 'Phase 2: Authentication & RBAC Verification',
    file: path.resolve(__dirname, 'authVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 3: Catalog & Media Pipeline Verification',
    file: path.resolve(__dirname, 'catalogVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 4: Product Discovery & Filtering Verification',
    file: path.resolve(__dirname, 'discoveryVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 5: Shopping Cart Engine Verification',
    file: path.resolve(__dirname, 'cartVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 6: Checkout & Inventory Reservation Verification',
    file: path.resolve(__dirname, 'orderVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 7: Payment Gateway & Verification Verification',
    file: path.resolve(__dirname, 'paymentVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 8: Order Lifecycle & State Machine Verification',
    file: path.resolve(__dirname, 'orderLifecycleVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 9: Reviews & Wishlist Engine Verification',
    file: path.resolve(__dirname, 'reviewWishlistVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 10: Admin Dashboard & Inventory Analytics Verification',
    file: path.resolve(__dirname, 'adminDashboardVerification.js'),
    category: 'INTEGRATION',
  },
  {
    name: 'Phase 12: High-Contention Inventory Concurrency (10 Checkouts for 3 Items)',
    file: path.resolve(__dirname, 'concurrency/inventoryConcurrency.test.js'),
    category: 'CONCURRENCY',
  },
  {
    name: 'Phase 12: Payment Idempotency Lock Race (Simultaneous Verify & Webhook)',
    file: path.resolve(__dirname, 'concurrency/paymentIdempotency.test.js'),
    category: 'CONCURRENCY',
  },
  {
    name: 'Phase 13: Security Hardening, NoSQL Injection & Rate Limiting Verification',
    file: path.resolve(__dirname, 'securityVerification.js'),
    category: 'SECURITY',
  },
];

const runChildSuite = (suite) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const child = fork(suite.file, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    child.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      stdout += str;
      process.stdout.write(str);
    });

    child.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      stderr += str;
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

      // Count passes and fails from stdout
      const passMatches = stdout.match(/✔ PASS/g) || [];
      const failMatches = stdout.match(/❌ FAIL/g) || [];

      let passedCount = passMatches.length;
      let failedCount = failMatches.length;

      // Extract explicit summary numbers if present (using last match for aggregate suites)
      const allMatches = [...stdout.matchAll(/(?:TEST SUMMARY|TOTAL):\s*(?:Passed:\s*)?(\d+)\s*Passed,?\s*(?:Failed:\s*)?(\d+)\s*Failed/gi)];
      if (allMatches.length > 0) {
        const lastMatch = allMatches[allMatches.length - 1];
        passedCount = parseInt(lastMatch[1], 10);
        failedCount = parseInt(lastMatch[2], 10);
      }

      resolve({
        name: suite.name,
        category: suite.category,
        code,
        durationSec,
        passed: passedCount,
        failed: failedCount,
        success: code === 0 && failedCount === 0,
      });
    });
  });
};

const runAll = async () => {
  console.log('\n================================================================');
  console.log('       SHOPSPHERE UNIFIED AUTOMATED TEST RUNNER (ALL SUITES)');
  console.log('================================================================\n');

  const overallStartTime = Date.now();
  const summary = [];

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    console.log(`\n>>> [${i + 1}/${SUITES.length}] EXECUTING: ${suite.name}...`);
    const res = await runChildSuite(suite);
    summary.push(res);
  }

  const overallDurationSec = ((Date.now() - overallStartTime) / 1000).toFixed(2);

  // Print Executive Summary Table
  console.log('\n\n================================================================');
  console.log('             SHOPSPHERE AUTOMATED TEST SUITE MATRIX');
  console.log('================================================================');
  console.log(
    `${'STATUS'.padEnd(8)} | ${'CATEGORY'.padEnd(12)} | ${'PASSED'.padStart(6)} | ${'FAILED'.padStart(6)} | ${'TIME'.padStart(7)} | SUITE`
  );
  console.log(''.padEnd(80, '-'));

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;

  for (const s of summary) {
    const statusText = s.success ? '✔ PASS' : '❌ FAIL';
    grandTotalPassed += s.passed;
    grandTotalFailed += s.failed;
    console.log(
      `${statusText.padEnd(8)} | ${s.category.padEnd(12)} | ${String(s.passed).padStart(6)} | ${String(s.failed).padStart(6)} | ${(s.durationSec + 's').padStart(7)} | ${s.name}`
    );
  }

  console.log(''.padEnd(80, '='));
  console.log(`GRAND TOTALS: ${grandTotalPassed} Passed, ${grandTotalFailed} Failed across ${SUITES.length} suites in ${overallDurationSec}s`);
  console.log('================================================================\n');

  if (grandTotalFailed > 0 || summary.some((s) => !s.success)) {
    console.error('❌ Build Verification FAILED: One or more test suites failed.');
    process.exit(1);
  } else {
    console.log('✔ All test suites passed successfully with zero failures! System verified.');
    process.exit(0);
  }
};

runAll();
