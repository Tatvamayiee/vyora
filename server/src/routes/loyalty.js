import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

router.get('/:customerId', async (req, res, next) => {
  try {
    const customerId = Number(req.params.customerId);
    if (req.user.role.name === 'CUSTOMER' && req.user.customerId !== customerId) throw new HttpError(403, 'Access denied');
    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 30 }, customer: { select: { fullName: true, email: true } } },
    });
    res.json(account || { customerId, points: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, transactions: [] });
  } catch (e) { next(e); }
});

const txnSchema = z.object({
  customerId: z.number().int(),
  type: z.enum(['EARN', 'REDEEM', 'ADJUST']),
  points: z.number().int(),
  notes: z.string().optional(),
});

router.post('/transaction', requireRole('OWNER', 'MANAGER', 'CASHIER'), async (req, res, next) => {
  try {
    const data = txnSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.loyaltyAccount.findUnique({ where: { customerId: data.customerId } });
      if (!account) account = await tx.loyaltyAccount.create({ data: { customerId: data.customerId, points: 0 } });
      if (data.type === 'REDEEM' && account.points < Math.abs(data.points)) {
        throw new HttpError(400, 'Insufficient loyalty points');
      }
      const delta = data.type === 'REDEEM' ? -Math.abs(data.points) : data.points;
      const balanceAfter = account.points + delta;
      if (balanceAfter < 0) throw new HttpError(400, 'Insufficient loyalty points');
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: balanceAfter,
          ...(delta > 0 ? { lifetimeEarned: { increment: delta } } : { lifetimeRedeemed: { increment: Math.abs(delta) } }),
        },
      });
      return tx.loyaltyTransaction.create({ data: { accountId: account.id, customerId: data.customerId, type: data.type, points: delta, balanceAfter, notes: data.notes } });
    });
    res.status(201).json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

export default router;
