// Core plugin system types

export interface PluginContext {
  userId: string;
  voiceEngine: any;
  sendMessage: (message: string) => void;
}

export interface PluginConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  permissions: string[];
  settings?: Record<string, any>;
}

export interface PluginAction {
  id: string;
  name: string;
  description: string;
  voiceTriggers: string[];
  parameters: PluginParameter[];
  handler: (params: Record<string, any>, context: PluginContext) => Promise<PluginResult>;
}

export interface PluginParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
}

export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  voiceResponse?: string;
}

export interface Plugin {
  config: PluginConfig;
  actions: PluginAction[];
  initialize?(context: PluginContext): Promise<void>;
  destroy?(): Promise<void>;
  onSettingsChange?(settings: Record<string, any>): void;
}

export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): Plugin | undefined;
  getAll(): Plugin[];
  getEnabled(): Plugin[];
  enable(pluginId: string): void;
  disable(pluginId: string): void;
  executeAction(pluginId: string, actionId: string, params: Record<string, any>, context: PluginContext): Promise<PluginResult>;
  findActionByVoiceTrigger(trigger: string): { plugin: Plugin; action: PluginAction } | null;
  findActionByVoiceTriggerInAll(trigger: string): { plugin: Plugin; action: PluginAction; enabled: boolean } | null;
}
