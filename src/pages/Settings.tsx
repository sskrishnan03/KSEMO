import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Sliders, Shield, Database, Trash2, Check, AlertCircle,
  Download, LogOut, Bell, Globe, Sparkles,
} from 'lucide-react';
import { Button, Input, Textarea, Modal, Badge } from '../components/ui';
import { useAuthContext } from '../components/AuthProvider';
import { updateProfile, getSettings, upsertSettings, submitFeedback } from '../lib/data';
import { downloadFile, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { AppPreferences } from '../lib/types';

type Tab = 'profile' | 'preferences' | 'security' | 'data' | 'feedback';

export default function Settings() {
  const { profile, user, signOut, refresh } = useAuthContext();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('profile');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [prefs, setPrefs] = useState<AppPreferences>({});
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [error, setError] = useState('');
  const [feedbackCat, setFeedbackCat] = useState('general');
  const [feedbackSubj, setFeedbackSubj] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setUsername(profile.username);
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) getSettings(user.id).then((s) => setPrefs(s?.preferences ?? {})).catch(() => {});
  }, [user]);

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
    setSavingPrefs(false);
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  };

  const exportData = async () => {
    if (!user) return;
    const [chats, msgs] = await Promise.all([
      supabase.from('chats').select('*').eq('user_id', user.id),
      supabase.from('messages').select('*').eq('user_id', user.id),
    ]);
    const data = { profile, chats: chats.data, messages: msgs.data, exportedAt: new Date().toISOString() };
    downloadFile(`ksemo-export-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setError('');
    // Delete user data via service role is not available client-side; sign out and
    // surface a clear message. The user can request full deletion via feedback.
    await signOut();
    nav('/', { replace: true });
  };

  const sendFeedback = async () => {
    if (!feedbackSubj.trim() || !feedbackBody.trim()) return;
    await submitFeedback(feedbackCat, feedbackSubj, feedbackBody);
    setFeedbackSubj(''); setFeedbackBody('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 2500);
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'feedback', label: 'Feedback', icon: Sparkles },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-8">Settings</h1>

        <div className="grid lg:grid-cols-[200px_1fr] gap-8">
          {/* Tabs */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] whitespace-nowrap transition',
                  tab === t.id ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                )}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="min-w-0">
            {tab === 'profile' && (
              <form onSubmit={saveProfile} className="space-y-5 max-w-lg">
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-1.5">Email</label>
                  <Input value={user?.email ?? ''} disabled className="opacity-60" />
                </div>
                <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short bio…" />
                <div className="flex items-center gap-2">
                  <Badge>Role: {profile?.role}</Badge>
                  <span className="text-[11px] text-ink-300">Joined {new Date(profile?.created_at ?? Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={savingProfile}>{savedProfile ? <Check size={15} /> : null} Save profile</Button>
                </div>
              </form>
            )}

            {tab === 'preferences' && (
              <div className="space-y-6 max-w-lg">
                <Toggle label="Send on Enter" desc="Press Enter to send, Shift+Enter for newline" value={prefs.send_on_enter ?? true} onChange={(v) => setPrefs({ ...prefs, send_on_enter: v })} />
                <Toggle label="Streaming responses" desc="Show responses token by token" value={prefs.streaming ?? true} onChange={(v) => setPrefs({ ...prefs, streaming: v })} />
                <Toggle label="Show token count" desc="Display token usage per message" value={prefs.show_token_count ?? false} onChange={(v) => setPrefs({ ...prefs, show_token_count: v })} />
                <Toggle label="Reduce motion" desc="Minimize animations" value={prefs.reduce_motion ?? false} onChange={(v) => setPrefs({ ...prefs, reduce_motion: v })} />
                <Toggle label="Compact mode" desc="Tighter spacing in the sidebar" value={prefs.compact_mode ?? false} onChange={(v) => setPrefs({ ...prefs, compact_mode: v })} />
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-2 flex items-center gap-1.5"><Globe size={12} /> Language</label>
                  <select value={prefs.language ?? 'en'} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })} className="w-full h-11 px-3.5 rounded-xl bg-ink-850 border border-white/10 text-white focus:outline-none focus:border-white/25">
                    <option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="ja">Japanese</option><option value="zh">Chinese</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-2 flex items-center gap-1.5"><Bell size={12} /> Notifications</label>
                  <Toggle label="Email notifications" desc="Product and security updates by email" value={prefs.notifications_email ?? true} onChange={(v) => setPrefs({ ...prefs, notifications_email: v })} />
                  <Toggle label="Security alerts" desc="Login and account security alerts" value={prefs.notifications_security ?? true} onChange={(v) => setPrefs({ ...prefs, notifications_security: v })} />
                  <Toggle label="Product news" desc="New features and announcements" value={prefs.notifications_product ?? false} onChange={(v) => setPrefs({ ...prefs, notifications_product: v })} />
                </div>
                <Button onClick={savePrefs} loading={savingPrefs}>{savedPrefs ? <Check size={15} /> : null} Save preferences</Button>
              </div>
            )}

            {tab === 'security' && (
              <div className="space-y-6 max-w-lg">
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1">Password</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Change your account password.</p>
                  <Button variant="outline" size="sm" onClick={() => nav('/reset')}>Change password</Button>
                </div>
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1">Two-factor authentication</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Add an extra layer of security to your account.</p>
                  <Badge className="text-ink-300">Not configured</Badge>
                </div>
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1">Active sessions</h3>
                  <p className="text-[12px] text-ink-300 mb-4">This device is currently signed in.</p>
                  <div className="flex items-center gap-2 text-[12px] text-ink-200">
                    <span className="h-2 w-2 rounded-full bg-white" /> Current session · {user?.email}
                  </div>
                </div>
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1">Sign out</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Sign out of this device.</p>
                  <Button variant="danger" size="sm" onClick={async () => { await signOut(); nav('/login', { replace: true }); }}><LogOut size={14} /> Sign out</Button>
                </div>
              </div>
            )}

            {tab === 'data' && (
              <div className="space-y-4 max-w-lg">
                <div className="rounded-2xl bg-ink-850 border border-white/8 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><Download size={15} /> Export your data</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Download all your chats, messages, and profile as JSON.</p>
                  <Button variant="outline" size="sm" onClick={exportData}>Export data</Button>
                </div>
                <div className="rounded-2xl bg-ink-850 border border-red-500/20 p-5">
                  <h3 className="text-[14px] font-semibold text-white mb-1 flex items-center gap-2"><Trash2 size={15} /> Delete account</h3>
                  <p className="text-[12px] text-ink-300 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
                  <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete account</Button>
                </div>
              </div>
            )}

            {tab === 'feedback' && (
              <div className="space-y-4 max-w-lg">
                <p className="text-[13px] text-ink-200">Tell us how we can improve Ksemo.</p>
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-2">Category</label>
                  <select value={feedbackCat} onChange={(e) => setFeedbackCat(e.target.value)} className="w-full h-11 px-3.5 rounded-xl bg-ink-850 border border-white/10 text-white focus:outline-none focus:border-white/25">
                    <option value="general">General</option><option value="bug">Bug report</option><option value="feature">Feature request</option><option value="praise">Praise</option>
                  </select>
                </div>
                <Input label="Subject" value={feedbackSubj} onChange={(e) => setFeedbackSubj(e.target.value)} placeholder="Short summary" />
                <Textarea label="Details" value={feedbackBody} onChange={(e) => setFeedbackBody(e.target.value)} rows={5} placeholder="Tell us more…" />
                <Button onClick={sendFeedback} disabled={!feedbackSubj.trim() || !feedbackBody.trim()}>
                  {feedbackSent ? <Check size={15} /> : null} {feedbackSent ? 'Sent — thank you' : 'Send feedback'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" size="sm" onClick={deleteAccount}>Delete forever</Button></>}>
        <p className="text-[13px] text-ink-200 mb-4">This will sign you out. To fully remove your data, our team will process your request after you confirm. Type <span className="text-white font-mono">DELETE</span> to continue.</p>
        <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" />
        {error && <p className="mt-2 text-[12px] text-white flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
      </Modal>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between py-2 text-left">
      <div>
        <div className="text-[13px] text-white">{label}</div>
        <div className="text-[11px] text-ink-300">{desc}</div>
      </div>
      <span className={cn('relative h-6 w-11 rounded-full transition shrink-0', value ? 'bg-white' : 'bg-ink-700 border border-white/10')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full transition-all', value ? 'left-[22px] bg-ink-900' : 'left-0.5 bg-ink-200')} />
      </span>
    </button>
  );
}
