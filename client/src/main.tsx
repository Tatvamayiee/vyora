import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { AuthProvider } from './auth';
import { RoleEntry, Login } from './pages/Auth';
import { OwnerDashboard, ManagerDashboard } from './pages/Dashboards';
import { CashierPOS, RecentBills, BillModal } from './pages/POS';
import { InventoryPage, StockPage, WarehousePage } from './pages/Operations';
import { PromotionsPage, StaffPage, ReportsPage } from './pages/Admin';
import { CustomerHome, CustomerPurchases, CustomerProfile } from './pages/Customer';
import { useEffect, useState } from 'react';
import { get, getToken } from './services/api';

// Unauthenticated users never render protected pages (back-button / refresh safe).
function AuthGate(_: { children?: React.ReactNode }) {
  useEffect(() => {
    if (!location.hash.startsWith('#/') || location.hash.length > 2) location.replace('#/');
  }, []);
  return <RoleEntry />;
}

function BillPage() {
  const id = location.hash.split('/')[2];
  const [sale, setSale] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { get(`/sales/${id}`).then(setSale).catch((e) => setError(e.message)); }, [id]);
  if (error) return <div className="error-banner">{error}</div>;
  if (!sale) return <div className="empty">Loading…</div>;
  return <BillModal sale={sale} onClose={() => (location.hash = '#/')} />;
}

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const path = hash.replace(/^#/, '') || '/';

  if (path === '/' || path === '') return <RoleEntry />;
  if (path.startsWith('/login/')) {
    const portal = path.split('/')[2].toUpperCase();
    if (portal === 'OWNER') return <Login portal="OWNER" />;
    if (portal === 'MANAGER') return <Login portal="MANAGER" />;
    if (portal === 'EMPLOYEE') return <Login portal="EMPLOYEE" />;
    return <Login portal="CUSTOMER" />;
  }
  // every route below requires a session
  if (!getToken()) return <AuthGate />;
  if (path.startsWith('/owner')) return <OwnerDashboard />;
  if (path.startsWith('/manager')) return <ManagerDashboard />;
  if (path.startsWith('/pos')) return <CashierPOS />;
  if (path.startsWith('/bills')) return <RecentBills />;
  if (path.startsWith('/bill/')) return <BillPage />;
  if (path.startsWith('/inventory')) return <InventoryPage />;
  if (path.startsWith('/stock')) return <StockPage />;
  if (path.startsWith('/warehouse')) return <WarehousePage />;
  if (path.startsWith('/promotions')) return <PromotionsPage />;
  if (path.startsWith('/staff')) return <StaffPage />;
  if (path.startsWith('/reports')) return <ReportsPage />;
  if (path.startsWith('/purchases')) return <CustomerPurchases />;
  if (path.startsWith('/profile')) return <CustomerProfile />;
  if (path.startsWith('/customer')) return <CustomerHome />;
  return <RoleEntry />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
