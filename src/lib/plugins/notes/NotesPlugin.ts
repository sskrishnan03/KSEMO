import { Plugin, PluginResult } from '../types';
import { getNotesStorage } from './NotesStorage';

export const NotesPlugin: Plugin = {
  config: {
    id: 'notes',
    name: 'Notes',
    description: 'Create and manage your notes',
    version: '1.0.0',
    enabled: false,
    permissions: ['notes.read', 'notes.write'],
    settings: {
      defaultFolder: 'general',
    },
  },
  actions: [
    {
      id: 'createNote',
      name: 'Create Note',
      description: 'Create a new note',
      voiceTriggers: ['create note', 'take a note', 'write note', 'save note', 'new note'],
      parameters: [
        { name: 'content', type: 'string', required: true, description: 'Note content' },
        { name: 'title', type: 'string', required: false, description: 'Note title' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const storage = getNotesStorage();
          const title = params.title || params.content.slice(0, 50);

          const note = await storage.createNote(title, params.content);

          return {
            success: true,
            data: note,
            voiceResponse: `Note "${title}" saved`,
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
      id: 'listNotes',
      name: 'List Notes',
      description: 'List your notes',
      voiceTriggers: ['show notes', 'my notes', 'list notes', 'read notes'],
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Number of notes', default: 10 },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const storage = getNotesStorage();
          const notes = await storage.listNotes(params.limit);

          if (notes.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: 'No notes found',
            };
          }

          const summary = notes.map((n: any) => n.title).join(', ');
          return {
            success: true,
            data: notes,
            voiceResponse: `You have ${notes.length} notes: ${summary}`,
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
      id: 'searchNotes',
      name: 'Search Notes',
      description: 'Search through your notes',
      voiceTriggers: ['search notes', 'find note', 'search for'],
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search query' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const storage = getNotesStorage();
          const notes = await storage.searchNotes(params.query);

          if (notes.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: `No notes found matching "${params.query}"`,
            };
          }

          return {
            success: true,
            data: notes,
            voiceResponse: `Found ${notes.length} notes`,
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
      id: 'deleteNote',
      name: 'Delete Note',
      description: 'Delete a note',
      voiceTriggers: ['delete note', 'remove note'],
      parameters: [
        { name: 'title', type: 'string', required: true, description: 'Note title' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const storage = getNotesStorage();
          const notes = await storage.listNotes(100);

          const note = notes.find((n: any) => n.title.toLowerCase() === params.title.toLowerCase());

          if (!note) {
            return {
              success: false,
              error: 'Note not found',
            };
          }

          await storage.deleteNote(note.id);

          return {
            success: true,
            data: note,
            voiceResponse: `Note "${params.title}" deleted`,
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
