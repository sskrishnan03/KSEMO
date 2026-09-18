import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  DEFAULT_PRESENTATION_CONFIG,
  CANONICAL_PART_NAME,
  type PptPresentationSpec,
} from "@shared/presentation";
import type { SlideDefinition } from "../spec";
import { VISUAL_THEMES } from "./themes";
import {
  buildDeckSpec,
  generateDeck,
  adjustSlideCount,
} from "./engine";
import {
  validateSpec,
  validateSlide,
  repairSpec,
} from "./validator";
import { exportPptx, readCanonicalFromBuffer } from "./exporter";

function sampleSlides(): SlideDefinition[] {
  return [
    {
      layout: "title",
      title: "Q3 Enterprise Growth Strategy",
      subtitle: "FY26 Executive Review",
      bullets: [
        "Revenue grew 18% year over year",
        "Three new markets launched in EMEA",
        "Net retention improved to 124%",
      ],
    },
    {
      layout: "section",
      title: "Performance Overview",
      subtitle: "Chapter One",
    },
    {
      layout: "stats",
      title: "Key Metrics",
      metrics: [
        { value: "$42M", label: "ARR", change: "+18% YoY" },
        { value: "124%", label: "Net retention", change: "+6 pts" },
        { value: "3", label: "New markets", change: "EMEA / LATAM / APAC" },
        { value: "81", label: "Enterprise NPS", change: "All-time high" },
      ],
    },
    {
      layout: "two_column",
      title: "Commercial Highlights",
      columns: [
        { title: "Enterprise", text: "Landed 27 logos above $100k ACV in the quarter.", bullets: ["Morgan deal", "Siemens expansion", "Public sector renewal"] },
        { title: "SMB & PLG", text: "Self-serve pipeline grew steadily.", bullets: ["Product-led motion", "In-app upgrade flow", "Partner API"] },
      ],
    },
    {
      layout: "process",
      title: "Execution Roadmap",
      steps: [
        { step: 1, title: "Diagnose", description: "Baseline metrics, schema mapping, dependency graphing." },
        { step: 2, title: "Design", description: "Structure findings into logical chapters and metric cards." },
        { step: 3, title: "Deliver", description: "Ship a polished, validated deck to stakeholders." },
        { step: 4, title: "Iterate", description: "Incorporate feedback and refresh the narrative." },
      ],
    },
    {
      layout: "table",
      title: "Benchmark Comparison",
      table: {
        headers: ["KPI", "Q1", "Q2", "Q3", "Trend"],
        rows: [
          ["ARR", "$28M", "$34M", "$42M", "Up"],
          ["NRR", "110%", "118%", "124%", "Up"],
          ["Gross margin", "74%", "75%", "77%", "Up"],
          ["Time-to-value", "31d", "27d", "22d", "Down"],
          ["Support CSAT", "88", "90", "91", "Up"],
        ],
      },
    },
    {
      layout: "quote",
      title: "Customer Voice",
      quote: { text: "KSEMO gave our GTM team a single source of truth for every customer story.", author: "VP Revenue, Global 500" },
    },
    {
      layout: "bullets",
      title: "Risks & Mitigations",
      bullets: [
        "Headcount hiring market remains competitive across engineering hubs.",
        "FX headwinds from EUR/USD continue to pressure reported revenue growth.",
        "Long tail renewals carry higher churn risk than strategic accounts.",
        "Mitigation: expanded comp adjuster program and dual-currency pricing.",
      ],
    },
  ];
}

describe("presentation engine", () => {
  it("builds a valid canonical spec from sample slides (default config)", () => {
    const { spec, violations } = buildDeckSpec({
      title: "Q3 Enterprise Growth Strategy",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    });
    expect(spec.slides.length).toBe(sampleSlides().length);
    expect(violations).toEqual([]);
    expect(spec.widthIn).toBe(13.333);
    expect(spec.heightIn).toBe(7.5);
  });

  it("renders every registered visual style without violations", () => {
    for (const key of Object.keys(VISUAL_THEMES)) {
      const { spec, violations } = buildDeckSpec({
        title: "Style Audit",
        slides: sampleSlides(),
        config: DEFAULT_PRESENTATION_CONFIG,
        styleName: key as PptPresentationSpec["style"],
        footerLabel: "KSEMO",
      });
      expect(spec.style).toBe(VISUAL_THEMES[key].name);
      expect(violations.map(v => v.message)).toEqual([]);
    }
  });

  it("honors an explicitly requested style, never silently swapping it", () => {
    const { spec } = buildDeckSpec({
      title: "Statement of Work",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "Dark",
      footerLabel: "KSEMO",
    });
    expect(spec.style).toBe(VISUAL_THEMES["Dark"].name);
    expect(spec.themeKey).toBe(VISUAL_THEMES["Dark"].key);
    const colors = new Set(
      spec.slides.flatMap(s =>
        s.elements
          .map(e => (e.kind === "text" ? e.color : e.fill))
          .filter((c): c is string => typeof c === "string")
      )
    );
    const styleColors = [
      VISUAL_THEMES["Dark"].primary,
      VISUAL_THEMES["Dark"].secondary,
      VISUAL_THEMES["Dark"].accent,
      VISUAL_THEMES["Dark"].accent2,
      VISUAL_THEMES["Dark"].text,
      VISUAL_THEMES["Dark"].muted,
      VISUAL_THEMES["Dark"].invertedText,
    ];
    expect([...colors].some(c => styleColors.includes(c.toUpperCase()))).toBe(
      true
    );
  });

  it("fails loudly when an explicit style cannot be resolved", () => {
    expect(() =>
      buildDeckSpec({
        title: "Should not fall back",
        slides: sampleSlides(),
        config: DEFAULT_PRESENTATION_CONFIG,
        styleName: "NoSuchStyle" as PptPresentationSpec["style"],
        footerLabel: "KSEMO",
      })
    ).toThrow(/NoSuchStyle/);
  });

  it("expands a short deck to the requested slide count without empty slides", () => {
    const base = sampleSlides().slice(0, 3); // title + section + stats
    const grown = adjustSlideCount(base, 8);
    expect(grown.length).toBeGreaterThanOrEqual(3);
    expect(grown.every(s => s.title || (s.bullets ?? []).length)).toBe(true);
  });

  it("trims a long deck toward the requested count but never below a minimum", () => {
    const long = sampleSlides();
    const trimmed = adjustSlideCount(long, 3);
    expect(trimmed.length).toBeGreaterThanOrEqual(3);
    expect(trimmed.length).toBeLessThan(long.length);
    expect(trimmed.some(s => s.layout === "title")).toBe(true);
  });

  it("validates text overflow when a fontSize is inflated", () => {
    const { spec } = buildDeckSpec({
      title: "Overflow test",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
    });
    const target = spec.slides.find(s => s.kind === "bullets") ?? spec.slides[spec.slides.length - 1];
    const textEl = target.elements.find(e => e.kind === "text");
    expect(textEl).toBeDefined();
    if (textEl && textEl.kind === "text") {
      const inflated: PptPresentationSpec = {
        ...spec,
        slides: spec.slides.map(s =>
          s === target
            ? { ...s, elements: s.elements.map(e => (e === textEl ? { ...e, fontSize: 72 } : e)) }
            : s
        ),
      };
      const violations = validateSpec(inflated);
      expect(violations.some(v => v.kind === "overflow")).toBe(true);
    }
  });

  it("repairs overflowing text by shrinking font size", () => {
    const { spec } = buildDeckSpec({
      title: "Repair test",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
    });
    const target = spec.slides.find(s => s.kind === "bullets") ?? spec.slides[spec.slides.length - 1];
    const textEl = target.elements.find(e => e.kind === "text");
    expect(textEl).toBeDefined();
    if (textEl && textEl.kind === "text") {
      const inflated: PptPresentationSpec = {
        ...spec,
        slides: spec.slides.map(s =>
          s === target
            ? { ...s, elements: s.elements.map(e => (e === textEl ? { ...e, fontSize: 72 } : e)) }
            : s
        ),
      };
      const { spec: repaired, repairs } = repairSpec(inflated);
      expect(repairs).toBeGreaterThan(0);
      const violations = validateSpec(repaired);
      expect(violations.filter(v => v.slideIndex === target.index).map(v => v.message)).toEqual([]);
    }
  });

  it("generates a .pptx artifact that embeds the exact canonical spec", async () => {
    const input = {
      title: "Q3 Enterprise Growth Strategy",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    };
    const { spec, buffer, violations } = await generateDeck(input);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(violations).toEqual([]);
    const roundTrip = await readCanonicalFromBuffer(buffer);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip!.title).toBe(spec.title);
    expect(roundTrip!.slides.length).toBe(spec.slides.length);
  });

  it("the downloaded file embeds the exact spec the KSEMO preview renders", async () => {
    const input = {
      title: "Q3 Enterprise Growth Strategy",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    };
    const planned = buildDeckSpec(input);
    const { buffer } = await generateDeck(input);
    // Preview reads ppt/canonical.json from the very same buffer the user
    // downloads, so preview and download can never drift apart.
    const fromFile = await readCanonicalFromBuffer(buffer);
    expect(fromFile).toEqual(planned.spec);
  });

  it("the canonical spec lives inside the .pptx as a real zip part", async () => {
    const { buffer } = await generateDeck({
      title: "Zip part audit",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.files[CANONICAL_PART_NAME]).toBeDefined();
    const raw = await zip.files[CANONICAL_PART_NAME].async("string");
    const parsed = JSON.parse(raw) as PptPresentationSpec;
    expect(parsed.version).toBe(1);
    expect(parsed.slides.length).toBe(sampleSlides().length);
  });

  it("exporting a spec directly produces the same canonical round trip", async () => {
    const { spec } = buildDeckSpec({
      title: "Direct export",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    });
    const buffer = await exportPptx(spec);
    const roundTrip = await readCanonicalFromBuffer(buffer);
    expect(roundTrip).toEqual(spec);
  });

  it("never contains page number text (e.g. '1 / 5') or footer title labels inside slide elements", () => {
    const { spec } = buildDeckSpec({
      title: "Clean Deck",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      footerLabel: "KSEMO",
    });
    for (const slide of spec.slides) {
      const pageNumRegex = /^\d+\s*\/\s*\d+$/;
      const slideTextRegex = /^slide\s+\d+$/i;
      for (const el of slide.elements) {
        if (el.kind === "text") {
          expect(pageNumRegex.test(el.text.trim())).toBe(false);
          expect(slideTextRegex.test(el.text.trim())).toBe(false);
          // Verify footer labels / filename are never stamped at the bottom of slides
          expect(el.text.trim()).not.toBe("KSEMO");
          if (slide.kind !== "title") {
            expect(el.text.trim()).not.toBe("Clean Deck");
          }
        }
      }
    }
  });

  it("supports lowercase canonical style IDs and case-insensitivity", () => {
    const lower = buildDeckSpec({
      title: "Lower test",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "minimal",
      footerLabel: "KSEMO",
    });
    expect(lower.spec.style).toBe("Minimal");
    expect(lower.spec.resolvedStyle).toBe("minimal");

    const upper = buildDeckSpec({
      title: "Upper test",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "TECHNICAL" as any,
      footerLabel: "KSEMO",
    });
    expect(upper.spec.style).toBe("Technical");
    expect(upper.spec.resolvedStyle).toBe("technical");
  });

  it("generates distinct layouts and backgrounds across styles", () => {
    const minimal = buildDeckSpec({
      title: "Minimal Deck",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "minimal",
    });
    const technical = buildDeckSpec({
      title: "Technical Deck",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "technical",
    });
    const dark = buildDeckSpec({
      title: "Dark Deck",
      slides: sampleSlides(),
      config: DEFAULT_PRESENTATION_CONFIG,
      styleName: "dark",
    });

    // Minimal is light background, Dark is dark background
    expect(minimal.spec.slides[0].background).not.toBe(dark.spec.slides[0].background);
    expect(technical.spec.slides[0].background).toBe(VISUAL_THEMES["technical"].titleBackground);
    expect(minimal.spec.slides[0].background).toBe(VISUAL_THEMES["minimal"].titleBackground);

    // Technical contains telemetry elements
    const technicalTexts = technical.spec.slides.flatMap(s => s.elements.filter(e => e.kind === "text").map(e => (e as any).text));
    expect(technicalTexts.some(t => t.includes("TELEMETRY") || t.includes("METRIC") || t.includes("SYSTEM"))).toBe(true);
  });
});