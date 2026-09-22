import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const staffSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER'], 'Invalid role'),
  branchId: z.number().int().positive('Valid branch ID required').optional(),
  staffCode: z.string().min(1, 'Staff code is required'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Valid phone number required').optional(),
  isActive: z.boolean().default(true).optional(),
});

const router = Router();
router.use(auth);

router.get('/', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    // Branch restriction for MANAGER role
    if (req.user.role.name === 'MANAGER') {
      const userBranch = req.user.employee?.branchId;
      if (!userBranch) {
        return res.status(403).json({ error: 'Manager profile not assigned to a branch' });
      }
      // Only return staff in the manager's branch
      const staff = await prisma.employee.findMany({
        where: { branchId: userBranch },
        include: { 
          user: { select: { id: true, email: true, fullName: true, isActive: true, role: true } }, 
          branch: true 
        },
        orderBy: { id: 'asc' },
      });
      return res.json(staff);
    }
    
    // OWNER can see all staff
    const staff = await prisma.employee.findMany({
      include: { 
        user: { select: { id: true, email: true, fullName: true, isActive: true, role: true } }, 
        branch: true 
      },
      orderBy: { id: 'asc' },
    });
    res.json(staff);
  } catch (e) { next(e); }
});

router.post('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = staffSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) throw new HttpError(409, 'A user with this email already exists');
    const role = await prisma.role.findUnique({ where: { name: data.role } });
    if (!role) throw new HttpError(400, 'Invalid role');
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName, roleId: role.id,
        employee: { create: { branchId: data.branchId || null, staffCode: data.staffCode, phone: data.phone || null } },
      },
    });
    res.status(201).json({ id: user.id });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

router.put('/:id', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    // First check if user has authorization for this staff member
    const targetEmployee = await prisma.employee.findUnique({ 
      where: { id: Number(req.params.id) }, 
      include: { user: true } 
    });
    if (!targetEmployee) throw new HttpError(404, 'Employee not found');
    
    // Check branch authorization
    if (!authorizedBranch(req, targetEmployee.branchId)) {
      return res.status(403).json({ 
        error: 'You are not authorized to modify staff in this branch. Only branch managers or owners can access this data.'
      });
    }
    
    const data = staffSchema.partial().omit({ password: true }).parse(req.body);
    const updateData = {};
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.role) {
      const role = await prisma.role.findUnique({ where: { name: data.role } });
      if (role) updateData.roleId = role.id;
    }
    if (data.branchId !== undefined) {
      updateData.employee = { update: { branchId: data.branchId } };
    }
    if (data.staffCode) {
      updateData.employee = { update: { ...(updateData.employee?.update || {}), staffCode: data.staffCode } };
    }
    if (data.phone) {
      updateData.employee = { update: { ...(updateData.employee?.update || {}), phone: data.phone } };
    }
    const user = await prisma.user.update({ where: { id: targetEmployee.userId }, data: updateData });
    res.json({ id: user.id });
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    next(e);
  }
});

export default router;
