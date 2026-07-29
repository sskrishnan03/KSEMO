import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthContext } from './AuthProvider';
import { Spinner, Modal, Button } from './ui';
import { getSettings } from '../lib/data';
import type { AppPreferences } from '../lib/types';
import { useTheme } from './ThemeProvider';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuthContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [activeEmail, setActiveEmail] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { setTheme: setAppTheme, setFontSize: setAppFontSize } = useTheme();
  const [prefs, setPrefs] = useState<AppPreferences>({});

  useEffect(() => {
    if (profile?.id) getSettings(profile.id).then((s) => {
      const p = s?.preferences ?? {};
      setPrefs(p);
      if (p.theme) { setAppTheme(p.theme); localStorage.setItem('ksemo_theme_mode', JSON.stringify(p.theme)); }
      if (p.font_size) { setAppFontSize(p.font_size); localStorage.setItem('ksemo_font_size', JSON.stringify(p.font_size)); }
    }).catch(() => {});
  }, [profile?.id]);

  const handleKeyboard = useCallback((e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    const isInInput = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT';

    if (isMeta && e.key === 'n' && (prefs.shortcut_new_chat ?? true) && !isInInput) {
      e.preventDefault();
      nav('/app');
    }
    if (isMeta && e.key === 'k' && (prefs.shortcut_search ?? true) && !isInInput) {
      e.preventDefault();
      nav('/app/search');
    }
    if (isMeta && e.key === ',' && (prefs.shortcut_settings ?? true) && !isInInput) {
      e.preventDefault();
      nav('/app/settings');
    }
    if (isMeta && e.key === 'b' && (prefs.shortcut_toggle_sidebar ?? true) && !isInInput) {
      e.preventDefault();
      setSidebarCollapsed((c) => !c);
    }
    if (isMeta && e.shiftKey && e.key === 'V' && (prefs.shortcut_voice_chat ?? true) && !isInInput) {
      e.preventDefault();
      nav('/app/voice-chat');
    }

    if (isMeta && e.shiftKey && e.key === 'H' && (prefs.shortcut_history ?? true) && !isInInput) {
      e.preventDefault();
      nav('/app/history');
    }
    if (e.key === 'Escape' && (prefs.shortcut_stop_generation ?? true)) {
      window.dispatchEvent(new CustomEvent('ksemo-stop-generation'));
    }
  }, [prefs, nav]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  useEffect(() => {
    const onEmailSent = (e: Event) => {
      const emailData = (e as CustomEvent).detail;
      setActiveEmail(emailData);
    };
    window.addEventListener('ksemo-email-sent', onEmailSent);
    return () => window.removeEventListener('ksemo-email-sent', onEmailSent);
  }, []);

  useEffect(() => {
    if (!activeEmail || modalOpen) return;
    const timer = setTimeout(() => {
      setActiveEmail(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeEmail, modalOpen]);

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
    <div className="flex h-screen bg-ink-900 text-white">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      {/* Floating System Email Dispatch Toast */}
      {activeEmail && (
        <div 
          onClick={() => setModalOpen(true)}
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-ink-950/95 border border-white/10 rounded-2xl p-4 shadow-lift animate-slide-up flex gap-3 items-start cursor-pointer hover:border-white/20 transition-all duration-300"
        >
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center shrink-0">
            <Mail size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-ink-300">System Dispatch</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveEmail(null); }}
                className="text-ink-300 hover:text-white transition"
              >
                <X size={14} />
              </button>
            </div>
            <h4 className="text-[13px] font-semibold text-white mt-1 truncate">
              {activeEmail.subject}
            </h4>
            <p className="text-[11px] text-ink-200 mt-0.5 leading-relaxed">
              Transactional email successfully dispatched to <span className="text-white font-medium">{activeEmail.email}</span>. Click to inspect message.
            </p>
          </div>
        </div>
      )}

      {/* Email Inspector Modal */}
      {activeEmail && (
        <Modal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setActiveEmail(null); }}
          title={activeEmail.subject}
          size="md"
          footer={
            <Button size="sm" onClick={() => { setModalOpen(false); setActiveEmail(null); }}>
              Acknowledge
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-1 text-[11px] pb-3 border-b border-white/8 text-ink-300">
              <div><span className="font-medium text-ink-400">From:</span> <span className="text-white">Ksemo Security & Onboarding &lt;no-reply@ksemo.com&gt;</span></div>
              <div><span className="font-medium text-ink-400">To:</span> <span className="text-white">{activeEmail.fullName} &lt;{activeEmail.email}&gt;</span></div>
              <div><span className="font-medium text-ink-400">Date:</span> <span className="text-white">{new Date(activeEmail.timestamp).toLocaleString()}</span></div>
            </div>
            <div className="p-4 rounded-xl bg-ink-950 border border-white/5 text-[12px] text-ink-100 leading-relaxed whitespace-pre-line font-mono">
              {activeEmail.body}
            </div>
            <div className="text-[10px] text-ink-400 italic">
              * Note: In production, this transactional email is automatically dispatched directly to the user's personal inbox.
            </div>
          </div>
        </Modal>
      )}
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
