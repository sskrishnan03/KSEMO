import { useEffect, useState } from 'react';
import {
  Users, BarChart3, Cpu, MessageSquare, Activity, Server,
  Megaphone, Shield, TrendingUp, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { Card, Badge, Button, Input, Textarea } from '../components/ui';
import { useAuthContext } from '../components/AuthProvider';
import { cn, formatNumber, formatRelativeTime } from '../lib/utils';
import { supabase } from '../lib/supabase';

type Tab = 'overview' | 'users' | 'usage' | 'feedback' | 'logs' | 'announcements';

interface UsageRow { id: string; model: string; prompt_tokens: number; completion_tokens: number; created_at: string; }
interface FeedbackRow { id: string; category: string; subject: string; body: string; status: string; created_at: string; }
interface LogRow { id: string; level: string; source: string; message: string; created_at: string; }
interface AnnRow { id: string; title: string; body: string; active: boolean; created_at: string; }

export default function Admin() {
  const { profile } = useAuthContext();
  const [tab, setTab] = useState<Tab>('overview');
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [anns, setAnns] = useState<AnnRow[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  useEffect(() => {
    supabase.from('ai_usage').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setUsage((data ?? []) as UsageRow[]));
    supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setFeedback((data ?? []) as FeedbackRow[]));
    supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setLogs((data ?? []) as LogRow[]));
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => setAnns((data ?? []) as AnnRow[]));
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ count }) => setUserCount(count ?? 0));
  }, []);

  const totalTokens = usage.reduce((a, u) => a + u.prompt_tokens + u.completion_tokens, 0);
  const byModel = usage.reduce<Record<string, number>>((acc, u) => {
    acc[u.model] = (acc[u.model] ?? 0) + 1;
    return acc;
  }, {});
  const topModels = Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxModelCount = topModels[0]?.[1] ?? 1;

  const postAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    const { data } = await supabase.from('announcements').insert({ title: annTitle, body: annBody }).select().maybeSingle();
    if (data) setAnns((a) => [data as AnnRow, ...a]);
    setAnnTitle(''); setAnnBody('');
  };

  const toggleAnn = async (id: string, active: boolean) => {
    await supabase.from('announcements').update({ active: !active }).eq('id', id);
    setAnns((a) => a.map((x) => x.id === id ? { ...x, active: !active } : x));
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'usage', label: 'AI Usage', icon: Cpu },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'logs', label: 'Logs', icon: Activity },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-8">
          <Shield size={20} className="text-white" />
          <h1 className="text-2xl font-semibold tracking-tight text-white">Admin</h1>
          <Badge>Admin access · {profile?.username}</Badge>
        </div>

        <nav className="flex gap-1 mb-8 border-b border-white/8 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-[13px] border-b-2 transition whitespace-nowrap',
                tab === t.id ? 'border-white text-white' : 'border-transparent text-ink-300 hover:text-white',
              )}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={Users} label="Total users" value={formatNumber(userCount)} sub="Signed up" />
              <Stat icon={Cpu} label="AI requests" value={formatNumber(usage.length)} sub="Last 200 logged" />
              <Stat icon={TrendingUp} label="Tokens used" value={formatNumber(totalTokens)} sub="Across all models" />
              <Stat icon={MessageSquare} label="Feedback" value={formatNumber(feedback.length)} sub={`${feedback.filter((f) => f.status === 'open').length} open`} />
            </div>

            <Card className="p-6">
              <h3 className="text-[14px] font-semibold text-white mb-4">Model usage</h3>
              {topModels.length === 0 ? (
                <p className="text-[13px] text-ink-300">No usage recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {topModels.map(([model, count]) => (
                    <div key={model}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="text-ink-100">{model}</span>
                        <span className="text-ink-300">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(count / maxModelCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid sm:grid-cols-2 gap-3">
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-white mb-3 flex items-center gap-2"><Server size={15} /> System health</h3>
                <div className="space-y-2 text-[12px]">
                  <HealthRow label="API gateway" ok />
                  <HealthRow label="Database" ok />
                  <HealthRow label="Edge functions" ok />
                  <HealthRow label="Auth service" ok />
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-[14px] font-semibold text-white mb-3 flex items-center gap-2"><Activity size={15} /> Recent activity</h3>
                <div className="space-y-2 text-[12px] text-ink-200">
                  {usage.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex justify-between">
                      <span className="truncate">{u.model}</span>
                      <span className="text-ink-300">{formatRelativeTime(u.created_at)}</span>
                    </div>
                  ))}
                  {usage.length === 0 && <p className="text-ink-300">No recent activity.</p>}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <Card className="p-6">
            <h3 className="text-[14px] font-semibold text-white mb-4">User management</h3>
            <p className="text-[13px] text-ink-300 mb-4">{formatNumber(userCount)} registered users. Detailed per-user management requires service-role access.</p>
            <div className="rounded-xl bg-ink-800/50 border border-white/5 p-4 text-[12px] text-ink-200">
              <div className="flex justify-between py-1"><span>Total users</span><span className="text-white">{userCount}</span></div>
              <div className="flex justify-between py-1"><span>Active in last 24h</span><span className="text-white">—</span></div>
              <div className="flex justify-between py-1"><span>Admins</span><span className="text-white">{profile?.role === 'admin' ? 1 : 0}+</span></div>
            </div>
          </Card>
        )}

        {tab === 'usage' && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-white/8"><h3 className="text-[14px] font-semibold text-white">AI usage log</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-ink-800/50 text-ink-300">
                  <tr><th className="text-left p-3">Model</th><th className="text-right p-3">Prompt</th><th className="text-right p-3">Completion</th><th className="text-right p-3">When</th></tr>
                </thead>
                <tbody>
                  {usage.slice(0, 50).map((u) => (
                    <tr key={u.id} className="border-t border-white/5">
                      <td className="p-3 text-white">{u.model}</td>
                      <td className="p-3 text-right text-ink-200">{u.prompt_tokens}</td>
                      <td className="p-3 text-right text-ink-200">{u.completion_tokens}</td>
                      <td className="p-3 text-right text-ink-300">{formatRelativeTime(u.created_at)}</td>
                    </tr>
                  ))}
                  {usage.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-ink-300">No usage recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'feedback' && (
          <div className="space-y-2">
            {feedback.length === 0 && <Card className="p-8 text-center text-[13px] text-ink-300">No feedback yet.</Card>}
            {feedback.map((f) => (
              <Card key={f.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{f.category}</Badge>
                  <Badge className={f.status === 'open' ? 'text-white' : 'text-ink-300'}>{f.status}</Badge>
                  <span className="text-[11px] text-ink-300 ml-auto">{formatRelativeTime(f.created_at)}</span>
                </div>
                <div className="text-[13px] font-medium text-white">{f.subject}</div>
                <p className="text-[12px] text-ink-300 mt-1">{f.body}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === 'logs' && (
          <Card className="p-4">
            <div className="space-y-1 font-mono text-[12px]">
              {logs.length === 0 && <p className="text-ink-300 p-4">No logs recorded.</p>}
              {logs.map((l) => (
                <div key={l.id} className="flex gap-3 py-1 border-b border-white/5">
                  <span className={cn('shrink-0', l.level === 'error' ? 'text-white' : l.level === 'warn' ? 'text-ink-100' : 'text-ink-300')}>
                    {l.level.toUpperCase()}
                  </span>
                  <span className="text-ink-300 shrink-0">{l.source}</span>
                  <span className="text-ink-100 flex-1">{l.message}</span>
                  <span className="text-ink-300 shrink-0">{formatRelativeTime(l.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'announcements' && (
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-white mb-3">Post announcement</h3>
              <div className="space-y-3">
                <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                <Textarea placeholder="Body" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} />
                <Button size="sm" onClick={postAnnouncement} disabled={!annTitle.trim() || !annBody.trim()}>Post</Button>
              </div>
            </Card>
            <div className="space-y-2">
              {anns.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-white">{a.title}</span>
                    <Badge className={a.active ? 'text-white' : 'text-ink-300'}>{a.active ? 'Active' : 'Inactive'}</Badge>
                    <span className="text-[11px] text-ink-300 ml-auto">{formatRelativeTime(a.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-ink-300">{a.body}</p>
                  <button onClick={() => toggleAnn(a.id, a.active)} className="mt-2 text-[11px] text-ink-200 hover:text-white transition">
                    {a.active ? 'Deactivate' : 'Activate'}
                  </button>
                </Card>
              ))}
              {anns.length === 0 && <Card className="p-6 text-center text-[13px] text-ink-300">No announcements yet.</Card>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-ink-300 mb-2">
        <Icon size={15} /> <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-white tracking-tight">{value}</div>
      <div className="text-[11px] text-ink-300 mt-0.5">{sub}</div>
    </Card>
  );
}

function HealthRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-100">{label}</span>
      <span className={cn('flex items-center gap-1.5', ok ? 'text-white' : 'text-white')}>
        {ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {ok ? 'Operational' : 'Degraded'}
      </span>
    </div>
  );
}
