import React, { useEffect, useState } from 'react';
import { get, post, put, del, fmtDate, fmtINR } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useToast } from '../auth';

const NAV: NavItem[] = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/promotions', label: 'Promotions', icon: 'promotions' },
  { to: '/staff', label: 'Staff & Branches', icon: 'staff' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];

const empty = { name: '', description: '', discountType: 'PERCENT', discountValue: '', categoryId: '', productId: '', startDate: '', endDate: '' };

export function PromotionsPage() {
  const { toast, toastNode } = useToast();
  const [promos, setPromos] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  const load = () => {
    get('/promotions').then(setPromos).catch(() => {});
    get('/products?meta=categories').then(setCategories).catch(() => {});
    get('/products').then(setProducts).catch(() => {});
  };
  useEffect(load, []);

  function status(p: any) {
    const now = new Date();
    if (!p.isActive) return <span className="badge neutral">Inactive</span>;
    if (new Date(p.startDate) > now) return <span className="badge blue">Scheduled</span>;
    if (new Date(p.endDate) < now) return <span className="badge neutral">Expired</span>;
    return <span className="badge green">Active</span>;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const data: any = {
      name: form.name, description: form.description,
      discountType: form.discountType, discountValue: Number(form.discountValue),
      startDate: form.startDate, endDate: form.endDate,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      productIds: form.productId ? [Number(form.productId)] : [],
    };
    try {
      if (editId) await put(`/promotions/${editId}`, data);
      else await post('/promotions', data);
      toast(editId ? 'Promotion updated' : 'Promotion created');
      setModal(false); setForm(empty); setEditId(null); load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function toggle(p: any) {
    try { await put(`/promotions/${p.id}`, { isActive: !p.isActive }); load(); } catch (e: any) { toast(e.message, true); }
  }
  async function remove(id: number) {
    if (!confirm('Delete this promotion?')) return;
    try { await del(`/promotions/${id}`); toast('Promotion deleted'); load(); } catch (e: any) { toast(e.message, true); }
  }

  return (
    <Layout title="Promotions & Offers" nav={NAV}
      actions={<button className="btn primary sm" onClick={() => { setForm(empty); setEditId(null); setModal(true); }}>+ New Promotion</button>}>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Discount</th><th>Scope</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {promos.length === 0 && <tr><td colSpan={7} className="empty">No promotions yet</td></tr>}
            {promos.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}<div style={{ fontSize: 11, color: 'var(--outline)' }}>{p.description}</div></td>
                <td>{p.discountType === 'PERCENT' ? `${Number(p.discountValue)}%` : fmtINR(p.discountValue)}</td>
                <td style={{ fontSize: 12 }}>{p.category?.name || (p.products?.length ? p.products.map((pp: any) => pp.product?.name).join(', ') : 'All products')}</td>
                <td>{fmtDate(p.startDate)}</td><td>{fmtDate(p.endDate)}</td>
                <td>{status(p)}</td>
                <td>
                  <button className="btn sm" onClick={() => toggle(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</button>{' '}
                  <button className="btn sm" onClick={() => { setForm({ ...p, discountValue: String(p.discountValue), categoryId: p.categoryId || '', productId: p.products?.[0]?.productId || '', startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10) }); setEditId(p.id); setModal(true); }}>Edit</button>{' '}
                  <button className="btn sm danger" onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{editId ? 'Edit Promotion' : 'New Promotion'}</h3>
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Description</label><input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Discount type</label>
                <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                  <option value="PERCENT">Percent (%)</option><option value="FLAT">Flat (₹)</option>
                </select>
              </div>
              <div className="field"><label>Discount value</label><input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required /></div>
            </div>
            <div className="row">
              <div className="field"><label>Category scope</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, productId: '' })}>
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>or single product</label>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, categoryId: '' })} disabled={!!form.categoryId}>
                  <option value="">— None —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field"><label>Start date</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
              <div className="field"><label>End date</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
            </div>
            <button className="btn primary" style={{ width: '100%' }}>{editId ? 'Save changes' : 'Create promotion'}</button>
          </form>
        </div>
      )}
      {toastNode}
    </Layout>
  );
}

export function StaffBranchesPage() {
  const { toast, toastNode } = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [modal, setModal] = useState<null | 'staff' | 'branch'>(null);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', password: '', role: 'CASHIER', branchId: '', phone: '' });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', city: '', phone: '' });
  const [editBranchId, setEditBranchId] = useState<number | null>(null);

  const load = () => {
    get('/staff').then(setStaff).catch(() => {});
    get('/branches').then(setBranches).catch(() => {});
  };
  useEffect(load, []);

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post('/staff', {
        fullName: staffForm.fullName, email: staffForm.email, password: staffForm.password,
        role: staffForm.role, branchId: staffForm.branchId ? Number(staffForm.branchId) : null, phone: staffForm.phone || null,
      });
      toast('Employee added');
      setModal(null); setStaffForm({ fullName: '', email: '', password: '', role: 'CASHIER', branchId: '', phone: '' });
      load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function toggleStaff(emp: any) {
    try { await put(`/staff/${emp.id}`, { isActive: !emp.isActive }); toast('Employee updated'); load(); } catch (e: any) { toast(e.message, true); }
  }
  async function assignBranch(emp: any, branchId: string) {
    try { await put(`/staff/${emp.id}`, { branchId: branchId ? Number(branchId) : null }); toast('Branch assigned'); load(); } catch (e: any) { toast(e.message, true); }
  }

  async function saveBranch(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editBranchId) await put(`/branches/${editBranchId}`, branchForm);
      else await post('/branches', branchForm);
      toast(editBranchId ? 'Branch updated' : 'Branch created');
      setModal(null); setBranchForm({ name: '', address: '', city: '', phone: '' }); setEditBranchId(null);
      load();
    } catch (err: any) { toast(err.message, true); }
  }

  return (
    <Layout title="Staff & Branch Management" nav={NAV}
      actions={<>
        <button className="btn outline sm" onClick={() => { setBranchForm({ name: '', address: '', city: '', phone: '' }); setEditBranchId(null); setModal('branch'); }}>+ Branch</button>
        <button className="btn primary sm" onClick={() => setModal('staff')}>+ Employee</button>
      </>}>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Employees</h3>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.user?.fullName}<div style={{ fontSize: 11, color: 'var(--outline)' }}>{s.user?.email} · {s.staffCode}</div></td>
                  <td><span className="badge blue">{s.user?.role.name}</span></td>
                  <td>
                    <select value={s.branchId || ''} onChange={(e) => assignBranch(s, e.target.value)} style={{ padding: '6px 8px', fontSize: 12 }}>
                      <option value="">Unassigned</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${s.isActive ? 'green' : 'neutral'}`}>{s.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td><button className="btn sm" onClick={() => toggleStaff(s)}>{s.isActive ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Branches</h3>
          <table>
            <thead><tr><th>Branch</th><th>City</th><th>Phone</th><th></th></tr></thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.name}<div style={{ fontSize: 11, color: 'var(--outline)' }}>{b.address}</div></td>
                  <td>{b.city}</td><td>{b.phone}</td>
                  <td>
                    <button className="btn sm" onClick={() => { setBranchForm({ name: b.name, address: b.address || '', city: b.city || '', phone: b.phone || '' }); setEditBranchId(b.id); setModal('branch'); }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'staff' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveStaff}>
            <h3>Add Employee</h3>
            <div className="field"><label>Full name</label><input value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} required /></div>
            <div className="field"><label>Email</label><input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} required /></div>
            <div className="field"><label>Temporary password</label><input type="text" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} required minLength={8} /></div>
            <div className="row">
              <div className="field"><label>Role</label>
                <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
                  <option value="MANAGER">Manager</option><option value="CASHIER">Cashier</option><option value="WAREHOUSE">Warehouse</option>
                </select>
              </div>
              <div className="field"><label>Branch</label>
                <select value={staffForm.branchId} onChange={(e) => setStaffForm({ ...staffForm, branchId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn primary" style={{ width: '100%' }}>Add employee</button>
          </form>
        </div>
      )}

      {modal === 'branch' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveBranch}>
            <h3>{editBranchId ? 'Edit Branch' : 'New Branch'}</h3>
            <div className="field"><label>Name</label><input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required /></div>
            <div className="field"><label>Address</label><input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>City</label><input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
              <div className="field"><label>Phone</label><input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></div>
            </div>
            <button className="btn primary" style={{ width: '100%' }}>{editBranchId ? 'Save changes' : 'Create branch'}</button>
          </form>
        </div>
      )}
      {toastNode}
    </Layout>
  );
}

export function ReportsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [range, setRange] = useState('month');
  useEffect(() => { get(`/reports/sales?range=${range}`).then(setSales).catch(() => {}); }, [range]);
  return (
    <Layout title="Reports & Business Insights" nav={NAV}
      actions={<select value={range} onChange={(e) => setRange(e.target.value)} style={{ width: 'auto' }}>
        <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option>
      </select>}>
      <div className="card">
        <h3 style={{ fontSize: 15 }}>Sales Report</h3>
        <table>
          <thead><tr><th>Bill</th><th>Branch</th><th>Customer</th><th>Date</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={8} className="empty">No data for this period</td></tr>}
            {sales.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.billNumber}</td><td>{s.branch?.name}</td><td>{s.customer?.fullName || 'Walk-in'}</td>
                <td>{fmtDate(s.createdAt)}</td><td>{fmtINR(s.subtotal)}</td><td>{fmtINR(s.discount)}</td><td>{fmtINR(s.tax)}</td>
                <td style={{ fontWeight: 700 }}>{fmtINR(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
