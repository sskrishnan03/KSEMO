import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon, Unlink, Check, ArrowRight, Loader2, Shield, Mic, AlertCircle
} from 'lucide-react';
import { getPluginRegistry } from '../../lib/plugins';
import { getGoogleAuthService, GoogleAuthService } from '../../lib/google/GoogleAuthService';
import {
  EmailLogo, CalendarLogo, TasksLogo, NotesLogo,
  WeatherLogo, NewsLogo, CalculatorLogo, TimerLogo, WebSearchLogo
} from './PluginLogos';

interface PluginExample {
  command: string;
  response: string;
}

interface PluginDetail {
  id: string;
  name: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  color: string;
  category: string;
  howItWorks: string[];
  about: string;
  requiresAuth: boolean;
  authType?: 'google' | 'api' | 'none';
  keywords: string[];
  examples: PluginExample[];
}

const pluginDetails: Record<string, PluginDetail> = {
  email: {
    id: 'email',
    name: 'Email',
    description: 'Send, read, and manage your Gmail',
    icon: EmailLogo,
    color: 'bg-blue-500',
    category: 'Communication',
    howItWorks: [
      'Click "Connect" and sign in with your Google account in the popup.',
      'Allow access to Gmail when Google asks for permission.',
      'Once connected, just talk or type a command that starts with "send email", "read emails", or "search emails".',
      'Your emails are fetched live from Gmail — no manual syncing needed.',
      'To stop using the plugin, click "Disconnect" at any time.'
    ],
    about: 'Connect your Gmail account to send, receive, and manage emails using voice commands. Supports composing, reading, replying, and searching through your inbox.',
    requiresAuth: true,
    authType: 'google',
    keywords: ['email', 'mail', 'gmail', 'message'],
    examples: [
      {
        command: '"Send email to john@example.com with subject Meeting and body Are you free tomorrow?"',
        response: '✅ Email sent successfully to john@example.com'
      },
      {
        command: '"Read my emails"',
        response: '📬 You have 5 emails. Project update from Sarah, Invoice from Acme Inc...'
      }
    ]
  },
  calendar: {
    id: 'calendar',
    name: 'Calendar',
    description: 'Manage your Google Calendar events',
    icon: CalendarLogo,
    color: 'bg-green-500',
    category: 'Productivity',
    howItWorks: [
      'Click "Connect" and sign in with your Google account in the popup.',
      'Allow access to your Calendar when Google asks for permission.',
      'Use commands like "create event", "show events", or "am I free tomorrow?".',
      'Events are created and read straight from your Google Calendar.',
      'To stop using the plugin, click "Disconnect" at any time.'
    ],
    about: 'Connect your Google Calendar to create, view, and manage events. Check availability, schedule meetings, and keep track of your schedule with voice commands.',
    requiresAuth: true,
    authType: 'google',
    keywords: ['calendar', 'event', 'schedule', 'meeting', 'appointment'],
    examples: [
      {
        command: '"Create event Team sync tomorrow at 2pm"',
        response: '✅ Event "Team sync" scheduled for tomorrow at 2:00 PM'
      },
      {
        command: '"What\'s on my calendar this week?"',
        response: '📅 You have 3 events: Team sync on Monday, Client call on Wednesday...'
      }
    ]
  },
  tasks: {
    id: 'tasks',
    name: 'Tasks',
    description: 'Manage your Google Tasks',
    icon: TasksLogo,
    color: 'bg-purple-500',
    category: 'Productivity',
    howItWorks: [
      'Click "Connect" and sign in with your Google account in the popup.',
      'Allow access to your Tasks when Google asks for permission.',
      'Use commands like "add task", "show tasks", or "complete task".',
      'Tasks stay in sync with Google Tasks across all your devices.',
      'To stop using the plugin, click "Disconnect" at any time.'
    ],
    about: 'Connect Google Tasks to create and manage your to-do lists. Add, complete, and delete tasks using simple voice commands.',
    requiresAuth: true,
    authType: 'google',
    keywords: ['task', 'todo', 'to-do', 'reminder'],
    examples: [
      {
        command: '"Add task Call mom tomorrow"',
        response: '✅ Task "Call mom" added to your Google Tasks'
      },
      {
        command: '"What do I need to do?"',
        response: '📋 You have 3 tasks: Call mom, Buy groceries, Finish report'
      }
    ]
  },
  notes: {
    id: 'notes',
    name: 'Notes',
    description: 'Create and manage your notes',
    icon: NotesLogo,
    color: 'bg-yellow-500',
    category: 'Productivity',
    howItWorks: [
      'Notes are stored locally in your browser — no account needed.',
      'Click "Connect" to enable the plugin.',
      'Use commands like "create note", "show notes", or "search notes".',
      'Notes are saved instantly and available across your sessions on this device.'
    ],
    about: 'Create, search, and manage notes with voice commands. Capture ideas, meeting notes, and important information without ever leaving your conversation.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['note', 'keep', 'memo', 'remember'],
    examples: [
      {
        command: '"Create note Meeting notes: discuss project timeline"',
        response: '✅ Note "Meeting notes: discuss project timeline" saved'
      },
      {
        command: '"Show notes"',
        response: '🗒️ You have 2 notes: Meeting notes, Shopping list'
      }
    ]
  },
  weather: {
    id: 'weather',
    name: 'Weather',
    description: 'Get weather forecasts and conditions',
    icon: WeatherLogo,
    color: 'bg-cyan-500',
    category: 'Information',
    howItWorks: [
      'Click "Connect" to enable the plugin.',
      'Ask for conditions in any city: "Weather in London".',
      'Ask for a forecast: "Forecast for tomorrow".',
      'You can even combine it with other commands like travel planning.'
    ],
    about: 'Get real-time weather information and forecasts for any location worldwide. Includes temperature, conditions, and future predictions.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['weather', 'forecast', 'temperature', 'climate'],
    examples: [
      {
        command: '"Weather in London"',
        response: '⛅ Currently in London, it\'s 22 degrees and partly cloudy'
      },
      {
        command: '"Forecast for tomorrow"',
        response: '🌤️ Tomorrow: sunny, high 25, low 18'
      }
    ]
  },
  news: {
    id: 'news',
    name: 'News',
    description: 'Get latest news headlines and summaries',
    icon: NewsLogo,
    color: 'bg-orange-500',
    category: 'Information',
    howItWorks: [
      'Click "Connect" to enable the plugin.',
      'Ask "Latest news" for the top headlines.',
      'Ask "Tech news" or "Sports news" for a specific category.',
      'Each answer reads the headlines out loud and shows them on screen.'
    ],
    about: 'Stay updated with the latest news from various categories including technology, sports, business, and more.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['news', 'headlines', 'updates', 'breaking'],
    examples: [
      {
        command: '"Latest news"',
        response: '📰 Here are the top 5 headlines: Tech Giants Announce New AI Partnership...'
      },
      {
        command: '"News summary"',
        response: '🗞️ Today\'s top stories include major developments in artificial intelligence...'
      }
    ]
  },
  calculator: {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform calculations and conversions',
    icon: CalculatorLogo,
    color: 'bg-pink-500',
    category: 'Utilities',
    howItWorks: [
      'Click "Connect" to enable the plugin.',
      'Ask math questions: "Calculate 25 times 4".',
      'Ask for conversions: "Convert 50 dollars to euros".',
      'Results are spoken back and shown on screen.'
    ],
    about: 'Perform mathematical calculations and unit conversions instantly. Supports basic arithmetic and common conversions.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['calculate', 'compute', 'math', 'convert'],
    examples: [
      {
        command: '"What is 25 times 4?"',
        response: '🧮 25 times 4 equals 100'
      },
      {
        command: '"Convert 10 kg to lbs"',
        response: '⚖️ 10 kg is 22.05 lbs'
      }
    ]
  },
  timer: {
    id: 'timer',
    name: 'Timer',
    description: 'Set countdown timers and alarms',
    icon: TimerLogo,
    color: 'bg-red-500',
    category: 'Utilities',
    howItWorks: [
      'Click "Connect" to enable the plugin.',
      'Say "Set timer for 5 minutes" to start a countdown.',
      'Say "Set alarm for 9am" to create an alarm.',
      'Say "Stop timer" to cancel a running timer.'
    ],
    about: 'Set countdown timers and alarms to help you manage time. Great for cooking, workouts, reminders, and time-sensitive tasks.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['timer', 'alarm', 'countdown', 'reminder'],
    examples: [
      {
        command: '"Set timer for 5 minutes"',
        response: '⏱️ Timer set for 5 minutes'
      },
      {
        command: '"Set alarm for 7am"',
        response: '⏰ Alarm set for 07:00. That\'s 8 hours from now'
      }
    ]
  },
  websearch: {
    id: 'websearch',
    name: 'Web Search',
    description: 'Search the web for information',
    icon: WebSearchLogo,
    color: 'bg-indigo-500',
    category: 'Information',
    howItWorks: [
      'Click "Connect" to enable the plugin.',
      'Say "Search for AI news" to find the latest articles.',
      'Say "Look up Python tutorial" to find resources.',
      'The top results are read back to you and shown on screen.'
    ],
    about: 'Search the web to find information, websites, and resources on any topic.',
    requiresAuth: false,
    authType: 'none',
    keywords: ['search', 'google', 'find', 'look up', 'web'],
    examples: [
      {
        command: '"Search for latest AI news"',
        response: '🔍 I found 10 results. The top result is "AI Breakthroughs in 2026"...'
      },
      {
        command: '"Look up best restaurants nearby"',
        response: '🍽️ Here are the top results for "best restaurants nearby"...'
      }
    ]
  }
};

const GOOGLE_PLUGINS = ['email', 'calendar', 'tasks'];

export function PluginWorkspace() {
  const [selectedPlugin, setSelectedPlugin] = useState<PluginDetail | null>(null);
  const [connectedPlugins, setConnectedPlugins] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthService | null>(null);

  useEffect(() => {
    const auth = getGoogleAuthService();
    setGoogleAuth(auth);

    const checkConnections = async () => {
      const connected = new Set<string>();

      // Check Google OAuth
      if (await auth.isAuthenticated()) {
        GOOGLE_PLUGINS.forEach(id => connected.add(id));
      }

      // Check other enabled plugins (persisted in the registry)
      const registry = getPluginRegistry();
      const enabled = registry.getEnabled().map(p => p.config.id);
      enabled.forEach(id => connected.add(id));

      setConnectedPlugins(connected);
    };

    checkConnections();
  }, []);

  const handleConnect = async (plugin: PluginDetail) => {
    setConnectingId(plugin.id);
    setConnectionError(null);

    try {
      const registry = getPluginRegistry();

      if (plugin.authType === 'google') {
        await googleAuth?.authenticate();
        // Add all Google plugins when one is connected
        GOOGLE_PLUGINS.forEach(id => {
          registry.enable(id);
          setConnectedPlugins(prev => new Set(prev).add(id));
        });
      } else {
        // Enable non-Google plugins
        registry.enable(plugin.id);
        setConnectedPlugins(prev => new Set(prev).add(plugin.id));
      }
    } catch (error) {
      const message = (error as Error).message || 'Connection failed. Please try again.';
      setConnectionError(message);
      console.error('Connection error:', error);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (plugin: PluginDetail) => {
    setConnectingId(plugin.id);
    setConnectionError(null);

    try {
      const registry = getPluginRegistry();

      if (plugin.authType === 'google') {
        await googleAuth?.logout();
        // Remove all Google plugins when one is disconnected
        GOOGLE_PLUGINS.forEach(id => {
          registry.disable(id);
          setConnectedPlugins(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        });
      } else {
        // Disable non-Google plugins
        registry.disable(plugin.id);
        setConnectedPlugins(prev => {
          const newSet = new Set(prev);
          newSet.delete(plugin.id);
          return newSet;
        });
      }
    } catch (error) {
      const message = (error as Error).message || 'Disconnect failed. Please try again.';
      setConnectionError(message);
      console.error('Disconnect error:', error);
    } finally {
      setConnectingId(null);
    }
  };

  const isConnected = (pluginId: string) => connectedPlugins.has(pluginId);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {!selectedPlugin ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Plugins</h1>
              <p className="mt-2 text-ink-300">Connect and manage your voice assistant plugins.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(pluginDetails).map((plugin) => {
                const connected = isConnected(plugin.id);
                return (
                  <button
                    key={plugin.id}
                    onClick={() => setSelectedPlugin(plugin)}
                    className="group flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-4 hover:border-white/15 transition text-left"
                  >
                    <div className="h-12 w-12 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200">
                      {React.createElement(plugin.icon, { size: 24, className: 'text-ink-200' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[15px] text-white truncate">{plugin.name}</div>
                        {connected && (
                          <Check size={14} className="text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[12px] text-ink-300 truncate">{plugin.description}</div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-ink-400 bg-white/5 px-2 py-0.5 rounded-full">
                          {plugin.category}
                        </span>
                        {plugin.requiresAuth && (
                          <span className="text-[10px] text-ink-400 flex items-center gap-1">
                            <Shield size={10} /> Google
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-ink-300 group-hover:text-white transition shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => { setSelectedPlugin(null); setConnectionError(null); }}
              className="flex items-center gap-2 text-ink-400 hover:text-white transition mb-6"
            >
              <ArrowRight size={16} className="rotate-180" />
              <span>Back to all plugins</span>
            </button>

            {connectionError && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Could not connect</p>
                  <p className="mt-0.5 text-red-300/90">{connectionError}</p>
                </div>
              </div>
            )}

            <div className="bg-ink-850 rounded-2xl border border-white/8 overflow-hidden">
              {/* ── Header: icon left, Connect button on the right (inside the card) ── */}
              <div className="p-6 sm:p-8 border-b border-white/8">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className={`h-20 w-20 rounded-2xl ${selectedPlugin.color} flex items-center justify-center shrink-0 shadow-lg`}>
                    <selectedPlugin.icon size={40} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[11px] uppercase tracking-wider text-ink-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        {selectedPlugin.category}
                      </span>
                      {selectedPlugin.requiresAuth && (
                        <span className="text-[11px] text-ink-300 flex items-center gap-1">
                          <Shield size={11} /> Requires Google account
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold text-white mb-1">{selectedPlugin.name}</h2>
                    <p className="text-ink-300 text-sm">{selectedPlugin.description}</p>
                  </div>

                  <div className="shrink-0 sm:ml-4 flex sm:flex-col items-center gap-3">
                    {isConnected(selectedPlugin.id) ? (
                      <>
                        <button
                          onClick={() => handleDisconnect(selectedPlugin)}
                          disabled={connectingId === selectedPlugin.id}
                          className="flex items-center justify-center gap-2 w-40 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 text-sm font-medium"
                        >
                          {connectingId === selectedPlugin.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Unlink size={16} />
                          )}
                          <span>{connectingId === selectedPlugin.id ? 'Disconnecting...' : 'Disconnect'}</span>
                        </button>
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check size={13} />
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleConnect(selectedPlugin)}
                          disabled={connectingId === selectedPlugin.id}
                          className="flex items-center justify-center gap-2 w-40 px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 text-sm font-medium shadow-lg shadow-emerald-500/20"
                        >
                          {connectingId === selectedPlugin.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <LinkIcon size={16} />
                          )}
                          <span>{connectingId === selectedPlugin.id ? 'Connecting...' : 'Connect'}</span>
                        </button>
                        {!selectedPlugin.requiresAuth && (
                          <span className="text-[11px] text-ink-400">No account needed</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── How to use (step by step) ── */}
              <div className="p-6 sm:p-8 border-b border-white/8">
                <h4 className="text-lg font-semibold text-white mb-1">How to use</h4>
                <p className="text-sm text-ink-300 mb-5">Follow these steps to get started with {selectedPlugin.name}.</p>
                <ol className="space-y-3">
                  {selectedPlugin.howItWorks.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-ink-200">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* ── Example commands ── */}
              <div className="p-6 sm:p-8 border-b border-white/8">
                <h4 className="text-lg font-semibold text-white mb-1">Example commands</h4>
                <p className="text-sm text-ink-300 mb-5">Try these in your voice chat. Just say the command out loud or type it.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedPlugin.examples.map((example, i) => (
                    <div key={i} className="rounded-xl bg-ink-900 border border-white/8 p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-2.5">
                        <Mic size={14} className="shrink-0 mt-0.5 text-ink-300" />
                        <span className="text-[13px] text-white leading-relaxed">{example.command}</span>
                      </div>
                      <div className="flex items-start gap-2.5 pl-6">
                        <span className="shrink-0 mt-0.5 text-emerald-400 text-xs">↳</span>
                        <span className="text-[12px] text-ink-300 leading-relaxed">{example.response}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── About ── */}
              <div className="p-6 sm:p-8 border-b border-white/8">
                <h4 className="text-lg font-semibold text-white mb-3">About this plugin</h4>
                <p className="text-sm text-ink-300 leading-relaxed">{selectedPlugin.about}</p>
              </div>

              {/* ── Voice keywords ── */}
              <div className="p-6 sm:p-8">
                <h4 className="text-lg font-semibold text-white mb-1">Voice keywords</h4>
                <p className="text-sm text-ink-300 mb-3">
                  Start your command with one of these keywords to trigger {selectedPlugin.name}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedPlugin.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-ink-200"
                    >
                      "{keyword}"
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
