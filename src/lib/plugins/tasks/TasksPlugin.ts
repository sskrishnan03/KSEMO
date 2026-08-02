import { Plugin, PluginResult } from '../types';
import { getTasksService } from '../../google/TasksService';

export const TasksPlugin: Plugin = {
  config: {
    id: 'tasks',
    name: 'Tasks',
    description: 'Manage your Google Tasks with voice commands',
    version: '1.0.0',
    enabled: false,
    permissions: ['tasks.read', 'tasks.write'],
    settings: {
      defaultList: 'default',
    },
  },
  actions: [
    {
      id: 'addTask',
      name: 'Add Task',
      description: 'Add a new task to your to-do list',
      voiceTriggers: ['add task', 'create task', 'new task', 'to do', 'remember to'],
      parameters: [
        { name: 'task', type: 'string', required: true, description: 'Task description' },
        { name: 'dueDate', type: 'string', required: false, description: 'Due date' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const tasksService = getTasksService();
          
          let due: string | undefined;
          if (params.dueDate) {
            due = new Date(params.dueDate).toISOString();
          }

          const task = await tasksService.createTask(params.task, undefined, due);

          return {
            success: true,
            data: task,
            voiceResponse: `Task "${params.task}" added to your Google Tasks`,
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
      id: 'listTasks',
      name: 'List Tasks',
      description: 'List your tasks',
      voiceTriggers: ['show tasks', 'my tasks', 'to do list', 'what do i need to do'],
      parameters: [
        { name: 'filter', type: 'string', required: false, description: 'Filter by (all, completed, pending)', default: 'pending' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const tasksService = getTasksService();
          const showCompleted = params.filter === 'all' || params.filter === 'completed';
          const tasks = await tasksService.listTasks(100, showCompleted);

          let filtered = tasks;
          if (params.filter === 'pending') {
            filtered = tasks.filter((t: any) => t.status === 'needsAction');
          } else if (params.filter === 'completed') {
            filtered = tasks.filter((t: any) => t.status === 'completed');
          }

          if (filtered.length === 0) {
            return {
              success: true,
              data: [],
              voiceResponse: params.filter === 'completed' ? 'No completed tasks' : 'No pending tasks',
            };
          }

          const summary = filtered.map((t: any) => t.title).join(', ');
          return {
            success: true,
            data: filtered,
            voiceResponse: `You have ${filtered.length} task${filtered.length > 1 ? 's' : ''}: ${summary}`,
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
      id: 'completeTask',
      name: 'Complete Task',
      description: 'Mark a task as completed',
      voiceTriggers: ['complete task', 'done', 'task done', 'mark complete'],
      parameters: [
        { name: 'task', type: 'string', required: true, description: 'Task description' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const tasksService = getTasksService();
          const tasks = await tasksService.listTasks(100, false);
          
          const task = tasks.find((t: any) => t.title.toLowerCase() === params.task.toLowerCase());
          
          if (!task) {
            return {
              success: false,
              error: 'Task not found',
            };
          }

          await tasksService.completeTask(task.id);

          return {
            success: true,
            data: task,
            voiceResponse: `Task "${params.task}" marked as complete`,
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
      id: 'deleteTask',
      name: 'Delete Task',
      description: 'Delete a task',
      voiceTriggers: ['delete task', 'remove task'],
      parameters: [
        { name: 'task', type: 'string', required: true, description: 'Task description' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const tasksService = getTasksService();
          const tasks = await tasksService.listTasks(100, false);
          
          const task = tasks.find((t: any) => t.title.toLowerCase() === params.task.toLowerCase());
          
          if (!task) {
            return {
              success: false,
              error: 'Task not found',
            };
          }

          await tasksService.deleteTask(task.id);

          return {
            success: true,
            data: task,
            voiceResponse: `Task "${params.task}" deleted`,
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
