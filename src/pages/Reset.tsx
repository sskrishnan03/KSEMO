import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

export default function Reset() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => nav('/app', { replace: true }), 1800);
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your account."
      footer={<Link to="/login" className="text-white hover:underline">Back to sign in</Link>}
    >
      {done ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
          <div className="h-10 w-10 rounded-xl bg-ink-800 border border-white/10 mx-auto flex items-center justify-center mb-3">
            <Check size={18} className="text-white" />
          </div>
          <p className="text-[14px] text-white font-medium">Password updated</p>
          <p className="mt-1.5 text-[13px] text-ink-300">Taking you to your workspace…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[13px] text-white">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input type={show ? 'text' : 'password'} name="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-white transition">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Button type="submit" className="w-full" loading={loading}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
