/**
 * Presentation outline planner.
 *
 * Runs BEFORE the final .pptx layout+export step. Analyses the user's topic,
 * determines the best visual style and slide count, then produces a structured
 * outline of every slide (title, subtitle, bullets, special data). The outline
 * is the artifact the user edits in the chat; once approved it is converted to
 * SlideDefinitions by `outlineToSlideDefinitions` and handed to the layout engine.
 *
 * Patterns mirror `plan.ts` (invokeLLM + responseFormat: json_object) so the
 * code stays consistent across the codebase.
 */

import {
  invokeLLM,
  DEFAULT_LLM_MODEL,
  type Message,
} from "../../_core/llm";
import {
  PPT_SLIDE_TYPES,
  createSlideId,
  isPptOutlinePlan,
  type PptOutlinePlan,
  type PptOutlineSlide,
  type PptTopicAnalysis,
  type PptSlideType,
  type PptOutlineMetadata,
  PPT_OUTLINE_METADATA_KIND,
} from "../../../shared/presentationOutline";
import {
  DEFAULT_PRESENTATION_CONFIG,
  PPT_CONCRETE_STYLES,
  normalizeStyleId,
  type PresentationConfig,
  type PptVisualStyle,
  type PptSlidesConfig,
} from "../../../shared/presentation";
import { pickAutoTheme } from "../../../shared/pptThemes";
import { sanitizePresentationConfig } from "./config";
import type { SlideDefinition } from "../spec";

// ---------------------------------------------------------------------------
// Output schema fed to the LLM for strict JSON extraction
// ---------------------------------------------------------------------------

const OUTLINE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    title: { type: "string" },
    filename: { type: "string" },
    analysis: {
      type: "object",
      properties: {
        topic: { type: "string" },
        contentType: {
          type: "string",
          enum: [
            "concept",
            "process",
            "comparison",
            "statistics",
            "narrative",
            "guide",
            "proposal",
            "report",
          ],
        },
        audience: { type: "string" },
        complexity: {
          type: "string",
          enum: ["basic", "moderate", "advanced"],
        },
        goal: { type: "string" },
        visualNeed: {
          type: "string",
          enum: ["charts", "diagrams", "minimal", "rich"],
        },
        styleRationale: { type: "string" },
      },
      required: [
        "topic",
        "contentType",
        "audience",
        "complexity",
        "goal",
        "visualNeed",
        "styleRationale",
      ],
    },
    slideCount: { type: "number", minimum: 3, maximum: 25 },
    styleName: { type: "string" },
    summary: { type: "string" },
    slides: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...PPT_SLIDE_TYPES] },
          title: { type: "string", minLength: 2 },
          subtitle: { type: "string" },
          purpose: { type: "string" },
          bullets: { type: "array", items: { type: "string" }, minItems: 0 },
          metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                label: { type: "string" },
                change: { type: "string" },
              },
            },
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                title: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
              },
            },
          },
          quote: {
            type: "object",
            properties: {
              text: { type: "string" },
              author: { type: "string" },
            },
          },
          keyMessage: {
            type: "object",
            properties: {
              statement: { type: "string" },
              context: { type: "string" },
            },
          },
          chart: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "number" },
              },
            },
          },
          footnote: { type: "string" },
          visual: { type: "string" },
        },
        required: ["id", "type", "title", "bullets"],
      },
    },
  },
  required: [
    "title",
    "filename",
    "analysis",
    "slideCount",
    "styleName",
    "summary",
    "slides",
  ],
} as const;

// ---------------------------------------------------------------------------
// Raw LLM → safe coercion helpers
// ---------------------------------------------------------------------------

const VALID_SLIDE_TYPES = new Set<string>(PPT_SLIDE_TYPES as readonly string[]);
const VALID_STYLE_IDS = new Set<string>(PPT_CONCRETE_STYLES as readonly string[]);

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function coerceBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .map(b => b.trim());
}

function coerceSlideType(value: unknown): PptSlideType {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  return VALID_SLIDE_TYPES.has(v) ? (v as PptSlideType) : "content";
}

function coerceStyleName(value: unknown): PptVisualStyle {
  if (typeof value !== "string" || !value.trim()) return "auto";
  const norm = normalizeStyleId(value.trim());
  return VALID_STYLE_IDS.has(norm) ? (norm as PptVisualStyle) : "auto";
}

function coerceAnalysis(value: unknown): PptTopicAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  return {
    topic: coerceString(a.topic, ""),
    contentType: coerceString(
      a.contentType,
      "concept"
    ) as PptTopicAnalysis["contentType"],
    audience: coerceString(a.audience, "general audience"),
    complexity: coerceString(
      a.complexity,
      "moderate"
    ) as PptTopicAnalysis["complexity"],
    goal: coerceString(a.goal, "inform"),
    visualNeed: coerceString(
      a.visualNeed,
      "rich"
    ) as PptTopicAnalysis["visualNeed"],
    styleRationale: coerceString(a.styleRationale, ""),
  };
}

function coerceMetrics(value: unknown): PptOutlineSlide["metrics"] {
  if (!Array.isArray(value)) return undefined;
  const metrics = value
    .filter(
      (m): m is Record<string, unknown> =>
        Boolean(m) && typeof m === "object" && typeof (m as any).value === "string"
    )
    .map(m => ({
      value: String((m as any).value),
      label: String((m as any).label ?? ""),
      change: (m as any).change ? String((m as any).change) : undefined,
    }));
  return metrics.length > 0 ? metrics : undefined;
}

function coerceSteps(value: unknown): PptOutlineSlide["steps"] {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .filter(
      (s): s is Record<string, unknown> =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as any).title === "string"
    )
    .map((s, idx) => ({
      step: typeof (s as any).step === "number" ? (s as any).step : idx + 1,
      title: String((s as any).title),
      description: coerceString((s as any).description, ""),
    }));
  return steps.length > 0 ? steps : undefined;
}

function coerceColumns(value: unknown): PptOutlineSlide["columns"] {
  if (!Array.isArray(value)) return undefined;
  const cols = value
    .filter(
      (c): c is Record<string, unknown> =>
        Boolean(c) && typeof c === "object"
    )
    .map(c => ({
      title: coerceString((c as any).title, ""),
      bullets: coerceBullets((c as any).bullets),
    }));
  return cols.length > 0 ? cols : undefined;
}

function coerceQuote(value: unknown): PptOutlineSlide["quote"] {
  if (!value || typeof value !== "object") return undefined;
  const q = value as Record<string, unknown>;
  const text = coerceString(q.text, "");
  if (!text) return undefined;
  return {
    text,
    author: q.author ? String(q.author) : undefined,
  };
}

function coerceKeyMessage(
  value: unknown
): PptOutlineSlide["keyMessage"] {
  if (!value || typeof value !== "object") return undefined;
  const km = value as Record<string, unknown>;
  const statement = coerceString(km.statement, "");
  if (!statement) return undefined;
  return {
    statement,
    context: km.context ? String(km.context) : undefined,
  };
}

function coerceChart(value: unknown): PptOutlineSlide["chart"] {
  if (!Array.isArray(value)) return undefined;
  const chart = value
    .filter(
      (d): d is Record<string, unknown> =>
        Boolean(d) &&
        typeof d === "object" &&
        typeof (d as any).label === "string" &&
        typeof (d as any).value === "number"
    )
    .map(d => ({
      label: String((d as any).label),
      value: Number((d as any).value),
    }));
  return chart.length > 0 ? chart : undefined;
}

function coerceRawSlide(raw: Record<string, unknown>): PptOutlineSlide {
  return {
    id:
      typeof raw.id === "string" && raw.id.startsWith("slide-")
        ? raw.id
        : createSlideId(),
    type: coerceSlideType(raw.type),
    title: coerceString(raw.title, "Untitled slide"),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    purpose: raw.purpose ? String(raw.purpose) : undefined,
    bullets: coerceBullets(raw.bullets),
    metrics: coerceMetrics(raw.metrics),
    steps: coerceSteps(raw.steps),
    columns: coerceColumns(raw.columns),
    quote: coerceQuote(raw.quote),
    keyMessage: coerceKeyMessage(raw.keyMessage),
    chart: coerceChart(raw.chart),
    footnote: raw.footnote ? String(raw.footnote) : undefined,
    visual: raw.visual ? coerceStyleName(raw.visual) : undefined,
  };
}

function coerceRawOutline(raw: Record<string, unknown>): PptOutlinePlan | null {
  const slides = Array.isArray(raw.slides) ? raw.slides : [];
  if (slides.length < 2) return null;

  const config = sanitizePresentationConfig(raw.config ?? {});

  return {
    version: 1,
    title: coerceString(raw.title, "Presentation"),
    filename: coerceString(raw.filename, "presentation"),
    analysis: coerceAnalysis(raw.analysis) ?? {
      topic: "",
      contentType: "concept",
      audience: "general audience",
      complexity: "moderate",
      goal: "inform",
      visualNeed: "rich",
      styleRationale: "",
    },
    slideCount: typeof raw.slideCount === "number" ? raw.slideCount : slides.length,
    slides: slides
      .filter(
        (s): s is Record<string, unknown> =>
          Boolean(s) && typeof s === "object"
      )
      .map(coerceRawSlide),
    config,
    styleName: coerceStyleName(raw.styleName),
    summary: coerceString(raw.summary, ""),
  };
}

// ---------------------------------------------------------------------------
// JSON parsing (identical strategy to plan.ts)
// ---------------------------------------------------------------------------

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const candidate = JSON.parse(cleaned.slice(start, end + 1));
        return typeof candidate === "object" && candidate !== null
          ? candidate
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceSlidesResult(
  raw: Record<string, unknown>
): PptOutlinePlan | null {
  return coerceRawOutline(raw);
}

// ---------------------------------------------------------------------------
// Slide count resolution
// ---------------------------------------------------------------------------

function resolveSlideCount(
  userPrompt: string,
  configSlides: PptSlidesConfig
): number {
  // Explicit number in config takes highest priority
  if (typeof configSlides === "number") return configSlides;

  // Check for explicit user mention: "12 slides", "5 slides"
  const match = userPrompt.toLowerCase().match(/\b(\d{1,2})\s*-?\s*slides?\b/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 3 && n <= 25) return n;
  }

  // Slides-mentioning words indicate desire for more substance
  if (/\bextensive|detailed|comprehensive|in-depth\b/i.test(userPrompt))
    return 12;

  // Default heuristic
  return 8;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const STYLE_GUIDE = `
You MUST honour the selected visual style in your content decisions, NOT just backgrounds. Style affects tone, vocabulary, data density, slide layouts chosen, and bullet word count:
- Minimal: ≤3 short bullets per slide (under 8 words each); high signal; generous whitespace.
- Modern: clean, forward-looking; 3-4 crisp bullets; metric highlights.
- Corporate: executive tone; scorecards, benchmarks, ROI framing; 3-5 bullets.
- Editorial: rich analysis; 3-5 detailed bullets; magazine-style storytelling.
- Bold: dramatic headlines; fewer bullets (2-4), high-impact numbers.
- Elegant: refined language; restrained bullet count (2-4); polished framing.
- Creative: energetic, expressive; 3-4 vivid bullets; playful metaphors.
- Dark: dramatic high-contrast; striking statistics; confident declarations.
- Light: accessible, friendly; clear simple structure; 3-4 approachable bullets.
- Glass: layered concepts; modern tech-leaning; 3-4 concise bullets.
- Academic: rigorous, citation-ready; formal definitions; 3-5 analytical bullets.
- Technical: precise terminology; architecture blocks; metrics-driven; 3-5 bullets.
- Luxury: prestigious, understated; refined statistics; 2-4 premium bullets.
- Startup: product-led; traction metrics; 3-4 crisp value proposition bullets.
- Magazine: feature-article tone; bold pull-quotes; 3-4 vivid details.
- Data: every claim backed by metrics; 3-5 quantified bullets.
- Presentation: all-purpose professional; clear structure; 3-4 adaptable bullets.

When the style is "auto", pick the archetype that best fits the topic and audience, then state it in styleName.
`;

function buildOutlineSystemPrompt(
  slideCount: number,
  styleName: string
): string {
  const styleLower = styleName.toLowerCase();
  return `You are an expert presentation architect for KSEMO. Given a user request and optional web research, produce an authoritative, storytelling presentation OUTLINE as a single JSON object.

TASK
1. Analyse the user's topic to determine its type, audience, complexity, goal, and required visual richness.
2. Pick the best visual style: ${styleName === "auto" ? "choose the most appropriate from the 17 concrete styles" : `use "${styleLower}" authoritatively`}.
3. Structure a coherent narrative across exactly ${slideCount} content slides that tells a complete story. Avoid random or padded slides.

NARRATIVE ARC (apply to every deck):
Slide 1 — Title slide (hero): bold title + subtitle framing the topic.
Slide 2 — Agenda / Overview: give the audience a clear map of the deck.
Slides 3..N-1 — Content body: variety of types (content, stats, process, comparison, timeline, chart, quote, key_message, section, agenda). No two consecutive slides may share the same type. NEVER use "title" or "agenda" or "closing" in the content body.
Slide N — Closing slide (closing): key takeaways, next steps, or call to action.

SLIDE TYPE RULES
- type "title": exactly 1, always slide 1. subtitle required.
- type "agenda": exactly 1, always slide 2. bullets are section labels.
- type "closing": exactly 1, always the last slide. bullets list takeaways.
- type "content": bullets is the primary content carrier (2-5 bullets).
- type "stats": metrics array required (2-4 metrics: value + label + change).
- type "process": steps array required (3-5 steps: step number + title + description).
- type "timeline": steps array required (3-5 entries, chronological).
- type "comparison": columns (2 columns with bullets each) OR bullets used as row descriptions.
- type "chart": chart array required (3-6 data points: label + numeric value).
- type "quote": quote.text required; quote.author optional.
- type "key_message": keyMessage.statement required; keyMessage.context optional.
- type "section": a divider slide — brief subtitle as purpose.
NO slide may have an empty bullets array. Every slide must have at least 1 bullet or structured data (metrics/steps/chart/quote/keyMessage).

CONTENT DENSITY
- bullets: max 12 words per bullet; max 5 bullets per slide.
- metrics: value max 6 characters; label max 3 words.
- steps: title max 5 words; description max 20 words.
- Keep ALL text SHORT so the professional layout engine can render it at large, readable font sizes (title 32-44pt, body 18-24pt).

SLIDE COUNT
You MUST produce exactly ${slideCount} slides including the title and closing.

OUTPUT
Return a single JSON object with no markdown fences. Keys:
{
  "title": "deck title",
  "filename": "url_safe_snake_case_filename_without_extension",
  "analysis": { topic, contentType, audience, complexity, goal, visualNeed, styleRationale },
  "slideCount": ${slideCount},
  "styleName": "auto or concrete style name",
  "summary": "one friendly sentence describing the deck",
  "slides": [
    { "id": "slide-... (use this exact prefix), "type": "title|agenda|content|...", "title": "...", "subtitle": "... (only for title type)", "purpose": "one-line rationale shown in editor", "bullets": ["...", "..."], "metrics": [...], "steps": [...], "columns": [...], "quote": {...}, "keyMessage": {...}, "chart": [...], "footnote": "optional" }
  ]
}

${STYLE_GUIDE}
CRITICAL PROHIBITIONS:
- NEVER write page numbers, slide numbers, "Slide N", "Page N", or the file name inside any slide text.
- NEVER use filler or placeholder text. Every bullet must contain real, substantive content grounded in the user's topic.
- NEVER make title-only slides (every slide has bullets or structured data).
`;
}

function buildUserPrompt(
  userMessage: string,
  researchContext: string,
  slideCount: number,
  selectedStyle: string
): string {
  const researchBlock = researchContext
    ? `\n\nRESEARCH FINDINGS:\n${researchContext}`
    : "";
  return `User request:\n"${userMessage.slice(0, 4000)}"${researchContext}

Deck requirements:
- slideCount: ${slideCount}
- styleName: "${selectedStyle}"
${researchBlock}

Produce the complete JSON outline now. You MUST return exactly ${slideCount} slides, following all rules above.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type OutlineProgressStage =
  | "analyzing"
  | "planning"
  | "content_generated";

export type OutlineProgressCallback = (stage: OutlineProgressStage) => void;

/**
 * Full outline planner: runs topic analysis + style resolution + slide
 * generation in a single structured LLM call. Returns the cached outline ready
 * to be persisted in message metadata and rendered by the client editor.
 */
export async function planPresentationOutline(input: {
  userMessage: string;
  history: Message[];
  presentationConfig?: unknown;
  presentationStyle?: unknown;
  onProgress?: OutlineProgressCallback;
  signal?: AbortSignal;
  researchContext?: string;
}): Promise<PptOutlinePlan> {
  const {
    userMessage,
    history,
    presentationConfig,
    presentationStyle,
    onProgress,
    signal,
    researchContext,
  } = input;

  // ── Resolve config & style ────────────────────────────────────────────
  onProgress?.("analyzing");

  const config = sanitizePresentationConfig(
    presentationConfig ?? DEFAULT_PRESENTATION_CONFIG
  );

  let selectedStyle: PptVisualStyle;
  if (presentationStyle && presentationStyle !== "auto") {
    selectedStyle = normalizeStyleId(presentationStyle);
  } else if (config.visualStyle && config.visualStyle !== "auto") {
    selectedStyle = normalizeStyleId(config.visualStyle);
  } else {
    selectedStyle = pickAutoTheme(userMessage).key as PptVisualStyle;
  }

  const resolvedStyleName =
    selectedStyle === "auto"
      ? coerceStyleName(pickAutoTheme(userMessage).key)
      : selectedStyle;

  const slideCount = resolveSlideCount(userMessage, config.slides);

  // ── Build prompts ─────────────────────────────────────────────────────
  onProgress?.("planning");

  const systemPrompt = buildOutlineSystemPrompt(slideCount, resolvedStyleName);
  const userPrompt = buildUserPrompt(
    userMessage,
    researchContext ?? "",
    slideCount,
    resolvedStyleName
  );

  // ── LLM call ──────────────────────────────────────────────────────────
  try {
    const result = await invokeLLM({
      model: DEFAULT_LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        { role: "user" as const, content: userPrompt },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 16000,
      signal,
    });

    const raw = result.choices?.[0]?.message?.content;
    const text = Array.isArray(raw)
      ? raw
          .map(p =>
            typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p)
          )
          .join("")
      : String(raw ?? "");

    const parsed = parseJsonFromText(text);
    if (parsed) {
      const outline = coerceSlidesResult(parsed);
      if (outline && outline.slides.length >= 2) {
        onProgress?.("content_generated");
        return outline;
      }
    }
  } catch (error) {
    console.warn("[PPT Outline] LLM call failed; using synthesis fallback.", error);
  }

  // ── Synthesis fallback ────────────────────────────────────────────────
  return synthesizeFallbackOutline(
    userMessage,
    resolvedStyleName,
    slideCount,
    config
  );
}

/**
 * Regenerate a single slide within an existing outline. Uses the surrounding
 * slides + topic context so the replacement is coherent with the rest.
 */
export async function regenerateSingleSlide(input: {
  outline: PptOutlinePlan;
  slideId: string;
  instruction?: string;
  signal?: AbortSignal;
}): Promise<PptOutlinePlan> {
  const { outline, slideId, instruction, signal } = input;
  const targetIdx = outline.slides.findIndex(s => s.id === slideId);
  if (targetIdx < 0) return outline;

  const prevSlide = targetIdx > 0 ? outline.slides[targetIdx - 1] : undefined;
  const nextSlide =
    targetIdx < outline.slides.length - 1
      ? outline.slides[targetIdx + 1]
      : undefined;
  const currentSlide = outline.slides[targetIdx];

  const prevContext = prevSlide
    ? `Previous slide: [${prevSlide.type}] "${prevSlide.title}" — ${prevSlide.bullets.slice(0, 2).join("; ")}`
    : "This is the first slide.";
  const nextContext = nextSlide
    ? `Next slide: [${nextSlide.type}] "${nextSlide.title}" — ${nextSlide.bullets.slice(0, 2).join("; ")}`
    : "This is the last slide.";

  const instructionBlock = instruction
    ? `\nUser instruction: "${instruction}"`
    : "";

  const systemPrompt = `You are a presentation content editor. Regenerate ONE slide within an existing deck outline. Return ONLY the replacement slide as a single JSON object (not an array).

RULES:
- Same narrative arc; same position in the deck.
- Same slide type as the current slide (${currentSlide.type}) unless the user explicitly asks to change it.
- At least 1 bullet; never title-only.
- Bullets: max 12 words, max 5 per slide.
- Output the single slide object directly (no markdown fences):
{ "id", "type", "title", "subtitle?", "purpose?", "bullets", "metrics?", "steps?", "columns?", "quote?", "keyMessage?", "chart?", "footnote?" }

${STYLE_GUIDE}`;

  const userPrompt = `Deck title: "${outline.title}"
Topic analysis: ${outline.analysis.contentType}, audience ${outline.analysis.audience}, complexity ${outline.analysis.complexity}
Current style: ${outline.styleName}

Slide to regenerate (index ${targetIdx + 1} of ${outline.slides.length}):
Title: "${currentSlide.title}"
Type: ${currentSlide.type}
Current bullets: ${JSON.stringify(currentSlide.bullets.slice(0, 3))}
${currentSlide.metrics ? `Metrics: ${JSON.stringify(currentSlide.metrics.slice(0, 2))}` : ""}
${currentSlide.steps ? `Steps: ${JSON.stringify(currentSlide.steps.slice(0, 2))}` : ""}

${prevContext}
${nextContext}${instructionBlock}

Return the replacement slide JSON now:`;

  try {
    const result = await invokeLLM({
      model: DEFAULT_LLM_MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      responseFormat: { type: "json_object" },
      maxTokens: 4000,
      signal,
    });

    const raw = result.choices?.[0]?.message?.content;
    const text = Array.isArray(raw)
      ? raw
          .map(p =>
            typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p)
          )
          .join("")
      : String(raw ?? "");

    const parsed = parseJsonFromText(text);
    if (parsed && typeof parsed === "object") {
      const newSlide = coerceRawSlide({
        ...parsed,
        id: slideId, // keep original id
      });
      const updatedSlides = [...outline.slides];
      updatedSlides[targetIdx] = newSlide;
      return {
        ...outline,
        slides: updatedSlides,
      };
    }
  } catch (error) {
    console.warn("[PPT Outline] Single-slide regeneration failed.", error);
  }

  return outline;
}

// ---------------------------------------------------------------------------
// Outline → SlideDefinition converter (consumed by layout engine)
// ---------------------------------------------------------------------------

/**
 * Converts the user-editable outline slides into SlideDefinitions that the
 * existing professional layout engine (`buildPresentationSpec` → `planLayouts`)
 * understands. Also normalises the outline metadata.
 */
export function outlineToSlideDefinitions(
  slides: PptOutlineSlide[],
  title: string
): SlideDefinition[] {
  return slides.map((slide): SlideDefinition => {
    const base: SlideDefinition = {
      title: slide.title,
      subtitle: slide.subtitle,
      bullets: slide.bullets.length > 0 ? [...slide.bullets] : undefined,
      footnote: slide.footnote,
    };

    switch (slide.type) {
      case "title":
        return {
          ...base,
          layout: "title",
          subtitle: slide.subtitle ?? title,
          bullets: slide.bullets.length > 0 ? [...slide.bullets] : undefined,
        };

      case "stats":
        return {
          ...base,
          layout: "stats",
          metrics: slide.metrics ?? [],
          bullets: undefined,
        };

      case "process":
      case "timeline":
        return {
          ...base,
          layout: "process",
          steps: slide.steps ?? [],
          bullets: undefined,
        };

      case "comparison":
        if (slide.columns && slide.columns.length >= 2) {
          return {
            ...base,
            layout: "two_column",
            columns: slide.columns.map(c => ({
              title: c.title,
              bullets: c.bullets,
            })),
            bullets: undefined,
          };
        }
        // Fallback: one-sided comparison rendered as a focused content slide
        return {
          ...base,
          bullets: slide.bullets,
        };

      case "chart":
        if (slide.chart && slide.chart.length > 0) {
          return {
            ...base,
            layout: "stats",
            metrics: slide.chart.map(d => ({
              value: String(d.value),
              label: d.label,
              change: undefined,
            })),
            bullets: undefined,
          };
        }
        return { ...base, bullets: slide.bullets };

      case "quote":
        return {
          ...base,
          layout: "quote",
          quote: slide.quote ?? { text: slide.title },
          bullets: undefined,
        };

      case "section":
        return {
          ...base,
          layout: "section",
          bullets: slide.bullets.length > 0 ? [...slide.bullets] : undefined,
        };

      case "key_message":
        return {
          ...base,
          layout: "key_message",
          keyMessage: slide.keyMessage ?? { statement: slide.title },
          bullets: undefined,
        };

      case "agenda":
      case "content":
      case "closing":
      default:
        return {
          ...base,
          bullets: slide.bullets,
        };
    }
  });
}

// ---------------------------------------------------------------------------
// Metadata persistence helpers
// ---------------------------------------------------------------------------

export function buildOutlineMetadata(
  outline: PptOutlinePlan,
  userPrompt: string
): PptOutlineMetadata {
  return {
    kind: PPT_OUTLINE_METADATA_KIND,
    outline,
    prompt: userPrompt,
    updatedAt: new Date().toISOString(),
    headerText: outline.summary || `Outline: ${outline.title}`,
  };
}

export function coerceOutlineFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): PptOutlineMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ppt = (metadata as Record<string, unknown>).pptOutline;
  if (!ppt || typeof ppt !== "object") return null;
  const obj = ppt as Record<string, unknown>;
  if (obj.kind !== PPT_OUTLINE_METADATA_KIND) return null;
  if (!isPptOutlinePlan(obj.outline)) return null;
  return obj as unknown as PptOutlineMetadata;
}

// ---------------------------------------------------------------------------
// Fallback outline synthesiser (never returns empty)
// ---------------------------------------------------------------------------

function synthesizeFallbackOutline(
  userMessage: string,
  styleName: PptVisualStyle,
  slideCount: number,
  config: PresentationConfig
): PptOutlinePlan {
  const topicClean = userMessage
    .replace(
      /\b(presentation|pptx|powerpoint|slides|create|generate|make)\b/gi,
      ""
    )
    .trim()
    .slice(0, 100);
  const title = topicClean
    ? topicClean.charAt(0).toUpperCase() + topicClean.slice(1)
    : "Presentation";
  const filename = title
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join("_")
    .toLowerCase();
  const actualSlideCount = Math.max(3, Math.min(25, slideCount));

  const bodySlides: PptOutlineSlide[] = [];
  const bodyTypes: PptSlideType[] = [
    "content",
    "stats",
    "process",
    "content",
    "comparison",
    "chart",
    "key_message",
    "content",
    "quote",
    "content",
    "timeline",
    "content",
    "stats",
    "content",
    "content",
  ];

  const usedTypes = new Set<string>(["title", "agenda", "closing"]);

  for (let i = 0; i < actualSlideCount - 2; i++) {
    let type =
      bodyTypes[i % bodyTypes.length] ?? "content";
    // Avoid repeats
    let attempts = 0;
    while (usedTypes.has(type) && attempts < bodyTypes.length) {
      type = bodyTypes[(i + attempts + 1) % bodyTypes.length] ?? "content";
      attempts++;
    }
    usedTypes.add(type);

    const slide: PptOutlineSlide = {
      id: createSlideId(),
      type,
      title: `Slide ${i + 2} — ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      bullets: [
        `Key point ${i * 2 + 1} for this section`,
        `Supporting evidence for point ${i * 2 + 1}`,
      ],
    };

    if (type === "stats") {
      slide.metrics = [
        { value: "78%", label: "Primary metric", change: "+12%" },
        { value: "3.2x", label: "Growth rate", change: "year over year" },
      ];
      slide.bullets = [];
    }
    if (type === "process") {
      slide.steps = [
        { step: 1, title: "Step 1", description: "Initial action" },
        { step: 2, title: "Step 2", description: "Follow-up action" },
        { step: 3, title: "Step 3", description: "Final action" },
      ];
      slide.bullets = [];
    }
    if (type === "chart") {
      slide.chart = [
        { label: "Q1", value: 42 },
        { label: "Q2", value: 58 },
        { label: "Q3", value: 71 },
        { label: "Q4", value: 85 },
      ];
      slide.bullets = [];
    }
    if (type === "quote") {
      slide.quote = {
        text: "A meaningful observation about this topic.",
        author: "Expert",
      };
      slide.bullets = [];
    }
    if (type === "key_message") {
      slide.keyMessage = {
        statement: `The core takeaway from ${title}.`,
        context: "Derived from comprehensive analysis.",
      };
      slide.bullets = [];
    }
    if (type === "comparison") {
      slide.columns = [
        { title: "Option A", bullets: ["Feature 1", "Feature 2"] },
        { title: "Option B", bullets: ["Feature 3", "Feature 4"] },
      ];
      slide.bullets = [];
    }

    bodySlides.push(slide);
  }

  const outline: PptOutlinePlan = {
    version: 1,
    title,
    filename: filename || "presentation",
    analysis: {
      topic: title,
      contentType: "concept",
      audience: "general audience",
      complexity: "moderate",
      goal: "inform",
      visualNeed: "rich",
      styleRationale: `Fallback: using ${styleName} as the selected style.`,
    },
    slideCount: actualSlideCount,
    styleName,
    config,
    summary: `I prepared a ${actualSlideCount}-slide presentation outline on "${title}". Review and edit the slides below, then click "Generate presentation" when ready.`,
    slides: [
      {
        id: createSlideId(),
        type: "title",
        title,
        subtitle: "Presentation outline",
        purpose: "Open the deck with a clear, bold title",
        bullets: [],
      },
      {
        id: createSlideId(),
        type: "agenda",
        title: "Agenda",
        purpose: "Give the audience a clear map",
        bullets: bodySlides.slice(0, 5).map(s => s.title),
      },
      ...bodySlides,
      {
        id: createSlideId(),
        type: "closing",
        title: "Summary & Next Steps",
        purpose: "Close with clear takeaways and next actions",
        bullets: [
          "Recap the core insights",
          "Outline the immediate next steps",
          "Invite questions or discussion",
        ],
      },
    ],
  };

  return outline;
}
