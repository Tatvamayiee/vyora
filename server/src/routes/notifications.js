import { Router } from 'express';
import { prisma } from '../index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const where = req.user.role.name === 'CUSTOMER'
      ? { OR: [{ userId: req.user.id }, { role: 'CUSTOMER' }] }
      : { OR: [{ role: req.user.role.name }, { userId: req.user.id }] };
    const notifications = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30 });
    res.json(notifications);
  } catch (e) { next(e); }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { id: Number(req.params.id), userId: req.user.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
