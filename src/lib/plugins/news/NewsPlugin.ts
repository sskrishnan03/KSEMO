import { Plugin, PluginResult } from '../types';

export const NewsPlugin: Plugin = {
  config: {
    id: 'news',
    name: 'News',
    description: 'Get news headlines and summaries',
    version: '1.0.0',
    enabled: false,
    permissions: ['news.read'],
    settings: {
      defaultCategory: 'general',
      sources: [],
    },
  },
  actions: [
    {
      id: 'headlines',
      name: 'Get Headlines',
      description: 'Get latest news headlines',
      voiceTriggers: ['news', 'headlines', 'latest news', 'what\'s happening'],
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Number of headlines', default: 5 },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          // In production, integrate with news API (NewsAPI, etc.)
          // For demo, return simulated headlines
          const headlines = [
            { title: 'Tech Giants Announce New AI Partnership', source: 'Tech News' },
            { title: 'Global Markets Rally Amid Economic Optimism', source: 'Financial Times' },
            { title: 'Breakthrough in Renewable Energy Storage', source: 'Science Daily' },
            { title: 'New Health Guidelines Released by WHO', source: 'Health News' },
            { title: 'Sports Championship Finals This Weekend', source: 'Sports Daily' },
          ].slice(0, params.limit);

          const summary = headlines.map((h: any) => h.title).join('. ');
          return {
            success: true,
            data: headlines,
            voiceResponse: `Here are the top ${headlines.length} headlines: ${summary}`,
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
      id: 'summary',
      name: 'News Summary',
      description: 'Get a summary of today\'s news',
      voiceTriggers: ['news summary', 'summarize news', 'what\'s new'],
      parameters: [],
      handler: async (): Promise<PluginResult> => {
        try {
          const summary = `Today's top stories include major developments in artificial intelligence partnerships, positive movement in global financial markets, breakthrough advances in renewable energy technology, new health guidelines from the World Health Organization, and upcoming championship finals in sports.`;

          return {
            success: true,
            data: { summary },
            voiceResponse: summary,
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
