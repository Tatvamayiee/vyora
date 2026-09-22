import { z } from 'zod';
import { prisma } from '../index.js';
import { HttpError } from '../middleware/error.js';

const CASHIER_MAX_DISCOUNT = 0.05;

export const saleSchema = z.object({
  branchId: z.number().int(),
  customerId: z.number().int().optional().nullable(),
  discountPct: z.number().min(0).max(100).default(0),
  items: z.array(z.object({
    productId: z.number().int(),
    quantity: z.number().int().positive('Quantity must be at least 1'),
  })).min(1, 'Cart is empty'),
  payment: z.object({
    method: z.enum(['CASH', 'UPI', 'CARD']),
    amount: z.number().positive('Payment amount must be positive'),
  }),
  offlineId: z.string().optional().nullable(),
});

async function nextBillNumber(branchId) {
  const count = await prisma.sale.count({ where: { branchId } });
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  const code = branch ? branch.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : 'STR';
  return `VY-${code}-${String(count + 1).padStart(5, '0')}`;
}

export async function createSale(data, user) {
  return prisma.$transaction(async (tx) => {
    // idempotency for offline sync
    if (data.offlineId) {
      const existing = await tx.sale.findUnique({ where: { offlineId: data.offlineId } });
      if (existing) return { duplicate: true, sale: existing };
    }

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const products = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) throw new HttpError(400, 'One or more products are invalid');

    const inventories = await tx.inventory.findMany({ where: { productId: { in: productIds }, branchId: data.branchId } });
    const invMap = new Map(inventories.map((i) => [i.productId, i]));

    for (const item of data.items) {
      const inv = invMap.get(item.productId);
      if (!inv || inv.quantity < item.quantity) {
        const p = products.find((p) => p.id === item.productId);
        throw new HttpError(400, `Insufficient stock for ${p ? p.name : 'product'}`);
      }
    }

    // apply active promotions
    const now = new Date();
    const promotions = await tx.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now }, endDate: { gte: now },
        OR: [{ categoryId: { in: products.map((p) => p.categoryId) } }, { products: { some: { productId: { in: productIds } } } }],
      },
      include: { products: true },
    });
    const promoForProduct = (productId, categoryId) =>
      promotions.find((pr) => pr.products.some((pp) => pp.productId === productId) || pr.categoryId === categoryId);

    let subtotal = 0, totalDiscount = 0, totalTax = 0;
    const lineData = data.items.map((item) => {
      const p = products.find((p) => p.id === item.productId);
      const promo = promoForProduct(p.id, p.categoryId);
      const unitPrice = Number(p.sellingPrice);
      let lineDiscount = 0;
      if (promo) {
        lineDiscount += promo.discountType === 'PERCENT'
          ? (unitPrice * Number(promo.discountValue)) / 100 * item.quantity
          : Number(promo.discountValue) * item.quantity;
      }
      const gross = unitPrice * item.quantity;
      lineDiscount += (gross * (data.discountPct || 0)) / 100;
      const taxable = gross - lineDiscount;
      const tax = (taxable * Number(p.taxRate)) / 100;
      subtotal += gross; totalDiscount += lineDiscount; totalTax += tax;
      return { p, item, unitPrice, lineDiscount, tax, lineTotal: taxable + tax };
    });

    const total = subtotal - totalDiscount + totalTax;
    if (data.payment.amount < Math.round(total * 100) / 100) {
      throw new HttpError(400, 'Payment amount is less than the bill total');
    }

    const billNumber = await nextBillNumber(data.branchId);
    const sale = await tx.sale.create({
      data: {
        billNumber,
        branchId: data.branchId,
        customerId: data.customerId || null,
        cashierId: user.id,
        subtotal, discount: totalDiscount, tax: totalTax, total,
        offlineId: data.offlineId || null,
        items: {
          create: lineData.map((l) => ({
            productId: l.p.id, quantity: l.item.quantity,
            unitPrice: l.unitPrice, discount: Math.round(l.lineDiscount * 100) / 100,
            tax: Math.round(l.tax * 100) / 100, lineTotal: Math.round(l.lineTotal * 100) / 100,
          })),
        },
      },
      include: { items: true },
    });

    await tx.payment.create({ data: { saleId: sale.id, method: data.payment.method, amount: Math.round(total * 100) / 100 } });

    // reduce inventory + stock movement
    for (const item of data.items) {
      const inv = invMap.get(item.productId);
      await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: item.quantity } } });
      await tx.stockMovement.create({
        data: { productId: item.productId, branchId: data.branchId, userId: user.id, type: 'SALE', quantity: -item.quantity, notes: `Sale ${billNumber}` },
      });
    }

    // loyalty earn: 1 point per ₹100 spent
    if (data.customerId) {
      const pointsEarned = Math.floor(total / 100);
      if (pointsEarned > 0) {
        let account = await tx.loyaltyAccount.findUnique({ where: { customerId: data.customerId } });
        if (!account) account = await tx.loyaltyAccount.create({ data: { customerId: data.customerId, points: 0 } });
        const balanceAfter = account.points + pointsEarned;
        await tx.loyaltyAccount.update({ where: { id: account.id }, data: { points: { increment: pointsEarned }, lifetimeEarned: { increment: pointsEarned } } });
        await tx.loyaltyTransaction.create({ data: { accountId: account.id, customerId: data.customerId, type: 'EARN', points: pointsEarned, balanceAfter, notes: `Earned on ${billNumber}` } });
      }
    }

    const full = await tx.sale.findUnique({ where: { id: sale.id }, include: { items: { include: { product: true } }, payments: true, customer: true, branch: true } });
    return { duplicate: false, sale: full };
  });
}
