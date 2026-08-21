import { AuthDivider, AuthError, AuthPasswordField, AuthTextField, GoogleButton } from "@/components/ksemo/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { startGoogleLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronLeft, KeyRound, LogIn, MailCheck, Send, UserPlus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

type Panel = "idle" | "signin" | "signup" | "forgot";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SPRING = { type: "spring", stiffness: 300, damping: 32 } as const;
const FADE = { duration: 0.22, ease: [0.32, 0.72, 0, 1] } as const;
const PANEL_WIDTH = 448;
const TEASER_WIDTH = 360;

const PATHS: Record<Exclude<Panel, "idle">, string> = {
  signin: "/signin",
  signup: "/signup",
  forgot: "/forgot-password",
};

const COPY: Record<Panel, { eyebrow: string; title: string; subtitle: string }> = {
  idle: {
    eyebrow: "KSEMO",
    title: "Welcome to KSEMO",
    subtitle: "Your private space to think, talk, and remember.",
  },
  signin: {
    eyebrow: "Sign in",
    title: "Welcome back",
    subtitle: "Pick up every thread right where you left it.",
  },
  signup: {
    eyebrow: "Create account",
    title: "Create your account",
    subtitle: "One private space for conversations, files, and memories.",
  },
  forgot: {
    eyebrow: "Password reset",
    title: "Reset your password",
    subtitle: "We'll email you a one-time link to set a new password.",
  },
};

const GOOGLE_CAPTION = "One tap with Google — no password needed.";

const STRENGTH_STYLES = [
  { bar: "bg-red-500", text: "text-red-400" },
  { bar: "bg-orange-400", text: "text-orange-300" },
  { bar: "bg-yellow-400", text: "text-yellow-300" },
  { bar: "bg-emerald-500", text: "text-emerald-400" },
] as const;

function getPasswordStrength(password: string): { level: number; label: string } {
  if (password.length === 0) return { level: -1, label: "" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { level: 0, label: "Very weak" };
  if (score === 2) return { level: 1, label: "Weak" };
  if (score <= 4) return { level: 2, label: "Strong" };
  return { level: 3, label: "Very strong" };
}

function StrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (strength.level < 0) return null;
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex flex-1 gap-1.5">
        {[0, 1, 2, 3].map(index => (
          <span
            key={index}
            aria-hidden="true"
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              index <= strength.level ? STRENGTH_STYLES[strength.level].bar : "bg-border"
            }`}
          />
        ))}
      </div>
      <span aria-live="polite" className={`shrink-0 text-xs font-medium ${STRENGTH_STYLES[strength.level].text}`}>
        {strength.label}
      </span>
    </div>
  );
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-[1.75rem] border border-border bg-card/70 p-6 text-left shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function CardHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="pb-0.5">
      <p className="text-base font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: error => {
      setFormError(error.message || "Could not sign you in. Please try again.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length === 0) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    signIn.mutate({ email: email.trim(), password });
  }

  return (
    <CardFrame>
      <CardHeading title="Sign in with email" hint="Use your KSEMO email and password." />
      <form onSubmit={submit} noValidate className="space-y-3">
        <AuthTextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          error={fieldErrors.email}
          disabled={signIn.isPending}
          autoFocus
        />
        <AuthPasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          error={fieldErrors.password}
          disabled={signIn.isPending}
          action={
            <button
              type="button"
              onClick={onForgot}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </button>
          }
        />
        <AuthError message={formError} />
        <Button type="submit" disabled={signIn.isPending} className="h-12 w-full rounded-xl text-[15px] font-medium">
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </CardFrame>
  );
}

function SignUpForm() {
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreed?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const signUp = trpc.auth.signUp.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.href = "/";
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") {
        setFieldErrors({ email: error.message });
        return;
      }
      setFormError(error.message || "Could not create your account. Please try again.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (name.trim().length === 0) errors.name = "Tell us your name.";
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < 8) errors.password = "At least 8 characters.";
    if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match.";
    if (!agreed) errors.agreed = "Please accept the Terms and Privacy Policy to continue.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    signUp.mutate({ name: name.trim(), email: email.trim(), password });
  }

  return (
    <CardFrame>
      <CardHeading title="Create your account" hint="Name, email, and a password — that's all." />
      <form onSubmit={submit} noValidate className="space-y-3">
        <AuthTextField
          label="Name"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={event => setName(event.target.value)}
          error={fieldErrors.name}
          disabled={signUp.isPending}
          autoFocus
        />
        <AuthTextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          error={fieldErrors.email}
          disabled={signUp.isPending}
        />
        <div className="grid grid-cols-2 gap-3">
          <AuthPasswordField
            label="Password"
            autoComplete="new-password"
            placeholder="8+ characters"
            value={password}
            onChange={event => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={signUp.isPending}
          />
          <AuthPasswordField
            label="Confirm"
            autoComplete="new-password"
            placeholder="Repeat it"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={signUp.isPending}
          />
        </div>
        <StrengthMeter password={password} />
        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5 px-1">
            <Checkbox
              id="signup-agree-terms"
              checked={agreed}
              onCheckedChange={checked => {
                setAgreed(checked === true);
                setFieldErrors(previous => ({ ...previous, agreed: undefined }));
              }}
              disabled={signUp.isPending}
              aria-invalid={Boolean(fieldErrors.agreed)}
              className="mt-0.5"
            />
            <label htmlFor="signup-agree-terms" className="cursor-pointer text-xs leading-5 text-muted-foreground">
              I agree to the{" "}
              <Link
                href="/support/terms"
                onClick={event => event.stopPropagation()}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/support/privacy"
                onClick={event => event.stopPropagation()}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </label>
          </div>
          {fieldErrors.agreed ? <p className="px-1 text-xs text-destructive">{fieldErrors.agreed}</p> : null}
        </div>
        <AuthError message={formError} />
        <Button type="submit" disabled={signUp.isPending} className="h-12 w-full rounded-xl text-[15px] font-medium">
          {signUp.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </CardFrame>
  );
}

function ForgotForm({ onBackToSignIn }: { onBackToSignIn: () => void }) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [result, setResult] = useState<{
    delivered: "email" | "fallback" | "skipped";
    resetUrl: string | null;
    usesGoogleOnly: boolean;
  } | null>(null);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: data => {
      setSentTo(email.trim());
      setResult({
        delivered: data.delivered ?? "skipped",
        resetUrl: data.resetUrl ?? null,
        usesGoogleOnly: Boolean((data as { usesGoogleOnly?: boolean }).usesGoogleOnly),
      });
    },
    onError: error => {
      setFormError(error.message || "Could not start the reset. Please try again.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    requestReset.mutate({ email: email.trim() });
  }

  if (sentTo) {
    return (
      <CardFrame>
        <CardHeading
          title="Check your inbox"
          hint={
            result?.usesGoogleOnly
              ? "This account signs in with Google."
              : `A one-time reset link is on its way to ${sentTo}.`
          }
        />
        <div className="space-y-3">
          {result?.usesGoogleOnly ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                There's no KSEMO password to reset — just continue with Google.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                The link expires in one hour and works only once. Didn't arrive? Check spam, or use a different email below.
              </p>
            </div>
          )}

          {result?.resetUrl ? (
            <div className="space-y-2.5 rounded-xl border border-dashed border-border bg-muted/40 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Email delivery couldn't complete just now, so here is your secure reset link:
              </p>
              <Button asChild className="h-12 w-full rounded-xl text-[15px] font-medium">
                <a href={result.resetUrl}>Open password reset</a>
              </Button>
            </div>
          ) : null}

          <Button
            variant="outline"
            onClick={() => {
              setSentTo(null);
              setResult(null);
              setEmail("");
            }}
            disabled={requestReset.isPending}
            className="h-11 w-full rounded-xl font-medium hover:bg-accent"
          >
            Use a different email
          </Button>

          <button
            type="button"
            onClick={onBackToSignIn}
            className="w-full text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </CardFrame>
    );
  }

  return (
    <CardFrame>
      <CardHeading title="Forgot your password?" hint="Enter your email and we'll send a one-time reset link." />
      <form onSubmit={submit} noValidate className="space-y-3">
        <AuthTextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          error={fieldError}
          disabled={requestReset.isPending}
          autoFocus
        />
        <AuthError message={formError} />
        <Button type="submit" disabled={requestReset.isPending} className="h-12 w-full rounded-xl text-[15px] font-medium">
          <span className="inline-flex items-center gap-2">
            <Send className="size-4" />
            {requestReset.isPending ? "Sending…" : "Send reset link"}
          </span>
        </Button>
        <p className="px-1 text-center text-xs leading-5 text-muted-foreground">
          For your security, we never confirm whether an email is registered.
        </p>
      </form>
    </CardFrame>
  );
}

function TeaserCard({
  icon,
  title,
  description,
  iconSide,
  orientation,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconSide: "left" | "right";
  orientation: "portrait" | "row";
  onClick: () => void;
}) {
  const iconWrap = (
    <span className="shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
      {icon}
    </span>
  );

  const arrow =
    iconSide === "right" ? (
      <ArrowLeft className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-x-1" />
    ) : (
      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
    );

  if (orientation === "row") {
    return (
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-5 py-4 text-left transition-colors duration-200 hover:border-foreground/25 hover:bg-card/80"
      >
        {iconSide === "right" ? (
          <>
            {arrow}
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold tracking-[-0.02em]">{title}</span>
              <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{description}</span>
            </span>
            {iconWrap}
          </>
        ) : (
          <>
            {iconWrap}
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold tracking-[-0.02em]">{title}</span>
              <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{description}</span>
            </span>
            {arrow}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group w-full max-w-[360px] rounded-[1.75rem] border border-dashed border-border bg-card/40 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-card/80 hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)] ${
        iconSide === "left" ? "text-right" : ""
      }`}
    >
      <span className={`flex items-center gap-2.5 whitespace-nowrap ${iconSide === "left" ? "justify-end" : ""}`}>
        {iconSide === "right" && arrow}
        {iconSide === "left" && iconWrap}
        <span className="block text-[1.6rem] font-semibold leading-none tracking-[-0.03em]">{title}</span>
        {iconSide === "right" && iconWrap}
        {iconSide === "left" && arrow}
      </span>
      <span className="mt-2.5 block text-sm leading-6 text-muted-foreground">{description}</span>
    </button>
  );
}

function GoogleDock({ action }: { action: React.ReactNode }) {
  return (
    <div className="w-full text-center">
      <motion.div layoutId="auth-google" transition={SPRING}>
        <GoogleButton onClick={startGoogleLogin} />
      </motion.div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{GOOGLE_CAPTION}</p>
      <div className="mt-2.5">{action}</div>
    </div>
  );
}

function fadeProps() {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: FADE,
  };
}

function BrandBlock({ panel, compact }: { panel: Panel; compact?: boolean }) {
  const copy = COPY[panel];
  return (
    <div className={compact ? "text-center" : "w-full max-w-[23rem] text-center"}>
      <Link href="/" className="mx-auto block size-14 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
        <img src="/KSEMOlogo.png" alt="KSEMO logo" className="size-full object-cover" />
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{copy.eyebrow}</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={panel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
        >
          <h1 className={`mt-3 font-semibold leading-tight tracking-[-0.03em] ${compact ? "text-[1.75rem]" : "text-[2rem]"}`}>
            {copy.title}
          </h1>
          <p className={`mx-auto mt-2.5 max-w-sm text-sm leading-6 text-muted-foreground ${compact ? "max-w-[18rem]" : ""}`}>
            {copy.subtitle}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StageZone({
  width,
  side,
  children,
}: {
  width: number;
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ width, opacity: width > 0 ? 1 : 0 }}
      transition={SPRING}
      style={{ pointerEvents: width > 0 ? "auto" : "none" }}
      aria-hidden={width === 0}
      className="relative hidden h-[min(42rem,calc(100dvh-7rem))] shrink-0 items-center overflow-hidden lg:flex"
    >
      <div className="flex w-[448px] items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {children}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StageFooter() {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] leading-5 text-muted-foreground">
      <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
        Home
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/support/faq" className="underline-offset-4 hover:text-foreground hover:underline">
        FAQ
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/support/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
        Privacy
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/support/terms" className="underline-offset-4 hover:text-foreground hover:underline">
        Terms
      </Link>
    </div>
  );
}

export default function AuthStage({ initialPanel = "idle" }: { initialPanel?: Panel }) {
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const isDesktop = useIsDesktop();

  function open(next: Panel) {
    setPanel(next);
    if (next !== "idle") navigate(PATHS[next], { replace: true });
  }

  const leftWidth = panel === "signin" || panel === "forgot" ? PANEL_WIDTH : panel === "idle" ? TEASER_WIDTH : 0;
  const rightWidth = panel === "signup" ? PANEL_WIDTH : panel === "idle" ? TEASER_WIDTH : 0;

  const backControl =
    panel !== "idle" ? (
      <AnimatePresence>
        <motion.button
          key="back"
          type="button"
          onClick={() => open("idle")}
          aria-label="Back"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={FADE}
          className="absolute left-6 top-6 z-20 grid size-10 place-items-center rounded-full border border-border bg-card/60 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </motion.button>
      </AnimatePresence>
    ) : null;

  if (!isDesktop) {
    return (
      <MotionConfig reducedMotion="user">
        <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-background px-5 py-10">
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
          {backControl}
          <div className="relative z-10 w-full max-w-lg">
            <BrandBlock panel={panel} compact />
            <div className="mt-7">
              <AnimatePresence mode="wait" initial={false}>
                {panel === "idle" ? (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                    className="space-y-3"
                  >
                    <TeaserCard
                      orientation="row"
                      icon={<LogIn className="size-6" />}
                      iconSide="right"
                      title="Sign in"
                      description="With your email and password."
                      onClick={() => open("signin")}
                    />
                    <TeaserCard
                      orientation="row"
                      icon={<UserPlus className="size-6" />}
                      iconSide="left"
                      title="Create account"
                      description="New to KSEMO? It takes a minute."
                      onClick={() => open("signup")}
                    />
                    <div className="pt-1">
                      <AuthDivider />
                    </div>
                    <motion.div layoutId="auth-google" transition={SPRING}>
                      <GoogleButton onClick={startGoogleLogin} />
                    </motion.div>
                    <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{GOOGLE_CAPTION}</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={panel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                    className="space-y-3"
                  >
                    {panel === "signin" && <SignInForm onForgot={() => open("forgot")} />}
                    {panel === "signup" && <SignUpForm />}
                    {panel === "forgot" && <ForgotForm onBackToSignIn={() => open("signin")} />}
                    <div className="py-1">
                      <AuthDivider />
                    </div>
                    <motion.div layoutId="auth-google" transition={SPRING}>
                      <GoogleButton onClick={startGoogleLogin} />
                    </motion.div>
                    <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{GOOGLE_CAPTION}</p>
                    {panel === "signin" && (
                      <Button
                        variant="ghost"
                        onClick={() => open("signup")}
                        className="h-10 w-full rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        New to KSEMO? Create account
                      </Button>
                    )}
                    {panel === "signup" && (
                      <Button
                        variant="ghost"
                        onClick={() => open("signin")}
                        className="h-10 w-full rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Already have an account? Sign in
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-10">
              <StageFooter />
            </div>
          </div>
        </main>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative grid h-dvh place-items-center overflow-hidden bg-background px-8">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
        {backControl}

        <div className="relative z-10 flex w-full max-w-[90rem] items-center justify-center gap-10">
          <StageZone width={leftWidth} side="left">
            {panel === "idle" && (
              <motion.div key="signin-teaser" {...fadeProps()}>
                <TeaserCard
                  orientation="portrait"
                  icon={<LogIn className="size-6" />}
                  iconSide="right"
                  title="Sign in"
                  description="With your email and password."
                  onClick={() => open("signin")}
                />
              </motion.div>
            )}
            {panel === "signin" && (
              <motion.div key="signin-form" {...fadeProps()} className="w-[448px]">
                <SignInForm onForgot={() => open("forgot")} />
              </motion.div>
            )}
            {panel === "forgot" && (
              <motion.div key="forgot-form" {...fadeProps()} className="w-[448px]">
                <ForgotForm onBackToSignIn={() => open("signin")} />
              </motion.div>
            )}
            {panel === "signup" && (
              <motion.div
                key="google-left"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="w-[448px]"
              >
                <GoogleDock
                  action={
                    <Button
                      variant="ghost"
                      onClick={() => open("signin")}
                      className="h-10 rounded-xl px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Already have an account? Sign in
                    </Button>
                  }
                />
              </motion.div>
            )}
          </StageZone>

          <div className="z-10 flex shrink-0 flex-col items-center">
            <BrandBlock panel={panel} />
            <div className="mt-9 h-20 w-full max-w-[23rem]">
              <AnimatePresence initial={false}>
                {panel === "idle" && (
                  <motion.div
                    key="center-google"
                    className="w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                  >
                    <motion.div layoutId="auth-google" transition={SPRING}>
                      <GoogleButton onClick={startGoogleLogin} />
                    </motion.div>
                    <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{GOOGLE_CAPTION}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <StageZone width={rightWidth} side="right">
            {panel === "idle" && (
              <motion.div key="signup-teaser" {...fadeProps()}>
                <TeaserCard
                  orientation="portrait"
                  icon={<UserPlus className="size-6" />}
                  iconSide="left"
                  title="Create account"
                  description="New to KSEMO? It takes a minute."
                  onClick={() => open("signup")}
                />
              </motion.div>
            )}
            {panel === "signup" && (
              <motion.div key="signup-form" {...fadeProps()} className="w-[448px]">
                <SignUpForm />
              </motion.div>
            )}
            {panel === "signin" && (
              <motion.div
                key="google-right"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="w-[448px]"
              >
                <GoogleDock
                  action={
                    <Button
                      variant="ghost"
                      onClick={() => open("signup")}
                      className="h-10 rounded-xl px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      New to KSEMO? Create account
                    </Button>
                  }
                />
              </motion.div>
            )}
          </StageZone>
        </div>

        <div className="absolute inset-x-0 bottom-5 z-10">
          <StageFooter />
        </div>
      </main>
    </MotionConfig>
  );
}
