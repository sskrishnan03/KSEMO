import { describe, expect, it } from "vitest";
import {
  extractMemoryCandidates,
  type ConversationForExtraction,
} from "./extract";

function conv(
  id: string,
  messages: string[]
): ConversationForExtraction {
  return {
    id,
    title: "Chat",
    messages: messages.map(content => ({ role: "user", content })),
  };
}

describe("extractMemoryCandidates", () => {
  it("extracts preferences from likes and dislikes", () => {
    const { candidates } = extractMemoryCandidates([
      conv("11aa", ["I really like hiking on weekends.", "My favorite food is sushi."]),
    ]);
    const categories = candidates.map(c => c.category);
    expect(categories).toEqual(["preference", "preference"]);
    expect(candidates[0].content).toContain("hiking");
    expect(candidates[1].content).toContain("sushi");
  });

  it("categorizes relationship details as sensitive and filters them by default", () => {
    const { candidates, blockedSensitive } = extractMemoryCandidates([
      conv("11bb", ["My wife and I are moving next month."]),
    ]);
    expect(candidates).toHaveLength(0);
    expect(blockedSensitive).toBe(1);
  });

  it("includes sensitive candidates when includeSensitive is true", () => {
    const { candidates, blockedSensitive } = extractMemoryCandidates(
      [conv("11cc", ["My wife and I are moving next month."])],
      { includeSensitive: true }
    );
    expect(blockedSensitive).toBe(0);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].category).toBe("relationship");
    expect(candidates[0].sensitive).toBe(true);
  });

  it("detects health conditions", () => {
    const { candidates } = extractMemoryCandidates(
      [conv("11dd", ["I am allergic to peanuts."])],
      { includeSensitive: true }
    );
    expect(candidates[0]?.category).toBe("health");
  });

  it("detects explicit remember-that instructions as general", () => {
    const { candidates } = extractMemoryCandidates([
      conv("11ee", ["Remember that I grew up in Chicago."]),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].category).toBe("general");
  });

  it("lets a specific category win inside a remember-that command", () => {
    const { candidates } = extractMemoryCandidates([
      conv("11e1", ["Remember that I prefer quiet coffee shops."]),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].category).toBe("preference");
  });

  it("blocks a remember-that capture that contains sensitive markers", () => {
    const { candidates, blockedSensitive } = extractMemoryCandidates([
      conv("11ff", ["please remember that I have arthritis"]),
    ]);
    expect(candidates).toHaveLength(0);
    expect(blockedSensitive).toBe(1);
  });

  it("prefers the specific category over the general remember rule", () => {
    const { candidates } = extractMemoryCandidates(
      [conv("11gg", ["remember that my husband is a chef"])],
      { includeSensitive: true }
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].category).toBe("relationship");
  });

  it("dedupes identical sentences across conversations", () => {
    const { candidates } = extractMemoryCandidates([
      conv("11hh", ["I love reading."]),
      conv("11ii", ["I love reading."]),
    ]);
    expect(candidates).toHaveLength(1);
  });

  it("ignores assistant messages", () => {
    const { candidates } = extractMemoryCandidates([
      {
        id: "11jj",
        title: "Chat",
        messages: [
          { role: "user", content: "I love reading." },
          { role: "assistant", content: "I love reading." },
        ],
      },
    ]);
    expect(candidates).toHaveLength(1);
  });

  it("flags financial markers", () => {
    const { candidates, blockedSensitive } = extractMemoryCandidates([
      conv("11kk", ["my salary is 90000 a year"]),
    ]);
    expect(candidates).toHaveLength(0);
    expect(blockedSensitive).toBe(1);
  });
});