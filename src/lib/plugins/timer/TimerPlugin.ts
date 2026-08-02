import { Plugin, PluginResult } from '../types';

export const TimerPlugin: Plugin = {
  config: {
    id: 'timer',
    name: 'Timer',
    description: 'Set timers and alarms',
    version: '1.0.0',
    enabled: false,
    permissions: [],
    settings: {},
  },
  actions: [
    {
      id: 'setTimer',
      name: 'Set Timer',
      description: 'Set a countdown timer',
      voiceTriggers: ['set timer', 'timer for', 'countdown', 'alarm in'],
      parameters: [
        { name: 'minutes', type: 'number', required: false, description: 'Minutes' },
        { name: 'seconds', type: 'number', required: false, description: 'Seconds' },
        { name: 'label', type: 'string', required: false, description: 'Timer label' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const minutes = params.minutes || 0;
          const seconds = params.seconds || 0;
          const totalSeconds = minutes * 60 + seconds;

          if (totalSeconds === 0) {
            return {
              success: false,
              error: 'Please specify a duration',
            };
          }

          const timer = {
            id: Date.now(),
            label: params.label || 'Timer',
            duration: totalSeconds,
            endTime: new Date(Date.now() + totalSeconds * 1000).toISOString(),
            completed: false,
          };

          const timers = JSON.parse(localStorage.getItem('ksemo_timers') || '[]');
          timers.push(timer);
          localStorage.setItem('ksemo_timers', JSON.stringify(timers));

          // Start the timer
          setTimeout(() => {
            timer.completed = true;
            const updatedTimers = JSON.parse(localStorage.getItem('ksemo_timers') || '[]');
            const index = updatedTimers.findIndex((t: any) => t.id === timer.id);
            if (index !== -1) {
              updatedTimers[index] = timer;
              localStorage.setItem('ksemo_timers', JSON.stringify(updatedTimers));
            }
          }, totalSeconds * 1000);

          const durationText = minutes > 0 
            ? `${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} second${seconds > 1 ? 's' : ''}` : ''}`
            : `${seconds} second${seconds > 1 ? 's' : ''}`;

          return {
            success: true,
            data: timer,
            voiceResponse: `Timer set for ${durationText}`,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },
    },
    {
      id: 'setAlarm',
      name: 'Set Alarm',
      description: 'Set an alarm for a specific time',
      voiceTriggers: ['set alarm', 'alarm at', 'wake me up at'],
      parameters: [
        { name: 'time', type: 'string', required: true, description: 'Time (HH:MM or "7am")' },
        { name: 'label', type: 'string', required: false, description: 'Alarm label' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const time = params.time.toLowerCase();
          let hours: number | undefined, minutes: number | undefined;

          if (time.includes('am') || time.includes('pm')) {
            const match = time.match(/(\d+):?(\d+)?\s*(am|pm)/);
            if (match) {
              hours = parseInt(match[1]);
              minutes = match[2] ? parseInt(match[2]) : 0;
              if (match[3] === 'pm' && hours !== 12) hours += 12;
              if (match[3] === 'am' && hours === 12) hours = 0;
            }
          } else {
            const match = time.match(/(\d+):(\d+)/);
            if (match) {
              hours = parseInt(match[1]);
              minutes = parseInt(match[2]);
            }
          }

          if (hours === undefined || minutes === undefined) {
            return {
              success: false,
              error: 'Invalid time format',
            };
          }

          const now = new Date();
          const alarmTime = new Date();
          alarmTime.setHours(hours, minutes, 0, 0);

          if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
          }

          const alarm = {
            id: Date.now(),
            label: params.label || 'Alarm',
            time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
            alarmTime: alarmTime.toISOString(),
            completed: false,
          };

          const alarms = JSON.parse(localStorage.getItem('ksemo_alarms') || '[]');
          alarms.push(alarm);
          localStorage.setItem('ksemo_alarms', JSON.stringify(alarms));

          const timeUntil = Math.floor((alarmTime.getTime() - now.getTime()) / 60000);
          const hoursUntil = Math.floor(timeUntil / 60);
          const minsUntil = timeUntil % 60;

          let timeText = '';
          if (hoursUntil > 0) {
            timeText = `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} and ${minsUntil} minute${minsUntil > 1 ? 's' : ''}`;
          } else {
            timeText = `${minsUntil} minute${minsUntil > 1 ? 's' : ''}`;
          }

          return {
            success: true,
            data: alarm,
            voiceResponse: `Alarm set for ${alarm.time}. That's ${timeText} from now.`,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },
    },
  ],
};
