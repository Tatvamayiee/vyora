import React, { useEffect, useState } from 'react';
import { get, post, put, fmtINR } from '../services/api';
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

const empty = { name: '', sku: '', barcode: '', categoryId: '', costPrice: '', sellingPrice: '', taxRate: '5', reorderLevel: '10' };

export function InventoryPage({ role }: { role: 'OWNER' | 'MANAGER' | 'WAREHOUSE' }) {
  const { toast, toastNode } = useToast();
  const [inv, setInv] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'inventory' | 'products'>('inventory');
  const [modal, setModal] = useState<null | 'product'>(null);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const canEdit = role === 'OWNER';

  const load = () => {
    get('/inventory').then(setInv).catch(() => { });
    get('/products').then(setProducts).catch(() => { });
    get('/products?meta=categories').then(setCategories).catch(() => { });
  };
  useEffect(load, []);

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    const data = { ...form, categoryId: Number(form.categoryId), costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), taxRate: Number(form.taxRate), reorderLevel: Number(form.reorderLevel) };
    try {
      if (editId) await put(`/products/${editId}`, data);
      else await post('/products', data);
      toast(editId ? 'Product updated' : 'Product created');
      setModal(null); setForm(empty); setEditId(null);
      load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function removeProduct(id: number) {
    if (!confirm('Deactivate this product?')) return;
    try { await put(`/products/${id}`, { isActive: false }); toast('Product deactivated'); load(); }
    catch (err: any) { toast(err.message, true); }
  }

  const invFiltered = inv.filter((i) => !search || i.product.name.toLowerCase().includes(search.toLowerCase()) || i.product.sku.toLowerCase().includes(search.toLowerCase()));
  const invByBranch = invFiltered.reduce<Record<string, any[]>>((acc, i) => {
    (acc[i.branch?.name || 'Other'] ||= []).push(i);
    return acc;
  }, {});

  return (
    <Layout title="Inventory & Products" nav={NAV}
      actions={canEdit && <button className="btn primary sm" onClick={() => { setForm(empty); setEditId(null); setModal('product'); }}>+ Add Product</button>}>
      <div className="toolbar">
        <input placeholder="Search product or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
      </div>
      <div className="tabs">
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Stock by Branch</button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products ({products.length})</button>
      </div>

      {tab === 'inventory' && Object.entries(invByBranch).map(([branch, items]) => (
        <div className="card" key={branch} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15 }}>{branch}</h3>
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.product.name}</td><td>{i.product.sku}</td><td>{i.product.category?.name}</td>
                  <td>{i.quantity}</td><td>{i.reorderLevel}</td>
                  <td><span className={`badge ${i.quantity === 0 ? 'red' : i.quantity <= i.reorderLevel ? 'amber' : 'green'}`}>
                    {i.quantity === 0 ? 'Out of stock' : i.quantity <= i.reorderLevel ? 'Low' : 'In stock'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === 'products' && (
        <div className="card">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Cost</th><th>Selling</th><th>Tax</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.sku}</td><td>{p.category?.name}</td>
                  <td>{fmtINR(p.costPrice)}</td><td>{fmtINR(p.sellingPrice)}</td><td>{p.taxRate}%</td>
                  <td><span className={`badge ${p.isActive ? 'green' : 'neutral'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                  {canEdit && (
                    <td>
                      <button className="btn sm" onClick={() => { setForm({ ...empty, ...p, categoryId: p.categoryId, costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), taxRate: String(p.taxRate), reorderLevel: String(p.reorderLevel) }); setEditId(p.id); setModal('product'); }}>Edit</button>{' '}
                      {p.isActive && <button className="btn sm danger" onClick={() => removeProduct(p.id)}>Disable</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'product' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}>
            <h3>{editId ? 'Edit Product' : 'New Product'}</h3>
            <div className="row">
              <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="field"><label>SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required disabled={!!editId} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Barcode</label><input value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              <div className="field"><label>Category</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field"><label>Cost price (₹)</label><input type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required /></div>
              <div className="field"><label>Selling price (₹)</label><input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required /></div>
            </div>
            <div className="row">
              <div className="field"><label>Tax %</label><input type="number" step="0.01" min="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
              <div className="field"><label>Reorder level</label><input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
            </div>
            <button className="btn primary" style={{ width: '100%' }}>{editId ? 'Save changes' : 'Create product'}</button>
          </form>
        </div>
      )}
      {toastNode}
    </Layout>
  );
}
