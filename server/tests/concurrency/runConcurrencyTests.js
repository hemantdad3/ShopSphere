const runInventoryConcurrencyTest = require('./inventoryConcurrency.test');
const runPaymentIdempotencyTest = require('./paymentIdempotency.test');

const runAllConcurrencyTests = async () => {
  console.log('\n================================================================');
  console.log('         SHOPSPHERE MASTER CONCURRENCY TEST HARNESS');
  console.log('================================================================\n');

  const startTime = Date.now();
  let totalPassed = 0;
  let totalFailed = 0;

  const results = [];
  results.push(await runInventoryConcurrencyTest());
  results.push(await runPaymentIdempotencyTest());

  for (const res of results) {
    totalPassed += res.passed;
    totalFailed += res.failed;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('         CONCURRENCY SUITE AGGREGATED SUMMARY');
  console.log('================================================================');
  for (const res of results) {
    const status = res.failed === 0 ? '✔ PASS' : '❌ FAIL';
    console.log(`  ${status} [${res.suite}]: ${res.passed} passed, ${res.failed} failed`);
  }
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${totalPassed} Passed, ${totalFailed} Failed in ${durationSec}s`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

if (require.main === module) {
  runAllConcurrencyTests();
}

module.exports = runAllConcurrencyTests;
