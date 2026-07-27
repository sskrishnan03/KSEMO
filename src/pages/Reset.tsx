import { useState, useEffect, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';

export default function Reset() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) nav('/forgot', { replace: true });
  }, [token, nav]);

  if (!token) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }
      setDone(true);
    } catch {
      setError('Could not reach the server. Make sure it is running.');
    }
    setLoading(false);
  };

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Your password has been changed successfully"
        footer={<>Continue to <Link to="/login" className="text-white font-medium hover:underline">Sign in</Link></>}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
            <CheckCircle size={28} className="text-white" />
          </div>
          <p className="text-[14px] text-ink-200 leading-relaxed">
            You can now sign in with your new password.
          </p>
          <Button
            className="w-full h-11 justify-center rounded-xl font-semibold"
            onClick={() => nav('/login', { replace: true })}
          >
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong password for your account"
      footer={<>Back to <Link to="/login" className="text-white font-medium hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[13px] text-white">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-1.5 text-left">
          <label className="text-[13px] font-medium text-ink-200">New password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input
              type={show ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11"
              required
              autoFocus
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-white transition">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-[13px] font-medium text-ink-200">Confirm password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input
              type={show ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pl-10 h-11"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 justify-center rounded-xl font-semibold" loading={loading}>
          Update password
        </Button>

        <div className="text-center pt-2">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-ink-300 hover:text-white transition">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
