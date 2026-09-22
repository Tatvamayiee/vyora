import React, { useEffect, useState } from 'react';
import { get, post, put, fmtINR, fmtDateTime } from '../services/api';
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
];

interface InventoryRow {
  id: number; quantity: number; reorderLevel: number;
  product: { id: number; name: string; sku: string; sellingPrice: string; category: { name: string } };
  branch: { id: number; name: string };
}

export function InventoryPage() {
  const { user } = useAuth();
  const { toast, toastNode } = useToast();
  const isOwner = user?.role.name === 'OWNER';
  const nav = isOwner ? OWNER_NAV : MANAGER_NAV;
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editReorder, setEditReorder] = useState<{ id: number; value: number } | null>(null);

  const load = () => {
    get('/inventory' + (branchFilter ? `?branchId=${branchFilter}` : '')).then(setRows).catch((e) => toast(e.message, true));
    get('/products').then(setProducts).catch(() => {});
    if (isOwner) get('/branches').then(setBranches).catch(() => {});
  };
  useEffect(load, [branchFilter]);

  const filtered = rows.filter((r) => !search || r.product.name.toLowerCase().includes(search.toLowerCase()) || r.product.sku.toLowerCase().includes(search.toLowerCase()));
  const status = (r: InventoryRow) => (r.quantity <= 0 ? { cls: 'red', label: 'Out of stock' } : r.quantity <= r.reorderLevel ? { cls: 'amber', label: 'Low' } : { cls: 'green', label: 'In stock' });

  async function saveReorder() {
    if (!editReorder) return;
    try {
      await put(`/inventory/${editReorder.id}`, { reorderLevel: editReorder.value });
      toast('Reorder level updated'); setEditReorder(null); load();
    } catch (e: any) { toast(e.message, true); }
  }

  return (
    <Layout title="Inventory & Product Management" nav={nav}
      actions={<button className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add Product</button>}>
      <div className="toolbar">
        <input placeholder="Search product or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        {isOwner && (
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <span className="badge neutral">{filtered.length} records</span>
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Branch</th><th>Stock</th><th>Reorder</th><th>Status</th>{isOwner && <th></th>}</tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="empty">No inventory records</td></tr>}
            {filtered.map((r) => {
              const s = status(r);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.product.name}</td>
                  <td>{r.product.sku}</td>
                  <td>{r.product.category?.name}</td>
                  <td>{r.branch.name}</td>
                  <td style={{ fontWeight: 700 }}>{r.quantity}</td>
                  <td>{editReorder?.id === r.id ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input type="number" style={{ width: 70 }} value={editReorder.value}
                        onChange={(e) => setEditReorder({ id: r.id, value: Number(e.target.value) })} />
                      <button className="btn sm primary" onClick={saveReorder}>Save</button>
                    </span>
                  ) : r.reorderLevel}</td>
                  <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                  {isOwner && <td>{r.quantity <= r.reorderLevel && <button className="btn sm outline" onClick={() => setEditReorder({ id: r.id, value: r.reorderLevel })}>Edit</button>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <AddProductModal
          categories={[...new Set(products.map((p: any) => p.category?.name))].filter(Boolean)}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load(); }}
          toast={toast}
        />
      )}
      {toastNode}
    </Layout>
  );
}

function AddProductModal({ categories, onClose, onDone, toast }: { categories: string[]; onClose: () => void; onDone: () => void; toast: (t: string, e?: boolean) => void }) {
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', categoryId: '', costPrice: '', sellingPrice: '', taxRate: '5', reorderLevel: '10' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { get('/products').then((ps: any[]) => setCats(ps.map((p) => p.category).filter((c, i, a) => c && a.findIndex((x) => x.id === c.id) === i))).catch(() => {}); }, []);
  const catList = cats.length ? cats : categories.map((name, id) => ({ id: id + 1, name }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await post('/products', {
        name: form.name, sku: form.sku, barcode: form.barcode || undefined,
        categoryId: Number(form.categoryId), costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice), taxRate: Number(form.taxRate), reorderLevel: Number(form.reorderLevel),
      });
      toast('Product created'); onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16 }}>Add Product</h3>
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={submit}>
          <div className="field"><label>Product name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="row">
            <div className="field"><label>SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required /></div>
            <div className="field"><label>Barcode</label><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          </div>
          <div className="field"><label>Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Select…</option>
              {catList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="row">
            <div className="field"><label>Cost price ₹</label><input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required /></div>
            <div className="field"><label>Selling price ₹</label><input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required /></div>
          </div>
          <div className="row">
            <div className="field"><label>Tax %</label><input type="number" min="0" max="100" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
            <div className="field"><label>Reorder level</label><input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : 'Create Product'}</button>
        </form>
      </div>
    </div>
  );
}

export function StockPage() {
  const { user } = useAuth();
  const { toast, toastNode } = useToast();
  const isOwner = user?.role.name === 'OWNER';
  const nav = isOwner ? OWNER_NAV : MANAGER_NAV;
  const [tab, setTab] = useState<'ops' | 'issues' | 'history'>('ops');
  const [movements, setMovements] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invRows, setInvRows] = useState<InventoryRow[]>([]);
  const [myBranch, setMyBranch] = useState<number | null>(null);

  const load = () => {
    get('/inventory/movements').then(setMovements).catch(() => {});
    get('/inventory/issues').then(setIssues).catch(() => {});
    get('/products?active=1').then(setProducts).catch(() => {});
    get('/inventory').then((rows: InventoryRow[]) => {
      setInvRows(rows);
      if (rows[0]) setMyBranch(rows[0].branch.id);
    }).catch(() => {});
  };
  useEffect(load, []);

  async function stockOp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post('/inventory/stock-update', {
        productId: Number(f.get('productId')), branchId: Number(f.get('branchId')),
        type: f.get('type'), quantity: Number(f.get('quantity')), notes: f.get('notes') || undefined,
      });
      toast('Stock updated'); (e.target as HTMLFormElement).reset(); load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function createIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post('/inventory/issues', {
        productId: Number(f.get('productId')), branchId: Number(f.get('branchId')),
        type: f.get('type'), quantity: Number(f.get('quantity')), reason: f.get('reason'), notes: f.get('notes') || undefined,
      });
      toast('Issue logged'); (e.target as HTMLFormElement).reset(); load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function setIssueStatus(id: number, status: string) {
    try { await put(`/inventory/issues/${id}`, { status }); load(); } catch (e: any) { toast(e.message, true); }
  }

  const branchId = myBranch || undefined;
  const productOptions = products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);

  return (
    <Layout title="Stock Operations & Inventory Issues" nav={nav}>
      <div className="tabs">
        <button className={tab === 'ops' ? 'active' : ''} onClick={() => setTab('ops')}>Stock Operations</button>
        <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>Issues ({issues.length})</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Movement History</button>
      </div>

      {tab === 'ops' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontSize: 15 }}>Receive / Adjust Stock</h3>
            <form onSubmit={stockOp}>
              <div className="field"><label>Product</label><select name="productId" required><option value="">Select…</option>{productOptions}</select></div>
              <div className="row">
                <div className="field"><label>Type</label>
                  <select name="type" defaultValue="RECEIVE">
                    <option value="RECEIVE">Receive (+)</option>
                    <option value="ISSUE">Issue / Remove (−)</option>
                    <option value="ADJUSTMENT">Set exact (adjustment)</option>
                  </select>
                </div>
                <div className="field"><label>Quantity</label><input name="quantity" type="number" required /></div>
              </div>
              <div className="field"><label>Branch</label>
                <select name="branchId" defaultValue={branchId} required>
                  {invRows.length ? [...new Map(invRows.map((r) => [r.branch.id, r.branch])).values()].map((b) => <option key={b.id} value={b.id}>{b.name}</option>) : <option value="1">Indiranagar Store</option>}
                </select>
              </div>
              <div className="field"><label>Notes</label><input name="notes" placeholder="GRN reference, reason…" /></div>
              <button className="btn primary">Apply</button>
            </form>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 15 }}>Current Stock Snapshot</h3>
            <table>
              <thead><tr><th>Product</th><th>Qty</th></tr></thead>
              <tbody>{invRows.slice(0, 8).map((r) => <tr key={r.id}><td>{r.product.name}</td><td style={{ fontWeight: 700 }}>{r.quantity}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 15 }}>Log New Issue</h3>
              <form onSubmit={createIssue}>
                <div className="field"><label>Product</label><select name="productId" required><option value="">Select…</option>{productOptions}</select></div>
                <div className="row">
                  <div className="field"><label>Type</label>
                    <select name="type" defaultValue="DAMAGED">
                      <option>LOW_STOCK</option><option>DAMAGED</option><option>EXPIRED</option><option>MISSING</option><option>OTHER</option>
                    </select>
                  </div>
                  <div className="field"><label>Qty</label><input name="quantity" type="number" min="1" required /></div>
                </div>
                <div className="field"><label>Branch</label>
                  <select name="branchId" defaultValue={branchId} required>
                    {invRows.length ? [...new Map(invRows.map((r) => [r.branch.id, r.branch])).values()].map((b) => <option key={b.id} value={b.id}>{b.name}</option>) : <option value="1">Indiranagar Store</option>}
                  </select>
                </div>
                <div className="field"><label>Reason</label><input name="reason" required placeholder="e.g. water damage, expired batch…" /></div>
                <button className="btn primary">Log Issue</button>
              </form>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {issues.length === 0 && <tr><td colSpan={5} className="empty">No issues</td></tr>}
                  {issues.slice(0, 8).map((i) => (
                    <tr key={i.id}>
                      <td>{i.product.name}</td>
                      <td><span className="badge amber">{i.type}</span></td>
                      <td>{i.quantity}</td>
                      <td><span className={`badge ${i.status === 'RESOLVED' ? 'green' : i.status === 'IN_PROGRESS' ? 'blue' : 'amber'}`}>{i.status}</span></td>
                      <td>{i.status !== 'RESOLVED' && (
                        <select defaultValue={i.status} onChange={(e) => setIssueStatus(i.id, e.target.value)} style={{ width: 120, padding: '4px 8px' }}>
                          <option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option>
                        </select>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Notes</th><th>By</th></tr></thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={6} className="empty">No movements yet</td></tr>}
              {movements.slice(0, 30).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDateTime(m.createdAt)}</td>
                  <td>{m.product?.name}</td>
                  <td><span className={`badge ${m.quantity >= 0 ? 'green' : 'red'}`}>{m.type}</span></td>
                  <td style={{ fontWeight: 700, color: m.quantity >= 0 ? 'var(--success)' : 'var(--error)' }}>{m.quantity >= 0 ? '+' : ''}{m.quantity}</td>
                  <td>{m.notes || '—'}</td>
                  <td>{m.user?.fullName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toastNode}
    </Layout>
  );
}

export function WarehousePage() {
  const { toast, toastNode } = useToast();
  const NAV: NavItem[] = [{ to: '/warehouse', label: 'Warehouse Workspace', icon: 'warehouse' }, { to: '/stock', label: 'Stock Ops', icon: 'stock' }];
  const [inv, setInv] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

  const load = () => {
    get('/inventory').then(setInv).catch(() => {});
    get('/inventory/movements').then(setMovements).catch(() => {});
    get('/products?active=1').then(setProducts).catch(() => {});
    get('/inventory/issues').then(setIssues).catch(() => {});
  };
  useEffect(load, []);

  const branch = inv[0]?.branch;
  const low = inv.filter((r) => r.quantity <= r.reorderLevel);

  async function receive(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post('/inventory/stock-update', {
        productId: Number(f.get('productId')), branchId: Number(f.get('branchId')),
        type: 'RECEIVE', quantity: Number(f.get('quantity')), notes: f.get('notes') || 'Warehouse GRN',
      });
      toast('Stock received'); (e.target as HTMLFormElement).reset(); load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function logIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post('/inventory/issues', {
        productId: Number(f.get('productId')), branchId: Number(f.get('branchId')),
        type: f.get('type'), quantity: Number(f.get('quantity')), reason: f.get('reason'),
      });
      toast('Issue logged'); (e.target as HTMLFormElement).reset(); load();
    } catch (err: any) { toast(err.message, true); }
  }

  return (
    <Layout title="Warehouse Workspace" nav={NAV}
      actions={<span className="badge blue">{branch?.name || 'Assigned branch'}</span>}>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">SKUs tracked</div><div className="value">{inv.length}</div></div>
        <div className="kpi"><div className="label">Low stock</div><div className="value" style={{ color: 'var(--warn)' }}>{low.length}</div></div>
        <div className="kpi"><div className="label">Open issues</div><div className="value" style={{ color: 'var(--error)' }}>{issues.filter((i) => i.status !== 'RESOLVED').length}</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Receive Stock (GRN)</h3>
          <form onSubmit={receive}>
            <div className="field"><label>Product</label><select name="productId" required><option value="">Select…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="row">
              <div className="field"><label>Branch</label>
                <select name="branchId" defaultValue={branch?.id} required>
                  {branch ? <option value={branch.id}>{branch.name}</option> : <option value="1">Indiranagar Store</option>}
                </select>
              </div>
              <div className="field"><label>Qty</label><input name="quantity" type="number" min="1" required /></div>
            </div>
            <div className="field"><label>Notes</label><input name="notes" placeholder="DC reference / vehicle no." /></div>
            <button className="btn primary">Receive</button>
          </form>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Log Damaged / Expired</h3>
          <form onSubmit={logIssue}>
            <div className="field"><label>Product</label><select name="productId" required><option value="">Select…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="row">
              <div className="field"><label>Type</label><select name="type" defaultValue="DAMAGED"><option>DAMAGED</option><option>EXPIRED</option><option>MISSING</option></select></div>
              <div className="field"><label>Qty</label><input name="quantity" type="number" min="1" required /></div>
            </div>
            <div className="field"><label>Branch</label>
              <select name="branchId" defaultValue={branch?.id} required>
                {branch ? <option value={branch.id}>{branch.name}</option> : <option value="1">Indiranagar Store</option>}
              </select>
            </div>
            <div className="field"><label>Reason</label><input name="reason" required /></div>
            <button className="btn primary">Log Issue</button>
          </form>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <h3 style={{ fontSize: 15, padding: '16px 16px 0' }}>Recent Movements</h3>
        <table>
          <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Notes</th></tr></thead>
          <tbody>
            {movements.length === 0 && <tr><td colSpan={5} className="empty">No movements</td></tr>}
            {movements.slice(0, 12).map((m) => (
              <tr key={m.id}>
                <td>{fmtDateTime(m.createdAt)}</td><td>{m.product?.name}</td>
                <td><span className={`badge ${m.quantity >= 0 ? 'green' : 'red'}`}>{m.type}</span></td>
                <td style={{ fontWeight: 700 }}>{m.quantity >= 0 ? '+' : ''}{m.quantity}</td>
                <td>{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toastNode}
    </Layout>
  );
}
