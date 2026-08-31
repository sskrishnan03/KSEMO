import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Copy, Download } from "lucide-react";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { codeToHtml } from "shiki";

// Highlighted output cache. Re-tokenizing identical code on every render is the
// single most expensive thing the chat does while a fenced block is on screen.
// Keep a bounded LRU of {lang}:{code} -> html so repeated renders of settled
// blocks are instant and never touch Shiki again.
const HIGHLIGHT_CACHE = new Map<string, Promise<string>>();
const HIGHLIGHT_CACHE_MAX = 100;

function highlightCode(code: string, lang: string): Promise<string> {
  const key = `${lang}:${code}`;
  let pending = HIGHLIGHT_CACHE.get(key);
  if (!pending) {
    pending = codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
    pending.catch(() => {
      HIGHLIGHT_CACHE.delete(key);
    });
    HIGHLIGHT_CACHE.set(key, pending);
    if (HIGHLIGHT_CACHE.size > HIGHLIGHT_CACHE_MAX) {
      const oldest = HIGHLIGHT_CACHE.keys().next().value;
      if (oldest !== undefined) HIGHLIGHT_CACHE.delete(oldest);
    }
  }
  return pending;
}

/**
 * Display name + download extension for the languages KSEMO recognises.
 * Anything missing falls back to a neutral "Code" label and .txt.
 */
const LANGUAGE_META: Record<string, { label: string; ext: string }> = {
  python: { label: "Python", ext: "py" },
  py: { label: "Python", ext: "py" },
  javascript: { label: "JavaScript", ext: "js" },
  js: { label: "JavaScript", ext: "js" },
  jsx: { label: "JSX", ext: "jsx" },
  typescript: { label: "TypeScript", ext: "ts" },
  ts: { label: "TypeScript", ext: "ts" },
  tsx: { label: "TSX", ext: "tsx" },
  html: { label: "HTML", ext: "html" },
  css: { label: "CSS", ext: "css" },
  scss: { label: "SCSS", ext: "scss" },
  json: { label: "JSON", ext: "json" },
  java: { label: "Java", ext: "java" },
  c: { label: "C", ext: "c" },
  cpp: { label: "C++", ext: "cpp" },
  "c++": { label: "C++", ext: "cpp" },
  csharp: { label: "C#", ext: "cs" },
  "c#": { label: "C#", ext: "cs" },
  go: { label: "Go", ext: "go" },
  golang: { label: "Go", ext: "go" },
  rust: { label: "Rust", ext: "rs" },
  rs: { label: "Rust", ext: "rs" },
  php: { label: "PHP", ext: "php" },
  sql: { label: "SQL", ext: "sql" },
  bash: { label: "Bash", ext: "sh" },
  sh: { label: "Shell", ext: "sh" },
  shell: { label: "Shell", ext: "sh" },
  zsh: { label: "Zsh", ext: "sh" },
  powershell: { label: "PowerShell", ext: "ps1" },
  ps1: { label: "PowerShell", ext: "ps1" },
  markdown: { label: "Markdown", ext: "md" },
  md: { label: "Markdown", ext: "md" },
  yaml: { label: "YAML", ext: "yml" },
  yml: { label: "YAML", ext: "yml" },
  xml: { label: "XML", ext: "xml" },
  dockerfile: { label: "Dockerfile", ext: "dockerfile" },
  kotlin: { label: "Kotlin", ext: "kt" },
  swift: { label: "Swift", ext: "swift" },
  ruby: { label: "Ruby", ext: "rb" },
  rb: { label: "Ruby", ext: "rb" },
  dart: { label: "Dart", ext: "dart" },
  lua: { label: "Lua", ext: "lua" },
  r: { label: "R", ext: "r" },
  toml: { label: "TOML", ext: "toml" },
  graphql: { label: "GraphQL", ext: "graphql" },
  diff: { label: "Diff", ext: "diff" },
};

function normalizeLanguage(rawLanguage?: string) {
  const id = (rawLanguage ?? "").trim().toLowerCase();
  return { id, known: id.length > 0 && Boolean(LANGUAGE_META[id]) };
}

export function codeBlockLanguageLabel(rawLanguage?: string) {
  const { id, known } = normalizeLanguage(rawLanguage);
  return known ? LANGUAGE_META[id].label : "Code";
}

export function codeBlockDownloadName(rawLanguage?: string) {
  const { id, known } = normalizeLanguage(rawLanguage);
  if (!known) return "code.txt";
  const slug = LANGUAGE_META[id].label.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}-code.${LANGUAGE_META[id].ext}`;
}

function LanguageIcon() {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center font-mono text-[11px] font-semibold text-muted-foreground"
      aria-hidden
    >
      &lt;/&gt;
    </span>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(async () => {
    if (!code || copied) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      try {
        const scratch = document.createElement("textarea");
        scratch.value = code;
        scratch.setAttribute("readonly", "true");
        scratch.style.position = "fixed";
        scratch.style.opacity = "0";
        document.body.appendChild(scratch);
        scratch.select();
        document.execCommand("copy");
        scratch.remove();
      } catch {
        return;
      }
    }
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2_000);
  }, [code, copied]);

  const label = copied ? "Copied" : "Copy code";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 rounded-md transition-colors focus-visible:ring-1",
            copied
              ? "text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          onClick={copy}
          disabled={!code}
          aria-label={label}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function DownloadCodeButton({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  const download = useCallback(() => {
    if (!code) return;
    try {
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = codeBlockDownloadName(rawLanguage);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      // Downloading is best-effort; never break the chat over it.
    }
  }, [code, rawLanguage]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1"
          onClick={download}
          disabled={!code}
          aria-label="Download code"
        >
          <Download className="size-3.5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Download {codeBlockDownloadName(rawLanguage)}
      </TooltipContent>
    </Tooltip>
  );
}

function KsemoCodeBlockHeader({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <LanguageIcon />
        <span className="truncate font-mono text-xs font-medium lowercase tracking-wide text-muted-foreground">
          {codeBlockLanguageLabel(rawLanguage)}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <DownloadCodeButton code={code} rawLanguage={rawLanguage} />
        <CopyCodeButton code={code} />
      </div>
    </div>
  );
}

function CodeSurface({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  const [html, setHtml] = useState<string>("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const lang = (rawLanguage ?? "").trim().toLowerCase();
    const validLang = lang && lang in LANGUAGE_META ? lang : "text";

    const run = () => {
      highlightCode(code, validLang)
        .then(result => {
          if (!cancelled) setHtml(result);
        })
        .catch(() => {
          if (!cancelled) setHtml("");
        });
    };

    // While the block is still being streamed the code changes on every flush;
    // debounce so we highlight at most once after the text settles instead of
    // re-tokenizing the whole growing block per token.
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(run, 200);

    return () => {
      cancelled = true;
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [code, rawLanguage]);

  return (
    // Deliberately NOT a vertical scroll container. Horizontal overflow is
    // handled by the <pre> itself so vertical wheel/trackpad movement always
    // chains up to the main conversation scroller.
    <div className="ksemo-code-body">
      {html ? (
        <div
          className="[&>pre]:m-0 [&>pre]:bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre data-code-pre="plain">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function KsemoCodeBlock({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  const { id } = normalizeLanguage(rawLanguage);
  const blockStyle = useMemo(
    () => ({ contentVisibility: "auto" as const, containIntrinsicSize: "auto 200px" as const }),
    []
  );
  return (
    <div
      className="my-4 w-full overflow-hidden rounded-xl border border-border/70 bg-muted"
      data-language={id || "text"}
      style={blockStyle}
      aria-label={`${codeBlockLanguageLabel(rawLanguage)} code block`}
    >
      <KsemoCodeBlockHeader code={code} rawLanguage={rawLanguage} />
      <CodeSurface code={code} rawLanguage={rawLanguage} />
    </div>
  );
}

const FENCE_LANGUAGE_PATTERN = /language-([\w+#.-]+)/;

function flattenCodeChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children))
    return children.map(child => flattenCodeChildren(child)).join("");
  if (
    React.isValidElement(children) &&
    typeof children.props === "object" &&
    children.props !== null &&
    "children" in children.props
  ) {
    return flattenCodeChildren(
      (children.props as { children?: React.ReactNode }).children
    );
  }
  return "";
}

/**
 * Drop-in replacement for Streamdown's `code` element. Inline code keeps the
 * original pill styling; fenced blocks become the full KSEMO Code Block.
 */
type MarkdownCodeElementProps = React.ClassAttributes<HTMLElement> &
  React.HTMLAttributes<HTMLElement> & { node?: unknown };

function KsemoMarkdownCodeInner({
  node,
  className,
  children,
  ...htmlAttributes
}: MarkdownCodeElementProps) {
  void node;
  const position = (
    node as
      | { position?: { start?: { line?: number }; end?: { line?: number } } }
      | undefined
  )?.position;
  // A `language-*` class only ever comes from a fenced block, so it wins over
  // the position heuristic even if the ast position is unavailable.
  const fenceMatch = className?.match(FENCE_LANGUAGE_PATTERN);
  const isInline =
    !fenceMatch &&
    position?.start?.line !== undefined &&
    position?.end?.line !== undefined &&
    position.start.line === position.end.line;

  if (isInline) {
    return (
      <code
        className={cn(
          "rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 font-mono text-[13px]",
          className
        )}
        data-streamdown="inline-code"
        {...htmlAttributes}
      >
        {children}
      </code>
    );
  }

  const rawLanguage = fenceMatch?.[1];
  const code = flattenCodeChildren(children).replace(/\n$/, "");

  return <KsemoCodeBlock code={code} rawLanguage={rawLanguage} />;
}

export const KsemoMarkdownCode = memo(KsemoMarkdownCodeInner);