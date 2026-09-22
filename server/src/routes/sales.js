import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { createSale, saleSchema } from '../services/saleService.js';

const router = Router();
router.use(auth);

const CASHIER_MAX_DISCOUNT = 0.05;

router.post('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), async (req, res, next) => {
  let data;
  try {
    data = saleSchema.parse(req.body);
    if (!authorizedBranch(req, data.branchId)) throw new HttpError(403, 'Access denied to this branch');
    if (req.user.role.name === 'CASHIER' && data.discountPct > CASHIER_MAX_DISCOUNT * 100) {
      throw new HttpError(403, 'Cashiers may apply a maximum discount of 5%');
    }

    const result = await createSale(data, req.user);

    if (result.duplicate) {
      return res.status(200).json({ duplicate: true, sale: result.sale, message: 'Transaction was already synced' });
    }
    if (data.offlineId) {
      await prisma.offlineTransaction.updateMany({ where: { id: data.offlineId }, data: { status: 'SYNCED', syncedAt: new Date() } });
      await prisma.syncLog.create({ data: { offlineId: data.offlineId, status: 'SYNCED', message: `Created sale ${result.sale.billNumber}` } });
    }
    res.status(201).json({ duplicate: false, sale: result.sale });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (data?.offlineId) {
      await prisma.offlineTransaction.updateMany({ where: { id: data.offlineId }, data: { status: 'SYNC_FAILED' } }).catch(() => {});
      await prisma.syncLog.create({ data: { offlineId: data.offlineId, status: 'SYNC_FAILED', message: e.message } }).catch(() => {});
    }
    next(e);
  }
});

router.get('/', requireRole('OWNER', 'MANAGER', 'CASHIER', 'CUSTOMER'), async (req, res, next) => {
  try {
    if (req.user.role.name === 'CUSTOMER') {
      // customers see only their own bills
      if (!req.user.customerId) return res.json([]);
      const own = await prisma.sale.findMany({
        where: { customerId: req.user.customerId },
        take: 50, orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true } }, customer: { select: { fullName: true } }, payments: true, items: { include: { product: true } }, cashier: { select: { fullName: true } } },
      });
      return res.json(own);
    }
    let branchId = undefined;
    if (req.user.role.name === 'MANAGER') {
      branchId = req.user.employee?.branchId;
    } else if (req.user.role.name === 'CASHIER') {
      branchId = req.user.employee?.branchId;
    }
    const where = branchId ? { branchId } : {};
    const sales = await prisma.sale.findMany({
      where, take: 50, orderBy: { createdAt: 'desc' },
      include: { branch: { select: { name: true } }, customer: { select: { fullName: true } }, payments: true, items: { include: { product: true } }, cashier: { select: { fullName: true } } },
    });
    res.json(sales);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: Number(req.params.id) },
      include: { branch: true, customer: true, payments: true, items: { include: { product: true } }, cashier: { select: { fullName: true } } },
    });
    if (!sale) throw new HttpError(404, 'Bill not found');
    if (req.user.role.name === 'CUSTOMER' && sale.customerId !== req.user.customerId) throw new HttpError(403, 'Access denied');
    if (req.user.role.name !== 'OWNER' && req.user.role.name !== 'CUSTOMER' && !authorizedBranch(req, sale.branchId)) throw new HttpError(403, 'Access denied');
    res.json(sale);
  } catch (e) { next(e); }
});

export default router;
