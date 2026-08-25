import {
  AuthError,
  AuthPasswordField,
  AuthTextField,
  GoogleButton,
} from "@/components/ksemo/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { startGoogleLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  KeyRound,
  LogIn,
  MailCheck,
  Send,
  UserPlus,
} from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";

type Panel = "idle" | "signin" | "signup" | "forgot";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FADE = { duration: 0.22, ease: [0.32, 0.72, 0, 1] } as const;

function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        or
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function FooterLinks() {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] leading-5 text-muted-foreground">
      <Link
        href="/support/faq"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Help
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href="/support/privacy"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Privacy
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href="/support/terms"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Terms
      </Link>
    </div>
  );
}

function SignInForm({
  onForgot,
  onSignup,
}: {
  onForgot: () => void;
  onSignup: () => void;
}) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
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

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    signIn.mutate({ email: email.trim() });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 max-w-xs mx-auto">
      <AuthTextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={event => setEmail(event.target.value)}
        error={fieldError}
        disabled={signIn.isPending}
        autoFocus
      />
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          id="signin-remember"
          checked={remember}
          onCheckedChange={checked => setRemember(checked === true)}
          disabled={signIn.isPending}
          className="mt-0.5"
        />
        <label
          htmlFor="signin-remember"
          className="cursor-pointer text-xs leading-5 text-muted-foreground"
        >
          Remember me
        </label>
      </div>
      <AuthError message={formError} />
      <Button
        type="submit"
        disabled={signIn.isPending}
        className="h-10 w-full rounded-lg text-sm font-medium bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] hover:bg-[oklch(0.93_0.003_80)]"
      >
        <span className="inline-flex items-center gap-2">
          <LogIn className="size-4" />
          {signIn.isPending ? "Signing in…" : "Sign in"}
        </span>
      </Button>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onForgot}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </button>
        <button
          type="button"
          onClick={onSignup}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Create account
        </button>
      </div>
    </form>
  );
}

function SignUpForm({ onSignin }: { onSignin: () => void }) {
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
      setFormError(
        error.message || "Could not create your account. Please try again."
      );
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (name.trim().length === 0) errors.name = "Tell us your name.";
    if (!EMAIL_PATTERN.test(email.trim()))
      errors.email = "Enter a valid email address.";
    if (password.length < 8) errors.password = "At least 8 characters.";
    if (confirmPassword !== password)
      errors.confirmPassword = "Passwords do not match.";
    if (!agreed)
      errors.agreed = "Please accept the Terms and Privacy Policy to continue.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    signUp.mutate({ name: name.trim(), email: email.trim(), password });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 max-w-xs mx-auto">
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
      <div className="grid grid-cols-2 gap-2">
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
          <label
            htmlFor="signup-agree-terms"
            className="cursor-pointer text-xs leading-5 text-muted-foreground"
          >
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
        {fieldErrors.agreed ? (
          <p className="px-1 text-xs text-destructive">{fieldErrors.agreed}</p>
        ) : null}
      </div>
      <AuthError message={formError} />
      <Button
        type="submit"
        disabled={signUp.isPending}
        className="h-10 w-full rounded-lg text-sm font-medium bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] hover:bg-[oklch(0.93_0.003_80)]"
      >
        <span className="inline-flex items-center gap-2">
          <UserPlus className="size-4" />
          {signUp.isPending ? "Creating account…" : "Create account"}
        </span>
      </Button>
      <button
        type="button"
        onClick={onSignin}
        className="w-full text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Already have an account? Sign in
      </button>
    </form>
  );
}

function ForgotForm({
  onBackToSignIn,
  onSignin,
}: {
  onBackToSignIn: () => void;
  onSignin: () => void;
}) {
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
        usesGoogleOnly: Boolean(
          (data as { usesGoogleOnly?: boolean }).usesGoogleOnly
        ),
      });
    },
    onError: error => {
      setFormError(
        error.message || "Could not start the reset. Please try again."
      );
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
      <div className="space-y-3 max-w-xs mx-auto">
        <div className="space-y-3">
          {result?.usesGoogleOnly ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background/60 p-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                This account signs in with Google.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background/60 p-3">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                Reset link sent to {sentTo}.
              </p>
            </div>
          )}

          {result?.resetUrl ? (
            <div className="space-y-2.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Here is your reset link:
              </p>
              <Button
                asChild
                className="h-10 w-full rounded-lg text-sm font-medium"
              >
                <a href={result.resetUrl}>Open reset link</a>
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
            className="h-10 w-full rounded-lg text-sm font-medium hover:bg-accent"
          >
            Use different email
          </Button>

          <button
            type="button"
            onClick={onSignin}
            className="w-full text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 max-w-xs mx-auto">
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
      <Button
        type="submit"
        disabled={requestReset.isPending}
        className="h-10 w-full rounded-lg text-sm font-medium bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] hover:bg-[oklch(0.93_0.003_80)]"
      >
        <span className="inline-flex items-center gap-2">
          <Send className="size-4" />
          {requestReset.isPending ? "Sending…" : "Send reset link"}
        </span>
      </Button>
    </form>
  );
}

export default function AuthStage() {
  const [panel, setPanel] = useState<Panel>("idle");

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-dvh items-center justify-center bg-background px-5 py-10">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative z-10 w-full max-w-5xl">
          <AnimatePresence mode="wait" initial={false}>
            {panel === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="max-w-md mx-auto"
              >
                <div className="flex flex-col items-center text-center">
                  <Link
                    href="/"
                    className="mx-auto block size-14 overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <img
                      src="/KSEMOlogo.png"
                      alt="KSEMO logo"
                      className="size-full object-cover"
                    />
                  </Link>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    KSEMO
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                    Welcome back
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Your private space to think, talk, and remember.
                  </p>
                </div>

                <div className="mt-8 space-y-3 max-w-xs mx-auto">
                  <GoogleButton onClick={startGoogleLogin} />
                  <AuthDivider />
                  <Button
                    onClick={() => setPanel("signin")}
                    className="w-full h-10 rounded-lg text-sm font-medium bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] hover:bg-[oklch(0.93_0.003_80)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LogIn className="size-4" />
                      Sign in
                    </span>
                  </Button>
                  <Button
                    onClick={() => setPanel("signup")}
                    variant="outline"
                    className="w-full h-10 rounded-lg text-sm font-medium border-border text-foreground hover:bg-accent"
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserPlus className="size-4" />
                      Create account
                    </span>
                  </Button>
                </div>

                <div className="mt-8">
                  <FooterLinks />
                </div>
              </motion.div>
            )}

            {panel === "signin" && (
              <motion.div
                key="signin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="max-w-md mx-auto"
              >
                <button
                  type="button"
                  onClick={() => setPanel("idle")}
                  className="mb-4 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2">
                    <LogIn className="size-5 text-muted-foreground" />
                    <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                      Sign in
                    </h1>
                  </div>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Enter your email to sign in to your account.
                  </p>
                </div>

                <div className="mt-8 space-y-3 max-w-xs mx-auto">
                  <GoogleButton onClick={startGoogleLogin} />
                  <AuthDivider />
                  <SignInForm
                    onForgot={() => setPanel("forgot")}
                    onSignup={() => setPanel("signup")}
                  />
                </div>

                <div className="mt-8">
                  <FooterLinks />
                </div>
              </motion.div>
            )}

            {panel === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="max-w-md mx-auto"
              >
                <button
                  type="button"
                  onClick={() => setPanel("idle")}
                  className="mb-4 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2">
                    <UserPlus className="size-5 text-muted-foreground" />
                    <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                      Create account
                    </h1>
                  </div>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Join KSEMO to start your private space.
                  </p>
                </div>

                <div className="mt-8 space-y-3 max-w-xs mx-auto">
                  <GoogleButton onClick={startGoogleLogin} />
                  <AuthDivider />
                  <SignUpForm onSignin={() => setPanel("signin")} />
                </div>

                <div className="mt-8">
                  <FooterLinks />
                </div>
              </motion.div>
            )}

            {panel === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="max-w-md mx-auto"
              >
                <button
                  type="button"
                  onClick={() => setPanel("signin")}
                  className="mb-4 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-5 text-muted-foreground" />
                    <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                      Forgot password?
                    </h1>
                  </div>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    We'll send you a link to reset your password.
                  </p>
                </div>

                <div className="mt-8">
                  <ForgotForm
                    onBackToSignIn={() => setPanel("signin")}
                    onSignin={() => setPanel("signin")}
                  />
                </div>

                <div className="mt-8">
                  <FooterLinks />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  );
}
