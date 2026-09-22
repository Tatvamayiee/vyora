import { Router } from 'express';
import { prisma } from '../index.js';
import { auth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth, requireRole('OWNER', 'MANAGER'));

router.get('/sales', async (req, res, next) => {
  try {
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    if (req.user.role.name !== 'OWNER' && req.user.employee?.branchId) branchId = req.user.employee.branchId;
    const days = Number(req.query.days) || 30;
    const gte = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte }, ...(branchId ? { branchId } : {}) },
      include: {
        items: { include: { product: true } }, payments: true,
        branch: { select: { name: true } }, customer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const byDay = {};
    for (const s of sales) {
      const day = s.createdAt.toISOString().slice(0, 10);
      byDay[day] = byDay[day] || { revenue: 0, bills: 0 };
      byDay[day].revenue += Number(s.total);
      byDay[day].bills += 1;
    }
    const byPayment = {};
    for (const s of sales) for (const p of s.payments) byPayment[p.method] = (byPayment[p.method] || 0) + Number(p.amount);
    const productQty = {};
    for (const s of sales) for (const i of s.items) productQty[i.product.name] = (productQty[i.product.name] || 0) + i.quantity;
    const topProducts = Object.entries(productQty).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, qty]) => ({ name, qty }));
    res.json({ byDay, byPayment, topProducts, totalRevenue: sales.reduce((a, s) => a + Number(s.total), 0), billCount: sales.length });
  } catch (e) { next(e); }
});

router.get('/inventory', async (req, res, next) => {
  try {
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    if (req.user.role.name !== 'OWNER' && req.user.employee?.branchId) branchId = req.user.employee.branchId;
    const inv = await prisma.inventory.findMany({
      where: branchId ? { branchId } : {},
      include: { product: { include: { category: true } }, branch: { select: { name: true } } },
    });
    const stockValue = inv.reduce((a, i) => a + i.quantity * Number(i.product.costPrice), 0);
    const byCategory = {};
    for (const i of inv) byCategory[i.product.category.name] = (byCategory[i.product.category.name] || 0) + i.quantity;
    res.json({
      totalSkus: inv.length,
      stockValue,
      lowStock: inv.filter((i) => i.quantity <= i.reorderLevel),
      outOfStock: inv.filter((i) => i.quantity === 0),
      byCategory,
    });
  } catch (e) { next(e); }
});

router.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ include: { loyalty: true, sales: true } });
    const spenders = customers.map((c) => ({
      name: c.fullName, email: c.email,
      visits: c.sales.length,
      spend: c.sales.reduce((a, s) => a + Number(s.total), 0),
      points: c.loyalty?.points || 0,
    })).sort((a, b) => b.spend - a.spend).slice(0, 20);
    res.json({ totalCustomers: customers.length, topCustomers: spenders });
  } catch (e) { next(e); }
});

export default router;
