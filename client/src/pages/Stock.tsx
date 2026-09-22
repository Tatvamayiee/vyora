import React, { useEffect, useState } from 'react';
import { get, post, put, fmtDateTime } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useAuth, useToast } from '../auth';

const NAV_OWNER: NavItem[] = [
  { to: '/owner', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/promotions', label: 'Promotions', icon: 'promotions' },
  { to: '/staff', label: 'Staff & Branches', icon: 'staff' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];
const NAV_WAREHOUSE: NavItem[] = [
  { to: '/warehouse', label: 'Warehouse', icon: 'warehouse' },
  { to: '/stock', label: 'Stock & Issues', icon: 'stock' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
];

export function StockPage({ role }: { role: 'OWNER' | 'MANAGER' | 'WAREHOUSE' }) {
  const { user } = useAuth();
  const { toast, toastNode } = useToast();
  const [movements, setMovements] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [modal, setModal] = useState<null | 'stock' | 'issue'>(null);
  const [stockForm, setStockForm] = useState({ inventoryId: '', type: 'RECEIVE', quantity: '', notes: '' });
  const [issueForm, setIssueForm] = useState({ inventoryId: '', type: 'DAMAGED', quantity: '', reason: '', notes: '' });

  const canStock = role !== 'CASHIER';
  const nav = role === 'WAREHOUSE' ? NAV_WAREHOUSE : NAV_OWNER;

  const load = () => {
    get('/inventory/movements').then(setMovements).catch(() => { });
    get('/inventory/issues').then(setIssues).catch(() => { });
    get('/inventory').then(setInventory).catch(() => { });
  };
  useEffect(load, []);

  async function saveStock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post('/inventory/stock-update', {
        inventoryId: Number(stockForm.inventoryId), type: stockForm.type,
        quantity: Number(stockForm.quantity), notes: stockForm.notes || undefined,
      });
      toast('Stock updated');
      setModal(null); setStockForm({ inventoryId: '', type: 'RECEIVE', quantity: '', notes: '' });
      load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function saveIssue(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post('/inventory/issues', {
        inventoryId: Number(issueForm.inventoryId), type: issueForm.type,
        quantity: Number(issueForm.quantity), reason: issueForm.reason, notes: issueForm.notes || undefined,
      });
      toast('Issue reported');
      setModal(null); setIssueForm({ inventoryId: '', type: 'DAMAGED', quantity: '', reason: '', notes: '' });
      load();
    } catch (err: any) { toast(err.message, true); }
  }

  async function updateIssue(id: number, status: string) {
    try { await put(`/inventory/issues/${id}`, { status }); toast('Issue updated'); load(); }
    catch (err: any) { toast(err.message, true); }
  }

  return (
    <Layout title="Stock Operations & Issues" nav={nav}>
      {canStock && (
        <div className="toolbar">
          <button className="btn primary" onClick={() => setModal('stock')}>Receive / Adjust Stock</button>
          <button className="btn outline" onClick={() => setModal('issue')}>Report Issue</button>
        </div>
      )}
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Inventory Issues</h3>
          <table>
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th><th>Status</th><th>Created</th>{canStock && <th></th>}</tr></thead>
            <tbody>
              {issues.length === 0 && <tr><td colSpan={7} className="empty">No issues reported</td></tr>}
              {issues.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.product.name}</td>
                  <td><span className="badge neutral">{i.type.replace('_', ' ')}</span></td>
                  <td>{i.quantity}</td><td>{i.reason}</td>
                  <td><span className={`badge ${i.status === 'RESOLVED' ? 'green' : i.status === 'IN_PROGRESS' ? 'amber' : 'blue'}`}>{i.status.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 12 }}>{fmtDateTime(i.createdAt)}</td>
                  {canStock && (
                    <td>
                      {i.status === 'OPEN' && <button className="btn sm" onClick={() => updateIssue(i.id, 'IN_PROGRESS')}>Start</button>}
                      {i.status !== 'RESOLVED' && <button className="btn sm primary" onClick={() => updateIssue(i.id, 'RESOLVED')}>Resolve</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Stock Movement History</h3>
          <table>
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Notes</th><th>When</th></tr></thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={5} className="empty">No movements yet</td></tr>}
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.product?.name}</td>
                  <td><span className={`badge ${m.quantity > 0 ? 'green' : 'red'}`}>{m.type}</span></td>
                  <td>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td style={{ fontSize: 12 }}>{m.notes}</td>
                  <td style={{ fontSize: 12 }}>{fmtDateTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'stock' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveStock}>
            <h3>Receive / Adjust Stock</h3>
            <div className="field"><label>Product (branch inventory)</label>
              <select value={stockForm.inventoryId} onChange={(e) => setStockForm({ ...stockForm, inventoryId: e.target.value })} required>
                <option value="">Select product…</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.branch.name} · {i.product.name} (stock {i.quantity})</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field"><label>Type</label>
                <select value={stockForm.type} onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}>
                  <option value="RECEIVE">Receive (+)</option>
                  <option value="ADJUSTMENT">Adjustment (+/-)</option>
                  <option value="ISSUE">Issue (−)</option>
                </select>
              </div>
              <div className="field"><label>Quantity (signed)</label><input type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Notes</label><input value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} placeholder="Invoice no, supplier…" /></div>
            <button className="btn primary" style={{ width: '100%' }}>Apply stock change</button>
          </form>
        </div>
      )}

      {modal === 'issue' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveIssue}>
            <h3>Report Inventory Issue</h3>
            <div className="field"><label>Product (branch inventory)</label>
              <select value={issueForm.inventoryId} onChange={(e) => setIssueForm({ ...issueForm, inventoryId: e.target.value })} required>
                <option value="">Select product…</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.branch.name} · {i.product.name} (stock {i.quantity})</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field"><label>Type</label>
                <select value={issueForm.type} onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })}>
                  <option>LOW_STOCK</option><option>DAMAGED</option><option>EXPIRED</option><option>MISSING</option><option>OTHER</option>
                </select>
              </div>
              <div className="field"><label>Quantity</label><input type="number" min="1" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Reason</label><input value={issueForm.reason} onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })} required /></div>
            <div className="field"><label>Notes</label><input value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} /></div>
            <button className="btn primary" style={{ width: '100%' }}>Report issue</button>
          </form>
        </div>
      )}
      {toastNode}
    </Layout>
  );
}
