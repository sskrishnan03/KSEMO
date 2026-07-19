import { type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, PanelLeftOpen, LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthContext } from './AuthProvider';
import { Spinner } from './ui';
import { cn, initials } from '../lib/utils';
import { listNotifications } from '../lib/data';
import type { Notification } from '../lib/types';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, loading, signOut } = useAuthContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile && !loading) {
      nav('/login', { replace: true, state: { from: loc.pathname } });
    }
  }, [profile, loading, loc.pathname, nav]);

  useEffect(() => {
    listNotifications().then((n: Notification[]) => setUnread(n.filter((x) => !x.read).length)).catch(() => {});
  }, [loc.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [loc.pathname]);

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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 glass border-b border-white/8 flex items-center gap-3 px-4">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-ink-200 hover:bg-white/5">
            <Menu size={18} />
          </button>
          <button onClick={() => setSidebarOpen(true)} className="hidden md:flex h-9 w-9 rounded-lg items-center justify-center text-ink-300 hover:bg-white/5 hover:text-white transition">
            <PanelLeftOpen size={16} />
          </button>

          <button
            onClick={() => nav('/app/search')}
            className="ml-1 flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-xl bg-ink-850 border border-white/8 text-ink-300 hover:border-white/15 hover:text-ink-100 transition text-[13px]"
          >
            <Search size={14} /> Search chats, messages, files…
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => nav('/app/notifications')} className="relative h-9 w-9 rounded-lg flex items-center justify-center text-ink-200 hover:bg-white/5 hover:text-white transition">
              <Bell size={17} />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-white" />}
            </button>
            <button
              onClick={() => { signOut(); nav('/login', { replace: true }); }}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-ink-200 hover:bg-white/5 hover:text-white transition"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
            <button
              onClick={() => nav('/app/settings')}
              className={cn(
                'h-9 pl-1.5 pr-2.5 rounded-lg flex items-center gap-2 hover:bg-white/5 transition',
                loc.pathname.startsWith('/app/settings') && 'bg-white/5',
              )}
            >
              <div className="h-6 w-6 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white">
                {initials(profile.full_name || profile.username)}
              </div>
              <span className="hidden sm:block text-[12px] text-ink-100 max-w-[100px] truncate">{profile.full_name || profile.username}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
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
