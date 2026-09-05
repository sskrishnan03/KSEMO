import { describe, expect, it } from "vitest";
import { buildSource, normalizeCitedSources } from "./sources";
import type { Source } from "@shared/research";

function makeSources(count: number): Source[] {
  return Array.from({ length: count }, (_, i) => {
    const source = buildSource({
      index: i,
      title: `Source ${i + 1}`,
      link: `https://example.com/${i + 1}`,
      snippet: `Snippet ${i + 1}`,
    });
    expect(source).not.toBeNull();
    return source as Source;
  });
}

describe("normalizeCitedSources", () => {
  it("keeps only cited sources, in first-citation order, renumbering markers", () => {
    const sources = makeSources(8);
    const answer = "Models improved significantly [3] and [6]. Costs fell [6] again.";
    const { answer: rewritten, sources: used } = normalizeCitedSources(
      answer,
      sources
    );
    expect(rewritten).toBe("Models improved significantly [1] and [2]. Costs fell [2] again.");
    expect(used.map(s => s.title)).toEqual(["Source 3", "Source 6"]);
  });

  it("preserves citations to sources that were never supplied", () => {
    const sources = makeSources(2);
    const answer = "Claim [1] and stray [9].";
    const { answer: rewritten, sources: used } = normalizeCitedSources(
      answer,
      sources
    );
    expect(rewritten).toBe("Claim [1] and stray [9].");
    expect(used.map(s => s.title)).toEqual(["Source 1"]);
  });

  it("falls back to the top sources when nothing was cited", () => {
    const sources = makeSources(8);
    const answer = "No citations in this answer.";
    const { answer: rewritten, sources: used } = normalizeCitedSources(
      answer,
      sources
    );
    expect(rewritten).toBe(answer);
    expect(used).toHaveLength(6);
    expect(used[0].title).toBe("Source 1");
    expect(used[5].title).toBe("Source 6");
  });

  it("returns empty sources for an empty input", () => {
    const { sources: used } = normalizeCitedSources("anything", []);
    expect(used).toEqual([]);
  });

  it("keeps the answer untouched when all citations match the fallback", () => {
    const sources = makeSources(3);
    const answer = "Point [2] supports this claim [1].";
    const { sources: used } = normalizeCitedSources(answer, sources);
    // order follows first use: [2] then [1]
    expect(used.map(s => s.title)).toEqual(["Source 2", "Source 1"]);
  });
});