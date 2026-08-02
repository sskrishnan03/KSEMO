import { PluginAction } from '../plugins/types';

/**
 * Uses Gemini to turn a natural spoken command into structured plugin
 * parameters. Returns null when the API key is missing or the LLM fails,
 * so callers can fall back to regex extraction.
 */
export async function parsePluginCommand(
  transcript: string,
  pluginId: string,
  action: PluginAction
): Promise<Record<string, any> | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const paramSpecs = action.parameters.map((p) =>
    `- ${p.name}: ${p.type}${p.required ? ' (required)' : ' (optional)'}${p.description ? ' — ' + p.description : ''}`
  ).join('\n');

  const prompt = `Extract structured data from a spoken command for a plugin.

Plugin: ${pluginId}
Action: ${action.name} (id: ${action.id})
Parameters:
${paramSpecs}

Command: "${transcript}"

Rules:
- to / from: the recipient or sender — email address, or name after "to" / "from".
- subject: text after "subject", "regarding", "about", "re:", or "titled".
- body / content / message / task / note / query / location: the actual content — usually the text after words like "saying", "say", "body", "with", "that", "about", or whatever remains after the other fields.
- expression: the math expression (e.g. "25 times 4").
- minutes / seconds: numbers together with their unit.
- time / date: the time or date value (e.g. "2pm", "07:00", "tomorrow").
- value / from / to for conversions: the number and units.
- Any text that looks like a person's name, email, place, or date belongs to the matching field.

Respond with ONLY valid JSON and nothing else:
{"paramName": value}
Use null for any parameter that is missing or unclear.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleaned = text
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Only keep known parameters, and keep nulls for required ones so the
    // caller can tell the user what's missing.
    const result: Record<string, any> = {};
    for (const p of action.parameters) {
      if (parsed[p.name] !== undefined) {
        result[p.name] = parsed[p.name];
      }
    }
    return result;
  } catch {
    return null;
  }
}
