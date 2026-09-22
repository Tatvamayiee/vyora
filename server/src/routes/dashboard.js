import { Router } from 'express';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

function rangeFrom(query) {
  const { range, from, to } = query;
  const now = new Date();
  let gte, lte;
  if (range === 'today') {
    gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    lte = now;
  } else if (range === 'week') {
    gte = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    lte = now;
  } else if (range === 'month') {
    gte = new Date(now.getFullYear(), now.getMonth(), 1);
    lte = now;
  } else if (from && to) {
    gte = new Date(from);
    lte = new Date(to);
  } else {
    gte = new Date(now.getFullYear(), now.getMonth(), 1);
    lte = now;
  }
  return { gte, lte };
}

router.get('/owner', requireRole('OWNER'), async (req, res, next) => {
  try {
    const { gte, lte } = rangeFrom(req.query);
    const branchId = req.query.branchId && req.query.branchId !== 'all' ? Number(req.query.branchId) : null;

    const saleWhere = { createdAt: { gte, lte }, ...(branchId ? { branchId } : {}) };
    const [sales, agg, branches, lowStock, recent] = await prisma.$transaction([
      prisma.sale.findMany({
        where: saleWhere,
        include: { payments: true, customer: { select: { fullName: true } }, branch: { select: { name: true } }, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.aggregate({ where: saleWhere, _sum: { total: true, discount: true, tax: true }, _count: true }),
      prisma.branch.findMany({ where: { isActive: true } }),
      prisma.inventory.findMany({
        where: branchId ? { branchId } : {},
        include: { product: { select: { name: true, sku: true, sellingPrice: true } }, branch: { select: { name: true } } },
        orderBy: { quantity: 'asc' },
        take: 8,
      }),
      prisma.sale.findMany({
        where: branchId ? { branchId } : {},
        take: 8, orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true } }, customer: { select: { fullName: true } }, payments: true },
      }),
    ]);

    // aggregates computed in JS from the fetched sales (portable, index-friendly)
    const topMap = new Map();
    const trendMap = new Map();
    for (const s of sales) {
      const day = s.createdAt.toISOString().slice(0, 10);
      const t = trendMap.get(day) || { day, total: 0, bills: 0 };
      t.total += Number(s.total); t.bills += 1;
      trendMap.set(day, t);
      for (const it of s.items) {
        const p = topMap.get(it.productId) || { id: it.productId, name: it.product.name, qty: 0, revenue: 0 };
        p.qty += it.quantity; p.revenue += Number(it.lineTotal);
        topMap.set(it.productId, p);
      }
    }
    const topProducts = [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const trend = [...trendMap.values()].sort((a, b) => a.day.localeCompare(b.day));

    // branch performance
    const branchPerfMap = new Map(branches.map((b) => [b.id, { id: b.id, name: b.name, revenue: 0, bills: 0 }]));
    for (const s of sales) {
      const b = branchPerfMap.get(s.branchId);
      if (b) { b.revenue += Number(s.total); b.bills += 1; }
    }
    const branchPerf = [...branchPerfMap.values()].sort((a, b) => b.revenue - a.revenue);

    const customers = await prisma.customer.count();
    const lowStockFiltered = lowStock.filter((i) => i.quantity <= i.reorderLevel);

    res.json({
      kpis: {
        revenue: agg._sum.total || 0,
        discount: agg._sum.discount || 0,
        tax: agg._sum.tax || 0,
        bills: agg._count,
        customers,
        avgBill: agg._count ? (Number(agg._sum.total) || 0) / agg._count : 0,
      },
      branches,
      branchPerf,
      lowStock: lowStockFiltered,
      topProducts,
      trend,
      recentSales: recent,
    });
  } catch (e) { next(e); }
});

router.get('/manager', requireRole('MANAGER', 'OWNER'), async (req, res, next) => {
  try {
    const branchId = Number(req.query.branchId) || req.user.employee?.branchId;
    if (!branchId) throw new HttpError(400, 'No branch assigned');
    if (!authorizedBranch(req, branchId)) throw new HttpError(403, 'Access denied to this branch');
    const { gte, lte } = rangeFrom({ range: 'today' });

    const [agg, lowStock, recent, customers, issues] = await Promise.all([
      prisma.sale.aggregate({ where: { branchId, createdAt: { gte, lte } }, _sum: { total: true }, _count: true }),
      prisma.inventory.findMany({
        where: { branchId },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { quantity: 'asc' },
      }),
      prisma.sale.findMany({
        where: { branchId }, take: 8, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { fullName: true } }, payments: true },
      }),
      prisma.customer.count(),
      prisma.inventoryIssue.findMany({ where: { branchId, status: { not: 'RESOLVED' } }, take: 5, include: { product: true } }),
    ]);
    const low = lowStock.filter((i) => i.quantity <= i.reorderLevel);
    res.json({
      kpis: { revenue: agg._sum.total || 0, bills: agg._count, customers, lowStockCount: low.length },
      lowStock: low,
      inventoryStatus: {
        totalSkus: lowStock.length,
        inStock: lowStock.filter((i) => i.quantity > i.reorderLevel).length,
        low: low.length,
        outOfStock: lowStock.filter((i) => i.quantity === 0).length,
      },
      openIssues: issues,
      recentSales: recent,
    });
  } catch (e) { next(e); }
});

export default router;
