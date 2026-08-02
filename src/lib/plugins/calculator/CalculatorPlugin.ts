import { Plugin, PluginResult } from '../types';

// Safe arithmetic evaluator — supports +, -, *, /, parentheses and decimals only.
function safeEvaluate(input: string): number {
  const tokens = input.match(/\d+\.?\d*|[+\-*/()]/g) || [];
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parsePrimary = (): number => {
    const token = consume();
    if (token === '(') {
      const value = parseExpression();
      if (consume() !== ')') throw new Error('Mismatched parentheses');
      return value;
    }
    if (token === '-') return -parsePrimary();
    if (token === undefined || !/^\d/.test(token)) throw new Error('Invalid expression');
    return parseFloat(token);
  };

  const parseTerm = (): number => {
    let value = parsePrimary();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePrimary();
      if (op === '*') value *= right;
      else value /= right;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (op === '+') value += right;
      else value -= right;
    }
    return value;
  };

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error('Invalid expression');
  return result;
}

export const CalculatorPlugin: Plugin = {
  config: {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform calculations and conversions',
    version: '1.0.0',
    enabled: false,
    permissions: [],
    settings: {},
  },
  actions: [
    {
      id: 'calculate',
      name: 'Calculate',
      description: 'Perform a mathematical calculation',
      voiceTriggers: ['calculate', 'what is', 'compute', 'solve', 'math'],
      parameters: [
        { name: 'expression', type: 'string', required: true, description: 'Mathematical expression' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const expression = String(params.expression)
            .replace(/\bplus\b/g, '+')
            .replace(/\bminus\b/g, '-')
            .replace(/\bmultiplied by\b/g, '*')
            .replace(/\btimes\b/g, '*')
            .replace(/\bdivided by\b/g, '/')
            .replace(/\bover\b/g, '/')
            .replace(/\bx\b/g, '*')
            .replace(/[^-+*/()\d.\s]/g, '')
            .replace(/\s+/g, '');

          if (!expression || !/^[0-9+\-*/().]+$/.test(expression)) {
            return {
              success: false,
              error: 'Could not calculate. Please check your expression.',
            };
          }

          const result = safeEvaluate(expression);

          return {
            success: true,
            data: { expression: params.expression, result },
            voiceResponse: `${params.expression} equals ${result}`,
          };
        } catch (error) {
          return {
            success: false,
            error: 'Could not calculate. Please check your expression.',
          };
        }
      },
    },
    {
      id: 'convert',
      name: 'Convert',
      description: 'Convert units',
      voiceTriggers: ['convert', 'change to', 'conversion'],
      parameters: [
        { name: 'value', type: 'number', required: true, description: 'Value to convert' },
        { name: 'from', type: 'string', required: true, description: 'From unit' },
        { name: 'to', type: 'string', required: true, description: 'To unit' },
      ],
      handler: async (params: Record<string, any>): Promise<PluginResult> => {
        try {
          const conversions: Record<string, Record<string, number | ((v: number) => number)>> = {
            'km': { 'miles': 0.621371, 'm': 1000 },
            'miles': { 'km': 1.60934, 'm': 1609.34 },
            'kg': { 'lbs': 2.20462, 'g': 1000 },
            'lbs': { 'kg': 0.453592, 'g': 453.592 },
            'celsius': { 'fahrenheit': (c: number) => c * 9/5 + 32, 'kelvin': (c: number) => c + 273.15 },
            'fahrenheit': { 'celsius': (f: number) => (f - 32) * 5/9, 'kelvin': (f: number) => (f - 32) * 5/9 + 273.15 },
          };

          const from = params.from.toLowerCase();
          const to = params.to.toLowerCase();
          const value = params.value;

          let result: number;

          if (conversions[from]?.[to]) {
            const conversion = conversions[from][to];
            if (typeof conversion === 'function') {
              result = conversion(value);
            } else {
              result = value * (conversion as number);
            }
          } else {
            return {
              success: false,
              error: `Conversion from ${from} to ${to} not supported`,
            };
          }

          return {
            success: true,
            data: { from, to, value, result },
            voiceResponse: `${value} ${from} is ${result.toFixed(2)} ${to}`,
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
