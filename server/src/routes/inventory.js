import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    if (req.user.role.name !== 'OWNER' && req.user.employee?.branchId) {
      branchId = req.user.employee.branchId; // staff restricted to own branch
    }
    const inv = await prisma.inventory.findMany({
      where: branchId ? { branchId } : {},
      include: { product: { include: { category: true } }, branch: true },
      orderBy: { id: 'asc' },
    });
    res.json(inv);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const inv = await prisma.inventory.findUnique({ where: { id: Number(req.params.id) } });
    if (!inv) throw new HttpError(404, 'Inventory record not found');
    if (!authorizedBranch(req, inv.branchId)) throw new HttpError(403, 'Access denied to this branch');
    const { reorderLevel } = z.object({ reorderLevel: z.number().int().min(0) }).parse(req.body);
    const updated = await prisma.inventory.update({ where: { id: inv.id }, data: { reorderLevel } });
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

const stockSchema = z.object({
  productId: z.number().int(),
  branchId: z.number().int(),
  type: z.enum(['RECEIVE', 'ISSUE', 'ADJUSTMENT']),
  quantity: z.number().int(), // signed
  notes: z.string().optional(),
});

router.post('/stock-update', requireRole('OWNER', 'MANAGER', 'WAREHOUSE'), async (req, res, next) => {
  try {
    const data = stockSchema.parse(req.body);
    if (!authorizedBranch(req, data.branchId)) throw new HttpError(403, 'Access denied to this branch');
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product || !product.isActive) throw new HttpError(400, 'Invalid product');
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new HttpError(400, 'Invalid product');
      let invRow = await tx.inventory.findUnique({ where: { productId_branchId: { productId: data.productId, branchId: data.branchId } } });
      if (!invRow) {
        invRow = await tx.inventory.create({
          data: { productId: data.productId, branchId: data.branchId, quantity: 0, reorderLevel: product.reorderLevel },
        });
      }
      const target = data.type === 'ADJUSTMENT' ? data.quantity : invRow.quantity + data.quantity;
      if (target < 0) throw new HttpError(400, 'Insufficient stock for this operation');
      const updated = await tx.inventory.update({ where: { id: invRow.id }, data: { quantity: target } });
      await tx.stockMovement.create({
        data: { productId: data.productId, branchId: data.branchId, userId: req.user.id, type: data.type, quantity: target - invRow.quantity, notes: data.notes },
      });
      return updated;
    });
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.get('/movements', async (req, res, next) => {
  try {
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    if (req.user.role.name !== 'OWNER' && req.user.employee?.branchId) branchId = req.user.employee.branchId;
    const movements = await prisma.stockMovement.findMany({
      where: branchId ? { branchId } : {},
      take: 50, orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, sku: true } }, branch: { select: { name: true } }, user: { select: { fullName: true } } },
    });
    res.json(movements);
  } catch (e) { next(e); }
});

export default router;
