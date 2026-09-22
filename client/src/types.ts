// types.ts
export interface User {
  id: number;
  email: string;
  fullName: string;
  role: {
    name: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'CUSTOMER';
  };
  isActive: boolean;
  employee?: {
    id: number;
    branchId: number | null;
    staffCode: string;
  };
  customer?: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: number;
  costPrice: string;
  sellingPrice: string;
  taxRate: string;
  reorderLevel: number;
  isActive: boolean;
  category?: {
    id: number;
    name: string;
  };
  inventories?: Inventory[];
}

export interface Inventory {
  id: number;
  productId: number;
  branchId: number;
  quantity: number;
  reorderLevel: number;
  updatedAt: string;
  product?: Product;
  branch?: {
    id: number;
    name: string;
  };
}

export interface Sale {
  id: number;
  billNumber: string;
  branchId: number;
  customerId: number | null;
  cashierId: number;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  offlineId: string | null;
  createdAt: string;
  customer?: {
    id: number;
    fullName: string;
  };
  branch?: {
    id: number;
    name: string;
  };
  payments?: Payment[];
  items?: SaleItem[];
  cashier?: {
    id: number;
    fullName: string;
  };
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  discount: string;
  tax: string;
  lineTotal: string;
  product?: Product;
}

export interface Payment {
  id: number;
  saleId: number;
  method: 'CASH' | 'UPI' | 'CARD';
  amount: string;
  createdAt: string;
}

export interface Branch {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LoyaltyAccount {
  id: number;
  customerId: number;
  points: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  updatedAt: string;
  transactions?: LoyaltyTransaction[];
  customer?: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface LoyaltyTransaction {
  id: number;
  accountId: number;
  customerId: number;
  type: 'EARN' | 'REDEEM' | 'ADJUST';
  points: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
}

export interface Promotion {
  id: number;
  name: string;
  description: string | null;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: string;
  categoryId: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  category?: {
    id: number;
    name: string;
  };
  products?: PromotionProduct[];
}

export interface PromotionProduct {
  promotionId: number;
  productId: number;
  product?: Product;
}

export interface StockMovement {
  id: number;
  productId: number;
  branchId: number;
  userId: number | null;
  type: 'RECEIVE' | 'ISSUE' | 'ADJUSTMENT' | 'SALE' | 'RETURN';
  quantity: number;
  notes: string | null;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    sku: string;
  };
  branch?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
    fullName: string;
  };
}

export interface InventoryIssue {
  id: number;
  productId: number;
  branchId: number;
  type: 'LOW_STOCK' | 'DAMAGED' | 'EXPIRED' | 'MISSING' | 'OTHER';
  quantity: number;
  reason: string;
  notes: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdById: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  branch?: {
    id: number;
    name: string;
  };
  createdBy?: {
    id: number;
    fullName: string;
  };
}

export interface Notification {
  id: number;
  userId: number | null;
  role: string | null;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface OfflineTransaction {
  id: string;
  cashierId: number;
  branchId: number;
  payload: any;
  status: 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED';
  createdAt: string;
  syncedAt: string | null;
}

export interface DashboardKPIs {
  revenue: string;
  discount: string;
  tax: string;
  bills: number;
  customers: number;
  avgBill: string;
}

export interface SaleRequest {
  branchId: number;
  customerId?: number | null;
  discountPct?: number;
  items: {
    productId: number;
    quantity: number;
  }[];
  payment: {
    method: 'CASH' | 'UPI' | 'CARD';
    amount: number;
  };
  offlineId?: string | null;
}
