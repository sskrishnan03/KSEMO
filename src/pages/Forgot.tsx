import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Enter your email address.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return; }
      setSent(true);
    } catch {
      setError('Could not reach the server. Make sure it is running.');
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We sent a password reset link to your inbox"
        footer={<>Remember your password? <Link to="/login" className="text-white font-medium hover:underline">Sign in</Link></>}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
            <CheckCircle size={28} className="text-white" />
          </div>
          <p className="text-[14px] text-ink-200 leading-relaxed">
            A password reset link has been sent to<br />
            <span className="text-white font-medium">{email}</span>
          </p>
          <p className="text-[13px] text-ink-300">
            The link expires in 15 minutes. Check your spam folder if you don't see it.
          </p>
          <Button variant="outline" className="w-full h-11 justify-center rounded-xl border border-white/10 text-[14px] font-medium text-white hover:bg-white/5 transition" onClick={() => { setSent(false); setEmail(''); }}>
            Try a different email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
      footer={<>Remember your password? <Link to="/login" className="text-white font-medium hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[13px] text-white">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-1.5 text-left">
          <label className="text-[13px] font-medium text-ink-200">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 justify-center rounded-xl font-semibold" loading={loading}>
          Send reset link
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
