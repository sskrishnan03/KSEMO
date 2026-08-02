import { cn } from '../../lib/utils';

interface LiveCaptionsProps {
  text: string;
  isInterim?: boolean;
  className?: string;
}

export function LiveCaptions({ text, isInterim = false, className }: LiveCaptionsProps) {
  if (!text) return null;

  return (
    <div
      className={cn(
        'text-center px-6 py-4 transition-all duration-200',
        isInterim ? 'opacity-60' : 'opacity-100',
        className
      )}
    >
      <p className="text-2xl font-medium text-white leading-relaxed">
        {text}
      </p>
      {isInterim && (
        <span className="inline-block w-2 h-6 bg-white/50 ml-1 animate-pulse" />
      )}
    </div>
  );
}
