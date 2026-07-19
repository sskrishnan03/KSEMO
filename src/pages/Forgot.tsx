import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, Check, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<><Link to="/login" className="inline-flex items-center gap-1 text-white hover:underline"><ArrowLeft size={13} /> Back to sign in</Link></>}
    >
      {sent ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
          <div className="h-10 w-10 rounded-xl bg-ink-800 border border-white/10 mx-auto flex items-center justify-center mb-3">
            <Check size={18} className="text-white" />
          </div>
          <p className="text-[14px] text-white font-medium">Check your inbox</p>
          <p className="mt-1.5 text-[13px] text-ink-300">We sent a reset link to <span className="text-white">{email}</span>.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[13px] text-white">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input type="email" name="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
          </div>
          <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
