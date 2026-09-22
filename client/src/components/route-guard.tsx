// route-guard.tsx
import { useAuth } from './auth-provider';
import type { User } from '../types';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
  allowedRoles?: string[];
}

export function RouteGuard({ children, requiredRole, allowedRoles }: RouteGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    window.location.href = '/screen_01_authentication_entry/code.html';
    return null;
  }

  if (requiredRole && user.role.name !== requiredRole) {
    window.location.href = '/screen_01_authentication_entry/code.html';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role.name)) {
    window.location.href = '/screen_01_authentication_entry/code.html';
    return null;
  }

  return <>{children}</>;
}
