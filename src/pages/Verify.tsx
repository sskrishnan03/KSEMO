import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Check, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

export default function Verify() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  // If Supabase redirected with a session (email confirmation link), go straight in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav('/app', { replace: true });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Email confirmation is OFF by default; OTP code verification is optional.
    // Attempt to verify the token if a code was provided.
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setLoading(false);
    if (error) {
      setError('Invalid or expired code. You can also sign in directly if your email is already confirmed.');
      return;
    }
    setVerified(true);
    setTimeout(() => nav('/app', { replace: true }), 1200);
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email || 'your email'}.`}
      footer={<Link to="/login" className="text-white hover:underline">Back to sign in</Link>}
    >
      {verified ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
          <div className="h-10 w-10 rounded-xl bg-ink-800 border border-white/10 mx-auto flex items-center justify-center mb-3">
            <Check size={18} className="text-white" />
          </div>
          <p className="text-[14px] text-white font-medium">Email verified</p>
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
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <Input name="code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="pl-10 tracking-[0.5em] text-center" maxLength={6} />
          </div>
          <Button type="submit" className="w-full" loading={loading}>Verify code</Button>
          <p className="text-[12px] text-ink-300 text-center">Didn't get a code? You can usually sign in directly after signup.</p>
        </form>
      )}
    </AuthLayout>
  );
}
