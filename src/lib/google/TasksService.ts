import { getGoogleAuthService } from './GoogleAuthService';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  completed?: string;
  status: 'needsAction' | 'completed';
}

export class TasksService {
  private authService = getGoogleAuthService();
  private baseUrl = 'https://www.googleapis.com/tasks/v1/lists/@default/tasks';

  async getAccessToken(): Promise<string> {
    return await this.authService.authenticate();
  }

  async listTasks(maxResults: number = 100, showCompleted: boolean = false): Promise<Task[]> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `${this.baseUrl}?maxResults=${maxResults}&showCompleted=${showCompleted}&showHidden=false`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Tasks API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  async createTask(title: string, notes?: string, due?: string): Promise<Task> {
    const token = await this.getAccessToken();
    
    const task: any = {
      title,
      status: 'needsAction',
    };

    if (notes) task.notes = notes;
    if (due) task.due = due;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Tasks API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Tasks API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async completeTask(taskId: string): Promise<Task> {
    return await this.updateTask(taskId, {
      status: 'completed',
      completed: new Date().toISOString(),
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tasks API error: ${response.statusText}`);
    }
  }

  async clearCompleted(): Promise<void> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tasks API error: ${response.statusText}`);
    }
  }
}

let instance: TasksService | null = null;

export function getTasksService(): TasksService {
  if (!instance) {
    instance = new TasksService();
  }
  return instance;
}
