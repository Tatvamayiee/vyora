import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { get, setToken, getToken } from './services/api';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: { name: string };
  employee?: { branchId: number; branch: { id: number; name: string } | null } | null;
  customer?: { id: number; fullName: string } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}
const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: () => { }, logout: () => { } });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    get<{ id: number; email: string; fullName: string; role: { name: string }; employee?: any; customer?: any }>('/auth/me')
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token: string, u: AuthUser) => { setToken(token); setUser(u); }, []);
  const logout = useCallback(() => { setToken(null); setUser(null); location.hash = '#/'; }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className={`toast${msg.error ? ' error' : ''}`}>{msg.text}</div> : null;
  return { toast: (text: string, error = false) => setMsg({ text, error }), toastNode: node };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
