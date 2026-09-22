import React, { useEffect, useState } from 'react';
import { get, post, put, del, fmtINR, fmtDate, fmtDateTime } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useAuth, useToast } from '../auth';

const OWNER_NAV: NavItem[] = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/promotions', label: 'Promotions', icon: 'promotions' },
  { to: '/staff', label: 'Staff & Branches', icon: 'staff' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];
const MANAGER_NAV: NavItem[] = [
  { to: '/manager', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];

export function PromotionsPage() {
  const { toast, toastNode } = useToast();
  const [promos, setPromos] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    get('/promotions').then(setPromos).catch(() => {});
    get('/products').then((ps: any[]) => {
      setProducts(ps);
      const c = ps.map((p) => p.category).filter(Boolean).filter((c: any, i: number, a: any[]) => a.findIndex((x) => x.id === c.id) === i);
      setCats(c);
    }).catch(() => {});
  };
  useEffect(load, []);

  const statusBadge = (s: string) => (s === 'ACTIVE' ? 'green' : s === 'SCHEDULED' ? 'blue' : 'neutral');

  return (
    <Layout title="Promotions & Offers" nav={OWNER_NAV}
      actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ New Promotion</button>}>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Total</div><div className="value">{promos.length}</div></div>
        <div className="kpi"><div className="label">Active</div><div className="value" style={{ color: 'var(--success)' }}>{promos.filter((p) => p.status === 'ACTIVE').length}</div></div>
        <div className="kpi"><div className="label">Scheduled</div><div className="value" style={{ color: 'var(--secondary)' }}>{promos.filter((p) => p.status === 'SCHEDULED').length}</div></div>
        <div className="kpi"><div className="label">Expired</div><div className="value" style={{ color: 'var(--outline)' }}>{promos.filter((p) => p.status === 'EXPIRED').length}</div></div>
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Name</th><th>Discount</th><th>Scope</th><th>Period</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {promos.length === 0 && <tr><td colSpan={6} className="empty">No promotions yet</td></tr>}
            {promos.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}<div style={{ fontSize: 11, color: 'var(--outline)' }}>{p.description}</div></td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.discountType === 'PERCENT' ? `${Number(p.discountValue)}%` : `₹${Number(p.discountValue)}`}</td>
                <td>{p.category?.name || (p.products?.length ? `${p.products.length} product(s)` : 'All')}</td>
                <td style={{ fontSize: 12 }}>{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</td>
                <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm outline" onClick={() => setEditing(p)}>Edit</button>{' '}
                  <button className="btn sm danger" onClick={async () => {
                    if (!confirm(`Delete promotion "${p.name}"?`)) return;
                    try { await del(`/promotions/${p.id}`); toast('Deleted'); load(); } catch (e: any) { toast(e.message, true); }
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(showNew || editing) && (
        <PromoModal
          promo={editing} categories={cats} products={products}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onDone={() => { setShowNew(false); setEditing(null); load(); }}
          toast={toast}
        />
      )}
      {toastNode}
    </Layout>
  );
}

function PromoModal({ promo, categories, products, onClose, onDone, toast }: {
  promo: any; categories: any[]; products: any[]; onClose: () => void; onDone: () => void; toast: (t: string, e?: boolean) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: promo?.name || '', description: promo?.description || '',
    discountType: promo?.discountType || 'PERCENT', discountValue: promo ? String(Number(promo.discountValue)) : '10',
    categoryId: promo?.categoryId ? String(promo.categoryId) : '',
    productIds: promo?.products?.map((pp: any) => pp.productId) || [] as number[],
    startDate: promo ? new Date(promo.startDate).toISOString().slice(0, 10) : today,
    endDate: promo ? new Date(promo.endDate).toISOString().slice(0, 10) : in30,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const payload = {
      name: form.name, description: form.description || undefined,
      discountType: form.discountType, discountValue: Number(form.discountValue),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      productIds: form.productIds,
      startDate: form.startDate, endDate: form.endDate,
    };
    try {
      if (promo) await put(`/promotions/${promo.id}`, payload);
      else await post('/promotions', payload);
      toast(promo ? 'Promotion updated' : 'Promotion created'); onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16 }}>{promo ? 'Edit Promotion' : 'New Promotion'}</h3>
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={submit}>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="field"><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                <option value="PERCENT">Percent %</option><option value="FLAT">Flat ₹</option>
              </select>
            </div>
            <div className="field"><label>Value</label><input type="number" min="1" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required /></div>
          </div>
          <div className="field"><label>Category scope</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Whole store</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Specific products (optional)</label>
            <select multiple value={form.productIds.map(String)} onChange={(e) => setForm({ ...form, productIds: [...e.target.selectedOptions].map((o) => Number(o.value)) })} style={{ height: 90 }}>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="row">
            <div className="field"><label>Start</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
            <div className="field"><label>End</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : promo ? 'Save Changes' : 'Create Promotion'}</button>
        </form>
      </div>
    </div>
  );
}

export function StaffPage() {
  const { toast, toastNode } = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'staff' | 'branches'>('staff');

  const load = () => {
    get('/staff').then(setStaff).catch((e) => toast(e.message, true));
    get('/branches').then(setBranches).catch(() => {});
  };
  useEffect(load, []);

  async function toggleActive(emp: any) {
    try {
      await put(`/staff/${emp.id}`, { isActive: !emp.user.isActive });
      toast(emp.user.isActive ? 'Deactivated' : 'Activated'); load();
    } catch (e: any) { toast(e.message, true); }
  }

  async function createBranch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post('/branches', { name: f.get('name'), address: f.get('address') || undefined, city: f.get('city') || undefined, phone: f.get('phone') || undefined });
      toast('Branch created'); (e.target as HTMLFormElement).reset(); load();
    } catch (err: any) { toast(err.message, true); }
  }

  return (
    <Layout title="Staff & Branch Management" nav={OWNER_NAV}
      actions={<button className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add Employee</button>}>
      <div className="tabs">
        <button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Employees ({staff.length})</button>
        <button className={tab === 'branches' ? 'active' : ''} onClick={() => setTab('branches')}>Branches ({branches.length})</button>
      </div>

      {tab === 'staff' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Staff code</th><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {staff.length === 0 && <tr><td colSpan={7} className="empty">No staff</td></tr>}
              {staff.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace' }}>{s.staffCode}</td>
                  <td style={{ fontWeight: 600 }}>{s.user.fullName}</td>
                  <td>{s.user.email}</td>
                  <td><span className="badge blue">{s.user.role.name}</span></td>
                  <td>{s.branch?.name || '—'}</td>
                  <td><span className={`badge ${s.user.isActive ? 'green' : 'red'}`}>{s.user.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><button className="btn sm outline" onClick={() => toggleActive(s)}>{s.user.isActive ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'branches' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontSize: 15 }}>Create Branch</h3>
            <form onSubmit={createBranch}>
              <div className="field"><label>Branch name</label><input name="name" required /></div>
              <div className="field"><label>Address</label><input name="address" /></div>
              <div className="row">
                <div className="field"><label>City</label><input name="city" defaultValue="Bengaluru" /></div>
                <div className="field"><label>Phone</label><input name="phone" /></div>
              </div>
              <button className="btn primary">Create</button>
            </form>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 15 }}>All Branches</h3>
            {branches.map((b) => (
              <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--surface-container)' }}>
                <div style={{ fontWeight: 600 }}>{b.name} {!b.isActive && <span className="badge red">Inactive</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--outline)' }}>{b.address}, {b.city}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Staff: {b.employees?.map((e: any) => e.user.fullName).join(', ') || 'none assigned'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddStaffModal branches={branches} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} toast={toast} />
      )}
      {toastNode}
    </Layout>
  );
}

function AddStaffModal({ branches, onClose, onDone, toast }: { branches: any[]; onClose: () => void; onDone: () => void; toast: (t: string, e?: boolean) => void }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'CASHIER', branchId: '', staffCode: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await post('/staff', {
        fullName: form.fullName, email: form.email, password: form.password,
        role: form.role, staffCode: form.staffCode,
        branchId: form.branchId ? Number(form.branchId) : null,
        phone: form.phone || undefined,
      });
      toast('Employee added'); onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16 }}>Add Employee</h3>
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={submit}>
          <div className="row">
            <div className="field"><label>Full name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
            <div className="field"><label>Staff code</label><input value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} placeholder="EMP-4483" required /></div>
          </div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="row">
            <div className="field"><label>Temp password</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>MANAGER</option><option>CASHIER</option><option>WAREHOUSE</option>
              </select>
            </div>
            <div className="field"><label>Branch</label>
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">Unassigned</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Create Employee'}</button>
        </form>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [sales, setSales] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [cust, setCust] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    get(`/reports/sales?days=${days}`).then(setSales).catch(() => {});
    get('/reports/inventory').then(setInv).catch(() => {});
    get('/reports/customers').then(setCust).catch(() => {});
  }, [days]);

  const maxDay = sales ? Math.max(...Object.values(sales.byDay || {}).map((d: any) => d.revenue), 1) : 1;

  return (
    <Layout title="Reports & Business Insights" nav={OWNER_NAV}
      actions={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      }>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Revenue</div><div className="value">{fmtINR(sales?.totalRevenue || 0)}</div></div>
        <div className="kpi"><div className="label">Bills</div><div className="value">{sales?.billCount || 0}</div></div>
        <div className="kpi"><div className="label">Payment mix</div>
          <div className="value" style={{ fontSize: 15 }}>
            {sales ? Object.entries(sales.byPayment).map(([m, v]: any) => `${m} ${fmtINR(v)}`).join(' · ') : '—'}
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Daily Revenue</h3>
          {!sales || !Object.keys(sales.byDay).length ? <div className="empty">No data</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(sales.byDay).map(([day, d]: any) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ width: 80 }}>{day.slice(5)}</span>
                  <div style={{ flex: 1, background: 'var(--surface-low)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.revenue / maxDay) * 100}%`, background: 'var(--primary)', height: 14 }} />
                  </div>
                  <span style={{ width: 90, textAlign: 'right', fontWeight: 600 }}>{fmtINR(d.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Top Products (by qty)</h3>
          <table>
            <thead><tr><th>Product</th><th>Qty</th></tr></thead>
            <tbody>
              {(!sales?.topProducts?.length) && <tr><td colSpan={2} className="empty">No data</td></tr>}
              {sales?.topProducts?.map((p: any) => <tr key={p.name}><td>{p.name}</td><td style={{ fontWeight: 700 }}>{p.qty}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Inventory Summary</h3>
          {inv && (
            <div className="totals">
              <div className="line"><span>Total SKUs tracked</span><span>{inv.totalSkus}</span></div>
              <div className="line"><span>Stock value (cost)</span><span>{fmtINR(inv.stockValue)}</span></div>
              <div className="line"><span>Low stock</span><span style={{ color: 'var(--warn)' }}>{inv.lowStock?.length || 0}</span></div>
              <div className="line"><span>Out of stock</span><span style={{ color: 'var(--error)' }}>{inv.outOfStock?.length || 0}</span></div>
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Top Customers</h3>
          <table>
            <thead><tr><th>Customer</th><th>Visits</th><th>Spend</th></tr></thead>
            <tbody>
              {(!cust?.topCustomers?.length) && <tr><td colSpan={3} className="empty">No data</td></tr>}
              {cust?.topCustomers?.slice(0, 10).map((c: any) => <tr key={c.email}><td>{c.name}</td><td>{c.visits}</td><td>{fmtINR(c.spend)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export function CustomerHome() {
  const { user, logout } = useAuth();
  const [cust, setCust] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const customerId = user?.customer?.id;

  useEffect(() => {
    if (!customerId) return;
    get(`/customers/${customerId}`).then(setCust).catch(() => {});
    get(`/loyalty/${customerId}`).then(setLoyalty).catch(() => {});
    get('/promotions').then((ps) => setPromos(ps.filter((p: any) => p.status === 'ACTIVE'))).catch(() => {});
  }, [customerId]);

  return (
    <div className="customer-shell">
      <div style={{ background: 'var(--primary)', color: '#fff', padding: '20px 20px 24px', borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Vanakkam 🙏</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.fullName}</div>
          </div>
          <button className="btn sm" onClick={logout} style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none' }}>Logout</button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div className="kpi-grid">
          <div className="kpi"><div className="label">Loyalty points</div><div className="value" style={{ color: 'var(--primary)' }}>{loyalty?.points ?? 0}</div><div className="sub">lifetime {loyalty?.lifetimeEarned ?? 0}</div></div>
          <div className="kpi"><div className="label">Total bills</div><div className="value">{cust?.sales?.length ?? 0}</div><div className="sub">recent 10</div></div>
        </div>
        <h3 style={{ fontSize: 15, margin: '12px 0 8px' }}>Active Offers</h3>
        {promos.length === 0 && <div className="empty">No active offers right now</div>}
        {promos.map((p) => (
          <div key={p.id} className="card" style={{ marginBottom: 10, padding: 14, borderLeft: '4px solid var(--primary)' }}>
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--outline)' }}>{p.description}</div>
            <div style={{ marginTop: 6 }}>
              <span className="badge green">{p.discountType === 'PERCENT' ? `${Number(p.discountValue)}% OFF` : `₹${Number(p.discountValue)} OFF`}</span>{' '}
              <span className="badge neutral">till {fmtDate(p.endDate)}</span>
            </div>
          </div>
        ))}
        <h3 style={{ fontSize: 15, margin: '16px 0 8px' }}>Recent Purchases</h3>
        {(cust?.sales?.length ?? 0) === 0 && <div className="empty">No purchases yet</div>}
        {cust?.sales?.slice(0, 5).map((s: any) => (
          <div key={s.id} className="card" style={{ marginBottom: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.billNumber}</div>
              <div style={{ fontSize: 11, color: 'var(--outline)' }}>{s.branch?.name} · {fmtDateTime(s.createdAt)}</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtINR(s.total)}</div>
          </div>
        ))}
      </div>
      <CustomerNav />
    </div>
  );
}

export function CustomerPurchases() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const customerId = user?.customer?.id;

  useEffect(() => {
    if (!customerId) return;
    get(`/loyalty/${customerId}`).then((l) => {
      void l;
      get('/sales').then(setSales).catch(() => {});
    }).catch(() => {});
  }, [customerId]);

  return (
    <div className="customer-shell">
      <div style={{ padding: 20 }}>
        <a href="#/customer" style={{ fontSize: 13 }}>← Home</a>
        <h2 style={{ margin: '8px 0 12px' }}>My Purchases</h2>
        {sales.length === 0 && <div className="empty">No purchases yet</div>}
        {sales.map((s) => (
          <div key={s.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700 }}>{s.billNumber}</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtINR(s.total)}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--outline)', margin: '4px 0' }}>{s.branch?.name} · {fmtDateTime(s.createdAt)} · {s.payments?.[0]?.method}</div>
            <table style={{ marginTop: 6 }}>
              <tbody>
                {s.items?.map((i: any) => (
                  <tr key={i.id}><td style={{ padding: '4px 0' }}>{i.product.name} × {i.quantity}</td><td style={{ textAlign: 'right', padding: '4px 0' }}>{fmtINR(i.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <CustomerNav />
    </div>
  );
}

export function CustomerProfile() {
  const { user, logout } = useAuth();
  const [loyalty, setLoyalty] = useState<any>(null);
  const customerId = user?.customer?.id;

  useEffect(() => {
    if (!customerId) return;
    get(`/loyalty/${customerId}`).then(setLoyalty).catch(() => {});
  }, [customerId]);

  return (
    <div className="customer-shell">
      <div style={{ padding: 20 }}>
        <a href="#/customer" style={{ fontSize: 13 }}>← Home</a>
        <h2 style={{ margin: '8px 0 12px' }}>Profile & Loyalty</h2>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.fullName}</div>
          <div style={{ fontSize: 13, color: 'var(--outline)' }}>{user?.email}</div>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="label">Balance</div><div className="value" style={{ color: 'var(--primary)' }}>{loyalty?.points ?? 0}</div></div>
          <div className="kpi"><div className="label">Earned</div><div className="value">{loyalty?.lifetimeEarned ?? 0}</div></div>
          <div className="kpi"><div className="label">Redeemed</div><div className="value">{loyalty?.lifetimeRedeemed ?? 0}</div></div>
        </div>
        <h3 style={{ fontSize: 15, margin: '14px 0 8px' }}>Loyalty History</h3>
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Points</th><th>Balance</th></tr></thead>
            <tbody>
              {(!loyalty?.transactions?.length) && <tr><td colSpan={4} className="empty">No transactions</td></tr>}
              {loyalty?.transactions?.map((t: any) => (
                <tr key={t.id}>
                  <td>{fmtDateTime(t.createdAt)}</td>
                  <td><span className={`badge ${t.points >= 0 ? 'green' : 'amber'}`}>{t.type}</span></td>
                  <td style={{ fontWeight: 700, color: t.points >= 0 ? 'var(--success)' : 'var(--warn)' }}>{t.points >= 0 ? '+' : ''}{t.points}</td>
                  <td>{t.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn danger" style={{ width: '100%', marginTop: 16 }} onClick={logout}>Logout</button>
      </div>
      <CustomerNav />
    </div>
  );
}

function CustomerNav() {
  const path = location.hash.replace(/^#/, '') || '/customer';
  const items = [
    { to: '/customer', label: 'Home', ic: '🏠' },
    { to: '/purchases', label: 'Purchases', ic: '🧾' },
    { to: '/profile', label: 'Profile', ic: '👤' },
  ];
  return (
    <nav className="customer-nav">
      {items.map((i) => (
        <a key={i.to} href={`#${i.to}`} className={path.startsWith(i.to) ? 'active' : ''}>
          <span className="ic">{i.ic}</span>{i.label}
        </a>
      ))}
    </nav>
  );
}
