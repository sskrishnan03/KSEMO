import { useEffect, useState } from 'react';
import { Bell, Check, Shield, Sparkles, Info, AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/data';
import { formatRelativeTime, cn } from '../lib/utils';
import type { Notification } from '../lib/types';

const icons: Record<string, typeof Bell> = {
  system: Info, security: Shield, credits: Sparkles, product: Bell, alert: AlertCircle,
};

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); listNotifications().then(setItems).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const markOne = async (id: string) => {
    await markNotificationRead(id);
    setItems((s) => s.map((n) => n.id === id ? { ...n, read: true } : n));
  };
  const markAll = async () => {
    await markAllNotificationsRead();
    setItems((s) => s.map((n) => ({ ...n, read: true })));
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Notifications</h1>
            <p className="text-ink-300 mt-2">{unread > 0 ? `${unread} unread` : 'You are all caught up.'}</p>
          </div>
          {unread > 0 && <Button size="sm" variant="outline" onClick={markAll}><Check size={14} /> Mark all read</Button>}
        </div>

        {loading && <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}

        {!loading && items.length === 0 && (
          <EmptyState icon={<Bell size={20} />} title="No notifications" description="System updates, security alerts, and product news will show up here." />
        )}

        <div className="space-y-1">
          {items.map((n) => {
            const Icon = icons[n.type] ?? Bell;
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl p-4 border transition',
                  n.read ? 'bg-ink-850/50 border-white/5' : 'bg-ink-850 border-white/10',
                )}
              >
                <div className={cn('h-9 w-9 rounded-lg border flex items-center justify-center shrink-0', n.read ? 'bg-ink-800 border-white/8 text-ink-300' : 'bg-ink-800 border-white/15 text-white')}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white">{n.title}</span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  {n.body && <p className="text-[12px] text-ink-300 mt-0.5">{n.body}</p>}
                  <div className="text-[11px] text-ink-300 mt-1">{formatRelativeTime(n.created_at)}</div>
                </div>
                {!n.read && (
                  <button onClick={() => markOne(n.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition">
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
