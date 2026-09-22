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
    if (req.user.role.name !== 'OWNER' && req.user.employee?.branchId) branchId = req.user.employee.branchId;
    const issues = await prisma.inventoryIssue.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: 'desc' },
      include: { product: true, branch: true, createdBy: { select: { fullName: true } } },
    });
    res.json(issues);
  } catch (e) { next(e); }
});

const issueSchema = z.object({
  productId: z.number().int(),
  branchId: z.number().int(),
  type: z.enum(['LOW_STOCK', 'DAMAGED', 'EXPIRED', 'MISSING', 'OTHER']),
  quantity: z.number().int().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

router.post('/', requireRole('OWNER', 'MANAGER', 'WAREHOUSE'), async (req, res, next) => {
  try {
    const data = issueSchema.parse(req.body);
    if (!authorizedBranch(req, data.branchId)) throw new HttpError(403, 'Access denied to this branch');
    const issue = await prisma.inventoryIssue.create({ data: { ...data, createdById: req.user.id }, include: { product: true, branch: true } });
    res.status(201).json(issue);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.put('/:id', requireRole('OWNER', 'MANAGER', 'WAREHOUSE'), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']) }).parse(req.body);
    const existing = await prisma.inventoryIssue.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) throw new HttpError(404, 'Issue not found');
    if (!authorizedBranch(req, existing.branchId)) throw new HttpError(403, 'Access denied to this branch');
    const updated = await prisma.inventoryIssue.update({ where: { id: existing.id }, data: { status } });
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

export default router;
