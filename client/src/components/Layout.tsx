import React from 'react';
import { useAuth, useOnline } from '../auth';

const ICONS: Record<string, string> = {
  dashboard: '📊', pos: '🧾', inventory: '📦', stock: '📥', promotions: '🏷️',
  staff: '👥', branches: '🏢', reports: '📈', warehouse: '🚚', billing: '💰',
};

export interface NavItem { to: string; label: string; icon: string; }

export function Layout({ title, nav, children, actions }: {
  title: string; nav: NavItem[]; children: React.ReactNode; actions?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const online = useOnline();
  const current = location.hash.slice(1) || '/';
  const initials = (user?.fullName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="app-shell">
      <aside className="sidenav">
        <div className="brand">Vyora Retail<small>{user?.employee?.branch?.name || 'Smart Retail POS'}</small></div>
        {nav.map((n) => (
          <a key={n.to} href={`#${n.to}`} className={current === n.to || (n.to !== '/' && current.startsWith(n.to)) ? 'active' : ''}>
            <span>{ICONS[n.icon] || '•'}</span>{n.label}
          </a>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <a href="#/profile" style={{ alignItems: 'center' }}>
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{initials}</span>
            <span>{user?.fullName}<br /><small style={{ fontSize: 10, color: 'var(--outline)' }}>{user?.role.name}</small></span>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}><span>🚪</span>Logout</a>
        </div>
      </aside>
      <main className="main">
        {!online && <div className="offline-pill">⚠ Offline — bills will sync when reconnected</div>}
        <div className="topbar">
          <h1>{title}</h1>
          <div className="user">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}
