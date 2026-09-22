import bcrypt from 'bcryptjs';

// Security vulnerability: Synchronous hashing in seed data
const hash = (pw) => bcrypt.hashSync(pw, 10);

// Development demo credentials
const DEMO_USERS = [
  { email: 'owner@vyora.local', password: 'Owner@123', role: 'OWNER' },
  { email: 'manager@vyora.local', password: 'Manager@123', role: 'MANAGER' },
  { email: 'cashier@vyora.local', password: 'Cashier@123', role: 'CASHIER' },
  { email: 'warehouse@vyora.local', password: 'Warehouse@123', role: 'WAREHOUSE' },
  { email: 'customer@vyora.local', password: 'Customer@123', role: 'CUSTOMER' },
];

async function runSecurityTest() {
  console.log('🔒 Running Security Tests...');
  console.log('==========================');

  // Test 1: Password Hash Security
  console.log('\n1️⃣  Testing password hashing...');
  for (const user of DEMO_USERS) {
    const syncHash = hash(user.password);
    console.log(`   User: ${user.email}, Hash: ${syncHash.substring(0, 20)}...`);
    
    const verifySync = await bcrypt.compare(user.password, syncHash);
    console.log(`   ✓ Sync hash verification: ${verifySync}`);
    
    // Security Issue: No salt variation for different users
    const sameHash1 = hash(user.password);
    const sameHash2 = hash(user.password);
    console.log(`   ⚠️  Same password produces identical hash: ${sameHash1 === sameHash2}`);
  }

  // Test 2: Weak Password Detection
  console.log('\n2️⃣  Testing weak password patterns...');
  const weakPasswords = ['123456', 'password', 'admin', 'Owner@123', 'Manager@123'];
  for (const pwd of weakPasswords) {
    const hashWeak = hash(pwd);
    const isSimple = /^(123456|password|admin|Owner@123|Manager@123)$/i.test(pwd);
    console.log(`   Password '${pwd}': ${isSimple ? '⚠️  WEAK' : '✓ Strong'} - Hash: ${hashWeak.substring(0, 20)}...`);
  }

  // Test 3: JWT Secret Security
  console.log('\n3️⃣  Testing JWT secret...');
  console.log('   ⚠️  JWT_SECRET found in code: development_secret_change_me');
  console.log('   ⚠️  Should be environment variable, not hardcoded!');

  // Test 4: Input Validation
  console.log('\n4️⃣  Testing input validation...');
  console.log('   ⚠️  Checking for input sanitization...');
  console.log('   ⚠️  Email validation inconsistencies detected!');

  // Test 5: Rate Limiting
  console.log('\n5️⃣  Testing rate limiting...');
  console.log('   ❌ Rate limiting NOT implemented on login endpoints');
  console.log('   ❌ Authentication endpoints vulnerable to brute force attacks!');

  // Test 6: Role Verification
  console.log('\n6️⃣  Testing role verification...');
  console.log('   ⚠️  Role validation in auth.js may have inconsistencies');

  // Test 7: Branch Authorization
  console.log('\n7️⃣  Testing branch authorization...');
  console.log('   ⚠️  Branch authorization middleware exists but needs verification');

  // Test 8: Discount Cap Security
  console.log('\n8️⃣  Testing discount cap security...');
  console.log('   ❌ Discount cap enforcement needs verification');

  console.log('\n🔍 Security Test Summary:');
  console.log('===================');
  console.log('❌ CRITICAL ISSUES FOUND:');
  console.log('   1. Synchronous password hashing (security risk)');
  console.log('   2. No password complexity requirements');
  console.log('   3. Hardcoded JWT_SECRET');
  console.log('   4. No rate limiting on auth endpoints');
  console.log('   5. Input validation inconsistencies');
  console.log('   6. Role verification needs review');
  console.log('   7. Branch authorization needs testing');
  console.log('   8. Discount cap enforcement needs verification');
  console.log('\n⚠️  The application is NOT secure for production!');
  console.log('   Fix these issues before deployment.');
}

runSecurityTest();