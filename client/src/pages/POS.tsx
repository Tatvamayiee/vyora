import React, { useEffect, useRef, useState } from 'react';
import { get, post, fmtINR, fmtDateTime } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useAuth, useToast, useOnline } from '../auth';
import { saveOfflineTx, getPendingTxs, newOfflineId, OfflineTx, deleteOfflineTx } from '../services/offline';

const NAV: NavItem[] = [
  { to: '/pos', label: 'POS Billing', icon: 'pos' },
  { to: '/bills', label: 'Recent Bills', icon: 'billing' },
];

interface CartLine { productId: number; name: string; sku: string; unitPrice: number; taxRate: number; quantity: number; }

export function CashierPOS() {
  const { user, logout } = useAuth();
  const { toast, toastNode } = useToast();
  const online = useOnline();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = () => {
    get('/products?active=1').then(setProducts).catch(() => {});
    get('/customers').then(setCustomers).catch(() => {});
    getPendingTxs().then((t) => setPendingCount(t.filter((x) => x.status === 'PENDING_SYNC').length)).catch(() => {});
  };
  useEffect(load, []);
  useEffect(() => { if (online) syncPending(); }, [online]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  async function syncPending() {
    try {
      const pending = (await getPendingTxs()).filter((t) => t.status === 'PENDING_SYNC' || t.status === 'SYNC_FAILED');
      for (const t of pending) {
        try {
          await post('/sync/offline-transactions', t);
          await deleteOfflineTx(t.offlineId);
        } catch { /* leave for retry */ }
      }
      if (pending.length) { toast(`${pending.length} offline bill(s) synced`); setPendingCount(0); }
    } catch { /* server down */ }
  }

  const branchId = user?.employee?.branchId || 1;
  const categories = [...new Set(products.map((p) => p.category?.name))].filter(Boolean);
  const filtered = products.filter((p) =>
    (!category || p.category?.name === category) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)));
  const stockOf = (p: any) => p.inventories?.find((i: any) => i.branchId === branchId)?.quantity ?? 0;

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountAmt = subtotal * (discount / 100);
  const tax = cart.reduce((s, l) => s + (l.unitPrice * l.quantity - (l.unitPrice * l.quantity * discount) / 100) * (l.taxRate / 100), 0);
  const total = subtotal - discountAmt + tax;

  function addToCart(p: any) {
    if (stockOf(p) <= 0) return;
    setCart((c) => {
      const ex = c.find((l) => l.productId === p.id);
      if (ex) {
        if (ex.quantity >= stockOf(p)) { toast(`Only ${stockOf(p)} in stock`, true); return c; }
        return c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...c, { productId: p.id, name: p.name, sku: p.sku, unitPrice: Number(p.sellingPrice), taxRate: Number(p.taxRate), quantity: 1 }];
    });
  }
  function setQty(productId: number, q: number) {
    if (q <= 0) return setCart((c) => c.filter((l) => l.productId !== productId));
    const line = cart.find((l) => l.productId === productId);
    const max = stockOf(products.find((p) => p.id === productId));
    if (line && q > max) { toast(`Only ${max} in stock`, true); return; }
    setCart((c) => c.map((l) => (l.productId === productId ? { ...l, quantity: q } : l)));
  }

  async function checkout() {
    if (!cart.length) return toast('Cart is empty', true);
    if (discount > 5) return toast('Maximum discount is 5%', true);
    setBusy(true);
    const payload = {
      branchId, customerId: customerId ? Number(customerId) : null,
      discountPct: discount, items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      payment: { method, amount: Math.round(total * 100) / 100 },
    };
    try {
      if (!online) {
        const tx: OfflineTx = {
          offlineId: newOfflineId(), ...payload,
          itemsDetail: cart.map((l) => ({ productId: l.productId, name: l.name, unitPrice: l.unitPrice })),
          createdAt: new Date().toISOString(), status: 'PENDING_SYNC',
        };
        await saveOfflineTx(tx);
        toast('Saved offline — will sync when back online');
        setCart([]); setDiscount(0); setCustomerId('');
        setPendingCount((n) => n + 1);
        return;
      }
      const res = await post<{ sale: any }>('/sales', payload);
      setBill(res.sale);
      toast(`Bill ${res.sale.billNumber} created`);
      setCart([]); setDiscount(0); setCustomerId('');
      load();
    } catch (e: any) {
      // fallback: save offline on network failure
      if (e.message.includes('fetch') || e.message.includes('Failed')) {
        const tx: OfflineTx = {
          offlineId: newOfflineId(), ...payload,
          itemsDetail: cart.map((l) => ({ productId: l.productId, name: l.name, unitPrice: l.unitPrice })),
          createdAt: new Date().toISOString(), status: 'PENDING_SYNC',
        };
        await saveOfflineTx(tx);
        toast('Network failed — saved offline', true);
        setCart([]); setDiscount(0); setCustomerId('');
      } else toast(e.message, true);
    } finally { setBusy(false); }
  }

  return (
    <Layout title="POS Billing" nav={NAV}
      actions={<>
        {pendingCount > 0 && <span className="badge amber">🔄 {pendingCount} pending sync</span>}
        <span className="badge blue">{online ? '🟢 Online' : '🔴 Offline'}</span>
      </>}>
      <div className="pos-layout">
        <div className="pos-products">
          <div className="toolbar">
            <input ref={searchRef} placeholder="Search name, SKU or scan barcode…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) addToCart(filtered[0]);
              }} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c as string}>{c}</option>)}
            </select>
          </div>
          <div className="pos-grid">
            {filtered.map((p) => {
              const st = stockOf(p);
              return (
                <div key={p.id} className={`pos-tile${st <= 0 ? ' out' : ''}`} onClick={() => addToCart(p)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--outline)' }}>{p.sku} · {p.category?.name}</div>
                  <div className="price">{fmtINR(p.sellingPrice)}</div>
                  <div className="stock">{st <= 0 ? 'Out of stock' : `${st} in stock`}</div>
                </div>
              );
            })}
            {!filtered.length && <div className="empty">No products match</div>}
          </div>
        </div>
        <div className="cart">
          <h3 style={{ fontSize: 15 }}>Cart ({cart.reduce((s, l) => s + l.quantity, 0)} items)</h3>
          <div className="field" style={{ marginBottom: 8 }}>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName} {c.phone ? `· ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div className="cart-items">
            {cart.length === 0 && <div className="empty">Tap products to add</div>}
            {cart.map((l) => (
              <div key={l.productId} className="cart-line">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--outline)' }}>{fmtINR(l.unitPrice)} each</div>
                </div>
                <div className="qty-ctl">
                  <button onClick={() => setQty(l.productId, l.quantity - 1)}>−</button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{l.quantity}</span>
                  <button onClick={() => setQty(l.productId, l.quantity + 1)}>+</button>
                </div>
                <div style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>{fmtINR(l.unitPrice * l.quantity)}</div>
              </div>
            ))}
          </div>
          <div className="field row">
            <div>
              <label>Discount % (max 5)</label>
              <input type="number" min={0} max={5} step={0.5} value={discount} onChange={(e) => {
                const v = Math.min(Number(e.target.value), 5);
                if (Number(e.target.value) > 5) toast('Cashier discount is capped at 5%', true);
                setDiscount(v || 0);
              }} />
            </div>
            <div>
              <label>Payment</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
              </select>
            </div>
          </div>
          <div className="totals">
            <div className="line"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
            <div className="line"><span>Discount ({discount}%)</span><span>−{fmtINR(discountAmt)}</span></div>
            <div className="line"><span>Tax</span><span>{fmtINR(tax)}</span></div>
            <div className="line grand"><span>Total</span><span>{fmtINR(total)}</span></div>
          </div>
          <button className="btn primary" style={{ width: '100%', marginTop: 12 }} disabled={busy || !cart.length} onClick={checkout}>
            {busy ? 'Processing…' : online ? `Charge ${fmtINR(total)}` : 'Save Bill Offline'}
          </button>
        </div>
      </div>
      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
      {toastNode}
    </Layout>
  );
}

export function BillModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} id="print-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>Vyora Retail</div>
            <div style={{ fontSize: 12, color: 'var(--outline)' }}>{sale.branch?.name}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div style={{ fontWeight: 700 }}>{sale.billNumber}</div>
            <div>{fmtDateTime(sale.createdAt)}</div>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed var(--outline-variant)', margin: '12px 0' }} />
        <div style={{ fontSize: 12 }}>Cashier: <b>{sale.cashier?.fullName}</b> · Customer: <b>{sale.customer?.fullName || 'Walk-in'}</b></div>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            {sale.items.map((i: any) => (
              <tr key={i.id}><td>{i.product.name}</td><td>{i.quantity}</td><td>{fmtINR(i.unitPrice)}</td><td>{fmtINR(i.lineTotal)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="totals" style={{ marginTop: 10 }}>
          <div className="line"><span>Subtotal</span><span>{fmtINR(sale.subtotal)}</span></div>
          <div className="line"><span>Discount</span><span>−{fmtINR(sale.discount)}</span></div>
          <div className="line"><span>Tax</span><span>{fmtINR(sale.tax)}</span></div>
          <div className="line grand"><span>Total ({sale.payments?.[0]?.method})</span><span>{fmtINR(sale.total)}</span></div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--outline)' }}>Thank you for shopping at Vyora!</div>
      </div>
    </div>
  );
}

export function RecentBills() {
  const [sales, setSales] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  useEffect(() => { get('/sales').then(setSales).catch(() => {}); }, []);
  return (
    <Layout title="Recent Bills" nav={NAV}>
      <div className="card">
        <table>
          <thead><tr><th>Bill</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Method</th><th></th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={7} className="empty">No bills yet</td></tr>}
            {sales.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.billNumber}</td>
                <td>{s.customer?.fullName || 'Walk-in'}</td>
                <td>{fmtDateTime(s.createdAt)}</td>
                <td>{s.items?.reduce((a: number, i: any) => a + i.quantity, 0)}</td>
                <td>{fmtINR(s.total)}</td>
                <td><span className="badge neutral">{s.payments?.[0]?.method}</span></td>
                <td><button className="btn sm outline" onClick={() => setBill(s)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
    </Layout>
  );
}
