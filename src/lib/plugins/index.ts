import { getPluginRegistry } from './PluginRegistry';
import { EmailPlugin } from './email/EmailPlugin';
import { CalendarPlugin } from './calendar/CalendarPlugin';
import { NotesPlugin } from './notes/NotesPlugin';
import { TasksPlugin } from './tasks/TasksPlugin';
import { WeatherPlugin } from './weather/WeatherPlugin';
import { NewsPlugin } from './news/NewsPlugin';
import { CalculatorPlugin } from './calculator/CalculatorPlugin';
import { TimerPlugin } from './timer/TimerPlugin';
import { WebSearchPlugin } from './websearch/WebSearchPlugin';

export function initializePlugins() {
  const registry = getPluginRegistry();

  // Register all plugins
  registry.register(EmailPlugin);
  registry.register(CalendarPlugin);
  registry.register(NotesPlugin);
  registry.register(TasksPlugin);
  registry.register(WeatherPlugin);
  registry.register(NewsPlugin);
  registry.register(CalculatorPlugin);
  registry.register(TimerPlugin);
  registry.register(WebSearchPlugin);

  return registry;
}

export { getPluginRegistry };
export * from './types';
