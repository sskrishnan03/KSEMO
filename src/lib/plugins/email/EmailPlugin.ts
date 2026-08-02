import { Plugin, PluginResult } from '../types';
import { getGmailService } from '../../google/GmailService';

export const EmailPlugin: Plugin = {
  config: {
    id: 'email',
    name: 'Email',
    description: 'Manage your Gmail with voice commands',
    version: '1.0.0',
    enabled: false,
    permissions: ['email.read', 'email.write', 'email.send'],
    settings: {
      defaultEmail: '',
      signature: '',
      autoReply: false,
    },
  },
  actions: [
    {
      id: 'compose',
      name: 'Compose Email',
      description: 'Compose a new email',
      voiceTriggers: ['compose email', 'write email', 'new email', 'create email', 'draft email'],
      parameters: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'body', type: 'string', required: true, description: 'Email body content' },
        { name: 'cc', type: 'string', required: false, description: 'CC recipients' },
        { name: 'bcc', type: 'string', required: false, description: 'BCC recipients' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const gmailService = getGmailService();
          const draft = await gmailService.createDraft(
            params.to,
            params.subject,
            params.body,
            params.cc,
            params.bcc
          );

          return {
            success: true,
            data: draft,
            voiceResponse: `Email draft created to ${params.to} with subject "${params.subject}". Would you like to send it?`,
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
      id: 'send',
      name: 'Send Email',
      description: 'Send a composed email',
      voiceTriggers: ['send email', 'send it', 'send the email'],
      parameters: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'body', type: 'string', required: true, description: 'Email body content' },
        { name: 'cc', type: 'string', required: false, description: 'CC recipients' },
        { name: 'bcc', type: 'string', required: false, description: 'BCC recipients' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const gmailService = getGmailService();
          const sent = await gmailService.sendMessage(
            params.to,
            params.subject,
            params.body,
            params.cc,
            params.bcc
          );

          return {
            success: true,
            data: sent,
            voiceResponse: `Email sent successfully to ${params.to}`,
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
      id: 'read',
      name: 'Read Emails',
      description: 'Read your recent emails',
      voiceTriggers: ['read emails', 'check emails', 'show emails', 'my emails', 'inbox'],
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Number of emails to show', default: 5 },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const gmailService = getGmailService();
          const messages = await gmailService.listMessages(params.limit);

          if (messages.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: 'You have no emails in your inbox',
            };
          }

          const summary = messages.map((msg: any) => {
            const subject = msg.payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No subject';
            const from = msg.payload.headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
            return `${subject} from ${from}`;
          }).join('. ');

          return {
            success: true,
            data: messages,
            voiceResponse: `You have ${messages.length} emails. ${summary}`,
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
      id: 'reply',
      name: 'Reply to Email',
      description: 'Reply to an email',
      voiceTriggers: ['reply', 'reply to email', 'reply to'],
      parameters: [
        { name: 'body', type: 'string', required: true, description: 'Reply content' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const gmailService = getGmailService();
          const messages = await gmailService.listMessages(1);
          
          if (messages.length === 0) {
            return {
              success: false,
              error: 'No emails found to reply to',
            };
          }

          const lastEmail = messages[0];
          const subject = lastEmail.payload.headers.find((h: any) => h.name === 'Subject')?.value || '';
          const from = lastEmail.payload.headers.find((h: any) => h.name === 'From')?.value || '';

          const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
          const replyBody = `\n\nOn ${new Date(parseInt(lastEmail.internalDate)).toLocaleDateString()}, ${from} wrote:\n${lastEmail.snippet}`;

          const draft = await gmailService.createDraft(
            from,
            replySubject,
            params.body + replyBody
          );

          return {
            success: true,
            data: draft,
            voiceResponse: `Reply composed. Would you like to send it?`,
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
      id: 'search',
      name: 'Search Emails',
      description: 'Search through your emails',
      voiceTriggers: ['search emails', 'find email', 'search for', 'find'],
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search query' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const gmailService = getGmailService();
          const messages = await gmailService.searchMessages(params.query);

          if (messages.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: `No emails found matching "${params.query}"`,
            };
          }

          const summary = messages.map((msg: any) => {
            const subject = msg.payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No subject';
            return subject;
          }).join(', ');

          return {
            success: true,
            data: messages,
            voiceResponse: `Found ${messages.length} emails: ${summary}`,
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
