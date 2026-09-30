import { describe, expect, it } from "vitest";
import { normalizeCommand, routeBotCommand } from "./commandRouter";
import { isValidExternalUrl, normalizeSafeUrl } from "./urlSafety";

describe("commandRouter", () => {
  describe("normalization", () => {
    it("handles speech recognition quirks and filler words", () => {
      expect(normalizeCommand("Can you please open You Tube for me?")).toBe(
        "open youtube"
      );
      expect(normalizeCommand("Please go to Git Hub")).toBe("go to github");
      expect(normalizeCommand("Hey KSEMO, open linked in please")).toBe(
        "open linkedin"
      );
      expect(normalizeCommand("Could you search YouTube for React?")).toBe(
        "search youtube for react"
      );
    });
  });

  describe("basic navigation", () => {
    it("recognizes direct website navigation", () => {
      const commands = [
        { input: "Open YouTube", target: "YouTube", url: "https://www.youtube.com/" },
        { input: "Open Google", target: "Google", url: "https://www.google.com/" },
        { input: "Open GitHub", target: "GitHub", url: "https://github.com/" },
        { input: "Open Gmail", target: "Gmail", url: "https://mail.google.com/" },
        { input: "Open Wikipedia", target: "Wikipedia", url: "https://www.wikipedia.org/" },
        { input: "Open Instagram", target: "Instagram", url: "https://www.instagram.com/" },
        { input: "Open Reddit", target: "Reddit", url: "https://www.reddit.com/" },
        { input: "Open Netflix", target: "Netflix", url: "https://www.netflix.com/" },
        { input: "Open Spotify", target: "Spotify", url: "https://open.spotify.com/" },
        { input: "Open LinkedIn", target: "LinkedIn", url: "https://www.linkedin.com/" },
        { input: "Open Amazon", target: "Amazon", url: "https://www.amazon.com/" },
      ];

      for (const cmd of commands) {
        const action = routeBotCommand(cmd.input);
        expect(action.intent).toBe("navigate");
        expect(action.target).toBe(cmd.target);
        expect(action.url).toBe(cmd.url);
        expect(action.openNewTab).toBe(true);
      }
    });

    it("recognizes natural navigation variations", () => {
      const variations = [
        "Can you open YouTube?",
        "Please go to GitHub",
        "Take me to Google",
        "Launch Gmail",
        "Visit YouTube",
      ];

      for (const text of variations) {
        const action = routeBotCommand(text);
        expect(action.intent).toBe("navigate");
        expect(action.openNewTab).toBe(true);
      }
    });

    it("recognizes direct domain URLs", () => {
      const action = routeBotCommand("Open example.com");
      expect(action.intent).toBe("navigate");
      expect(action.url).toBe("https://example.com/");
    });
  });

  describe("YouTube specific content commands", () => {
    it("handles YouTube search and play commands", () => {
      const action1 = routeBotCommand("Search YouTube for Python tutorials");
      expect(action1.intent).toBe("youtube_search");
      expect(action1.query).toBe("Python tutorials");
      expect(action1.url).toContain("https://www.youtube.com/results?search_query=Python%20tutorials");

      const action2 = routeBotCommand("Open YouTube and search for React tutorials");
      expect(action2.intent).toBe("youtube_search");
      expect(action2.query).toBe("React tutorials");

      const action3 = routeBotCommand("Find Java tutorials on YouTube");
      expect(action3.intent).toBe("youtube_search");
      expect(action3.query).toBe("Java tutorials");

      const action4 = routeBotCommand("Open YouTube and search for A R Rahman songs");
      expect(action4.intent).toBe("youtube_search");
      expect(action4.query).toBe("A R Rahman songs");

      const action5 = routeBotCommand("Open YouTube and play Believer");
      expect(action5.intent).toBe("youtube_search");
      expect(action5.query).toBe("Believer");
      expect(action5.url).toContain("Believer");
    });
  });

  describe("general web search commands", () => {
    it("detects web search intent", () => {
      const action1 = routeBotCommand("Search the web for Python 3.14");
      expect(action1.intent).toBe("web_search");
      expect(action1.query).toBe("Python 3.14");
      expect(action1.statusText).toBe("Searching the web...");

      const action2 = routeBotCommand("Search online for today's technology news");
      expect(action2.intent).toBe("web_search");
      expect(action2.query).toBe("today's technology news");

      const action3 = routeBotCommand("Look up React documentation");
      expect(action3.intent).toBe("web_search");
      expect(action3.query).toBe("React documentation");
    });
  });

  describe("normal conversational AI questions", () => {
    it("identifies chat questions that should not trigger navigation", () => {
      const action1 = routeBotCommand("What is Python?");
      expect(action1.intent).toBe("chat");

      const action2 = routeBotCommand("Explain machine learning");
      expect(action2.intent).toBe("chat");

      const action3 = routeBotCommand("How does HTTP work?");
      expect(action3.intent).toBe("chat");
    });
  });

  describe("ambiguous and destructive safety", () => {
    it("blocks ambiguous navigation", () => {
      const action = routeBotCommand("Open that");
      expect(action.intent).toBe("ambiguous");
      expect(action.openNewTab).toBeFalsy();
    });

    it("blocks destructive actions", () => {
      const action = routeBotCommand("Delete all my files");
      expect(action.intent).toBe("destructive");
      expect(action.destructive).toBe(true);
    });
  });
});

describe("urlSafety", () => {
  it("allows safe http and https protocols", () => {
    expect(isValidExternalUrl("https://www.youtube.com/")).toBe(true);
    expect(isValidExternalUrl("http://example.com/")).toBe(true);
  });

  it("strictly blocks unsafe protocols", () => {
    expect(isValidExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isValidExternalUrl("data:text/html,test")).toBe(false);
    expect(isValidExternalUrl("vbscript:msgbox")).toBe(false);
    expect(isValidExternalUrl("file:///C:/test")).toBe(false);
  });

  it("normalizes domains safely", () => {
    expect(normalizeSafeUrl("youtube.com")).toBe("https://youtube.com");
    expect(normalizeSafeUrl("javascript:alert(1)")).toBeNull();
  });
});
