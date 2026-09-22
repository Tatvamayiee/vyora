#!/usr/bin/env node
/*
 * Acceptance test runner for VYORA Retail POS
 * Runs 18 critical checks covering auth, RBAC, discount caps,
 * transaction integrity, stock ops, loyalty, offline idempotency,
 * branch isolation, and real data verification.
 */

const fs = require('fs');
const path = require('path');

console.log('Starting VYORA Retail Acceptance Tests...');
console.log('==========================================');

// Run sequential acceptance tests
async function runAcceptanceTests() {
  try {
    // Import and run the acceptance test script
    const testScript = require('./.freebuff/acceptance-test.mjs');
    await testScript.default();
  } catch (error) {
    console.error('Acceptance test failed:', error.message);
    process.exit(1);
  }
}

runAcceptanceTests();