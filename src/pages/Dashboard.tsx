import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listChats, createChat, getLastActiveChatId, setLastActiveChatId } from '../lib/data';

export default function Dashboard() {
  const nav = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const redirectToChat = async () => {
      try {
        // First try to restore last active chat from localStorage
        const lastId = getLastActiveChatId();
        if (lastId) {
          const chats = await listChats();
          const exists = chats.find(c => c.id === lastId && !c.archived);
          if (exists) {
            nav(`/app/chat/${exists.id}`, { replace: true });
            return;
          }
        }
        // Fallback: most recent active chat
        const chats = await listChats();
        const activeChats = chats.filter(c => !c.archived);
        if (activeChats.length > 0) {
          activeChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          setLastActiveChatId(activeChats[0].id);
          nav(`/app/chat/${activeChats[0].id}`, { replace: true });
        } else {
          const c = await createChat();
          if (c) {
            nav(`/app/chat/${c.id}`, { replace: true });
          }
        }
      } catch {
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
