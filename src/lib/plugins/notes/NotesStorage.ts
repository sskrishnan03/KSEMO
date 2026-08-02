export interface StoredNote {
  id: string;
  title: string;
  textContent?: string;
  createTime: string;
  updateTime: string;
}

const STORAGE_KEY = 'ksemo_notes';

function loadNotes(): StoredNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: StoredNote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export class NotesStorage {
  async listNotes(pageSize: number = 20): Promise<StoredNote[]> {
    return loadNotes().slice(0, pageSize);
  }

  async createNote(title: string, textContent?: string): Promise<StoredNote> {
    const now = new Date().toISOString();
    const note: StoredNote = {
      id: `note_${Date.now()}`,
      title,
      textContent,
      createTime: now,
      updateTime: now,
    };

    const notes = loadNotes();
    notes.unshift(note);
    saveNotes(notes);

    return note;
  }

  async deleteNote(noteId: string): Promise<void> {
    const notes = loadNotes().filter((n) => n.id !== noteId);
    saveNotes(notes);
  }

  async searchNotes(query: string): Promise<StoredNote[]> {
    const q = query.toLowerCase();
    return loadNotes().filter((n) =>
      n.title.toLowerCase().includes(q) ||
      (n.textContent?.toLowerCase().includes(q) ?? false)
    );
  }
}

let instance: NotesStorage | null = null;

export function getNotesStorage(): NotesStorage {
  if (!instance) {
    instance = new NotesStorage();
  }
  return instance;
}
