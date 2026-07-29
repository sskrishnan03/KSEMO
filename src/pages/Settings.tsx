import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Sliders, Database, Trash2, Check, AlertCircle,
  Download, LogOut, Bell, Sparkles, Palette, KeyRound,
  MonitorSmartphone, Mic, MessageSquare, Search, Info, RefreshCw,
  Keyboard, Shield, HelpCircle,
  Mail, Send, CheckCircle,
} from 'lucide-react';
import { Button, Input, Textarea, Modal, Badge } from '../components/ui';
import { useAuthContext } from '../components/AuthProvider';
import { useTheme } from '../components/ThemeProvider';
import {
  updateProfile, getSettings, upsertSettings, submitFeedback,
  deleteAllChats, clearRecentSearches,
} from '../lib/data';
import { downloadFile, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { AppPreferences } from '../lib/types';

type Tab = 'account' | 'security' | 'preferences' | 'notifications' | 'appearance' | 'keyboard' | 'data' | 'feedback' | 'help';

const THEME_OPTIONS = [
  { value: 'dark' as const, label: 'Dark', desc: 'Default dark theme' },
  { value: 'light' as const, label: 'Light', desc: 'Light background' },
  { value: 'system' as const, label: 'System', desc: 'Follow OS setting' },
];



const SHORTCUTS: { key: string; label: string; desc: string; prefKey: keyof AppPreferences }[] = [
  { key: 'Ctrl/Cmd + N', label: 'New chat', desc: 'Start a new conversation', prefKey: 'shortcut_new_chat' },
  { key: 'Ctrl/Cmd + K', label: 'Search', desc: 'Open global search', prefKey: 'shortcut_search' },
  { key: 'Ctrl/Cmd + ,', label: 'Settings', desc: 'Open settings page', prefKey: 'shortcut_settings' },
  { key: 'Ctrl/Cmd + B', label: 'Toggle sidebar', desc: 'Collapse or expand the sidebar', prefKey: 'shortcut_toggle_sidebar' },
  { key: 'Esc', label: 'Stop generation', desc: 'Stop the AI from generating', prefKey: 'shortcut_stop_generation' },
  { key: 'Ctrl/Cmd + Shift + V', label: 'Voice chat', desc: 'Open voice conversation mode', prefKey: 'shortcut_voice_chat' },

  { key: 'Ctrl/Cmd + Shift + F', label: 'Files', desc: 'Open the file manager', prefKey: 'shortcut_files' },
  { key: 'Ctrl/Cmd + Shift + H', label: 'History', desc: 'Open chat history', prefKey: 'shortcut_history' },
];

export default function Settings() {
  const { profile, user, signOut, refresh } = useAuthContext();
  const { setTheme: setAppTheme, setFontSize: setAppFontSize } = useTheme();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'account';
  const [tab, setTab] = useState<Tab>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync tab when URL search params change (e.g. sidebar "Help & Support" link)
  useEffect(() => {
    const urlTab = (searchParams.get('tab') as Tab) || 'account';
    if (urlTab !== tab) setTab(urlTab);
  }, [searchParams]);

  // Profile
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Preferences
  const [prefs, setPrefs] = useState<AppPreferences>({});
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  // Modals
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [error, setError] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [clearSearchOpen, setClearSearchOpen] = useState(false);

  // Feedback
  const [feedbackCat, setFeedbackCat] = useState('general');
  const [feedbackSubj, setFeedbackSubj] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Password reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // Help & Support chat
  const [helpMessages, setHelpMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: "Hi! I'm the Ksemo assistant. Ask me anything about how to use the workspace — features, shortcuts, settings, or anything else." },
  ]);
  const [helpInput, setHelpInput] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const helpEndRef = useRef<HTMLDivElement>(null);

  // Scroll to top of content panel when tab changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setUsername(profile.username);
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) getSettings(user.id).then((s) => {
      const p = s?.preferences ?? {};
      setPrefs(p);
      if (p.theme) { setAppTheme(p.theme); localStorage.setItem('ksemo_theme_mode', JSON.stringify(p.theme)); }
      if (p.font_size) { setAppFontSize(p.font_size); localStorage.setItem('ksemo_font_size', JSON.stringify(p.font_size)); }
    }).catch(() => {});
  }, [user]);

  const updatePref = useCallback(<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    await updateProfile(user.id, { full_name: fullName, username, bio });
    setSavingProfile(false);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2000);
    refresh();
  };

  const savePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    await upsertSettings(user.id, prefs);
    // Sync theme/font to localStorage for ThemeProvider
    if (prefs.theme) localStorage.setItem('ksemo_theme_mode', JSON.stringify(prefs.theme));
    if (prefs.font_size) localStorage.setItem('ksemo_font_size', JSON.stringify(prefs.font_size));
    setSavingPrefs(false);
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  };

  const exportData = async () => {
    if (!user) return;
    const [chats, msgs, favs, uploads] = await Promise.all([
      supabase.from('chats').select('*').eq('user_id', user.id),
      supabase.from('messages').select('*').eq('user_id', user.id),
      supabase.from('favorites').select('*').eq('user_id', user.id),
      supabase.from('uploads').select('*').eq('user_id', user.id),
    ]);
    const data = {
      profile,
      chats: chats.data,
      messages: msgs.data,
      favorites: favs.data,
      uploads: uploads.data,
      settings: prefs,
      exportedAt: new Date().toISOString(),
    };
    downloadFile(`ksemo-export-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setError('');
    await signOut();
    nav('/', { replace: true });
  };

  const deleteAllChatsHandler = async () => {
    if (deleteAllConfirm !== 'DELETE ALL CHATS') return;
    setDeletingAll(true);
    try {
      await deleteAllChats();
      setDeleteAllOpen(false);
      setDeleteAllConfirm('');
      nav('/app', { replace: true });
    } catch (e) {
      console.error('Failed to delete all chats:', e);
    } finally {
      setDeletingAll(false);
    }
  };

  const clearSearchHandler = () => {
    clearRecentSearches();
    setClearSearchOpen(false);
  };

  const sendFeedback = async () => {
    if (!feedbackSubj.trim() || !feedbackBody.trim()) return;
    await submitFeedback(feedbackCat, feedbackSubj, feedbackBody);
    setFeedbackSubj(''); setFeedbackBody('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 2500);
  };

  const requestPasswordReset = async () => {
    if (!user?.email) return;
    setResetSending(true);
    setResetError('');
    try {
      const res = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error || 'Something went wrong.'); setResetSending(false); return; }
      setResetSent(true);
    } catch {
      setResetError('Could not reach the server.');
    }
    setResetSending(false);
  };

  const HELP_KB: { q: RegExp; a: string }[] = [
    { q: /how.*send|enter.*send|shift.*enter/i, a: "Press **Enter** to send a message. Press **Shift+Enter** for a new line. You can toggle this in **Settings > Preferences > Send on Enter**." },
    { q: /keyboard|shortcut|hotkey/i, a: "Ksemo has global shortcuts: **Ctrl/Cmd+N** (new chat), **Ctrl/Cmd+K** (search), **Ctrl/Cmd+B** (toggle sidebar), **Ctrl/Cmd+,** (settings), **Esc** (stop generation). Manage them in **Settings > Keyboard**." },
    { q: /voice|speech|mic/i, a: "Voice chat lets you talk to the AI hands-free. Open it from the sidebar menu or press **Ctrl/Cmd+Shift+V**. Enable/disable the mic button in **Settings > Preferences > Voice input**." },
    { q: /file|upload|attach|pdf|csv/i, a: "You can attach files (PDF, CSV, images, text) to messages using the paperclip icon in the chat input. Toggle this in **Settings > Preferences > File attachments**." },

    { q: /search|find/i, a: "Global search is available via **Ctrl/Cmd+K**. It searches across chats, messages, files, and favorites." },
    { q: /favorite|bookmark/i, a: "Click the star icon on any assistant message to save it to your favorites. View favorites from the sidebar favorites tab." },
    { q: /delete.*chat|remove.*chat|clear.*chat/i, a: "Click the trash icon next to a chat in the sidebar to delete it. To delete ALL chats at once, go to **Settings > Data Control > Delete all chats**." },
    { q: /export|download.*data/i, a: "Go to **Settings > Data Control > Export data** to download all your chats, messages, favorites, and settings as a JSON file." },
    { q: /model|gpt|claude|ai.*engine/i, a: "Ksemo uses OpenRouter to access multiple AI models. The default model is **ksemo-pro** (GPT-4o-mini). Some features use the local fallback when no API key is set." },
    { q: /dark.*mode|theme|light|appearance/i, a: "Go to **Settings > Appearance** to switch between dark, light, or system theme." },
    { q: /compact|spacing|layout/i, a: "Compact mode and sidebar options are available in **Settings > Preferences**." },
    { q: /stream|token.*count|read.*aloud/i, a: "In **Settings > Preferences**, you can toggle streaming responses, token count display, and read-aloud for assistant messages." },
    { q: /notification|alert|email/i, a: "Manage email and in-app notifications in **Settings > Notifications**. You can control security alerts, product news, and notification sounds." },
    { q: /language|lang|spanish|french/i, a: "Change the interface language in **Settings > Preferences > Language**. Supported languages include English, Spanish, French, German, Japanese, Chinese, and more." },
    { q: /password|reset|change.*pass/i, a: "Go to **Settings > Security** to request a password reset via email." },
    { q: /sign.*out|logout|log.*out/i, a: "Click the profile icon in the sidebar, then **Sign out**. Or go to **Settings > Security > Sign out**." },
    { q: /bug|report|issue|error/i, a: "Found a bug? Email us directly at **support@ksemo.com** with details about the issue. Include what happened, what you expected, and steps to reproduce if possible." },
    { q: /feedback|suggest|improve/i, a: "Go to **Settings > Feedback** to send general feedback, feature requests, or improvement suggestions." },
    { q: /admin|dashboard|usage/i, a: "The Admin panel is accessible from the sidebar (admin users only). It shows user management and usage analytics." },
    { q: /help|what.*can|how.*use|getting.*start/i, a: "Welcome! Ksemo is an AI workspace. Key features:\n- **AI Chat** — streaming conversations with the AI\n- **Voice Chat** — hands-free voice conversations\n- **File Analysis** — upload PDFs, CSVs, images\n- **Smart Search** — find anything across your workspace\n\nUse the sidebar to navigate, or ask me anything specific!" },
  ];

  const sendHelpMessage = async () => {
    const msg = helpInput.trim();
    if (!msg || helpLoading) return;
    setHelpInput('');
    setHelpMessages((m) => [...m, { role: 'user', content: msg }]);
    setHelpLoading(true);
    helpEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

    const match = HELP_KB.find((k) => k.q.test(msg));
    const reply = match
      ? match.a
      : "I don't have a specific answer for that. Try checking the relevant **Settings** tab, or email us at **support@ksemo.com** to reach our team. You can also ask me about features, shortcuts, or how to use any part of Ksemo.";

    setHelpMessages((m) => [...m, { role: 'assistant', content: reply }]);
    setHelpLoading(false);
    helpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const tabs: { id: Tab; label: string; icon: typeof User; group?: string }[] = [
    { id: 'account', label: 'Account', icon: User, group: 'Account' },
    { id: 'security', label: 'Security', icon: Shield, group: 'Account' },
    { id: 'preferences', label: 'Preferences', icon: Sliders, group: 'Preferences' },
    { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Preferences' },
    { id: 'appearance', label: 'Appearance', icon: Palette, group: 'Preferences' },
    { id: 'keyboard', label: 'Keyboard', icon: Keyboard, group: 'Preferences' },
    { id: 'data', label: 'Data Control', icon: Database, group: 'Data' },
    { id: 'feedback', label: 'Feedback', icon: Sparkles, group: 'Support' },
    { id: 'help', label: 'Help & Support', icon: HelpCircle, group: 'Support' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed header */}
      <div className="h-14 px-6 border-b border-white/8 flex items-center shrink-0">
        <h1 className="text-[15px] font-semibold tracking-tight text-white">Settings</h1>
      </div>

      {/* Body: fixed sidebar nav + scrollable content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar navigation — fixed, independently scrollable */}
        <nav className="w-48 shrink-0 border-r border-white/8 overflow-y-auto py-4 px-3">
          <div>
            {tabs.map((t, i) => {
              const showDivider = i > 0 && tabs[i - 1].group !== t.group;
              return (
                <div key={t.id}>
                  {showDivider && <div className="h-px bg-white/8" />}
                  <button
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] transition text-left',
                      tab === t.id ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <t.icon size={15} /> {t.label}
                  </button>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Content panel — only this scrolls */}
        <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">

            {/* ====== ACCOUNT ====== */}
            {tab === 'account' && (
              <div className="space-y-3">
                <form onSubmit={saveProfile} className="space-y-2">
                  <SectionHeader icon={User} title="Profile information" desc="Your personal details and public profile." />
                  <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-ink-200 mb-1.5">Email</label>
                      <Input value={user?.email ?? ''} disabled className="opacity-60" />
                    </div>
                    <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short bio..." />
                    <div className="flex items-center gap-2">
                      <Badge>Role: {profile?.role}</Badge>
                      <span className="text-[11px] text-ink-300">Joined {new Date(profile?.created_at ?? Date.now()).toLocaleDateString()}</span>
                    </div>
                    <Button type="submit" loading={savingProfile}>{savedProfile ? <Check size={15} /> : null} Save profile</Button>
                  </div>
                </form>

                <SectionHeader icon={Trash2} title="Danger zone" desc="Irreversible actions for your account." />
                <div className="rounded-2xl bg-ink-850 border border-red-500/20 p-4">
                  <h3 className="text-[14px] font-semibold text-white mb-1">Delete account</h3>
                  <p className="text-[12px] text-ink-300 mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
                  <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete account</Button>
                </div>
              </div>
            )}

            {/* ====== SECURITY ====== */}
            {tab === 'security' && (
              <div className="space-y-3">
                <SectionHeader icon={KeyRound} title="Password" desc="Change your account password via email." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <p className="text-[12px] text-ink-300 mb-3">A password reset link will be sent to your email address on file.</p>
                  <Button variant="outline" size="sm" onClick={() => { setResetSent(false); setResetError(''); setResetOpen(true); }}><Mail size={14} /> Request password reset</Button>
                </div>

                <SectionHeader icon={Shield} title="Two-factor authentication" desc="Add an extra layer of security to your account." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <p className="text-[12px] text-ink-300 mb-3">Two-factor authentication adds an additional layer of security by requiring a verification code when signing in.</p>
                  <Badge className="text-ink-300">Not configured</Badge>
                </div>

                <SectionHeader icon={MonitorSmartphone} title="Active sessions" desc="Devices currently signed into your account." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    <div>
                      <div className="text-[13px] text-white">Current session</div>
                      <div className="text-[11px] text-ink-300">{user?.email}</div>
                    </div>
                  </div>
                </div>

                <SectionHeader icon={LogOut} title="Sign out" desc="Sign out of this device." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <p className="text-[12px] text-ink-300 mb-3">You will be redirected to the login page.</p>
                  <Button variant="danger" size="sm" onClick={async () => { await signOut(); nav('/login', { replace: true }); }}><LogOut size={14} /> Sign out</Button>
                </div>
              </div>
            )}

            {/* ====== PREFERENCES ====== */}
            {tab === 'preferences' && (
              <div className="space-y-3">
                <SectionHeader icon={MessageSquare} title="Chat behavior" desc="How conversations work in the workspace." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-1">
                  <Toggle label="Send on Enter" desc="Press Enter to send, Shift+Enter for newline" value={prefs.send_on_enter ?? true} onChange={async (v) => { updatePref('send_on_enter', v); if (user) await upsertSettings(user.id, { ...prefs, send_on_enter: v }); }} />
                  <Toggle label="Auto-rename chats" desc="Automatically title new chats from the first message" value={prefs.auto_rename_chats ?? true} onChange={async (v) => { updatePref('auto_rename_chats', v); if (user) await upsertSettings(user.id, { ...prefs, auto_rename_chats: v }); }} />
                </div>

                <SectionHeader icon={Mic} title="Input & output" desc="Control voice, files, and read-aloud features." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-1">
                  <Toggle label="Voice input" desc="Show the microphone button for speech-to-text" value={prefs.voice_input_enabled ?? true} onChange={async (v) => { updatePref('voice_input_enabled', v); if (user) await upsertSettings(user.id, { ...prefs, voice_input_enabled: v }); }} />
                  <Toggle label="File attachments" desc="Allow attaching files to messages" value={prefs.file_attachment_enabled ?? true} onChange={async (v) => { updatePref('file_attachment_enabled', v); if (user) await upsertSettings(user.id, { ...prefs, file_attachment_enabled: v }); }} />
                  <Toggle label="Read aloud" desc="Show the read-aloud option on assistant messages" value={prefs.read_aloud_enabled ?? true} onChange={async (v) => { updatePref('read_aloud_enabled', v); if (user) await upsertSettings(user.id, { ...prefs, read_aloud_enabled: v }); }} />
                </div>
              </div>
            )}

            {/* ====== NOTIFICATIONS ====== */}
            {tab === 'notifications' && (
              <div className="space-y-3">
                <SectionHeader icon={Bell} title="Email notifications" desc="Control which emails you receive from Ksemo." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-1">
                  <Toggle label="Email notifications" desc="Receive product and security updates by email" value={prefs.notifications_email ?? true} onChange={(v) => updatePref('notifications_email', v)} />
                  <Toggle label="Security alerts" desc="Get notified about sign-ins and account changes" value={prefs.notifications_security ?? true} onChange={(v) => updatePref('notifications_security', v)} />
                  <Toggle label="Product news" desc="New features, improvements, and announcements" value={prefs.notifications_product ?? false} onChange={(v) => updatePref('notifications_product', v)} />
                </div>

                <SectionHeader icon={Info} title="In-app notifications" desc="Notifications inside the Ksemo workspace." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-1">
                  <Toggle label="In-app notifications" desc="Show notification badges and toasts in the app" value={prefs.notifications_in_app ?? true} onChange={(v) => updatePref('notifications_in_app', v)} />
                  <Toggle label="Notification sounds" desc="Play a sound when a new notification arrives" value={prefs.notifications_sound ?? false} onChange={(v) => updatePref('notifications_sound', v)} />
                </div>

                <Button onClick={savePrefs} loading={savingPrefs}>{savedPrefs ? <Check size={15} /> : null} Save preferences</Button>
              </div>
            )}

            {/* ====== APPEARANCE ====== */}
            {tab === 'appearance' && (
              <div className="space-y-3">
                <SectionHeader icon={Palette} title="Theme" desc="Choose how Ksemo looks on your device." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => { updatePref('theme', t.value); setAppTheme(t.value); }}
                        className={cn(
                          'rounded-xl border p-3 text-center transition',
                          (prefs.theme ?? 'dark') === t.value
                            ? 'border-white/30 bg-white/8 text-white'
                            : 'border-white/5 bg-white/3 text-ink-300 hover:border-white/15'
                        )}
                      >
                        <div className="text-[13px] font-medium mb-0.5">{t.label}</div>
                        <div className="text-[11px] text-ink-300">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={savePrefs} loading={savingPrefs}>{savedPrefs ? <Check size={15} /> : null} Save preferences</Button>
              </div>
            )}

            {/* ====== KEYBOARD SHORTCUTS ====== */}
            {tab === 'keyboard' && (
              <div className="space-y-3">
                <SectionHeader icon={Keyboard} title="Keyboard shortcuts" desc="Use hotkeys to navigate and control Ksemo faster." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-1">
                  {SHORTCUTS.map((s) => (
                    <Toggle
                      key={s.prefKey}
                      label={s.label}
                      desc={`${s.key} — ${s.desc}`}
                      value={prefs[s.prefKey] as boolean ?? true}
                      onChange={(v) => updatePref(s.prefKey, v)}
                    />
                  ))}
                </div>

                <SectionHeader icon={Info} title="Quick reference" desc="All available shortcuts at a glance." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 divide-y divide-white/5">
                  {SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-[13px] text-white">{s.label}</div>
                        <div className="text-[11px] text-ink-300">{s.desc}</div>
                      </div>
                      <kbd className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-ink-200 font-mono shrink-0 ml-4">{s.key}</kbd>
                    </div>
                  ))}
                </div>

                <Button onClick={savePrefs} loading={savingPrefs}>{savedPrefs ? <Check size={15} /> : null} Save preferences</Button>
              </div>
            )}

            {/* ====== DATA CONTROL ====== */}
            {tab === 'data' && (
              <div className="space-y-3">
                <SectionHeader icon={Database} title="Data Control" desc="Manage, export, or delete your data." />

                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><Download size={15} /> Export your data</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Download all your chats, messages, favorites, uploads, and settings as a JSON file.</p>
                  <Button variant="outline" size="sm" onClick={exportData}><Download size={14} /> Export data</Button>
                </div>

                <div className="rounded-2xl bg-ink-850 border border-orange-500/20 p-4">
                  <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><Trash2 size={15} /> Delete all chats</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Permanently delete every chat, message, and favorite in your account. This action is immediate and irreversible.</p>
                  <Button variant="danger" size="sm" onClick={() => { setDeleteAllConfirm(''); setDeleteAllOpen(true); }}><Trash2 size={14} /> Delete all chats</Button>
                </div>

                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4">
                  <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><Search size={15} /> Clear search history</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Remove all recent search queries from your device.</p>
                  <Button variant="outline" size="sm" onClick={() => setClearSearchOpen(true)}><RefreshCw size={14} /> Clear search history</Button>
                </div>
              </div>
            )}

            {/* ====== FEEDBACK ====== */}
            {tab === 'feedback' && (
              <div className="space-y-3">
                <SectionHeader icon={Sparkles} title="Send feedback" desc="Help us improve Ksemo with your thoughts." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-ink-200 mb-2">Category</label>
                    <select value={feedbackCat} onChange={(e) => setFeedbackCat(e.target.value)} className="w-full h-11 px-3.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-white/25">
                      <option value="general">General</option>
                      <option value="feature">Feature request</option>
                      <option value="praise">Praise</option>
                      <option value="improvement">Improvement suggestion</option>
                    </select>
                  </div>
                  <Input label="Subject" value={feedbackSubj} onChange={(e) => setFeedbackSubj(e.target.value)} placeholder="Short summary" />
                  <Textarea label="Details" value={feedbackBody} onChange={(e) => setFeedbackBody(e.target.value)} rows={5} placeholder="Tell us more..." />
                  <Button onClick={sendFeedback} disabled={!feedbackSubj.trim() || !feedbackBody.trim()}>
                    {feedbackSent ? <Check size={15} /> : null} {feedbackSent ? 'Sent - thank you' : 'Send feedback'}
                  </Button>
                </div>
              </div>
            )}

            {/* ====== HELP & SUPPORT ====== */}
            {tab === 'help' && (
              <div className="space-y-3">
                <SectionHeader icon={HelpCircle} title="Help & Support" desc="Get instant answers about Ksemo features and usage." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 overflow-hidden">
                  <div className="h-[420px] overflow-y-auto p-4 space-y-3">
                    {helpMessages.map((m, i) => (
                      <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed',
                          m.role === 'user'
                            ? 'bg-white text-ink-900'
                            : 'bg-white/8 text-ink-100 border border-white/8'
                        )}>
                          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    ))}
                    {helpLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white/8 border border-white/8 rounded-2xl px-4 py-3 text-[13px] text-ink-300">
                          <span className="animate-pulse">Thinking...</span>
                        </div>
                      </div>
                    )}
                    <div ref={helpEndRef} />
                  </div>
                  <div className="border-t border-white/8 p-3 flex gap-2">
                    <Input
                      value={helpInput}
                      onChange={(e) => setHelpInput(e.target.value)}
                      placeholder="Ask a question about Ksemo..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHelpMessage(); } }}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={sendHelpMessage} disabled={!helpInput.trim() || helpLoading}>
                      <Send size={14} />
                    </Button>
                  </div>
                </div>

                <SectionHeader icon={Mail} title="Contact human support" desc="Need more help? Reach out to our team directly." />
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/5 shrink-0"><Mail size={15} className="text-ink-200" /></div>
                    <div>
                      <div className="text-[13px] font-medium text-white">Email Support</div>
                      <div className="text-[12px] text-ink-300">For account issues, billing, or technical problems that need human assistance.</div>
                      <a href="mailto:support@ksemo.com" className="text-[12px] text-blue-400 hover:text-blue-300 transition mt-1 inline-block">support@ksemo.com</a>
                    </div>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/5 shrink-0"><MessageSquare size={15} className="text-ink-200" /></div>
                    <div>
                      <div className="text-[13px] font-medium text-white">Feature Requests</div>
                      <div className="text-[12px] text-ink-300">Have an idea? We love hearing from our users about what to build next.</div>
                      <button onClick={() => setTab('feedback')} className="text-[12px] text-blue-400 hover:text-blue-300 transition mt-1 inline-block">Send feedback</button>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>

      {/* ====== MODALS (rendered outside scroll containers) ====== */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" size="sm" onClick={deleteAccount}>Delete forever</Button></>}>
        <p className="text-[13px] text-ink-200 mb-4">This will sign you out. To fully remove your data, our team will process your request after you confirm. Type <span className="text-white font-mono">DELETE</span> to continue.</p>
        <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" />
        {error && <p className="mt-2 text-[12px] text-white flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
      </Modal>

      <Modal open={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} title="Delete all chats" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setDeleteAllOpen(false)}>Cancel</Button><Button variant="danger" size="sm" loading={deletingAll} disabled={deleteAllConfirm !== 'DELETE ALL CHATS'} onClick={deleteAllChatsHandler}>Delete all chats</Button></>}>
        <p className="text-[13px] text-ink-200 mb-2">This will permanently delete <strong className="text-white">all your chats, messages, and favorites</strong>. This action is irreversible.</p>
        <p className="text-[13px] text-ink-200 mb-4">Type <span className="text-white font-mono">DELETE ALL CHATS</span> to confirm.</p>
        <Input value={deleteAllConfirm} onChange={(e) => setDeleteAllConfirm(e.target.value)} placeholder="Type DELETE ALL CHATS" />
      </Modal>

      <Modal open={clearSearchOpen} onClose={() => setClearSearchOpen(false)} title="Clear search history" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setClearSearchOpen(false)}>Cancel</Button><Button variant="danger" size="sm" onClick={clearSearchHandler}>Clear history</Button></>}>
        <p className="text-[13px] text-ink-200">This will remove all recent search queries from this device. This action cannot be undone.</p>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset password" size="sm"
        footer={
          resetSent ? (
            <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>Close</Button>
          ) : (
            <><Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>Cancel</Button><Button size="sm" loading={resetSending} onClick={requestPasswordReset}>Send reset link</Button></>
          )
        }>
        {resetSent ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <CheckCircle size={22} className="text-white" />
            </div>
            <p className="text-[14px] text-ink-200">
              A password reset link has been sent to<br />
              <span className="text-white font-medium">{user?.email}</span>
            </p>
            <p className="text-[13px] text-ink-300">The link expires in 15 minutes. Check your spam folder if you don't see it.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-ink-200">A password reset link will be sent to:</p>
            <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-white font-medium">{user?.email}</div>
            {resetError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-white">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {resetError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function SectionHeader(props: { icon: typeof User; title: string; desc: string }) {
  const IconComp = props.icon;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 p-2 rounded-lg bg-white/5"><IconComp size={15} className="text-ink-200" /></div>
      <div>
        <h3 className="text-[14px] font-semibold text-white">{props.title}</h3>
        <p className="text-[12px] text-ink-300">{props.desc}</p>
      </div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between py-2 text-left">
      <div className="min-w-0">
        <div className="text-[13px] text-white">{label}</div>
        <div className="text-[11px] text-ink-300">{desc}</div>
      </div>
      <span className={cn('relative h-6 w-11 rounded-full transition shrink-0 ml-3', value ? 'bg-white' : 'bg-ink-700 border border-white/10')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full transition-all', value ? 'left-[22px] bg-ink-900' : 'left-0.5 bg-ink-200')} />
      </span>
    </button>
  );
}
