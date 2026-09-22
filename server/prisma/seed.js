/* Vyora Retail — development seed. Wipes and re-creates demo data.
 * Run: npm run seed (from server/) — DEVELOPMENT DEMO CREDENTIALS below.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function hash(pw) {
  return await bcrypt.hash(pw, 10);
}

async function main() {
  console.log('Seeding Vyora Retail (wiping existing demo data first)…');

  // wipe in FK-safe order
  await prisma.syncLog.deleteMany();
  await prisma.offlineTransaction.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryIssue.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.promotionProduct.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.role.deleteMany();

  // ---------- roles ----------
  const roleNames = ['OWNER', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'CUSTOMER'];
  const roles = {};
  for (const name of roleNames) roles[name] = await prisma.role.create({ data: { name } });

  // ---------- branches ----------
  const [indiranagar, koramangala, whitefield] = await Promise.all([
    prisma.branch.create({ data: { name: 'Indiranagar Store', address: '100 Ft Road, Indiranagar', city: 'Bengaluru', phone: '+91 80 4123 5501' } }),
    prisma.branch.create({ data: { name: 'Koramangala Store', address: '80 Ft Road, Koramangala 4th Block', city: 'Bengaluru', phone: '+91 80 4123 5502' } }),
    prisma.branch.create({ data: { name: 'Whitefield Store', address: 'ITPL Main Road, Whitefield', city: 'Bengaluru', phone: '+91 80 4123 5503' } }),
  ]);

  // ---------- users + staff ----------
  async function mkUser(email, password, fullName, roleName) {
    return await prisma.user.create({ data: { email, passwordHash: await hash(password), fullName, roleId: roles[roleName].id } });
  }

  const owner = await mkUser('owner@vyora.local', 'Owner@123', 'Rajesh Sharma', 'OWNER');
  const manager = await mkUser('manager@vyora.local', 'Manager@123', 'Priya Venkatesh', 'MANAGER');
  const manager2 = await mkUser('manager2@vyora.local', 'Manager@123', 'Suresh Babu', 'MANAGER');
  const cashier = await mkUser('cashier@vyora.local', 'Cashier@123', 'Ramesh Kumar', 'CASHIER');
  const warehouse = await mkUser('warehouse@vyora.local', 'Warehouse@123', 'Kavita Reddy', 'WAREHOUSE');

  await prisma.employee.create({ data: { userId: manager.id, branchId: indiranagar.id, staffCode: 'VYR-MGR-104', phone: '+91 98450 88419' } });
  await prisma.employee.create({ data: { userId: manager2.id, branchId: koramangala.id, staffCode: 'VYR-MGR-201', phone: '+91 98450 88420' } });
  await prisma.employee.create({ data: { userId: cashier.id, branchId: indiranagar.id, staffCode: 'EMP-4482', phone: '+91 98450 44821' } });
  await prisma.employee.create({ data: { userId: warehouse.id, branchId: indiranagar.id, staffCode: 'EMP-4490', phone: '+91 98450 44901' } });

  const customerUser = await mkUser('customer@vyora.local', 'Customer@123', 'Anita Rao', 'CUSTOMER');

  // ---------- customers ----------
  const customerData = [
    { fullName: 'Anita Rao', email: 'customer@vyora.local', phone: '+91 98860 10001', linkUser: customerUser },
    { fullName: 'Vikram Desai', email: 'vikram.desai@example.com', phone: '+91 98860 10002' },
    { fullName: 'Meera Nair', email: 'meera.nair@example.com', phone: '+91 98860 10003' },
    { fullName: 'Arjun Malhotra', email: 'arjun.malhotra@example.com', phone: '+91 98860 10004' },
    { fullName: 'Divya Iyer', email: 'divya.iyer@example.com', phone: '+91 98860 10005' },
  ];
  const customers = [];
  for (const c of customerData) {
    const { linkUser, ...data } = c;
    const customer = await prisma.customer.create({ data });
    if (linkUser) {
      await prisma.user.update({ where: { id: linkUser.id }, data: { customerId: customer.id } });
    }
    customers.push(customer);
  }

  // ---------- categories & products ----------
  const catNames = ['Staples', 'Dairy', 'Personal Care', 'Household', 'Snacks', 'Beverages'];
  const cats = {};
  for (const name of catNames) cats[name] = await prisma.category.create({ data: { name } });

  const productSeed = [
    { name: 'Aashirvaad Atta 5kg', sku: 'VY-STA-001', barcode: '8901234500011', cat: 'Staples', cost: 210, price: 249, tax: 5, reorder: 20 },
    { name: 'Tata Salt 1kg', sku: 'VY-STA-002', barcode: '8901234500028', cat: 'Staples', cost: 24, price: 28, tax: 5, reorder: 40 },
    { name: 'Sona Masoori Rice 5kg', sku: 'VY-STA-003', barcode: '8901234500035', cat: 'Staples', cost: 340, price: 395, tax: 5, reorder: 15 },
    { name: 'Fortune Sunflower Oil 1L', sku: 'VY-STA-004', barcode: '8901234500042', cat: 'Staples', cost: 135, price: 152, tax: 5, reorder: 25 },
    { name: 'Amul Butter 500g', sku: 'VY-DAI-001', barcode: '8901234500059', cat: 'Dairy', cost: 255, price: 285, tax: 12, reorder: 15 },
    { name: 'Amul Taaza Milk 1L', sku: 'VY-DAI-002', barcode: '8901234500066', cat: 'Dairy', cost: 52, price: 58, tax: 0, reorder: 50 },
    { name: 'Dove Shampoo 340ml', sku: 'VY-PCR-001', barcode: '8901234500073', cat: 'Personal Care', cost: 420, price: 499, tax: 18, reorder: 10 },
    { name: 'Colgate Toothpaste 200g', sku: 'VY-PCR-002', barcode: '8901234500080', cat: 'Personal Care', cost: 92, price: 110, tax: 18, reorder: 30 },
    { name: 'Surf Excel 2kg', sku: 'VY-HHL-001', barcode: '8901234500097', cat: 'Household', cost: 380, price: 445, tax: 18, reorder: 20 },
    { name: 'Parle-G Gold 1kg', sku: 'VY-SNK-001', barcode: '8901234500103', cat: 'Snacks', cost: 130, price: 155, tax: 12, reorder: 35 },
    { name: 'Britannia Good Day 600g', sku: 'VY-SNK-002', barcode: '8901234500110', cat: 'Snacks', cost: 118, price: 140, tax: 12, reorder: 30 },
    { name: 'Tata Tea Gold 500g', sku: 'VY-BEV-001', barcode: '8901234500127', cat: 'Beverages', cost: 265, price: 310, tax: 5, reorder: 20 },
  ];
  const products = [];
  for (const p of productSeed) {
    const { cat, cost, price, tax, reorder, ...rest } = p;
    products.push(await prisma.product.create({
      data: { ...rest, costPrice: cost, sellingPrice: price, taxRate: tax, reorderLevel: reorder, categoryId: cats[cat].id },
    }));
  }

  // ---------- promotions ----------
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const monthAhead = new Date(now.getTime() + 30 * 864e5);
  const twoWeeksAhead = new Date(now.getTime() + 14 * 864e5);

  const promoStaples = await prisma.promotion.create({
    data: {
      name: 'Monsoon Staples Sale', description: '10% off all staples this week',
      discountType: 'PERCENT', discountValue: 10, categoryId: cats['Staples'].id,
      startDate: monthAgo, endDate: twoWeeksAhead, isActive: true,
    },
  });
  const promoDairy = await prisma.promotion.create({
    data: {
      name: 'Dairy Combo Fest', description: 'Flat ₹20 off on Amul Butter',
      discountType: 'FLAT', discountValue: 20, categoryId: cats['Dairy'].id,
      startDate: monthAhead, endDate: new Date(now.getTime() + 60 * 864e5), isActive: true, // SCHEDULED
    },
  });
  const amulButter = products.find((p) => p.sku === 'VY-DAI-001');
  await prisma.promotionProduct.create({ data: { promotionId: promoDairy.id, productId: amulButter.id } });
  void promoStaples;

  // ---------- inventory (all branches) + low stock demo ----------
  for (const branch of [indiranagar, koramangala, whitefield]) {
    for (const p of products) {
      let qty = 25 + Math.floor(Math.random() * 120);
      if (branch.id === indiranagar.id) {
        if (p.sku === 'VY-STA-002') qty = 8;   // low stock demo
        if (p.sku === 'VY-DAI-002') qty = 3;   // critical low stock demo
      }
      await prisma.inventory.create({ data: { productId: p.id, branchId: branch.id, quantity: qty, reorderLevel: p.reorder } });
    }
  }

  // ---------- sales history (last 21 days, includes today) ----------
  const methods = ['CASH', 'UPI', 'CARD'];
  const counters = { [indiranagar.id]: 0, [koramangala.id]: 0, [whitefield.id]: 0 };
  const codes = { [indiranagar.id]: 'IND', [koramangala.id]: 'KOR', [whitefield.id]: 'WHT' };

  async function makeSale(branch, when, customerId) {
    const n = ++counters[branch.id];
    const billNumber = `VY-${codes[branch.id]}-${String(n).padStart(5, '0')}`;
    const nItems = 1 + Math.floor(Math.random() * 4);
    const picked = [...products].sort(() => Math.random() - 0.5).slice(0, nItems);
    let subtotal = 0, tax = 0;
    const items = [];
    for (const p of picked) {
      const quantity = 1 + Math.floor(Math.random() * 3);
      const unitPrice = Number(p.sellingPrice);
      const gross = unitPrice * quantity;
      const lineTax = (gross * Number(p.taxRate)) / 100;
      subtotal += gross; tax += lineTax;
      items.push({ productId: p.id, quantity, unitPrice, discount: 0, tax: lineTax, lineTotal: gross + lineTax });
    }
    const total = subtotal + tax;
    const sale = await prisma.sale.create({
      data: {
        billNumber, branchId: branch.id, customerId, cashierId: cashier.id,
        subtotal, discount: 0, tax, total, createdAt: when,
        items: { create: items },
      },
    });
    await prisma.payment.create({ data: { saleId: sale.id, method: methods[Math.floor(Math.random() * methods.length)], amount: total } });
    for (const it of items) {
      await prisma.stockMovement.create({
        data: { productId: it.productId, branchId: branch.id, userId: cashier.id, type: 'SALE', quantity: -it.quantity, notes: `Sale ${billNumber}`, createdAt: when },
      });
      const inv = await prisma.inventory.findUnique({ where: { productId_branchId: { productId: it.productId, branchId: branch.id } } });
      if (inv && inv.quantity >= it.quantity) {
        await prisma.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: it.quantity } } });
      }
    }
    return total;
  }

  let loyaltyTotals = new Map();
  for (let dayOffset = 20; dayOffset >= 0; dayOffset--) {
    const isToday = dayOffset === 0;
    const salesToday = isToday ? 6 : 2 + Math.floor(Math.random() * 5);
    for (let s = 0; s < salesToday; s++) {
      const branch = [indiranagar, koramangala, whitefield][Math.floor(Math.random() * 3)];
      const when = new Date(Date.now() - dayOffset * 864e5 + (9 + Math.random() * 10) * 36e5);
      if (when > new Date()) when.setTime(Date.now() - Math.random() * 36e5);
      const withCustomer = Math.random() < 0.6;
      const customer = withCustomer ? customers[Math.floor(Math.random() * customers.length)] : null;
      const total = await makeSale(branch, when, customer ? customer.id : null);
      if (customer) loyaltyTotals.set(customer.id, (loyaltyTotals.get(customer.id) || 0) + Math.floor(total / 100));
    }
  }

  // ---------- loyalty accounts + transactions ----------
  for (const c of customers) {
    const earned = loyaltyTotals.get(c.id) || 0;
    const redeemed = c.id === customers[0].id ? 50 : 0;
    const balance = Math.max(0, earned - redeemed);
    const account = await prisma.loyaltyAccount.create({
      data: { customerId: c.id, points: balance, lifetimeEarned: earned, lifetimeRedeemed: redeemed },
    });
    if (earned > 0) {
      await prisma.loyaltyTransaction.create({
        data: { accountId: account.id, customerId: c.id, type: 'EARN', points: earned, balanceAfter: earned, notes: 'Earned from purchases (seed history)' },
      });
    }
    if (redeemed > 0) {
      await prisma.loyaltyTransaction.create({
        data: { accountId: account.id, customerId: c.id, type: 'REDEEM', points: -redeemed, balanceAfter: balance, notes: 'Redeemed against coupon VY-CUST-2025' },
      });
    }
  }

  // ---------- inventory issues ----------
  await prisma.inventoryIssue.createMany({
    data: [
      { productId: products[0].id, branchId: indiranagar.id, type: 'DAMAGED', quantity: 2, reason: 'Water damage in aisle 3', status: 'OPEN', createdById: warehouse.id },
      { productId: products[4].id, branchId: indiranagar.id, type: 'EXPIRED', quantity: 3, reason: 'Past expiry date', status: 'IN_PROGRESS', createdById: warehouse.id },
      { productId: products[8].id, branchId: koramangala.id, type: 'LOW_STOCK', quantity: 10, reason: 'Below reorder level', status: 'RESOLVED', createdById: manager2.id },
    ],
  });

  // a receive + adjustment movement for warehouse history
  await prisma.stockMovement.create({
    data: { productId: products[2].id, branchId: indiranagar.id, userId: warehouse.id, type: 'RECEIVE', quantity: 40, notes: 'GRN from Whitefield DC' },
  });
  await prisma.inventory.update({ where: { productId_branchId: { productId: products[2].id, branchId: indiranagar.id } }, data: { quantity: { increment: 40 } } });

  // ---------- notifications ----------
  await prisma.notification.createMany({
    data: [
      { role: 'CUSTOMER', title: 'New offer just for you', body: 'Monsoon Staples Sale — 10% off all staples at every Vyora store!', type: 'OFFER' },
      { role: 'CUSTOMER', title: 'Loyalty update', body: 'You earned points on your last visit. Check your balance in the app.', type: 'INFO' },
      { userId: manager.id, title: 'Low stock alert', body: 'Amul Taaza Milk 1L is below reorder level at Indiranagar.', type: 'ALERT' },
      { userId: owner.id, title: 'Daily summary ready', body: "Yesterday's consolidated sales report is available.", type: 'INFO' },
    ],
  });

  console.log('Seed complete.');
  console.log('DEVELOPMENT DEMO CREDENTIALS:');
  console.log('  OWNER     owner@vyora.local     / Owner@123');
  console.log('  MANAGER   manager@vyora.local   / Manager@123  (Indiranagar)');
  console.log('  CASHIER   cashier@vyora.local   / Cashier@123  (Indiranagar)');
  console.log('  WAREHOUSE warehouse@vyora.local / Warehouse@123 (Indiranagar)');
  console.log('  CUSTOMER  customer@vyora.local  / Customer@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
