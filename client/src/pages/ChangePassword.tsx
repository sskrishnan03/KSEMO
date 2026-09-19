import {
  AuthError,
  AuthPasswordField,
  AuthShell,
} from "@/components/ksemo/AuthShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function ChangePassword() {
  const auth = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const isGoogle =
    (auth.user as { loginMethod?: string | null } | undefined)?.loginMethod ===
    "google";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => setSucceeded(true),
    onError: error => {
      setFormError(
        error.message || "Could not change your password. Please try again."
      );
    },
  });

  useEffect(() => {
    if (isGoogle || succeeded) return;
    if (formError) setFormError(null);
  }, [currentPassword, newPassword, confirmPassword, formError, isGoogle, succeeded]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (currentPassword.length < 8)
      errors.currentPassword = "Enter your current password.";
    if (newPassword.length < 8)
      errors.newPassword = "Use at least 8 characters.";
    if (confirmPassword.length < 8 || confirmPassword !== newPassword)
      errors.confirmPassword = "Passwords do not match.";
    if (newPassword.length >= 8 && newPassword === currentPassword)
      errors.newPassword =
        "New password must be different from your current one.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    changePassword.mutate({ currentPassword, newPassword });
  }

  if (isGoogle) {
    return (
      <AuthShell
        eyebrow="Account security"
        title="No local password"
        subtitle="This account signs in with Google, so there is no KSEMO password to reset."
        footer={
          <p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              Back to KSEMO
            </button>
          </p>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-5 text-muted-foreground">
              Your password is managed by Google. Use Google's account settings
              to change it.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")}
            className="h-11 w-full rounded-xl font-medium"
          >
            Back to KSEMO
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (succeeded) {
    return (
      <AuthShell
        eyebrow="All set"
        title="Password updated"
        subtitle="Your new password is active now. Every other session stays signed in."
        footer={
          <p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              Back to KSEMO
            </button>
          </p>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-5 text-muted-foreground">
              Use your new password the next time you sign in to KSEMO.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")}
            className="h-11 w-full rounded-xl font-medium"
          >
            Continue to KSEMO
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Account security"
      title="Reset your password"
      subtitle="Confirm your current password, then choose a strong new one."
      footer={
        <p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Back to KSEMO
          </button>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-3">
        <AuthPasswordField
          label="Current password"
          autoComplete="current-password"
          placeholder="Your current password"
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
          error={fieldErrors.currentPassword}
          disabled={changePassword.isPending}
        />

        <AuthPasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          error={fieldErrors.newPassword}
          disabled={changePassword.isPending}
        />

        <AuthPasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
          disabled={changePassword.isPending}
        />

        <AuthError message={formError} />

        <Button
          type="submit"
          disabled={changePassword.isPending}
          className="h-11 w-full rounded-xl font-medium"
        >
          {changePassword.isPending
            ? "Updating…"
            : "Reset password"}
        </Button>

        <p className="text-center text-[11px] leading-5 text-muted-foreground">
          Forgot your current password?{" "}
          <span
            role="link"
            tabIndex={0}
            onClick={() => navigate("/forgot-password")}
            onKeyDown={event => {
              if (event.key === "Enter") navigate("/forgot-password");
            }}
            className="cursor-pointer font-medium text-foreground transition-colors hover:text-primary"
          >
            Request a reset link
          </span>
        </p>
      </form>
    </AuthShell>
  );
}