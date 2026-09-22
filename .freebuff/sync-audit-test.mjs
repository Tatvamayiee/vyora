// Lifecycle test for the offline-sync audit trail
const BASE = 'http://localhost:5000/api';
const j = async (path, opts = {}, token) => {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const login = async (email, password, portal) =>
  (await j('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, portal }) })).body.token;

const cash = await login('cashier@vyora.local', 'Cashier@123', 'EMPLOYEE');
if (!cash) { console.error('FAIL: cashier login'); process.exit(1); }

const me = (await j('/auth/me', {}, cash)).body;
const branchId = me.employee?.branchId;
const productsRaw = (await j('/products', {}, cash)).body;
const products = Array.isArray(productsRaw) ? productsRaw : (productsRaw.products || []);
const prod = products[0];
if (!prod) { console.error('FAIL: no products (reseeded empty?)'); process.exit(1); }
console.log(`branch ${branchId}, product ${prod.id} "${prod.name}" price ${prod.sellingPrice} tax ${prod.taxRate}`);

const mkBody = (qty) => {
  const sub = Number(prod.sellingPrice) * qty;
  const tx = Math.round(sub * Number(prod.taxRate)) / 100;
  const total = Math.round((sub + tx) * 100) / 100;
  return {
    offlineId: OID, branchId, customerId: null, discountPct: 0,
    items: [{ productId: prod.id, quantity: qty }],
    itemsDetail: [], payment: { method: 'CASH', amount: total },
    createdAt: new Date().toISOString(), status: 'PENDING_SYNC',
  };
};

const OID = 'OFF-AUDIT-' + Date.now();

// 1) failure path: absurd quantity must be rejected, payload kept as SYNC_FAILED
const r1 = await j('/sync/offline-transactions', { method: 'POST', body: JSON.stringify(mkBody(999999)) }, cash);
console.log('1) huge qty →', r1.status, JSON.stringify(r1.body).slice(0, 80));

// 2) retry same offlineId with valid qty → real sale
const r2 = await j('/sync/offline-transactions', { method: 'POST', body: JSON.stringify(mkBody(2)) }, cash);
console.log('2) retry →', r2.status, 'duplicate:', r2.body.duplicate, 'bill:', r2.body.sale?.billNumber);

// 3) replay same offlineId → duplicate ignored, same bill
const r3 = await j('/sync/offline-transactions', { method: 'POST', body: JSON.stringify(mkBody(2)) }, cash);
console.log('3) replay →', r3.status, 'duplicate:', r3.body.duplicate, 'bill:', r3.body.sale?.billNumber);

// 4) history endpoint (cashier should be blocked — owner/manager only)
const r4a = await j('/sync/offline-transactions', {}, cash);
console.log('4a) history as cashier →', r4a.status, '(expect 403)');

const owner = await login('owner@vyora.local', 'Owner@123', 'OWNER');
const r4b = await j('/sync/offline-transactions', {}, owner);
const entry = (r4b.body || []).find((x) => x.offlineId === OID);
if (!entry) { console.error('FAIL: audit entry missing'); process.exit(1); }
console.log('4b) history as owner →', r4b.status, JSON.stringify({
  offlineId: entry.offlineId, status: entry.status, cashier: entry.cashier,
  branch: entry.branch, bill: entry.bill, items: entry.items,
  lifecycle: (entry.history || []).map((h) => h.status),
}));

if (r1.status === 400 && r2.body.sale && r3.body.duplicate === true && entry.status === 'SYNCED'
    && JSON.stringify(entry.lifecycle) === JSON.stringify(['RECEIVED', 'SYNC_FAILED', 'SYNCED', 'DUPLICATE_IGNORED'])) {
  console.log('ALL LIFECYCLE CHECKS PASS');
} else {
  console.error('LIFECYCLE MISMATCH'); process.exit(1);
}
