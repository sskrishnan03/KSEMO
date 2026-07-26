import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listChats, createChat } from '../lib/data';

export default function Dashboard() {
  const nav = useNavigate();

  useEffect(() => {
    const redirectToChat = async () => {
      try {
        const chats = await listChats();
        const activeChats = chats.filter(c => !c.archived);
        if (activeChats.length > 0) {
          // Sort by updated_at descending to get the most recent one
          activeChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          nav(`/app/chat/${activeChats[0].id}`, { replace: true });
        } else {
          const c = await createChat();
          if (c) {
            nav(`/app/chat/${c.id}`, { replace: true });
          }
        }
      } catch (err) {
        // Fallback
        const c = await createChat();
        if (c) {
          nav(`/app/chat/${c.id}`, { replace: true });
        }
      }
    };
    redirectToChat();
  }, [nav]);

  return (
    <div className="h-full flex items-center justify-center bg-ink-900">
      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}
