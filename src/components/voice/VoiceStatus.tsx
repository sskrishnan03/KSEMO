import { Mic, MicOff, Brain, Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceStatusProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error' | 'reconnecting';
  latency?: number;
  className?: string;
}

export function VoiceStatus({ state, latency, className }: VoiceStatusProps) {
  const getStatusConfig = () => {
    switch (state) {
      case 'listening':
        return {
          icon: Mic,
          label: 'Listening',
          color: 'text-green-400',
          bgColor: 'bg-green-400/10',
        };
      case 'thinking':
        return {
          icon: Brain,
          label: 'Thinking',
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10',
        };
      case 'speaking':
        return {
          icon: Volume2,
          label: 'Speaking',
          color: 'text-purple-400',
          bgColor: 'bg-purple-400/10',
        };
      case 'interrupted':
        return {
          icon: MicOff,
          label: 'Interrupted',
          color: 'text-orange-400',
          bgColor: 'bg-orange-400/10',
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
        };
      case 'reconnecting':
        return {
          icon: Loader2,
          label: 'Reconnecting',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/10',
        };
      default:
        return {
          icon: MicOff,
          label: 'Idle',
          color: 'text-gray-400',
          bgColor: 'bg-gray-400/10',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('p-2 rounded-full', config.bgColor)}>
        {state === 'thinking' ? (
          <Loader2 className={cn('w-4 h-4 animate-spin', config.color)} />
        ) : (
          <Icon className={cn('w-4 h-4', config.color)} />
        )}
      </div>
      <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
      {latency !== undefined && latency > 0 && (
        <span className="text-xs text-gray-500 ml-2">{latency}ms</span>
      )}
    </div>
  );
}
