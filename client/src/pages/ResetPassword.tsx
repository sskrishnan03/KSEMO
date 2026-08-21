import {
  AuthError,
  AuthPasswordField,
  AuthShell,
} from "@/components/ksemo/AuthShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Link2Off } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "wouter";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setSucceeded(true),
    onError: error => {
      setFormError(
        error.message || "Could not reset your password. Please try again."
      );
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (password.length < 8) errors.password = "Use at least 8 characters.";
    if (confirmPassword !== password)
      errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    resetPassword.mutate({ token, password });
  }

  if (!token) {
    return (
      <AuthShell
        eyebrow="Password reset"
        title="Link not valid"
        subtitle="This page needs a one-time reset link. Request a fresh one and try again."
        footer={
          <p>
            <Link
              href="/forgot-password"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Request a new reset link
            </Link>
          </p>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
          <Link2Off className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">
            Reset links expire after one hour for your security.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (succeeded) {
    return (
      <AuthShell
        eyebrow="All set"
        title="Password updated"
        subtitle="Your new password is ready. Sign in with your email to pick up right where you left off."
        footer={
          <p>
            <Link
              href="/signin"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Continue to sign in
            </Link>
          </p>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-5 text-muted-foreground">
              Every other session stays signed in — only your password changed.
            </p>
          </div>
          <Button asChild className="h-12 w-full rounded-xl font-medium">
            <a href="/signin">Go to sign in</a>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      subtitle="Pick something strong you don't use anywhere else."
      footer={
        <p>
          Trouble with this link?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Request a new one
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <AuthPasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={event => setPassword(event.target.value)}
          error={fieldErrors.password}
          disabled={resetPassword.isPending}
        />

        <AuthPasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
          disabled={resetPassword.isPending}
        />

        <AuthError message={formError} />

        <Button
          type="submit"
          disabled={resetPassword.isPending}
          className="h-12 w-full rounded-xl font-medium"
        >
          {resetPassword.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
