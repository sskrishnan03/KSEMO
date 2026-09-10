// Quality validation engine. After document generation, this module inspects
// the generated file to detect common issues before returning it to the user.
// It performs both structural validation (on the DocumentSpec) and byte-level
// validation (on the final file buffer).

import type { DocumentSpec, DocBlock } from "./spec";

export type QualityIssue = {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  fixable: boolean;
};

export type QualityReport = {
  passed: boolean;
  issues: QualityIssue[];
  stats: {
    blockCount: number;
    tableCount: number;
    headingCount: number;
    paragraphCount: number;
    listCount: number;
    estimatedPages: number;
    hasTitle: boolean;
    hasStructure: boolean;
    hasReferences: boolean;
    byteSize: number;
  };
};

// ─── Structural Validation ──────────────────────────────────────────────────

function validateSpecStructure(spec: DocumentSpec): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Check format
  if (!spec.format) {
    issues.push({
      severity: "error",
      category: "format",
      message: "Document format is missing.",
      fixable: false,
    });
  }

  // Check filename
  if (!spec.filename || spec.filename.length < 2) {
    issues.push({
      severity: "warning",
      category: "filename",
      message: "Filename is missing or too short.",
      fixable: true,
    });
  }

  // Check title
  if (!spec.title || spec.title.length < 2) {
    issues.push({
      severity: "warning",
      category: "title",
      message: "Document title is missing or too short.",
      fixable: true,
    });
  }

  // Check content
  const isTextFormat = ["pdf", "docx", "txt"].includes(spec.format);

  if (isTextFormat) {
    const blocks = spec.blocks ?? [];
    if (blocks.length === 0) {
      issues.push({
        severity: "error",
        category: "content",
        message: "Document has no content blocks.",
        fixable: false,
      });
      return issues;
    }

    // Check for title heading
    const hasTitle = blocks.some(
      b => b.type === "heading" && b.level === 1
    );
    if (!hasTitle) {
      issues.push({
        severity: "info",
        category: "structure",
        message: "Document has no level-1 heading.",
        fixable: true,
      });
    }

    // Check for at least one section heading
    const hasSectionHeadings = blocks.some(
      b => b.type === "heading" && b.level === 2
    );
    if (!hasSectionHeadings && blocks.length > 5) {
      issues.push({
        severity: "info",
        category: "structure",
        message: "Document lacks section headings for organization.",
        fixable: true,
      });
    }

    // Check for empty paragraphs
    const emptyParagraphs = blocks.filter(
      b => b.type === "paragraph" && (!b.text || b.text.trim().length === 0)
    );
    if (emptyParagraphs.length > 0) {
      issues.push({
        severity: "warning",
        category: "content",
        message: `${emptyParagraphs.length} empty paragraph(s) found.`,
        fixable: true,
      });
    }

    // Check for tables with no rows
    const emptyTables = blocks.filter(
      b => b.type === "table" && (!b.rows || b.rows.length === 0)
    );
    if (emptyTables.length > 0) {
      issues.push({
        severity: "warning",
        category: "content",
        message: `${emptyTables.length} empty table(s) found.`,
        fixable: true,
      });
    }

    // Check for very short documents
    const totalText = blocks
      .filter((b): b is Extract<DocBlock, { type: "paragraph" | "heading" }> =>
        b.type === "paragraph" || b.type === "heading"
      )
      .reduce((acc, b) => acc + (b.text?.length || 0), 0);

    if (totalText < 100 && blocks.length > 0) {
      issues.push({
        severity: "info",
        category: "content",
        message: "Document content is quite short.",
        fixable: false,
      });
    }
  } else if (spec.format === "xlsx") {
    const sheets = spec.sheets ?? [];
    if (sheets.length === 0) {
      issues.push({
        severity: "error",
        category: "content",
        message: "Spreadsheet has no sheets.",
        fixable: false,
      });
    }
    for (const sheet of sheets) {
      if (!sheet.rows || sheet.rows.length === 0) {
        issues.push({
          severity: "warning",
          category: "content",
          message: `Sheet "${sheet.name}" has no rows.`,
          fixable: false,
        });
      }
    }
  } else if (spec.format === "pptx") {
    const slides = spec.slides ?? [];
    if (slides.length === 0) {
      issues.push({
        severity: "error",
        category: "content",
        message: "Presentation has no slides.",
        fixable: false,
      });
    }
  }

  return issues;
}

// ─── Byte-level Validation ──────────────────────────────────────────────────

function validateFileBytes(
  buffer: Buffer,
  format: string
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (!buffer || buffer.length === 0) {
    issues.push({
      severity: "error",
      category: "file",
      message: "Generated file is empty.",
      fixable: false,
    });
    return issues;
  }

  // Check minimum size (a valid document should be at least a few hundred bytes)
  if (buffer.length < 200) {
    issues.push({
      severity: "warning",
      category: "file",
      message: "Generated file is unusually small.",
      fixable: false,
    });
  }

  // Format-specific byte validation
  switch (format) {
    case "pdf": {
      // Check PDF header
      const header = buffer.slice(0, 8).toString("ascii");
      if (!header.startsWith("%PDF")) {
        issues.push({
          severity: "error",
          category: "file",
          message: "File does not have a valid PDF header.",
          fixable: false,
        });
      }
      // Check PDF footer (should contain %%EOF)
      const tail = buffer.slice(-32).toString("ascii");
      if (!tail.includes("%%EOF")) {
        issues.push({
          severity: "warning",
          category: "file",
          message: "PDF may be missing end-of-file marker.",
          fixable: false,
        });
      }
      break;
    }
    case "docx": {
      // DOCX files are ZIP archives starting with PK header
      const header = buffer[0] === 0x50 && buffer[1] === 0x4b;
      if (!header) {
        issues.push({
          severity: "error",
          category: "file",
          message: "File does not have a valid DOCX/ZIP header.",
          fixable: false,
        });
      }
      break;
    }
    case "xlsx": {
      const header = buffer[0] === 0x50 && buffer[1] === 0x4b;
      if (!header) {
        issues.push({
          severity: "error",
          category: "file",
          message: "File does not have a valid XLSX/ZIP header.",
          fixable: false,
        });
      }
      break;
    }
    case "pptx": {
      const header = buffer[0] === 0x50 && buffer[1] === 0x4b;
      if (!header) {
        issues.push({
          severity: "error",
          category: "file",
          message: "File does not have a valid PPTX/ZIP header.",
          fixable: false,
        });
      }
      break;
    }
    case "txt": {
      // Text files should be valid UTF-8
      try {
        buffer.toString("utf8");
      } catch {
        issues.push({
          severity: "warning",
          category: "file",
          message: "Text file may contain invalid encoding.",
          fixable: false,
        });
      }
      break;
    }
  }

  return issues;
}

// ─── Statistics ─────────────────────────────────────────────────────────────

function computeStats(
  spec: DocumentSpec,
  buffer: Buffer
): QualityReport["stats"] {
  const blocks = spec.blocks ?? [];
  let blockCount = blocks.length;
  let tableCount = 0;
  let headingCount = 0;
  let paragraphCount = 0;
  let listCount = 0;
  let hasTitle = false;
  let hasStructure = false;
  let hasReferences = false;

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        headingCount++;
        if (block.level === 1 && block.text) hasTitle = true;
        if (block.level === 2) hasStructure = true;
        break;
      case "paragraph":
        paragraphCount++;
        if (
          block.text &&
          /references|sources|bibliography|citations/i.test(block.text)
        ) {
          hasReferences = true;
        }
        break;
      case "bulletList":
      case "numberedList":
        listCount++;
        break;
      case "table":
        tableCount++;
        break;
    }
  }

  // Rough page estimate: ~45 lines per page, average 2 lines per block
  const estimatedPages = Math.max(
    1,
    Math.ceil((headingCount * 3 + paragraphCount * 2.5 + tableCount * 6 + listCount * 2) / 45)
  );

  // Also check for references in any block text
  if (!hasReferences) {
    hasReferences = blocks.some(
      b =>
        b.type === "paragraph" &&
        b.text &&
        /\b(references?|sources?|bibliography|citations?|further reading)\b/i.test(
          b.text
        )
    );
  }

  return {
    blockCount,
    tableCount,
    headingCount,
    paragraphCount,
    listCount,
    estimatedPages,
    hasTitle,
    hasStructure,
    hasReferences,
    byteSize: buffer.length,
  };
}

// ─── Main Quality Check ─────────────────────────────────────────────────────

/**
 * Validates a generated document for common quality issues.
 * Returns a QualityReport with any issues found and document statistics.
 */
export function validateDocument(
  spec: DocumentSpec,
  buffer: Buffer
): QualityReport {
  const specIssues = validateSpecStructure(spec);
  const fileIssues = validateFileBytes(buffer, spec.format);
  const allIssues = [...specIssues, ...fileIssues];
  const stats = computeStats(spec, buffer);

  const hasErrors = allIssues.some(i => i.severity === "error");

  return {
    passed: !hasErrors,
    issues: allIssues,
    stats,
  };
}
