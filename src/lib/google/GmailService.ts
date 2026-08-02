import { getGoogleAuthService } from './GoogleAuthService';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: any[];
  };
  internalDate: string;
}

export interface GmailDraft {
  id: string;
  message: {
    id: string;
    threadId: string;
    snippet: string;
  };
}

export class GmailService {
  private authService = getGoogleAuthService();
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

  async getAccessToken(): Promise<string> {
    return await this.authService.authenticate();
  }

  async listMessages(maxResults: number = 10, labelIds: string[] = ['INBOX']): Promise<GmailMessage[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `${this.baseUrl}/messages?maxResults=${maxResults}&labelIds=${labelIds.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    // Fetch full message details for each message
    const fullMessages = await Promise.all(
      messages.map((msg: any) => this.getMessage(msg.id))
    );

    return fullMessages;
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `${this.baseUrl}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async sendMessage(to: string, subject: string, body: string, cc?: string, bcc?: string): Promise<GmailMessage> {
    const token = await this.getAccessToken();
    
    const email = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      `${this.baseUrl}/messages/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async createDraft(to: string, subject: string, body: string, cc?: string, bcc?: string): Promise<GmailDraft> {
    const token = await this.getAccessToken();
    
    const email = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      `${this.baseUrl}/drafts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            raw: encodedEmail,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async searchMessages(query: string, maxResults: number = 10): Promise<GmailMessage[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `${this.baseUrl}/messages/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    const fullMessages = await Promise.all(
      messages.map((msg: any) => this.getMessage(msg.id))
    );

    return fullMessages;
  }
}

let instance: GmailService | null = null;

export function getGmailService(): GmailService {
  if (!instance) {
    instance = new GmailService();
  }
  return instance;
}
