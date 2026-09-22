import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index.js';
import { signToken, auth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().refine(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), 'Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  role: z.enum(['OWNER', 'MANAGER', 'EMPLOYEE', 'CUSTOMER']).optional(),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true, employee: { include: { branch: true } }, customer: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid email or password');
    if (role && !['OWNER', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'].includes(role)) {
      throw new HttpError(400, 'Invalid role');
    }
    // ensure requested portal matches actual role
    if (role) {
      const portalRoles = {
        OWNER: ['OWNER'],
        MANAGER: ['MANAGER'],
        EMPLOYEE: ['CASHIER', 'WAREHOUSE'],
        CUSTOMER: ['CUSTOMER'],
      };
      if (!portalRoles[role].includes(user.role.name)) {
        throw new HttpError(403, `This account is not authorized for the ${role} portal`);
      }
    }
    const { passwordHash, ...safe } = user;
    res.json({ token: signToken(user), user: safe });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.post('/logout', auth, (req, res) => res.json({ ok: true }));

router.get('/me', auth, async (req, res) => {
  const { passwordHash, ...safe } = req.user;
  res.json(safe);
});

// ---------- SIGN UP (self-registration per portal) ----------
const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().refine(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), 'Enter a valid email'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  portal: z.enum(['OWNER', 'MANAGER', 'EMPLOYEE', 'CUSTOMER']),
  subwork: z.enum(['CASHIER', 'WAREHOUSE']).optional(),
});

router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);

    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with this email already exists. Please log in.');

    // map portal -> role name
    let roleName = data.portal;
    if (data.portal === 'EMPLOYEE') roleName = data.subwork === 'WAREHOUSE' ? 'WAREHOUSE' : 'CASHIER';
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new HttpError(500, 'Role configuration missing');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      let customerId = null;
      if (data.portal === 'CUSTOMER') {
        const customer = await tx.customer.create({ data: { fullName: data.fullName, email, phone: data.phone || null } });
        await tx.loyaltyAccount.create({ data: { customerId: customer.id, points: 0 } });
        customerId = customer.id;
      }
      const user = await tx.user.create({
        data: { email, passwordHash, fullName: data.fullName, roleId: role.id, customerId },
        include: { role: true, employee: { include: { branch: true } }, customer: true },
      });
      if (data.portal !== 'CUSTOMER') {
        await tx.employee.create({
          data: {
            userId: user.id,
            branchId: Number(process.env.DEFAULT_BRANCH_ID) || null,
            staffCode: `VYS-${String(user.id).padStart(4, '0')}`,
            phone: data.phone || null,
          },
        });
      }
      return user;
    });

    const { passwordHash: _ph, ...safe } = result;
    res.status(201).json({ token: signToken(result), user: safe, message: 'Account created successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email('Enter a valid email') }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Do not reveal whether the account exists
    res.json({ ok: true, message: 'If this email is registered, a reset link has been sent.' });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

export default router;
