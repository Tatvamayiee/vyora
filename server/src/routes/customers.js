import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

const customerSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a 10-digit mobile number').optional().or(z.literal('')),
});

router.get('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), async (req, res, next) => {
  try {
    const q = req.query.q;
    const customers = await prisma.customer.findMany({
      where: q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {},
      include: { loyalty: true },
      take: 50, orderBy: { fullName: 'asc' },
    });
    res.json(customers);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (req.user.role.name === 'CUSTOMER' && req.user.customerId !== Number(req.params.id)) {
      throw new HttpError(403, 'Access denied');
    }
    const customer = await prisma.customer.findUnique({ where: { id: Number(req.params.id) }, include: { loyalty: true, sales: { take: 10, orderBy: { createdAt: 'desc' }, include: { payments: true, branch: true } } } });
    if (!customer) throw new HttpError(404, 'Customer not found');
    res.json(customer);
  } catch (e) { next(e); }
});

router.post('/', requireRole('OWNER', 'MANAGER', 'CASHIER'), async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const exists = await prisma.customer.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) throw new HttpError(409, 'A customer with this email already exists');
    const customer = await prisma.customer.create({ data: { ...data, email: data.email.toLowerCase(), phone: data.phone || null } });
    res.status(201).json(customer);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

export default router;
