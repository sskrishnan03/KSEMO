import type { FileFormat } from "./capabilities";

export type DetectedFileRequest = {
  isFileRequest: boolean;
  format: FileFormat | null;
  cleanedPrompt: string;
};

/**
 * Normalizes keyword tokens to one of the 5 canonical file formats:
 * pdf | docx | xlsx | pptx | txt
 */
export function resolveFormatKeyword(keyword: string): FileFormat | null {
  const kw = keyword.trim().toLowerCase();

  // PDF
  if (/^pdf(\s+file|\s+document|\s+doc|\s+format)?$/i.test(kw) || kw === "pdf") {
    return "pdf";
  }

  // Word (.docx)
  if (
    /^(word|docx?|ms\s*word)(\s+file|\s+document|\s+doc|\s+format)?$/i.test(kw) ||
    kw === "docx" ||
    kw === "doc" ||
    kw === "word"
  ) {
    return "docx";
  }

  // Excel (.xlsx)
  if (
    /^(excel|xlsx?|spreadsheet|spreadsheets|workbook|workbooks|sheets?)(\s+file|\s+sheet|\s+format)?$/i.test(kw) ||
    kw === "xlsx" ||
    kw === "xls" ||
    kw === "excel" ||
    kw === "spreadsheet"
  ) {
    return "xlsx";
  }

  // PowerPoint (.pptx)
  if (
    /^(powerpoint|power\s*point|pptx?|presentation|presentations|slide\s*deck|slides?)(\s+(?:presentation|slides?|deck|file|format))?$/i.test(kw) ||
    kw === "pptx" ||
    kw === "ppt" ||
    kw === "powerpoint" ||
    kw === "presentation" ||
    kw === "slides"
  ) {
    return "pptx";
  }

  // Text (.txt)
  if (
    /^(text|txt|plain\s*text)(\s+file|\s+format)?$/i.test(kw) ||
    kw === "txt" ||
    kw === "text file" ||
    kw === "plain text"
  ) {
    return "txt";
  }

  return null;
}

/**
 * Strips command prefixes or trailing format indicators to yield the clean topic prompt.
 */
export function cleanPromptText(text: string, format?: FileFormat | null): string {
  let cleaned = text
    .replace(/^\/?(pdf|docx|word|xlsx|excel|pptx|powerpoint|ppt|txt|text)\s*[:\s-]\s*/i, "")
    .replace(/^(can you\s+)?(i\s+want|i\s+need|give\s+me|can\s+you\s+give\s+me|can\s+you\s+provide|can\s+you\s+send|please\s+)?(this|that|it)?\s*(in|into|to|as\s+a|as)?\s*(pdf|word|docx|excel|xlsx|powerpoint|pptx|text|txt)?\s*/i, "")
    .replace(/(?:[,;.-]|\band\b)?\s*(?:i\s+want\s+(?:this\s+)?in|give\s+me\s+(?:this\s+)?in|in|as\s+a|as)\s+(?:a\s+)?(pdf|word|docx|excel|xlsx|spreadsheet|powerpoint|pptx|presentation|slides|text\s*file|txt)(?:\s+(?:format|file|document))?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.toLowerCase() === "this" || cleaned.toLowerCase() === "that") {
    return text.trim();
  }
  return cleaned;
}

/**
 * Detects whether an input query is asking to create/export/generate a file,
 * and extracts the target format (pdf, docx, xlsx, pptx, txt).
 */
export function detectFileRequest(input: string): DetectedFileRequest {
  const text = (input ?? "").trim();
  if (!text) {
    return { isFileRequest: false, format: null, cleanedPrompt: "" };
  }

  // Guard against purely definitional / informational queries about file formats
  // e.g. "What is a PDF?", "How do I open docx files?", "Tell me about Excel formulas"
  const isPureDefinitionInquiry =
    /^(what\s+is|what's|what\s+are|how\s+(?:do\s+i|to|can\s+i)\s+(?:open|read|view|use)|why\s+is|tell\s+me\s+about|explain\s+what\s+is|difference\s+between)\s+(?:a\s+|an\s+|the\s+)?(?:pdf|docx?|excel|spreadsheet|powerpoint|pptx|text\s+file)\b/i.test(
      text
    ) &&
    !/(?:create|generate|make|give|send|convert|export|write|download|save|i\s+want)/i.test(text);

  if (isPureDefinitionInquiry) {
    return { isFileRequest: false, format: null, cleanedPrompt: text };
  }

  // 1. Explicit slash command or format prefix:
  // e.g. "/pdf ...", "/docx ...", "/xlsx ...", "/pptx ...", "/txt ...", "/word ...", "/excel ...", "pdf: ...", "excel: ..."
  const prefixMatch = text.match(
    /^\/?(pdf|docx|word|xlsx|excel|pptx|powerpoint|ppt|txt|text)\s*[:\s-]\s*(.*)$/i
  );
  if (prefixMatch) {
    const rawFmt = prefixMatch[1].toLowerCase();
    const prompt = prefixMatch[2].trim();
    const format = resolveFormatKeyword(rawFmt);
    if (format) {
      return { isFileRequest: true, format, cleanedPrompt: prompt || text };
    }
  }

  // 2. Format request targeting "this", previous messages, or conversation:
  // e.g. "I want this in PDF", "give me this in PDF", "can you give me this in excel",
  // "make this a presentation", "convert this to word", "export this as PDF", "save this as an excel sheet"
  const wantInFormatMatch = text.match(
    /(?:(?:i\s+)?(?:want|need)|give(?:\s+me)?|can\s+you\s+(?:give(?:\s+me)?|provide|send(?:\s+me)?|make)|please\s+(?:give(?:\s+me)?|make|send)|provide(?:\s+me)?|send(?:\s+me)?|make|turn|convert|export|save|download|put)\s+(?:this|that|it|everything|the\s+above)?\s*(?:in|into|to|as\s+a|as)\s+(?:a\s+|an\s+)?([a-z\s]+?)(?:\s+(?:format|file|doc|document|presentation|spreadsheet|deck))?(?:[?.!,]|$)/i
  );
  if (wantInFormatMatch) {
    const matchedKeyword = wantInFormatMatch[1].trim();
    const format = resolveFormatKeyword(matchedKeyword);
    if (format) {
      return { isFileRequest: true, format, cleanedPrompt: cleanPromptText(text, format) };
    }
  }

  // 3. Natural phrase "in [format]" / "as a [format]" anywhere in request:
  // e.g. "give me the company budget in PDF", "I want the summary in Word", "give me student marks as excel"
  const inFormatMatch = text.match(
    /\b(?:in|into|as\s+a|as)\s+(?:a\s+|an\s+)?(pdf|word(?:\s+document|\s+doc)?|docx|excel(?:\s+sheet|\s+spreadsheet)?|xlsx|spreadsheet|powerpoint(?:\s+presentation)?|pptx|presentation|slides?|text\s*file|txt)(?:\s+(?:format|file))?\b/i
  );
  if (inFormatMatch) {
    const matchedKeyword = inFormatMatch[1].trim();
    const format = resolveFormatKeyword(matchedKeyword);
    if (format) {
      // Ensure there is an actionable verb or intent in the sentence
      const hasActionOrIntent =
        /(?:create|make|generate|produce|build|write|draft|give|send|provide|want|need|turn|convert|export|save|download|put|prepare|compile)/i.test(
          text
        );
      if (hasActionOrIntent) {
        return { isFileRequest: true, format, cleanedPrompt: cleanPromptText(text, format) };
      }
    }
  }

  // 4. Creation command with format:
  // e.g. "create a PDF of...", "generate an excel sheet for...", "make a powerpoint presentation about...", "write a word document..."
  const createMatch = text.match(
    /\b(create|generate|make|build|draft|write|produce|prepare|compile)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?([a-z\s]+?)\s+(?:file|document|doc|sheet|spreadsheet|presentation|deck|report|essay)?\s+(?:of|about|for|with|on|regarding|showing)\b/i
  );
  if (createMatch) {
    const matchedKeyword = createMatch[2].trim();
    const format = resolveFormatKeyword(matchedKeyword);
    if (format) {
      return { isFileRequest: true, format, cleanedPrompt: cleanPromptText(text, format) };
    }
  }

  // 5. Direct create format:
  // e.g. "create a PDF", "generate an excel file", "make a presentation", "draft a word document"
  const directCreateMatch = text.match(
    /\b(create|generate|make|build|draft|write|produce|prepare)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(pdf|word(?:\s+doc(?:ument)?)?|docx|excel(?:\s+sheet|\s+spreadsheet)?|xlsx|spreadsheet|powerpoint(?:\s+presentation)?|pptx|presentation|slides?|text\s*file|txt)\b/i
  );
  if (directCreateMatch) {
    const matchedKeyword = directCreateMatch[2].trim();
    const format = resolveFormatKeyword(matchedKeyword);
    if (format) {
      return { isFileRequest: true, format, cleanedPrompt: cleanPromptText(text, format) };
    }
  }

  // 6. Trailing format clause:
  // e.g. "Explain photosynthesis, I want this in PDF" or "... in PDF format"
  const trailingMatch = text.match(
    /(?:[,;.-]|\band\b)?\s*(?:i\s+want\s+(?:this\s+)?in|give\s+me\s+(?:this\s+)?in|in|as\s+a|as)\s+(?:a\s+)?(pdf|word(?:\s+document)?|docx|excel(?:\s+sheet|\s+spreadsheet)?|xlsx|spreadsheet|powerpoint(?:\s+presentation|\s+slides?)?|pptx|presentation|slides?|text\s*file|txt)(?:\s+(?:format|file|document))?\s*$/i
  );
  if (trailingMatch) {
    const matchedKeyword = trailingMatch[1].trim();
    const format = resolveFormatKeyword(matchedKeyword);
    if (format) {
      return { isFileRequest: true, format, cleanedPrompt: cleanPromptText(text, format) };
    }
  }

  return { isFileRequest: false, format: null, cleanedPrompt: text };
}

/**
 * Backward-compatible helper that returns true if query looks like a file request.
 */
export function looksLikeFileRequest(message: string): boolean {
  return detectFileRequest(message).isFileRequest;
}

/**
 * Backward-compatible helper that extracts the likely format hint.
 */
export function likelyFormatHint(message: string): FileFormat | null {
  return detectFileRequest(message).format;
}
