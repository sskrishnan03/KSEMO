import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import React, { useId, useState } from "react";

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      disabled={disabled}
      className="h-10 w-full rounded-lg border-border bg-background text-sm font-medium hover:bg-accent"
    >
      <span className="inline-flex items-center gap-2">
        <GoogleIcon />
        Continue with Google
      </span>
    </Button>
  );
}

export function AuthDivider() {
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

export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-4 text-destructive"
    >
      {message}
    </p>
  );
}

type FieldProps = {
  label: string;
  error?: string | null;
  children?: React.ReactNode;
  action?: React.ReactNode;
};

function FieldFrame({ label, error, children, action }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[13px] font-medium text-foreground/90">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs leading-4 text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = FieldProps &
  Omit<React.ComponentProps<typeof Input>, "id">;

export function AuthTextField({
  label,
  error,
  action,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} action={action}>
      <Input
        id={id}
        autoComplete="off"
        className="h-11 rounded-xl border-border bg-background/60 text-[15px] shadow-none"
        {...inputProps}
      />
    </FieldFrame>
  );
}

type PasswordFieldProps = FieldProps &
  Omit<React.ComponentProps<typeof Input>, "id" | "type"> & {
    autoComplete?: string;
  };

export function AuthPasswordField({
  label,
  error,
  action,
  ...inputProps
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldFrame label={label} error={error} action={action}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className="h-11 rounded-xl border-border bg-background/60 pr-11 text-[15px] shadow-none"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </FieldFrame>
  );
}

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

// Shared frame for the email sign-in / sign-up / reset flows. Mirrors the
// KSEMO access screen (dot-grid backdrop, logo tile, sans display heading,
// floating card) and is locked to exactly one viewport height: the layout is
// compact by design and never scrolls.
export function AuthShell({
  eyebrow = "KSEMO",
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-auto bg-background px-5 py-6 sm:h-dvh sm:overflow-hidden sm:px-6">
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
      <section className="relative w-full max-w-sm text-center">
        <a
          href="/"
          className="mx-auto block size-11 overflow-hidden rounded-xl border border-border bg-card shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
        >
          <img
            src="/KSEMOlogo.png"
            alt="KSEMO logo"
            className="size-full object-cover"
          />
        </a>
        <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.85rem]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-5 text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-5 rounded-[1.5rem] border border-border bg-card/70 p-2.5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
          <div className="space-y-3 p-1.5">{children}</div>
        </div>
        {footer ? (
          <div className="mt-4 space-y-1.5 text-xs leading-5 text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  );
}
