import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const nav = useNavigate();

  useEffect(() => {
    nav('/app/voice-chat', { replace: true });
  }, [nav]);

  return (
    <div className="h-full flex items-center justify-center bg-ink-900">
      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}
