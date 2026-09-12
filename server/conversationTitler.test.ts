import { describe, expect, it, vi } from "vitest";
import {
  cleanGeneratedTitle,
  formatConversationForTitler,
  toTitleCase,
  createInitialTitle,
  createFallbackTitle,
  resolveConversationTitle,
  generateAiConversationTitle,
} from "./conversationTitler";
import * as llmModule from "./_core/llm";

describe("conversationTitler", () => {
  describe("toTitleCase", () => {
    it("capitalizes words and keeps minor words lowercase when appropriate", () => {
      expect(toTitleCase("flight booking and ticket design")).toBe(
        "Flight Booking and Ticket Design"
      );
    });

    it("preserves uppercase acronyms", () => {
      expect(toTitleCase("python async API setup")).toBe(
        "Python Async API Setup"
      );
    });
  });

  describe("cleanGeneratedTitle", () => {
    it("strips wrapping quotes and markdown", () => {
      expect(cleanGeneratedTitle('"Python Async API Setup"')).toBe(
        "Python Async API Setup"
      );
      expect(cleanGeneratedTitle("**Flight Booking Ticket Architecture**")).toBe(
        "Flight Booking Ticket Architecture"
      );
      expect(cleanGeneratedTitle("`Retail Space Layout Planning`")).toBe(
        "Retail Space Layout Planning"
      );
    });

    it("strips label prefixes like Title: or Topic:", () => {
      expect(
        cleanGeneratedTitle("Title: Retail Space Layout Planning")
      ).toBe("Retail Space Layout Planning");
      expect(cleanGeneratedTitle('Topic: "Flight Booking Ticket Architecture"')).toBe(
        "Flight Booking Ticket Architecture"
      );
      expect(cleanGeneratedTitle("Subject: Database Index Optimization")).toBe(
        "Database Index Optimization"
      );
    });

    it("strips trailing punctuation", () => {
      expect(
        cleanGeneratedTitle("Python Async API Setup.")
      ).toBe("Python Async API Setup");
      expect(
        cleanGeneratedTitle("Flight Booking Architecture!")
      ).toBe("Flight Booking Architecture");
    });

    it("strips forbidden filler phrases at the beginning", () => {
      expect(
        cleanGeneratedTitle("Question About Python Async API Setup")
      ).toBe("Python Async API Setup");
      expect(
        cleanGeneratedTitle("Help With Retail Space Layout Planning")
      ).toBe("Retail Space Layout Planning");
      expect(
        cleanGeneratedTitle("Discussion On Modern Database Architectures")
      ).toBe("Modern Database Architectures");
    });

    it("enforces a maximum of 5 words", () => {
      expect(
        cleanGeneratedTitle("One Two Three Four Five Six Seven")
      ).toBe("One Two Three Four Five");
    });

    it("rejects single word or empty outputs", () => {
      expect(cleanGeneratedTitle("Help")).toBeNull();
      expect(cleanGeneratedTitle("")).toBeNull();
      expect(cleanGeneratedTitle("   ")).toBeNull();
    });
  });

  describe("formatConversationForTitler", () => {
    it("formats short conversation correctly", () => {
      const messages = [
        { role: "user", content: "How do I setup async Python APIs?" },
        { role: "assistant", content: "You can use FastAPI with uvicorn." },
      ];
      const result = formatConversationForTitler(messages);
      expect(result).toContain("User: How do I setup async Python APIs?");
      expect(result).toContain("Assistant: You can use FastAPI with uvicorn.");
    });

    it("prunes long conversations to first exchange + latest exchange", () => {
      const messages = [
        { role: "user", content: "Message 1 (start)" },
        { role: "assistant", content: "Message 2 (reply 1)" },
        { role: "user", content: "Message 3 (middle)" },
        { role: "assistant", content: "Message 4 (middle)" },
        { role: "user", content: "Message 5 (middle)" },
        { role: "assistant", content: "Message 6 (middle)" },
        { role: "user", content: "Message 7 (late user)" },
        { role: "assistant", content: "Message 8 (late assistant)" },
      ];
      const result = formatConversationForTitler(messages);
      expect(result).toContain("Message 1 (start)");
      expect(result).toContain("Message 2 (reply 1)");
      expect(result).not.toContain("Message 3 (middle)");
      expect(result).not.toContain("Message 4 (middle)");
      expect(result).toContain("Message 7 (late user)");
      expect(result).toContain("Message 8 (late assistant)");
    });

    it("uses fallback user prompt and assistant response when messages array is empty", () => {
      const result = formatConversationForTitler([], "Calculate flight seats", "Here is the calculation");
      expect(result).toContain("User: Calculate flight seats");
      expect(result).toContain("Assistant: Here is the calculation");
    });
  });

  describe("createInitialTitle and createFallbackTitle", () => {
    it("generates a quick initial title in Title Case", () => {
      const title = createInitialTitle("how to build a flight booking ticket system");
      expect(title).toBe("How to Build a Flight Booking Ticket System");
    });

    it("falls back to heuristic topic extraction on long queries", () => {
      const fallback = createFallbackTitle(
        "I need help with how to partition a 22x12 retail store into fitting rooms and cash wrap",
        "Here are recommendations for partitioning your retail store"
      );
      expect(fallback.length).toBeGreaterThan(0);
      expect(fallback).not.toContain("I need help with");
    });
  });

  describe("generateAiConversationTitle and resolveConversationTitle", () => {
    it("returns cleaned AI title when invokeLLM succeeds", async () => {
      const invokeSpy = vi.spyOn(llmModule, "invokeLLM").mockResolvedValueOnce({
        id: "mock",
        object: "chat.completion",
        created: Date.now(),
        model: "gemini-flash-lite-latest",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: 'Title: "Flight Booking Ticket Architecture".',
            },
            finish_reason: "stop",
          },
        ],
      });

      const title = await generateAiConversationTitle({
        userPrompt: "I want to build a flight booking system",
        assistantResponse: "Here is how to design the ticket system",
      });

      expect(title).toBe("Flight Booking Ticket Architecture");
      invokeSpy.mockRestore();
    });

    it("falls back to deterministic title when invokeLLM fails", async () => {
      const invokeSpy = vi.spyOn(llmModule, "invokeLLM").mockRejectedValueOnce(new Error("Rate limit"));

      const title = await resolveConversationTitle({
        userContent: "Retail store partition planning guide",
        assistantContent: "Here are the layout options",
      });

      expect(title).toBe("Retail Store Partition Planning Guide");
      invokeSpy.mockRestore();
    });
  });
});
