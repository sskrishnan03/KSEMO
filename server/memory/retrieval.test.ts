import { describe, expect, it } from "vitest";
import {
  retrieveRelevantMemories,
  scoreMemory,
  tokenize,
} from "./retrieval";

type MemoryLike = {
  id: string;
  userId: number;
  title: string;
  content: string;
  category: "general";
  isSensitive: boolean;
  source: "manual" | "chat";
  sourceConversationId: string | null;
  consentStatus: "explicit" | "silent";
  createdAt: Date;
  updatedAt: Date;
};

const base: MemoryLike = {
  id: "1",
  userId: 1,
  title: "t",
  content: "c",
  category: "general",
  isSensitive: false,
  source: "manual",
  sourceConversationId: null,
  consentStatus: "explicit",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function memory(partial: Partial<MemoryLike>): MemoryLike {
  return { ...base, ...partial };
}

describe("tokenize", () => {
  it("lowercases and strips stopwords", () => {
    expect(tokenize("My favorite food is sushi")).toEqual([
      "favorite",
      "food",
      "sushi",
    ]);
  });
});

describe("scoreMemory", () => {
  it("scores title matches higher than content matches", () => {
    const titleHit = scoreMemory(
      memory({ title: "cat allergy", content: "nothing here" }),
      ["cat"]
    );
    const contentHit = scoreMemory(
      memory({ title: "note", content: "my cat is gray" }),
      ["cat"]
    );
    expect(titleHit).toBe(2);
    expect(contentHit).toBe(1);
  });

  it("returns 0 when nothing matches", () => {
    expect(scoreMemory(memory({}), ["unrelated"])).toBe(0);
  });
});

describe("retrieveRelevantMemories", () => {
  it("returns only memories that match the query, capped at the limit", () => {
    const mems = [
      memory({ id: "a", content: "likes hiking in the mountains" }),
      memory({ id: "b", content: "does not like cooking" }),
      memory({ id: "c", content: "hiking boots on sale" }),
      memory({ id: "d", content: "mountain trail map" }),
    ];
    const result = retrieveRelevantMemories(mems, "hiking", 2);
    expect(result.map(m => m.id)).toEqual(["a", "c"]);
  });

  it("orders by score then recency", () => {
    const mems = [
      memory({
        id: "a",
        content: "likes hiking in the mountains",
        updatedAt: new Date("2024-01-01"),
      }),
      memory({
        id: "b",
        content: "hiking",
        updatedAt: new Date("2025-01-01"),
      }),
    ];
    const result = retrieveRelevantMemories(mems, "hiking mountains", 5);
    expect(result[0].id).toBe("a");
  });

  it("returns nothing for an unrelated query", () => {
    const mems = [memory({ content: "loves rainy days" })];
    expect(retrieveRelevantMemories(mems, "sailing")).toHaveLength(0);
  });
});