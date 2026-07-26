import { type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink-800 text-white border border-white/10 hover:bg-ink-700 hover:border-white/20 active:bg-ink-750 shadow-soft font-semibold',
  secondary: 'bg-ink-700 text-white hover:bg-ink-600 border border-white/10',
  ghost: 'text-ink-100 hover:bg-white/5 hover:text-white',
  outline: 'border border-white/15 text-white hover:bg-white/5 hover:border-white/25',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-soft border border-transparent font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
  icon: 'h-9 w-9 rounded-lg justify-center',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-40 disabled:pointer-events-none select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...rest }: InputProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="block text-xs font-medium text-ink-200 mb-1.5">{label}</label>}
      <input
        id={inputId}
        className={cn(
          'w-full h-11 px-3.5 rounded-xl bg-ink-850 border border-white/10 text-white placeholder:text-ink-300',
          'focus:outline-none focus:border-white/25 focus:bg-ink-800 transition-all duration-200',
          error && 'border-white/30',
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-white/80">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-300">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="block text-xs font-medium text-ink-200 mb-1.5">{label}</label>}
      <textarea
        id={inputId}
        className={cn(
          'w-full px-3.5 py-3 rounded-xl bg-ink-850 border border-white/10 text-white placeholder:text-ink-300',
          'focus:outline-none focus:border-white/25 focus:bg-ink-800 transition-all duration-200 resize-none',
          error && 'border-white/30',
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-white/80">{error}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl bg-ink-850 border border-white/8 shadow-soft', className)}>
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-white/10 bg-white/5 text-ink-100', className)}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn('relative w-full glass-strong border border-white/10 rounded-2xl shadow-lift animate-scale-in', width)}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <h3 className="text-[15px] font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-200 hover:bg-white/5 hover:text-white transition">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin', className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-4 h-12 w-12 rounded-2xl bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-ink-300 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 rounded-md bg-ink-700 border border-white/10 text-[11px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        {label}
      </span>
    </span>
  );
}
