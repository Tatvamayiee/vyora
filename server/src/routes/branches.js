import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    let branchId;
    if (req.user.role.name === 'MANAGER') {
      const managerBranchId = req.user.employee?.branchId;
      if (!managerBranchId) return res.status(403).json({ error: 'Manager profile not assigned to a branch' });
      if (!authorizedBranch(req, managerBranchId)) return res.status(403).json({ error: 'Access denied to this branch' });
      branchId = managerBranchId;
    }
    const branches = await prisma.branch.findMany({
      where: branchId ? { id: branchId } : {},
      include: { employees: { include: { user: { select: { fullName: true } } } } },
      orderBy: { name: 'asc' },
    });
    res.json(branches);
  } catch (e) { next(e); }
});

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  managerEmployeeId: z.number().int().nullable().optional(),
});

router.post('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    const data = branchSchema.parse(req.body);
    const exists = await prisma.branch.findUnique({ where: { name: data.name } });
    if (exists) throw new HttpError(409, 'A branch with this name already exists');
    const branch = await prisma.branch.create({ data: { name: data.name, address: data.address, city: data.city, phone: data.phone } });
    if (data.managerEmployeeId) {
      const employee = await prisma.employee.findUnique({ where: { id: data.managerEmployeeId } });
      if (!employee) throw new HttpError(404, 'Manager employee not found');
      await prisma.employee.update({ where: { id: data.managerEmployeeId }, data: { branchId: branch.id } });
    }
    res.status(201).json(branch);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (e.code === 'P2002') return next(new HttpError(409, 'A branch with this name already exists'));
    next(e);
  }
});

router.put('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    const branch = await prisma.branch.findUnique({ where: { id: Number(req.params.id) } });
    if (!branch) throw new HttpError(404, 'Branch not found');
    const data = branchSchema.partial().parse(req.body);
    const { managerEmployeeId, ...rest } = data;
    const updated = await prisma.branch.update({ where: { id: branch.id }, data: rest });
    if (managerEmployeeId !== undefined) {
      await prisma.employee.updateMany({ where: { branchId: branch.id }, data: { branchId: null } });
      if (managerEmployeeId) {
        const employee = await prisma.employee.findUnique({ where: { id: managerEmployeeId } });
        if (!employee) throw new HttpError(404, 'Manager employee not found');
        await prisma.employee.update({ where: { id: managerEmployeeId }, data: { branchId: branch.id } });
      }
    }
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (e.code === 'P2025') return next(new HttpError(404, 'Branch not found'));
    next(e);
  }
});

export default router;
