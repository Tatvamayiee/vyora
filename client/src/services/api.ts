const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let token: string | null = localStorage.getItem('vyora_token');
export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('vyora_token', t);
  else localStorage.removeItem('vyora_token');
}
export function getToken() { return token; }

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    setToken(null);
    if (!location.hash.includes('login')) location.hash = '#/login';
    throw new Error('Session expired. Please log in again.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, data?: unknown) => api<T>(p, { method: 'POST', body: JSON.stringify(data || {}) });
export const put = <T = any>(p: string, data?: unknown) => api<T>(p, { method: 'PUT', body: JSON.stringify(data || {}) });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });

export function fmtINR(n: number | string) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
