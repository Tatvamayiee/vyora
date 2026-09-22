// Vyora acceptance tests against the live local API.
const BASE = 'http://localhost:5000/api';
const results = [];
const ok = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

async function login(email, password, role) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${email}: ${j.error}`);
  return j;
}
const call = (method, path, token, body) =>
  fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

// ---- AUTH ----
const owner = await login('owner@vyora.local', 'Owner@123', 'OWNER');
const manager = await login('manager@vyora.local', 'Manager@123', 'MANAGER');
const cashier = await login('cashier@vyora.local', 'Cashier@123', 'EMPLOYEE');
const warehouse = await login('warehouse@vyora.local', 'Warehouse@123', 'EMPLOYEE');
const customer = await login('customer@vyora.local', 'Customer@123', 'CUSTOMER');
ok('auth: all five demo users login', true);

const wrongPortal = await call('POST', '/auth/login', null, { email: 'cashier@vyora.local', password: 'Cashier@123', role: 'OWNER' });
ok('auth: cashier rejected from OWNER portal', wrongPortal.status === 403, wrongPortal.body.error);

// ---- RBAC ----
const staffAsCashier = await call('GET', '/staff', cashier.token);
ok('RBAC: cashier blocked from staff management', staffAsCashier.status === 403);
const ownerDashAsCashier = await call('GET', '/dashboard/owner', cashier.token);
ok('RBAC: cashier blocked from owner dashboard', ownerDashAsCashier.status === 403);
const promoAsManager = await call('POST', '/promotions', manager.token, { name: 'x', discountType: 'PERCENT', discountValue: 5, startDate: '2026-01-01', endDate: '2026-02-01' });
ok('RBAC: manager cannot create promotions', promoAsManager.status === 403);

// ---- Manager branch isolation ----
const branches = await call('GET', '/branches', owner.token);
const mgrBranchId = manager.user.employee?.branchId;
const otherBranch = branches.body.find((b) => b.id !== mgrBranchId);
const saleOtherBranch = await call('POST', '/sales', cashier.token, {
  branchId: otherBranch.id, discountPct: 0, items: [{ productId: 1, quantity: 1 }], payment: { method: 'CASH', amount: 10000 },
});
ok('branch isolation: cashier sale into other branch rejected', saleOtherBranch.status === 403, saleOtherBranch.body.error);

// ---- Cashier discount cap ----
const products = (await call('GET', '/products', cashier.token)).body;
const p = products[0];
const inv = (await call('GET', '/inventory', cashier.token)).body.find((i) => i.productId === p.id);
const overDiscount = await call('POST', '/sales', cashier.token, {
  branchId: mgrBranchId, discountPct: 10, items: [{ productId: p.id, quantity: 1 }], payment: { method: 'CASH', amount: 100000 },
});
ok('cashier: discount >5% rejected', overDiscount.status === 403, overDiscount.body.error);

// ---- Transactional sale: stock decrement + loyalty + bill number ----
const custId = customer.user.customerId;
const loyaltyBefore = (await call('GET', `/loyalty/${custId}`, customer.token)).body.points;
const unit = Number(p.sellingPrice);
const qty = 2;
const gross = unit * qty;
const tax = gross * Number(p.taxRate) / 100;
const total = Math.round((gross + tax) * 100) / 100;
const sale = await call('POST', '/sales', cashier.token, {
  branchId: mgrBranchId, customerId: custId, discountPct: 5,
  items: [{ productId: p.id, quantity: qty }], payment: { method: 'UPI', amount: total },
});
const s = sale.body.sale;
ok('cashier: sale created', sale.status === 201 && !!s?.billNumber, s?.billNumber);
const invAfter = (await call('GET', '/inventory', cashier.token)).body.find((i) => i.productId === p.id);
ok('inventory: stock decremented', invAfter.quantity === inv.quantity - qty, `${inv.quantity} → ${invAfter.quantity}`);
const loyaltyAfter = (await call('GET', `/loyalty/${custId}`, customer.token)).body.points;
ok('loyalty: points earned (1/₹100)', loyaltyAfter > loyaltyBefore, `${loyaltyBefore} → ${loyaltyAfter}`);
const movements = (await call('GET', '/inventory/movements', cashier.token)).body;
ok('stock movement: SALE recorded', movements.some((m) => m.type === 'SALE' && m.productId === p.id && m.notes?.includes(s.billNumber)));

// ---- Offline idempotency ----
const offlineId = 'test-offline-' + Date.now();
const offTx = {
  offlineId, branchId: mgrBranchId, discountPct: 0,
  items: [{ productId: p.id, quantity: 1 }], payment: { method: 'CASH', amount: Number(p.sellingPrice) * 1.05 },
};
const off1 = await call('POST', '/sync/offline-transactions', cashier.token, offTx);
const off2 = await call('POST', '/sync/offline-transactions', cashier.token, offTx);
ok('offline: first sync creates sale', off1.status === 200 && off1.body.sale?.billNumber, off1.body.sale?.billNumber || off1.body.error);
ok('offline: duplicate sync prevented (idempotent)', off2.body.duplicate === true && off2.body.sale.id === off1.body.sale.id);

// ---- Customer isolation ----
const custSales = (await call('GET', '/sales', customer.token)).body;
ok('customer: sees only own bills', custSales.every((x) => x.customerId === custId), `${custSales.length} bills`);
const allSales = (await call('GET', '/sales', owner.token)).body;
ok('owner: sees all bills', allSales.length >= custSales.length);

// ---- Warehouse ----
const whBranch = warehouse.user.employee?.branchId;
const whProduct = products[1];
const whInv = (await call('GET', '/inventory', warehouse.token)).body.find((i) => i.productId === whProduct.id);
const recv = await call('POST', '/inventory/stock-update', warehouse.token, {
  productId: whProduct.id, branchId: whBranch, type: 'RECEIVE', quantity: 10, notes: 'acceptance test GRN',
});
ok('warehouse: receive stock', recv.status === 200 && recv.body.quantity === whInv.quantity + 10);
const whIssue = await call('POST', '/inventory/issues', warehouse.token, {
  productId: whProduct.id, branchId: whBranch, type: 'DAMAGED', quantity: 1, reason: 'acceptance test',
});
ok('warehouse: create issue', whIssue.status === 201);
const whPos = await call('POST', '/sales', warehouse.token, {
  branchId: whBranch, discountPct: 0, items: [{ productId: whProduct.id, quantity: 1 }], payment: { method: 'CASH', amount: 999999 },
});
ok('RBAC: warehouse blocked from POS billing', whPos.status === 403);

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
