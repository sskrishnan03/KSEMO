import { describe, expect, it } from "vitest";
import {
  embedSourcesInContent,
  parseContentWithSources,
} from "@shared/research";

const sources = [
  {
    sourceId: "s1",
    title: "Wikipedia – Climate Change",
    url: "https://en.wikipedia.org/wiki/Climate_change",
    domain: "wikipedia.org",
    retrievedDate: "2025-09-04",
  },
  {
    sourceId: "s2",
    title: "NASA – Global Climate Change",
    url: "https://climate.nasa.gov/",
    domain: "nasa.gov",
    retrievedDate: "2025-09-04",
  },
];

describe("embedSourcesInContent / parseContentWithSources", () => {
  it("round-trips sources through embed + parse", () => {
    const answer = "Climate change is real [1]. See also [2].";
    const embedded = embedSourcesInContent(answer, sources);
    const { answer: parsedAnswer, sources: parsedSources } =
      parseContentWithSources(embedded);

    expect(parsedAnswer).toBe(answer);
    expect(parsedSources).toHaveLength(2);
    expect(parsedSources[0].sourceId).toBe("s1");
    expect(parsedSources[1].sourceId).toBe("s2");
    expect(parsedSources[0].domain).toBe("wikipedia.org");
    expect(parsedSources[1].domain).toBe("nasa.gov");
  });

  it("returns the raw content when no sources marker is present", () => {
    const plain = "Just a normal message with no sources.";
    const { answer, sources: extracted } = parseContentWithSources(plain);
    expect(answer).toBe(plain);
    expect(extracted).toHaveLength(0);
  });

  it("handles empty content gracefully", () => {
    const { answer, sources: extracted } = parseContentWithSources("");
    expect(answer).toBe("");
    expect(extracted).toHaveLength(0);
  });

  it("strips the marker while preserving the answer text", () => {
    const answer = "Some research result with citation [1] and [2].\n";
    const embedded = embedSourcesInContent(answer, sources);
    const { answer: parsed } = parseContentWithSources(embedded);

    expect(parsed).toBe(answer.trimEnd());
    expect(embedded).toContain("<!--KSEMO_SOURCES_START-->");
    expect(parsed).not.toContain("<!--KSEMO_SOURCES_START-->");
  });
});
