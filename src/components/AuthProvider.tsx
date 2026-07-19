import { createContext, useContext, type ReactNode } from 'react';
import { useAuth, type AuthState } from '../lib/useAuth';

const AuthContext = createContext<AuthState & { signOut: () => Promise<void>; refresh: () => Promise<void> } | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
