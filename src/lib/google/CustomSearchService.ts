import { getGoogleAuthService } from './GoogleAuthService';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export class CustomSearchService {
  private authService = getGoogleAuthService();
  private apiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || '';
  private cx = import.meta.env.VITE_GOOGLE_SEARCH_CX || '';

  async getAccessToken(): Promise<string> {
    return await this.authService.authenticate();
  }

  async search(query: string, numResults: number = 10, startIndex: number = 1): Promise<SearchResult[]> {
    if (!this.apiKey || !this.cx) {
      throw new Error('Google Custom Search API key and CX are required. Please set VITE_GOOGLE_SEARCH_API_KEY and VITE_GOOGLE_SEARCH_CX in your .env file.');
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.cx}&q=${encodeURIComponent(query)}&num=${numResults}&start=${startIndex}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Custom Search API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }
}

let instance: CustomSearchService | null = null;

export function getCustomSearchService(): CustomSearchService {
  if (!instance) {
    instance = new CustomSearchService();
  }
  return instance;
}
