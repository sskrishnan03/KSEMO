import { getPluginRegistry, PluginContext, PluginResult } from '../plugins';

export class PluginIntegrator {
  private pluginRegistry = getPluginRegistry();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async processVoiceCommand(transcript: string): Promise<PluginResult | null> {
    const match = this.pluginRegistry.findActionByVoiceTrigger(transcript);
    
    if (!match) {
      return null;
    }

    const { plugin, action } = match;
    
    // Extract parameters from transcript
    const params = this.extractParameters(transcript, action);
    
    // Execute the action
    const result = await this.pluginRegistry.executeAction(
      plugin.config.id,
      action.id,
      params,
      this.context
    );

    return result;
  }

  private extractParameters(transcript: string, action: any): Record<string, any> {
    const params: Record<string, any> = {};
    const lowerTranscript = transcript.toLowerCase();

    // Simple parameter extraction - in production, use NLP/LLM for better extraction
    for (const param of action.parameters) {
      if (param.name === 'to' && lowerTranscript.includes('to ')) {
        const match = lowerTranscript.match(/to\s+([^\s]+(?:\s+[^\s]+)?)/);
        if (match) params.to = match[1];
      } else if (param.name === 'from' && lowerTranscript.includes('from ')) {
        const match = lowerTranscript.match(/from\s+([^\s]+(?:\s+[^\s]+)?)/);
        if (match) params.from = match[1];
      } else if (param.name === 'value' && /\d+/.test(lowerTranscript)) {
        const match = lowerTranscript.match(/(\d+(?:\.\d+)?)/);
        if (match) params.value = parseFloat(match[1]);
      } else if (param.name === 'task' && lowerTranscript.length > 10) {
        // Extract task text after common triggers
        const triggers = ['add task', 'create task', 'new task', 'to do', 'remember to'];
        for (const trigger of triggers) {
          if (lowerTranscript.includes(trigger)) {
            const index = lowerTranscript.indexOf(trigger) + trigger.length;
            params.task = transcript.slice(index).trim();
            break;
          }
        }
      } else if (param.name === 'content' && lowerTranscript.length > 10) {
        const triggers = ['create note', 'take a note', 'write note', 'save note'];
        for (const trigger of triggers) {
          if (lowerTranscript.includes(trigger)) {
            const index = lowerTranscript.indexOf(trigger) + trigger.length;
            params.content = transcript.slice(index).trim();
            break;
          }
        }
      } else if (param.name === 'expression' && /\d+/.test(lowerTranscript)) {
        // Extract math expression
        const mathWords = ['calculate', 'what is', 'compute', 'solve'];
        for (const word of mathWords) {
          if (lowerTranscript.includes(word)) {
            const index = lowerTranscript.indexOf(word) + word.length;
            params.expression = transcript.slice(index).trim();
            break;
          }
        }
      } else if (param.name === 'query') {
        // Extract search query
        const triggers = ['search', 'google', 'look up', 'find'];
        for (const trigger of triggers) {
          if (lowerTranscript.includes(trigger)) {
            const index = lowerTranscript.indexOf(trigger) + trigger.length;
            params.query = transcript.slice(index).trim();
            break;
          }
        }
      } else if (param.name === 'location') {
        const triggers = ['weather', 'forecast'];
        for (const trigger of triggers) {
          if (lowerTranscript.includes(trigger)) {
            const index = lowerTranscript.indexOf(trigger) + trigger.length;
            const location = transcript.slice(index).trim().replace(/^(in|at|for)\s+/i, '');
            if (location) params.location = location;
            break;
          }
        }
      } else if (param.name === 'minutes' && /\d+\s*(minute|min)/i.test(lowerTranscript)) {
        const match = lowerTranscript.match(/(\d+)\s*(minute|min)/i);
        if (match) params.minutes = parseInt(match[1]);
      } else if (param.name === 'seconds' && /\d+\s*(second|sec)/i.test(lowerTranscript)) {
        const match = lowerTranscript.match(/(\d+)\s*(second|sec)/i);
        if (match) params.seconds = parseInt(match[1]);
      } else if (param.name === 'time' && /\d+/.test(lowerTranscript)) {
        const match = lowerTranscript.match(/(\d+(?::\d+)?(?:\s*(am|pm))?)/i);
        if (match) params.time = match[1];
      }
    }

    return params;
  }

  getAvailableActions(): Array<{ pluginId: string; pluginName: string; actionId: string; actionName: string; voiceTriggers: string[] }> {
    const actions: any[] = [];
    
    for (const plugin of this.pluginRegistry.getEnabled()) {
      for (const action of plugin.actions) {
        actions.push({
          pluginId: plugin.config.id,
          pluginName: plugin.config.name,
          actionId: action.id,
          actionName: action.name,
          voiceTriggers: action.voiceTriggers,
        });
      }
    }
    
    return actions;
  }
}
