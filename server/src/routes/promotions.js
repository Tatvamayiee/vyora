import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

function promoStatus(promo) {
  const now = new Date();
  if (!promo.isActive) return now < new Date(promo.startDate) ? 'SCHEDULED' : 'EXPIRED';
  if (now < new Date(promo.startDate)) return 'SCHEDULED';
  if (now > new Date(promo.endDate)) return 'EXPIRED';
  return 'ACTIVE';
}

// Public-ish list: staff and customers can view active offers
router.get('/', async (req, res, next) => {
  try {
    const promotions = await prisma.promotion.findMany({
      include: { products: { include: { product: true } }, category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(promotions.map((p) => ({ ...p, status: promoStatus(p) })));
  } catch (e) { next(e); }
});

const promoSchema = z.object({
  name: z.string().min(1, 'Promotion name is required'),
  description: z.string().optional(),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.number().positive('Discount value must be positive'),
  categoryId: z.number().int().optional().nullable(),
  productIds: z.array(z.number().int()).optional(),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().default(true),
});

router.post('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = promoSchema.parse(req.body);
    if (new Date(data.endDate) < new Date(data.startDate)) throw new HttpError(400, 'End date must be after start date');
    const { productIds, ...rest } = data;
    const promo = await prisma.promotion.create({
      data: {
        ...rest,
        categoryId: rest.categoryId || null,
        startDate: new Date(data.startDate), endDate: new Date(data.endDate),
        products: { create: (productIds || []).map((productId) => ({ productId })) },
      },
      include: { products: true, category: true },
    });
    res.status(201).json(promo);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.put('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = promoSchema.partial().parse(req.body);
    const { productIds, ...rest } = data;
    const updateData = { ...rest };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (productIds) {
      await prisma.promotionProduct.deleteMany({ where: { promotionId: Number(req.params.id) } });
      updateData.products = { create: productIds.map((productId) => ({ productId })) };
    }
    const promo = await prisma.promotion.update({
      where: { id: Number(req.params.id) }, data: updateData,
      include: { products: true, category: true },
    });
    res.json(promo);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (e.code === 'P2025') return next(new HttpError(404, 'Promotion not found'));
    next(e);
  }
});

router.delete('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    await prisma.promotion.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return next(new HttpError(404, 'Promotion not found'));
    next(e);
  }
});

export default router;
