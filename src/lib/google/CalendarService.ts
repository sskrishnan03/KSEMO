import { getGoogleAuthService } from './GoogleAuthService';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  created: string;
  updated: string;
}

export class CalendarService {
  private authService = getGoogleAuthService();
  private baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary';

  async getAccessToken(): Promise<string> {
    return await this.authService.authenticate();
  }

  async listEvents(maxResults: number = 10, timeMin?: string): Promise<CalendarEvent[]> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}/events?maxResults=${maxResults}`;
    if (timeMin) {
      url += `&timeMin=${encodeURIComponent(timeMin)}`;
    }
    url += '&orderBy=startTime&singleEvents=true';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  async createEvent(summary: string, start: string, end: string, description?: string, location?: string): Promise<CalendarEvent> {
    const token = await this.getAccessToken();
    
    const event: any = {
      summary,
      start: {},
      end: {},
    };

    if (start.includes('T')) {
      event.start.dateTime = start;
      event.end.dateTime = end;
    } else {
      event.start.date = start;
      event.end.date = end;
    }

    if (description) event.description = description;
    if (location) event.location = location;

    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteEvent(eventId: string): Promise<void> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }
  }

  async getFreeBusy(timeMin: string, timeMax: string): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/freebusy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    return await response.json();
  }
}

let instance: CalendarService | null = null;

export function getCalendarService(): CalendarService {
  if (!instance) {
    instance = new CalendarService();
  }
  return instance;
}
