import { Plugin, PluginResult } from '../types';

export const WeatherPlugin: Plugin = {
  config: {
    id: 'weather',
    name: 'Weather',
    description: 'Get weather information and forecasts',
    version: '1.0.0',
    enabled: false,
    permissions: ['weather.read'],
    settings: {
      defaultLocation: '',
      units: 'celsius',
    },
  },
  actions: [
    {
      id: 'currentWeather',
      name: 'Current Weather',
      description: 'Get current weather for a location',
      voiceTriggers: ['weather', 'current weather', 'what\'s the weather', 'temperature'],
      parameters: [
        { name: 'location', type: 'string', required: false, description: 'Location name' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const location = params.location || 'your location';
          
          // In production, integrate with weather API (OpenWeatherMap, etc.)
          // For demo, return simulated data
          const weatherData = {
            location,
            temperature: 22,
            condition: 'Partly Cloudy',
            humidity: 65,
            wind: 12,
            feelsLike: 24,
          };

          return {
            success: true,
            data: weatherData,
            voiceResponse: `Currently in ${location}, it's ${weatherData.temperature} degrees and ${weatherData.condition.toLowerCase()}. Feels like ${weatherData.feelsLike} degrees.`,
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
      id: 'forecast',
      name: 'Weather Forecast',
      description: 'Get weather forecast',
      voiceTriggers: ['forecast', 'weather forecast', 'tomorrow\'s weather'],
      parameters: [
        { name: 'location', type: 'string', required: false, description: 'Location name' },
        { name: 'days', type: 'number', required: false, description: 'Number of days', default: 3 },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const location = params.location || 'your location';
          const days = params.days || 3;

          // Simulated forecast data
          const forecast = Array.from({ length: days }, (_, i) => ({
            day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `In ${i} days`,
            high: 25 + Math.floor(Math.random() * 5),
            low: 18 + Math.floor(Math.random() * 3),
            condition: ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy'][Math.floor(Math.random() * 4)],
          }));

          const summary = forecast.map((f: any) => 
            `${f.day}: ${f.condition}, high ${f.high}, low ${f.low}`
          ).join('. ');

          return {
            success: true,
            data: forecast,
            voiceResponse: `Weather forecast for ${location}: ${summary}`,
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
