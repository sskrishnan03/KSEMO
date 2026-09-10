// Cheap, deterministic first-pass detection used to decide whether to even
// bother calling the (more expensive) LLM planner. This keeps normal questions
// from paying an extra model round-trip. It intentionally over-matches; the
// planner confirms whether a real file should be generated.

const FILE_ACTION_WORDS = [
  "create",
  "make",
  "generate",
  "produce",
  "build",
  "write",
  "draft",
  "convert",
  "export",
  "add",
  "compile",
  "design",
  "prepare",
];

const FILE_FORMAT_HINTS = [
  "pdf",
  "word",
  "docx",
  "doc",
  "excel",
  "xlsx",
  "xls",
  "spreadsheet",
  "powerpoint",
  "pptx",
  "ppt",
  "presentation",
  "slides",
  "text file",
  "txt",
  "resume",
  "cv",
  "invoice",
  "letter",
  "report",
  "budget",
  "notes",
  "table",
  "document",
  "file",
  "outline",
  "essay",
  "memo",
  "agenda",
];

export function looksLikeFileRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAction = FILE_ACTION_WORDS.some(word =>
    lower.includes(` ${word} `) ||
    lower.startsWith(`${word} `) ||
    lower.includes(` ${word}.`) ||
    lower.includes(` ${word},`) ||
    lower.includes(` ${word} a `) ||
    lower.includes(` ${word} this `) ||
    lower.includes(`${word} me `) ||
    lower.includes(`${word} an `) ||
    lower.includes(`${word} the `)
  );
  // "convert X into PDF", "make this into a PDF", "give me this as a PDF"
  const conversion = /(convert|make|turn|give|export|format|send).*(into|to|as a)?\s*(pdf|word|docx|excel|xlsx|spreadsheet|powerpoint|pptx|presentation|text)/i.test(
    lower
  );
  // "attach / file" phrasing
  const explicitFile = /(file|document|spreadsheet|presentation|resume|invoice|report|budget)\b/.test(
    lower
  ) && /(create|make|generate|produce|build|draft|write|export|convert)/.test(lower);

  return hasAction || conversion || explicitFile;
}

export function likelyFormatHint(message: string): string | null {
  const lower = message.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/xlsx|\bexcel\b|spreadsheet|budget|student marks|marksheet|grade/, "xlsx"],
    [/pptx|\bpowerpoint\b|\bppt\b|presentation|slides/, "pptx"],
    [/docx|\bword\b|\bdoc\b/, "docx"],
    [/\btxt\b|text file/, "txt"],
    [/pdf/, "pdf"],
  ];
  for (const [re, fmt] of map) if (re.test(lower)) return fmt;
  return null;
}
