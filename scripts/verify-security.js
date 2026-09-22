// scripts/verify-security.js
/**
 * Security verification script for VYORA Retail POS
 * Checks for critical security vulnerabilities before deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔒 VYORA Retail Security Verification');
console.log('====================================');

let issuesFound = 0;

function logIssue(severity, issue, location, recommendation) {
  issuesFound++;
  console.log(`\n${severity} ISSUE FOUND:`);
  console.log(`  Location: ${location}`);
  console.log(`  Issue: ${issue}`);
  console.log(`  Recommendation: ${recommendation}`);
}

// Check 1: Verify password hashing is asynchronous
console.log('\n1️⃣  Checking password hashing security...');
try {
  const seedContent = fs.readFileSync('server/prisma/seed.js', 'utf8');
  if (seedContent.includes('bcrypt.hashSync')) {
    logIssue('🔴 CRITICAL', 
      'Synchronous password hashing (hashSync) found in seed.js',
      'server/prisma/seed.js',
      'Use bcrypt.hash() with async/await for secure password hashing');
  }
} catch (error) {
  console.log('   ❌ Could not read seed.js:', error.message);
}

// Check 2: Verify JWT_SECRET environment variable
console.log('\n2️⃣  Checking JWT secret configuration...');
try {
  const envContent = fs.readFileSync('server/.env', 'utf8');
  if (envContent.includes('development_secret_change_me')) {
    logIssue('🟡 WARNING',
      'Hardcoded JWT_SECRET found in .env file',
      'server/.env',
      'Use environment variable for JWT_SECRET, not hardcoded value');
  }
} catch (error) {
  console.log('   ❌ Could not read .env file:', error.message);
}

// Check 3: Verify auth middleware configuration
console.log('\n3️⃣  Checking authentication middleware...');
try {
  const authContent = fs.readFileSync('server/src/middleware/auth.js', 'utf8');
  const issues = [];
  
  if (!authContent.includes('await bcrypt.compare')) {
    issues.push('Missing async bcrypt comparison in login route');
  }
  
  if (!authContent.includes('token.expired')) {
    issues.push('Missing token expiration verification');
  }
  
  if (issues.length > 0) {
    logIssue('🟡 WARNING',
      'Potential authentication middleware issues',
      'server/src/middleware/auth.js',
      issues.join(', '));
  }
} catch (error) {
  console.log('   ❌ Could not read auth.js:', error.message);
}

// Check 4: Verify input validation
console.log('\n4️⃣  Checking input validation...');
try {
  const authRoutesContent = fs.readFileSync('server/src/routes/auth.js', 'utf8');
  if (!authRoutesContent.includes('z.string().email')) {
    logIssue('🟡 WARNING',
      'Missing email validation schema',
      'server/src/routes/auth.js',
      'Use zod schema with proper email validation');
  }
} catch (error) {
  console.log('   ❌ Could not read auth.js routes:', error.message);
}

// Check 5: Verify rate limiting
console.log('\n5️⃣  Checking rate limiting...');
const rateLimitingFiles = [
  'server/src/middleware/rate-limit.js',
  'server/src/middleware/auth-rate-limit.js'
];
let rateLimitingFound = false;
for (const file of rateLimitingFiles) {
  try {
    if (fs.existsSync(file)) {
      rateLimitingFound = true;
      break;
    }
  } catch (error) {
    // File doesn't exist
  }
}

if (!rateLimitingFound) {
  logIssue('🟡 WARNING',
    'No rate limiting middleware found',
    'server/src/middleware/',
    'Implement rate limiting for login endpoints to prevent brute force attacks');
}

// Check 6: Verify HTTPS requirement
console.log('\n6️⃣  Checking HTTPS configuration...');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  if (!envContent.includes('HTTPS') && !envContent.includes('secure')) {
    logIssue('🟡 WARNING',
      'No HTTPS/SSL configuration found',
      '.env',
      'Configure HTTPS for production deployments');
  }
} catch (error) {
  // .env not in root, check server .env
}

// Check 7: Verify database connection security
console.log('\n7️⃣  Checking database security...');
try {
  const envContent = fs.readFileSync('server/.env', 'utf8');
  if (envContent.includes('localhost') || envContent.includes('127.0.0.1')) {
    logIssue('🟡 WARNING',
      'Database connection may not be secure',
      'server/.env',
      'Ensure proper database security configuration for production');
  }
} catch (error) {
  console.log('   ❌ Could not read .env file:', error.message);
}

// Check 8: Verify password strength requirements
console.log('\n8️⃣  Checking password policy...');
try {
  const staffSchemaContent = fs.readFileSync('server/src/routes/staff.js', 'utf8');
  if (!staffSchemaContent.includes('min(8')) {
    logIssue('🟡 WARNING',
      'Password policy may be insufficient',
      'server/src/routes/staff.js',
      'Enforce minimum 8 characters for new staff passwords');
  }
} catch (error) {
  console.log('   ❌ Could not read staff.js:', error.message);
}

// Check 9: Verify session security
console.log('\n9️⃣  Checking session security...');
try {
  const authContent = fs.readFileSync('server/src/middleware/auth.js', 'utf8');
  if (!authContent.includes('expiresIn')) {
    logIssue('🟡 WARNING',
      'No token expiration time configured',
      'server/src/middleware/auth.js',
      'Set reasonable token expiration (e.g., 7 days)');
  }
} catch (error) {
  console.log('   ❌ Could not read auth.js:', error.message);
}

// Check 10: Verify error handling
console.log('\n🔟 Checking error handling...');
try {
  const errorHandlerContent = fs.readFileSync('server/src/middleware/error.js', 'utf8');
  if (!errorHandlerContent.includes('status >= 500')) {
    logIssue('🟡 WARNING',
      'Error handling may expose sensitive information',
      'server/src/middleware/error.js',
      'Ensure error handler doesn\'t leak sensitive information');
  }
} catch (error) {
  console.log('   ❌ Could not read error.js:', error.message);
}

console.log('\n' + '='.repeat(50));
console.log('SECURITY VERIFICATION SUMMARY');
console.log('='.repeat(50));

if (issuesFound === 0) {
  console.log('✅ No critical security issues found!');
} else {
  console.log(`\n❌ ${issuesFound} security issue(s) found that need to be addressed.`);
  console.log('\nNext steps:');
  console.log('1. Fix synchronous password hashing in seed.js');
  console.log('2. Configure environment variables for production');
  console.log('3. Implement rate limiting for authentication endpoints');
  console.log('4. Review and strengthen input validation');
  console.log('5. Set up HTTPS for production deployments');
}

process.exit(issuesFound > 0 ? 1 : 0);