import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role.name, email: user.email },
    process.env.JWT_SECRET || 'development_secret_change_me',
    { expiresIn: '7d' }
  );
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development_secret_change_me');
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true, employee: { include: { branch: true } }, customer: true },
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Session invalid' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// role middleware: requireRole('OWNER','MANAGER')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role.name)) {
      return res.status(403).json({ error: 'You do not have permission for this action' });
    }
    next();
  };
}

// branch authorization: user may only touch their branch (MANAGER/CASHIER/WAREHOUSE), OWNER any
export function authorizedBranch(req, branchId) {
  if (req.user.role.name === 'OWNER') return true;
  const empBranch = req.user.employee?.branchId;
  return empBranch != null && Number(branchId) === Number(empBranch);
}

// Simple logout endpoint
export async function logout(req, res, next) {
  try {
    // For stateless JWT, logout is client-side only, but we can still validate token
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'development_secret_change_me');
      } catch (e) {
        // Token is already expired/invalid, that's fine for logout
      }
    }
    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (e) {
    next(e);
  }
}
