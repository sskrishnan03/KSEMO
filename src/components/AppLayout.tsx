import { type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthContext } from './AuthProvider';
import { Spinner } from './ui';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuthContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    if (!profile && !loading) {
      nav('/login', { replace: true, state: { from: loc.pathname } });
    }
  }, [profile, loading, loc.pathname, nav]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setSidebarCollapsed(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-900">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-ink-900 text-white">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthContext();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!loading && !session) nav('/login', { replace: true, state: { from: loc.pathname } });
  }, [session, loading, nav, loc.pathname]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ink-900"><Spinner className="h-6 w-6" /></div>;
  if (!session) return null;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuthContext();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin') nav('/app', { replace: true });
  }, [profile, loading, nav]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-ink-900"><Spinner className="h-6 w-6" /></div>;
  if (profile?.role !== 'admin') return null;
  return <AppLayout>{children}</AppLayout>;
}
