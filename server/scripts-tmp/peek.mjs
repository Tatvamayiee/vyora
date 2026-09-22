import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.product.findMany({ take: 15, select: { id: true, name: true, sku: true, barcode: true } });
console.log(JSON.stringify(rows, null, 1));
await p.$disconnect();
