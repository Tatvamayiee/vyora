import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

const syncSchema = z.object({
  offlineId: z.string().min(1),
  branchId: z.number().int(),
  customerId: z.number().int().optional().nullable(),
  discountPct: z.number().min(0).max(5).default(0),
  items: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().positive() })).min(1),
  payment: z.object({ method: z.enum(['CASH', 'UPI', 'CARD']), amount: z.number().positive() }),
  createdAt: z.string().optional(),
});

// Best-effort audit writes: a bookkeeping failure must never fail the sync itself.
const logSync = (offlineId, status, message) =>
  prisma.syncLog.create({ data: { offlineId, status, message: message ? String(message).slice(0, 500) : null } }).catch(() => {});

// Receives offline transactions; sale creation happens inside the sale service with offlineId idempotency.
router.post('/offline-transactions', requireRole('CASHIER', 'OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const data = syncSchema.parse(req.body);
    if (!authorizedBranch(req, data.branchId)) throw new HttpError(403, 'Access denied to this branch');

    // record the pending transaction (idempotent)
    const existing = await prisma.offlineTransaction.findUnique({ where: { id: data.offlineId } });
    if (!existing) {
      await prisma.offlineTransaction.create({
        data: { id: data.offlineId, cashierId: req.user.id, branchId: data.branchId, payload: data, status: 'PENDING_SYNC' },
      }).catch(() => {});
      await logSync(data.offlineId, 'RECEIVED', `received from ${req.user.email}`);
    }

    let result;
    try {
      result = await createSaleFromOffline(data, req);
    } catch (err) {
      // sale failed and rolled back — keep the payload, mark failed, log why
      await prisma.offlineTransaction.update({ where: { id: data.offlineId }, data: { status: 'SYNC_FAILED' } }).catch(() => {});
      await logSync(data.offlineId, 'SYNC_FAILED', err?.message || err);
      throw err;
    }

    await prisma.offlineTransaction.update({ where: { id: data.offlineId }, data: { status: 'SYNCED', syncedAt: new Date() } }).catch(() => {});
    await logSync(data.offlineId, result.duplicate ? 'DUPLICATE_IGNORED' : 'SYNCED', `bill ${result.sale?.billNumber ?? '?'}`);

    res.json({ ok: true, duplicate: !!result.duplicate, sale: result.sale });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

// Auditable offline-sync history: payload survives even after the client clears IndexedDB.
router.get('/offline-transactions', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const rows = await prisma.offlineTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        cashier: { select: { fullName: true, email: true } },
        branch: { select: { name: true } },
      },
    });
    const sales = await prisma.sale.findMany({
      where: { offlineId: { in: rows.map((r) => r.id) } },
      select: { offlineId: true, billNumber: true, total: true },
    });
    const billByOfflineId = Object.fromEntries(sales.map((s) => [s.offlineId, { billNumber: s.billNumber, total: s.total }]));
    const logs = await prisma.syncLog.findMany({
      where: { offlineId: { in: rows.map((r) => r.id) } },
      orderBy: { createdAt: 'asc' },
    });
    const logsByOfflineId = {};
    for (const l of logs) (logsByOfflineId[l.offlineId] ??= []).push({ status: l.status, message: l.message, at: l.createdAt });
    res.json(rows.map((r) => ({
      offlineId: r.id,
      status: r.status,
      branch: r.branch?.name,
      cashier: r.cashier?.fullName,
      createdAt: r.createdAt,
      syncedAt: r.syncedAt,
      bill: billByOfflineId[r.id] ?? null,
      items: r.payload?.items ?? [],
      payment: r.payload?.payment ?? null,
      history: logsByOfflineId[r.id] ?? [],
    })));
  } catch (e) { next(e); }
});

async function createSaleFromOffline(data, req) {
  // perform the same transactional logic as POST /api/sales by calling the sale service
  const { createSale } = await import('../services/saleService.js');
  return createSale({ ...data, offlineId: data.offlineId }, req.user);
}

export default router;
