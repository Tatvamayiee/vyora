// IndexedDB offline storage for POS transactions
const DB_NAME = 'vyora_offline';
const STORE = 'pending_transactions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'offlineId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineTx {
  offlineId: string;
  branchId: number;
  customerId: number | null;
  discountPct: number;
  items: { productId: number; quantity: number }[];
  itemsDetail: { productId: number; name: string; unitPrice: number }[];
  payment: { method: string; amount: number };
  createdAt: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED';
}

export async function saveOfflineTx(tx: OfflineTx) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(tx);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getPendingTxs(): Promise<OfflineTx[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineTx[]);
    req.onerror = () => reject(req.error);
  });
}

export async function updateTxStatus(offlineId: string, status: OfflineTx['status']) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const getReq = store.get(offlineId);
    getReq.onsuccess = () => {
      const tx = getReq.result;
      if (tx) {
        tx.status = status;
        store.put(tx);
      }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function deleteOfflineTx(offlineId: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(offlineId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function newOfflineId() {
  return `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
