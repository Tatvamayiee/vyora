import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import issueRoutes from './routes/issues.js';
import saleRoutes from './routes/sales.js';
import customerRoutes from './routes/customers.js';
import loyaltyRoutes from './routes/loyalty.js';
import promotionRoutes from './routes/promotions.js';
import staffRoutes from './routes/staff.js';
import branchRoutes from './routes/branches.js';
import reportRoutes from './routes/reports.js';
import syncRoutes from './routes/sync.js';
import notificationRoutes from './routes/notifications.js';
import { errorHandler } from './middleware/error.js';

export const prisma = new PrismaClient();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory/issues', issueRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'vyora-api' }));

// Apply error handling AFTER all routes to catch 404s
app.use(errorHandler);

const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Vyora API listening on http://localhost:${PORT}`);
});
