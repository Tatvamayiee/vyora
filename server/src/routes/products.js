import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { auth, requireRole, authorizedBranch } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(auth);

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int('Select a category'),
  costPrice: z.number().nonnegative('Cost price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  taxRate: z.number().min(0).max(100).default(5),
  reorderLevel: z.number().int().min(0).default(10),
  isActive: z.boolean().default(true),
});

router.get('/', async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const priceMin = req.query.priceMin ? Number(req.query.priceMin) : undefined;
    const priceMax = req.query.priceMax ? Number(req.query.priceMax) : undefined;
    const inStock = req.query.inStock === 'true';
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const skip = (page - 1) * limit;
    
    // Build search conditions with ranking
    let whereConditions = { isActive: true };
    const searchConditions = [];
    
    if (q) {
      // Exact matches get highest priority
      const exactNameMatch = { name: { equals: q, mode: 'insensitive' } };
      const exactSkuMatch = { sku: { equals: q } };
      const exactBarcodeMatch = { barcode: { equals: q } };
      
      searchConditions.push(exactNameMatch, exactSkuMatch, exactBarcodeMatch);
      
      // Partial matches get lower priority
      const fuzzyNameMatch = { name: { contains: q, mode: 'insensitive' } };
      const fuzzySkuMatch = { sku: { contains: q } };
      const fuzzyBarcodeMatch = { barcode: q };
      
      searchConditions.push(fuzzyNameMatch, fuzzySkuMatch, fuzzyBarcodeMatch);
    }
    
    if (searchConditions.length > 0) {
      whereConditions.OR = searchConditions;
    }
    
    if (categoryId) whereConditions.categoryId = categoryId;
    if (priceMin) whereConditions.sellingPrice = { gte: priceMin };
    if (priceMax) {
      if (!whereConditions.sellingPrice) whereConditions.sellingPrice = {};
      whereConditions.sellingPrice.lte = priceMax;
    }
    
    if (inStock && branchId) {
      whereConditions.inventories = {
        some: {
          branchId: branchId,
          quantity: { gt: 0 },
        },
      };
    }
    
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereConditions,
        include: {
          category: true,
          inventories: {
            where: branchId ? { branchId } : {},
            include: { branch: true },
          },
          promotions: {
            include: { promotion: true },
            where: { promotion: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } } },
          },
        },
        orderBy: [
          // Prioritize exact matches first
          { name: 'asc' },
        ],
        take: limit,
        skip,
      }),
      prisma.product.count({ where: whereConditions }),
    ]);
    
    // Format products for response
    const formattedProducts = products.map(product => {
      const branchInventories = product.inventories || [];
      const activeInventories = branchId 
        ? branchInventories.filter(inv => inv.branchId === branchId)
        : branchInventories;
      
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        categoryId: product.categoryId,
        categoryName: product.category?.name || null,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        taxRate: product.taxRate,
        reorderLevel: product.reorderLevel,
        isActive: product.isActive,
        // Stock information for selected branch
        stock: branchId
          ? activeInventories.find(inv => inv.branchId === branchId)?.quantity || 0
          : activeInventories.reduce((max, inv) => Math.max(max, inv.quantity), 0),
        
        // Promotion information
        promotion: product.promotions?.length > 0
          ? {
              id: product.promotions[0].promotion.id,
              name: product.promotions[0].promotion.name,
              discountType: product.promotions[0].promotion.discountType,
              discountValue: product.promotions[0].promotion.discountValue,
            }
          : null,
        
        // Branch inventory list for all branches
        branches: branchInventories.map(inv => ({
          branchId: inv.branchId,
          branchName: inv.branch?.name || 'Unknown',
          quantity: inv.quantity,
          lowStock: inv.quantity <= inv.reorderLevel,
        })),
      };
    });
    
    res.json({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, inventories: { include: { branch: true } } },
    });
    if (!product) throw new HttpError(404, 'Product not found');
    res.json(product);
  } catch (e) { next(e); }
});

router.post('/', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const exists = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (exists) throw new HttpError(409, 'A product with this SKU already exists');
    const branches = await prisma.branch.findMany({ select: { id: true } });
    const product = await prisma.product.create({
      data: {
        ...data,
        barcode: data.barcode || null,
        inventories: { create: branches.map((b) => ({ branchId: b.id, quantity: 0, reorderLevel: data.reorderLevel })) },
      },
      include: { category: true, inventories: { include: { branch: true } } },
    });
    res.status(201).json(product);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (e.code === 'P2002') return next(new HttpError(409, 'Barcode already in use'));
    next(e);
  }
});

router.put('/:id', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: Number(req.params.id) }, data });
    res.json(product);
  } catch (e) {
    if (e instanceof z.ZodError) return next(new HttpError(400, e.issues[0].message));
    if (e.code === 'P2025') return next(new HttpError(404, 'Product not found'));
    next(e);
  }
});

router.delete('/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    await prisma.product.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return next(new HttpError(404, 'Product not found'));
    next(e);
  }
});

export default router;
