import { Plugin, PluginContext, PluginRegistry, PluginResult, PluginAction } from './types';

class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private enabledPlugins: Set<string> = new Set();

  private static STORAGE_KEY = 'ksemo_enabled_plugins';
  private hasPersisted = false;

  private loadPersisted(): string[] {
    try {
      const raw = localStorage.getItem(PluginRegistryImpl.STORAGE_KEY);
      if (raw !== null) {
        this.hasPersisted = true;
        return JSON.parse(raw);
      }
    } catch {
      // ignore storage errors
    }
    return [];
  }

  private persist(): void {
    try {
      localStorage.setItem(
        PluginRegistryImpl.STORAGE_KEY,
        JSON.stringify(Array.from(this.enabledPlugins))
      );
      this.hasPersisted = true;
    } catch {
      // ignore storage errors
    }
  }

  register(plugin: Plugin): void {
    this.plugins.set(plugin.config.id, plugin);
    // Once the user has ever connected/disconnected a plugin, the persisted
    // list is the single source of truth. Until then, use config defaults so
    // plugins that need no account work straight out of the box.
    const persisted = this.loadPersisted();
    if (this.hasPersisted) {
      if (persisted.includes(plugin.config.id)) {
        this.enabledPlugins.add(plugin.config.id);
      }
    } else if (plugin.config.enabled) {
      this.enabledPlugins.add(plugin.config.id);
    }
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.destroy?.();
      this.plugins.delete(pluginId);
      this.enabledPlugins.delete(pluginId);
      this.persist();
    }
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): Plugin[] {
    return Array.from(this.enabledPlugins)
      .map(id => this.plugins.get(id))
      .filter((p): p is Plugin => p !== undefined);
  }

  enable(pluginId: string): void {
    if (this.plugins.has(pluginId)) {
      this.enabledPlugins.add(pluginId);
      this.persist();
    }
  }

  disable(pluginId: string): void {
    this.enabledPlugins.delete(pluginId);
    this.persist();
  }

  async executeAction(
    pluginId: string,
    actionId: string,
    params: Record<string, any>,
    context: PluginContext
  ): Promise<PluginResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        success: false,
        error: `Plugin ${pluginId} not found`,
      };
    }

    if (!this.enabledPlugins.has(pluginId)) {
      return {
        success: false,
        error: `Plugin ${pluginId} is disabled`,
      };
    }

    const action = plugin.actions.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        error: `Action ${actionId} not found in plugin ${pluginId}`,
      };
    }

    try {
      return await action.handler(params, context);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  findActionByVoiceTrigger(trigger: string): { plugin: Plugin; action: PluginAction } | null {
    const tokens = new Set(
      trigger.toLowerCase().split(/[^a-z0-9@.]+/).filter(Boolean)
    );

    let best: { plugin: Plugin; action: PluginAction; score: number } | null = null;

    for (const plugin of this.getEnabled()) {
      for (const action of plugin.actions) {
        for (const voiceTrigger of action.voiceTriggers) {
          const triggerWords = voiceTrigger.toLowerCase().split(/[^a-z0-9@.]+/).filter(Boolean);
          if (triggerWords.length === 0) continue;

          // A trigger matches when EVERY one of its words appears in the
          // transcript (allowing plural/singular forms). e.g. "send an email"
          // matches the "send email" trigger because "send" and "email" are
          // both present. More specific triggers win via the score.
          const matched = triggerWords.filter((w) =>
            [...tokens].some((t) => t === w || t.startsWith(w) || w.startsWith(t))
          ).length;

          if (matched === triggerWords.length && (!best || matched > best.score)) {
            best = { plugin, action, score: matched };
          }
        }
      }
    }

    return best ? { plugin: best.plugin, action: best.action } : null;
  }

  findActionByVoiceTriggerInAll(trigger: string): { plugin: Plugin; action: PluginAction; enabled: boolean } | null {
    const tokens = new Set(
      trigger.toLowerCase().split(/[^a-z0-9@.]+/).filter(Boolean)
    );

    let best: { plugin: Plugin; action: PluginAction; enabled: boolean; score: number } | null = null;

    for (const plugin of this.getAll()) {
      for (const action of plugin.actions) {
        for (const voiceTrigger of action.voiceTriggers) {
          const triggerWords = voiceTrigger.toLowerCase().split(/[^a-z0-9@.]+/).filter(Boolean);
          if (triggerWords.length === 0) continue;

          const matched = triggerWords.filter((w) =>
            [...tokens].some((t) => t === w || t.startsWith(w) || w.startsWith(t))
          ).length;

          if (matched === triggerWords.length && (!best || matched > best.score)) {
            best = {
              plugin,
              action,
              enabled: this.enabledPlugins.has(plugin.config.id),
              score: matched,
            };
          }
        }
      }
    }

    return best ? { plugin: best.plugin, action: best.action, enabled: best.enabled } : null;
  }
}

let instance: PluginRegistryImpl | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (!instance) {
    instance = new PluginRegistryImpl();
  }
  return instance;
}
