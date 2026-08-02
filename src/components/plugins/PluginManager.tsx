import { useState } from 'react';
import { X, Check, ChevronDown, ChevronRight, Zap, Mail, Calendar, FileText, CheckSquare, Cloud, Newspaper, Calculator, Clock, Search } from 'lucide-react';
import { getPluginRegistry } from '../../lib/plugins';

interface PluginManagerProps {
  onClose: () => void;
}

const PLUGIN_ICONS: Record<string, any> = {
  email: Mail,
  calendar: Calendar,
  notes: FileText,
  tasks: CheckSquare,
  weather: Cloud,
  news: Newspaper,
  calculator: Calculator,
  timer: Clock,
  websearch: Search,
};

export function PluginManager({ onClose }: PluginManagerProps) {
  const registry = getPluginRegistry();
  const [plugins, setPlugins] = useState(registry.getAll());
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);

  const togglePlugin = (pluginId: string) => {
    const plugin = registry.get(pluginId);
    if (plugin) {
      if (plugin.config.enabled) {
        registry.disable(pluginId);
      } else {
        registry.enable(pluginId);
      }
      setPlugins(registry.getAll());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Plugins</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="space-y-3">
          {plugins.map((plugin) => {
            const Icon = PLUGIN_ICONS[plugin.config.id] || Zap;
            const isExpanded = expandedPlugin === plugin.config.id;
            
            return (
              <div key={plugin.config.id} className="bg-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedPlugin(isExpanded ? null : plugin.config.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${plugin.config.enabled ? 'bg-white/20' : 'bg-white/5'}`}>
                      <Icon className={`w-5 h-5 ${plugin.config.enabled ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white">{plugin.config.name}</p>
                      <p className="text-sm text-gray-400">{plugin.config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlugin(plugin.config.id);
                      }}
                      className={`p-2 rounded-full transition-colors ${
                        plugin.config.enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/10 pt-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-300 mb-2">Available Actions</p>
                        <div className="space-y-2">
                          {plugin.actions.map((action) => (
                            <div key={action.id} className="bg-white/5 rounded-lg p-3">
                              <p className="text-sm font-medium text-white">{action.name}</p>
                              <p className="text-xs text-gray-400 mt-1">{action.description}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {action.voiceTriggers.slice(0, 3).map((trigger) => (
                                  <span key={trigger} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                                    "{trigger}"
                                  </span>
                                ))}
                                {action.voiceTriggers.length > 3 && (
                                  <span className="text-xs text-gray-500 px-2 py-0.5">
                                    +{action.voiceTriggers.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Version: {plugin.config.version}</span>
                        <span>•</span>
                        <span>{plugin.actions.length} actions</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-white/5 rounded-xl">
          <p className="text-sm text-gray-400">
            <strong className="text-white">Tip:</strong> Say commands like "add task buy groceries", "check weather", or "set timer for 5 minutes" to use plugins with voice.
          </p>
        </div>
      </div>
    </div>
  );
}
