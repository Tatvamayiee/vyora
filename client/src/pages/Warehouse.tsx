import React, { useEffect, useState } from 'react';
import { get, post, fmtDateTime } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useAuth, useToast } from '../auth';

const NAV: NavItem[] = [
  { to: '/warehouse', label: 'Workspace', icon: 'warehouse' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
];

export function WarehouseWorkspace() {
  const { user } = useAuth();
  const { toast, toastNode } = useToast();
  const [inv, setInv] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [form, setForm] = useState({ inventoryId: '', quantity: '' });
  const [issueForm, setIssueForm] = useState({ inventoryId: '', type: 'DAMAGED', quantity: '', reason: '' });

  const load = () => {
    get('/inventory').then(setInv).catch(() => { });
    get('/inventory/issues').then(setIssues).catch(() => { });
    get('/inventory/movements').then(setMovements).catch(() => { });
  };
  useEffect(load, []);

  const low = inv.filter((i) => i.quantity <= i.reorderLevel);

  async function receive(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post('/inventory/stock-update', { inventoryId: Number(form.inventoryId), type: 'RECEIVE', quantity: Number(form.quantity) });
      toast('Stock received'); setForm({ inventoryId: '', quantity: '' }); load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function reportIssue(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post('/inventory/issues', {
        inventoryId: Number(issueForm.inventoryId), type: issueForm.type,
        quantity: Number(issueForm.quantity), reason: issueForm.reason,
      });
      toast('Issue reported'); setIssueForm({ inventoryId: '', type: 'DAMAGED', quantity: '', reason: '' }); load();
    } catch (err: any) { toast(err.message, true); }
  }

  return (
    <Layout title="Warehouse Workspace" nav={NAV} actions={<span className="badge blue">{user?.employee?.branch?.name}</span>}>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">SKUs tracked</div><div className="value">{inv.length}</div></div>
        <div className="kpi"><div className="label">Low / out of stock</div><div className="value" style={{ color: low.length ? 'var(--warn)' : 'var(--success)' }}>{low.length}</div></div>
        <div className="kpi"><div className="label">Open issues</div><div className="value">{issues.filter((i) => i.status !== 'RESOLVED').length}</div></div>
        <div className="kpi"><div className="label">Movements logged</div><div className="value">{movements.length}</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Receive Stock</h3>
          <form onSubmit={receive}>
            <div className="field"><label>Product</label>
              <select value={form.inventoryId} onChange={(e) => setForm({ ...form, inventoryId: e.target.value })} required>
                <option value="">Select product…</option>
                {inv.map((i) => <option key={i.id} value={i.id}>{i.product.name} (current {i.quantity})</option>)}
              </select>
            </div>
            <div className="field"><label>Quantity received</label><input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></div>
            <button className="btn primary" style={{ width: '100%' }}>Receive stock</button>
          </form>
          <hr style={{ border: 'none', borderTop: '1px solid var(--surface-container)', margin: '18px 0' }} />
          <h3 style={{ fontSize: 15 }}>Report Damaged / Expired</h3>
          <form onSubmit={reportIssue}>
            <div className="field"><label>Product</label>
              <select value={issueForm.inventoryId} onChange={(e) => setIssueForm({ ...issueForm, inventoryId: e.target.value })} required>
                <option value="">Select product…</option>
                {inv.map((i) => <option key={i.id} value={i.id}>{i.product.name}</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field"><label>Type</label>
                <select value={issueForm.type} onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}>
                  <option>DAMAGED</option><option>EXPIRED</option><option>MISSING</option><option>LOW_STOCK</option><option>OTHER</option>
                </select>
              </div>
              <div className="field"><label>Quantity</label><input type="number" min="1" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Reason</label><input value={issueForm.reason} onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })} required /></div>
            <button className="btn outline" style={{ width: '100%' }}>Report issue</button>
          </form>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Recent Movements</h3>
          <table>
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>When</th></tr></thead>
            <tbody>
              {movements.slice(0, 12).map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.product?.name}</td>
                  <td><span className={`badge ${m.quantity > 0 ? 'green' : 'red'}`}>{m.type}</span></td>
                  <td>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td style={{ fontSize: 12 }}>{fmtDateTime(m.createdAt)}</td>
                </tr>
              ))}
              {!movements.length && <tr><td colSpan={4} className="empty">No movements yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15 }}>Stock Status</h3>
        <table>
          <thead><tr><th>Product</th><th>Stock</th><th>Reorder level</th><th>Status</th></tr></thead>
          <tbody>
            {inv.map((i) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.product.name}</td><td>{i.quantity}</td><td>{i.reorderLevel}</td>
                <td><span className={`badge ${i.quantity === 0 ? 'red' : i.quantity <= i.reorderLevel ? 'amber' : 'green'}`}>
                  {i.quantity === 0 ? 'Out' : i.quantity <= i.reorderLevel ? 'Reorder' : 'OK'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toastNode}
    </Layout>
  );
}
