import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KsemoCodeBlock,
  KsemoMarkdownCode,
  codeBlockDownloadName,
  codeBlockLanguageLabel,
} from "./code-block";

function blockNodePosition(startLine: number, endLine: number) {
  // The `node` prop is what the markdown renderer passes to components.
  return {
    node: { position: { start: { line: startLine }, end: { line: endLine } } },
  };
}

describe("codeBlockLanguageLabel", () => {
  it("maps common aliases to display names", () => {
    expect(codeBlockLanguageLabel("typescript")).toBe("TypeScript");
    expect(codeBlockLanguageLabel("ts")).toBe("TypeScript");
    expect(codeBlockLanguageLabel("c++")).toBe("C++");
    expect(codeBlockLanguageLabel("C#")).toBe("C#");
    expect(codeBlockLanguageLabel("JSX")).toBe("JSX");
  });

  it("falls back to a neutral label for unknown or missing languages", () => {
    expect(codeBlockLanguageLabel("")).toBe("Code");
    expect(codeBlockLanguageLabel("not-a-real-lang")).toBe("Code");
    expect(codeBlockLanguageLabel(undefined)).toBe("Code");
  });
});

describe("codeBlockDownloadName", () => {
  it("derives a safe, typed filename", () => {
    expect(codeBlockDownloadName("python")).toBe("python-code.py");
    expect(codeBlockDownloadName("bash")).toBe("bash-code.sh");
    expect(codeBlockDownloadName("c++")).toBe("c-code.cpp");
  });

  it("falls back to code.txt", () => {
    expect(codeBlockDownloadName("")).toBe("code.txt");
  });
});

describe("KsemoMarkdownCode inline vs fenced detection", () => {
  it("renders single-line code without a language class as inline", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoMarkdownCode, {
        ...blockNodePosition(2, 2),
        children: "keep this value",
      })
    );
    expect(markup).toContain('data-streamdown="inline-code"');
    expect(markup).toContain("keep this value");
    expect(markup).not.toContain("Copy code");
  });

  it("renders a language-fenced block even without ast position info", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoMarkdownCode, {
        className: "language-tsx",
        children: "const x = 1;",
      })
    );
    expect(markup).not.toContain('data-streamdown="inline-code"');
    expect(markup).toContain('data-language="tsx"');
    expect(markup).toContain("TSX");
  });

  it("renders a multiline bare fence as a block with a Code label", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoMarkdownCode, {
        ...blockNodePosition(1, 3),
        children: "line one\nline two",
      })
    );
    expect(markup).not.toContain('data-streamdown="inline-code"');
    expect(markup).toContain('data-language="text"');
    expect(markup).toContain("Code");
  });
});

describe("KsemoCodeBlock", () => {
  it("exposes the language label, copy control, and the code text", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoCodeBlock, {
        code: "console.log('hi');",
        rawLanguage: "javascript",
      })
    );
    expect(markup).toContain("JavaScript");
    expect(markup).toContain("Copy code");
    expect(markup).toContain("console.log");
    expect(markup).toContain('data-language="javascript"');
  });

  it("preserves multiline formatting and indentation exactly", () => {
    const code = 'function greet(name) {\n  return `hello ${name}`;\n}';
    const markup = renderToStaticMarkup(
      createElement(KsemoCodeBlock, { code, rawLanguage: "js" })
    );
    expect(markup).toContain("return `hello ${name}`;");
    expect(markup).toContain("  return ");
  });

  it("keeps long lines intact and never becomes a vertical scroll trap", () => {
    const longLine =
      "const payload = { id: 1, name: 'a very long value that will overflow the block width on most screens', tags: ['x','y','z'], nested: { deep: true } };";
    const markup = renderToStaticMarkup(
      createElement(KsemoCodeBlock, { code: longLine, rawLanguage: "ts" })
    );
    // The whole line must survive (horizontal scroll, not wrapping/truncation).
    // Server rendering entity-escapes the single quotes, so compare against the
    // escaped form to prove line integrity.
    expect(markup).toContain(longLine.replace(/'/g, "&#x27;"));
    // The block clips at its own bounds so long code never widens the page.
    expect(markup).toContain("overflow-hidden");
    // No internal vertical scrolling element anywhere in the block.
    expect(markup).not.toContain("overflow-y-auto");
    expect(markup).not.toContain("maxHeight");
  });
});