import { Plugin, PluginResult } from '../types';
import { getCalendarService } from '../../google/CalendarService';

export const CalendarPlugin: Plugin = {
  config: {
    id: 'calendar',
    name: 'Calendar',
    description: 'Manage your Google Calendar with voice commands',
    version: '1.0.0',
    enabled: false,
    permissions: ['calendar.read', 'calendar.write'],
    settings: {
      defaultCalendar: 'primary',
      reminderMinutes: 15,
    },
  },
  actions: [
    {
      id: 'createEvent',
      name: 'Create Event',
      description: 'Create a new calendar event',
      voiceTriggers: ['create event', 'add event', 'schedule event', 'new event', 'add to calendar'],
      parameters: [
        { name: 'title', type: 'string', required: true, description: 'Event title' },
        { name: 'date', type: 'string', required: true, description: 'Event date (YYYY-MM-DD or "tomorrow", "next Monday")' },
        { name: 'time', type: 'string', required: false, description: 'Event time (HH:MM or "3pm")' },
        { name: 'duration', type: 'number', required: false, description: 'Duration in minutes', default: 60 },
        { name: 'description', type: 'string', required: false, description: 'Event description' },
        { name: 'location', type: 'string', required: false, description: 'Event location' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const calendarService = getCalendarService();
          
          // Parse date and time
          let startDate = params.date;
          let startTime = params.time || '09:00';
          const duration = params.duration || 60;
          
          // Handle relative dates
          if (startDate.toLowerCase() === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            startDate = tomorrow.toISOString().split('T')[0];
          } else if (startDate.toLowerCase() === 'today') {
            startDate = new Date().toISOString().split('T')[0];
          }

          // Format start and end times
          const startDateTime = startTime.includes('T') ? startTime : `${startDate}T${startTime}:00`;
          const endDate = new Date(new Date(startDateTime).getTime() + duration * 60000);
          const endDateTime = endDate.toISOString();

          const event = await calendarService.createEvent(
            params.title,
            startDateTime,
            endDateTime,
            params.description,
            params.location
          );

          return {
            success: true,
            data: event,
            voiceResponse: `Event "${params.title}" scheduled for ${startDate}${params.time ? ' at ' + params.time : ''}`,
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
      id: 'listEvents',
      name: 'List Events',
      description: 'List your upcoming events',
      voiceTriggers: ['show events', 'my events', 'upcoming events', 'what\'s on my calendar', 'my schedule'],
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Number of events to show', default: 10 },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const calendarService = getCalendarService();
          const events = await calendarService.listEvents(params.limit);

          if (events.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: 'No upcoming events',
            };
          }

          const summary = events.map((e: any) => {
            const date = e.start.date || e.start.dateTime?.split('T')[0];
            const time = e.start.dateTime?.split('T')[1]?.substring(0, 5) || '';
            return `${e.summary} on ${date}${time ? ' at ' + time : ''}`;
          }).join(', ');

          return {
            success: true,
            data: events,
            voiceResponse: `You have ${events.length} event${events.length > 1 ? 's' : ''}: ${summary}`,
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
      id: 'checkAvailability',
      name: 'Check Availability',
      description: 'Check your availability on a specific date',
      voiceTriggers: ['am i free', 'check availability', 'am i available', 'do i have time'],
      parameters: [
        { name: 'date', type: 'string', required: true, description: 'Date to check' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const calendarService = getCalendarService();
          
          // Handle relative dates
          let checkDate = params.date;
          if (checkDate.toLowerCase() === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            checkDate = tomorrow.toISOString().split('T')[0];
          } else if (checkDate.toLowerCase() === 'today') {
            checkDate = new Date().toISOString().split('T')[0];
          }

          const events = await calendarService.listEvents(50, `${checkDate}T00:00:00Z`);
          const dayEvents = events.filter((e: any) => {
            const eventDate = e.start.date || e.start.dateTime?.split('T')[0];
            return eventDate === checkDate;
          });

          if (dayEvents.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: `You are free all day on ${checkDate}`,
            };
          }

          const summary = dayEvents.map((e: any) => {
            const time = e.start.dateTime?.split('T')[1]?.substring(0, 5) || 'all day';
            return `${e.summary} at ${time}`;
          }).join(', ');

          return {
            success: true,
            data: dayEvents,
            voiceResponse: `You have ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} on ${checkDate}: ${summary}`,
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
      id: 'deleteEvent',
      name: 'Delete Event',
      description: 'Delete a calendar event',
      voiceTriggers: ['delete event', 'remove event', 'cancel event'],
      parameters: [
        { name: 'title', type: 'string', required: true, description: 'Event title to delete' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const calendarService = getCalendarService();
          const events = await calendarService.listEvents(50);
          
          const event = events.find((e: any) => e.summary.toLowerCase() === params.title.toLowerCase());
          
          if (!event) {
            return {
              success: false,
              error: 'Event not found',
            };
          }

          await calendarService.deleteEvent(event.id);

          return {
            success: true,
            data: event,
            voiceResponse: `Event "${params.title}" deleted`,
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
