import React, { useEffect, useState } from 'react';
import { get, fmtINR, fmtDateTime } from '../services/api';
import { Layout, NavItem } from '../components/Layout';
import { useAuth } from '../auth';

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

function Spark({ data }: { data: { day: string; total: number }[] }) {
  if (!data.length) return <div className="empty">No sales in this period</div>;
  const max = Math.max(...data.map((d) => d.total)) || 1;
  const w = 100, h = 40;
  const pts = data.map((d, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (d.total / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="rgba(163,57,0,.08)" stroke="none" />
    </svg>
  );
}

const ranges = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' }, { key: 'custom', label: 'Custom' },
];

export function OwnerDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('today');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [branchId, setBranchId] = useState('all');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const load = () => {
    let q = `?range=${range}&branchId=${branchId}`;
    if (range === 'custom' && custom.from && custom.to) q += `&from=${custom.from}&to=${custom.to}`;
    get(`/dashboard/owner${q}`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [range, branchId, custom]);

  if (error) return <Layout title="Owner Dashboard" nav={OWNER_NAV}><div className="error-banner">{error}</div></Layout>;
  if (!data) return <Layout title="Owner Dashboard" nav={OWNER_NAV}><div className="empty">Loading…</div></Layout>;

  const k = data.kpis;
  return (
    <Layout title="Owner Dashboard" nav={OWNER_NAV}
      actions={<div className="toolbar" style={{ margin: 0 }}>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Branches</option>
          {data.branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="tabs" style={{ margin: 0, borderBottom: 'none' }}>
          {ranges.map((r) => (
            <button key={r.key} className={range === r.key ? 'active' : ''}
              onClick={() => { if (r.key === 'custom') { setShowCustom(true); } else { setShowCustom(false); setRange(r.key); } }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>}>
      {showCustom && (
        <div className="toolbar card" style={{ padding: 12 }}>
          <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} style={{ width: 150 }} />
          <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} style={{ width: 150 }} />
          <button className="btn primary sm" onClick={() => { setRange('custom'); }}>Apply</button>
        </div>
      )}
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Revenue</div><div className="value">{fmtINR(k.revenue)}</div><div className="sub">incl. tax</div></div>
        <div className="kpi"><div className="label">Bills</div><div className="value">{k.bills}</div><div className="sub">transactions</div></div>
        <div className="kpi"><div className="label">Customers</div><div className="value">{k.customers}</div><div className="sub">registered</div></div>
        <div className="kpi"><div className="label">Avg. Bill</div><div className="value">{fmtINR(k.avgBill)}</div><div className="sub">per transaction</div></div>
        <div className="kpi"><div className="label">Discounts given</div><div className="value">{fmtINR(k.discount)}</div><div className="sub">incl. promotions</div></div>
      </div>
      <div className="grid-3">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Sales Trend</h3>
          <Spark data={data.trend} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Branch Performance</h3>
          <table>
            <thead><tr><th>Branch</th><th>Revenue</th><th>Bills</th></tr></thead>
            <tbody>
              {data.branchPerf.map((b: any) => (
                <tr key={b.id}><td>{b.name}</td><td>{fmtINR(b.revenue)}</td><td>{b.bills}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Top Products</h3>
          <table>
            <thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead>
            <tbody>
              {data.topProducts.length === 0 && <tr><td colSpan={3} className="empty">No sales yet</td></tr>}
              {data.topProducts.map((p: any) => (
                <tr key={p.id}><td>{p.name}</td><td>{p.qty}</td><td>{fmtINR(p.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Low Stock Alerts</h3>
          <table>
            <thead><tr><th>Product</th><th>Branch</th><th>Stock</th></tr></thead>
            <tbody>
              {data.lowStock.length === 0 && <tr><td colSpan={3} className="empty">All good ✓</td></tr>}
              {data.lowStock.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.product.name}</td><td>{i.branch.name}</td>
                  <td><span className={`badge ${i.quantity === 0 ? 'red' : 'amber'}`}>{i.quantity} / {i.reorderLevel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15 }}>Recent Transactions</h3>
        <table>
          <thead><tr><th>Bill</th><th>Branch</th><th>Customer</th><th>Time</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {data.recentSales.map((s: any) => (
              <tr key={s.id}>
                <td><a href={`#/bill/${s.id}`}>{s.billNumber}</a></td><td>{s.branch.name}</td>
                <td>{s.customer?.fullName || 'Walk-in'}</td><td>{fmtDateTime(s.createdAt)}</td>
                <td>{fmtINR(s.total)}</td><td>{s.payments?.[0]?.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export function ManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { get('/dashboard/manager').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <Layout title="Manager Dashboard" nav={MANAGER_NAV}><div className="error-banner">{error}</div></Layout>;
  if (!data) return <Layout title="Manager Dashboard" nav={MANAGER_NAV}><div className="empty">Loading…</div></Layout>;

  const k = data.kpis;
  return (
    <Layout title="Manager Dashboard" nav={MANAGER_NAV}
      actions={<span className="badge blue">{user?.employee?.branch?.name || 'Branch'}</span>}>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Today's Sales</div><div className="value">{fmtINR(k.revenue)}</div></div>
        <div className="kpi"><div className="label">Bills Today</div><div className="value">{k.bills}</div></div>
        <div className="kpi"><div className="label">Customers</div><div className="value">{k.customers}</div><div className="sub">registered</div></div>
        <div className="kpi"><div className="label">Low-stock items</div><div className="value" style={{ color: k.lowStockCount ? 'var(--warn)' : 'var(--success)' }}>{k.lowStockCount}</div></div>
      </div>
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Total SKUs</div><div className="value">{data.inventoryStatus.totalSkus}</div></div>
        <div className="kpi"><div className="label">In Stock</div><div className="value" style={{ color: 'var(--success)' }}>{data.inventoryStatus.inStock}</div></div>
        <div className="kpi"><div className="label">Low</div><div className="value" style={{ color: 'var(--warn)' }}>{data.inventoryStatus.low}</div></div>
        <div className="kpi"><div className="label">Out of Stock</div><div className="value" style={{ color: 'var(--error)' }}>{data.inventoryStatus.outOfStock}</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Recent Transactions</h3>
          <table>
            <thead><tr><th>Bill</th><th>Customer</th><th>Time</th><th>Amount</th></tr></thead>
            <tbody>
              {data.recentSales.length === 0 && <tr><td colSpan={4} className="empty">No sales today yet</td></tr>}
              {data.recentSales.map((s: any) => (
                <tr key={s.id}><td><a href={`#/bill/${s.id}`}>{s.billNumber}</a></td><td>{s.customer?.fullName || 'Walk-in'}</td><td>{fmtDateTime(s.createdAt)}</td><td>{fmtINR(s.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }}>Low Stock</h3>
          <table>
            <thead><tr><th>Product</th><th>Stock</th><th>Reorder</th></tr></thead>
            <tbody>
              {data.lowStock.length === 0 && <tr><td colSpan={3} className="empty">All good ✓</td></tr>}
              {data.lowStock.slice(0, 6).map((i: any) => (
                <tr key={i.id}><td>{i.product.name}</td><td><span className="badge amber">{i.quantity}</span></td><td>{i.reorderLevel}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data.openIssues.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15 }}>Open Inventory Issues</h3>
          <table>
            <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Status</th></tr></thead>
            <tbody>
              {data.openIssues.map((i: any) => (
                <tr key={i.id}><td>{i.product.name}</td><td><span className="badge neutral">{i.type.replace('_', ' ')}</span></td><td>{i.quantity}</td><td><span className="badge blue">{i.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
