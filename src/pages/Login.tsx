import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../components/AuthProvider';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { session, profile, loading: authLoading } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session && profile && !authLoading) {
      const dest = (loc.state as { from?: string })?.from ?? '/app';
      nav(dest, { replace: true });
    }
  }, [session, profile, authLoading, nav, loc.state]);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };


  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message.includes('Invalid login') ? 'Incorrect email or password.' : error.message);
      return;
    }
    const dest = (loc.state as { from?: string })?.from ?? '/app';
    nav(dest, { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your workspace"
      footer={<>Don't have an account? <Link to="/signup" className="text-white font-medium hover:underline">Sign up</Link></>}
    >
      <div className="space-y-4">
        {/* Google sign-in at the top */}
        <Button variant="outline" className="w-full h-11 justify-center rounded-xl border border-white/10 text-[14px] font-medium text-white hover:bg-white/5 transition" onClick={handleGoogleSignIn} disabled={loading} type="button">
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-[11px] text-ink-300 justify-center">
          <div className="flex-1 h-px bg-white/5" /> or <div className="flex-1 h-px bg-white/5" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[13px] text-white">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          
          <div className="space-y-1.5 text-left">
            <label className="text-[13px] font-medium text-ink-200">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
              <Input type="email" name="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" required autoComplete="email" />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[13px] font-medium text-ink-200">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
              <Input type={show ? 'text' : 'password'} name="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11" required autoComplete="current-password" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-white transition">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[13px] pt-1">
            <label className="flex items-center gap-2 text-ink-200 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-white h-3.5 w-3.5 rounded" />
              Remember me
            </label>
          </div>

          <Button type="submit" className="w-full h-11 justify-center rounded-xl bg-white text-ink-900 font-semibold hover:bg-ink-100 transition" loading={loading}>
            Sign in
          </Button>

          <div className="text-center mt-3">
            <Link to="/forgot" className="text-[13px] text-ink-200 hover:text-white transition">Forgot password?</Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
