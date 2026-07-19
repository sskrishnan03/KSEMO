import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { listFavorites, removeFavorite } from '../lib/data';
import { formatRelativeTime, truncate } from '../lib/utils';
import type { Favorite, Message } from '../lib/types';

type Row = Favorite & { message?: Message; chat?: { id: string; title: string } };

export default function Favorites() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); listFavorites().then(setRows).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const remove = async (id: string, messageId: string) => {
    await removeFavorite(messageId);
    setRows((r) => r.filter((x) => x.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Favorites</h1>
        <p className="text-ink-300 mb-8">Messages you starred for later.</p>

        {loading && <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}

        {!loading && rows.length === 0 && (
          <EmptyState icon={<Star size={20} />} title="No favorites yet" description="Star any assistant message to save it here." />
        )}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-ink-850 border border-white/8 p-4">
              <div className="flex items-center gap-2 mb-2 text-[11px] text-ink-300">
                <MessageSquare size={12} />
                <Link to={`/app/chat/${r.message?.chat_id}`} className="hover:text-white transition">{r.chat?.title ?? 'Chat'}</Link>
                <span>· {formatRelativeTime(r.created_at)}</span>
                <button onClick={() => remove(r.id, r.message_id)} className="ml-auto h-6 px-2 rounded-lg flex items-center gap-1 text-ink-300 hover:text-white hover:bg-white/5 transition">
                  <Star size={12} className="fill-white text-white" /> Remove
                </button>
              </div>
              {r.message && <Markdown content={truncate(r.message.content, 400)} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
