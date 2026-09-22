import React, { useState } from 'react';
import { post } from '../services/api';
import { useAuth, AuthUser } from '../auth';

export function RoleEntry() {
  const roles = [
    { key: 'OWNER', icon: '👑', name: 'Owner', desc: 'Full business control', to: '#/login/owner' },
    { key: 'MANAGER', icon: '📋', name: 'Manager', desc: 'Branch management', to: '#/login/manager' },
    { key: 'EMPLOYEE', icon: '🧑‍💼', name: 'Employee', desc: 'Cashier & warehouse', to: '#/login/employee' },
    { key: 'CUSTOMER', icon: '🛒', name: 'Customer', desc: 'Shopping & loyalty', to: '#/login/customer' },
  ];
  return (
    <div className="role-entry">
      <img src="/logo.jpg" alt="Vyora Retail" style={{ width: 130, borderRadius: 14, boxShadow: '0 8px 24px rgba(163,57,0,.18)' }} />
      <div style={{ color: 'var(--on-surface-variant)' }}>Smart Retail POS &amp; Store Management</div>
      <div className="role-cards">
        {roles.map((r) => (
          <a key={r.key} href={r.to} className="role-card">
            <div className="icon">{r.icon}</div>
            <div className="name">{r.name}</div>
            <div className="desc">{r.desc}</div>
          </a>
        ))}
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: 'var(--outline)' }}>Localhost demo · v1.0</div>
    </div>
  );
}

export function Login({ portal }: { portal: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CUSTOMER' }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'signup'>('login');
  const [subwork, setSubwork] = useState<'CASHIER' | 'WAREHOUSE'>('CASHIER');
  const [signup, setSignup] = useState({ fullName: '', email: '', phone: '', password: '' });

  const titles: Record<string, string> = {
    OWNER: 'Owner Login', MANAGER: 'Manager Login',
    EMPLOYEE: 'Employee Login', CUSTOMER: 'Customer Login',
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'signup') {
        const res = await post<{ token: string; user: AuthUser }>('/auth/signup', {
          ...signup, portal, subwork: portal === 'EMPLOYEE' ? subwork : undefined,
        });
        login(res.token, res.user);
        const r = res.user.role.name;
        location.hash =
          r === 'OWNER' ? '#/owner' : r === 'MANAGER' ? '#/manager' :
          r === 'CASHIER' ? '#/pos' : r === 'WAREHOUSE' ? '#/warehouse' : '#/customer';
        return;
      }
      if (mode === 'forgot') {
        await post('/auth/forgot-password', { email });
        setError('');
        alert('If this email is registered, a reset link has been sent.');
        setMode('login');
        return;
      }
      const res = await post<{ token: string; user: AuthUser }>('/auth/login', { email, password, role: portal });
      if (portal === 'EMPLOYEE' && res.user.role.name !== subwork) {
        setError(`This account is a ${res.user.role.name}. Select the matching workspace.`);
        return;
      }
      login(res.token, res.user);
      const r = res.user.role.name;
      location.hash =
        r === 'OWNER' ? '#/owner' : r === 'MANAGER' ? '#/manager' :
        r === 'CASHIER' ? '#/pos' : r === 'WAREHOUSE' ? '#/warehouse' : '#/customer';
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  const demo: Record<string, string> = {
    OWNER: 'owner@vyora.local · Owner@123',
    MANAGER: 'manager@vyora.local · Manager@123',
    EMPLOYEE: `cashier@vyora.local · Cashier@123\nwarehouse@vyora.local · Warehouse@123`,
    CUSTOMER: 'customer@vyora.local · Customer@123',
  };

  return (
    <div className="auth-card">
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--primary)', marginBottom: 4 }}>Vyora Retail</div>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>{titles[portal]}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@vyora.local" required />
          </div>
          {mode === 'login' && (
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          )}
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Full name</label>
                <input value={signup.fullName} onChange={(e) => setSignup({ ...signup, fullName: e.target.value })} placeholder="Your name" required />
              </div>
              <div className="field">
                <label>Set password (min 8 chars)</label>
                <input type="password" value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} placeholder="••••••••" required minLength={8} />
              </div>
              {portal === 'CUSTOMER' && (
                <div className="field">
                  <label>Mobile number (optional)</label>
                  <input value={signup.phone} onChange={(e) => setSignup({ ...signup, phone: e.target.value })} placeholder="10-digit mobile" />
                </div>
              )}
            </>
          )}
          {portal === 'EMPLOYEE' && mode === 'login' && (
            <div className="field">
              <label>Workspace</label>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button type="button" className={subwork === 'CASHIER' ? 'active' : ''} onClick={() => setSubwork('CASHIER')}>🧾 Cashier</button>
                <button type="button" className={subwork === 'WAREHOUSE' ? 'active' : ''} onClick={() => setSubwork('WAREHOUSE')}>🚚 Warehouse</button>
              </div>
            </div>
          )}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Login' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', gap: 16, justifyContent: 'center' }}>
          {mode === 'signup' ? (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }} style={{ fontSize: 13 }}>← Back to login</a>
          ) : (
            <>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); }} style={{ fontSize: 13 }}>Create new account</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); }} style={{ fontSize: 13 }}>Forgot password?</a>
            </>
          )}
        </div>
        <a href="#/" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13 }}>← All portals</a>
        <div className="demo-note"><strong>Development demo credentials</strong><br />{demo[portal]}</div>
      </div>
    </div>
  );
}
