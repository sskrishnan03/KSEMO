import { Plugin, PluginResult } from '../types';
import { getCustomSearchService } from '../../google/CustomSearchService';

export const WebSearchPlugin: Plugin = {
  config: {
    id: 'websearch',
    name: 'Web Search',
    description: 'Search the web using Google Custom Search',
    version: '1.0.0',
    enabled: false,
    permissions: ['web.search'],
    settings: {
      defaultEngine: 'google',
    },
  },
  actions: [
    {
      id: 'search',
      name: 'Search Web',
      description: 'Search the web for information',
      voiceTriggers: ['search', 'google', 'look up', 'find on web', 'web search'],
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search query' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const searchService = getCustomSearchService();
          const results = await searchService.search(params.query);

          if (results.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: `No results found for "${params.query}"`,
            };
          }

          return {
            success: true,
            data: results,
            voiceResponse: `I found ${results.length} results for "${params.query}". The top result is ${results[0].title}.`,
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
