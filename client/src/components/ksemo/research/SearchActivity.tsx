import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  BookOpen,
  FileCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchMode, Source } from "@shared/research";

const DEEP_RESEARCH_STAGES: Record<
  string,
  { label: string; detail: string; progress: number }
> = {
  understanding: {
    label: "Analyzing Inquiry & Establishing Scope",
    detail: "Deconstructing core research questions and factual boundaries...",
    progress: 18,
  },
  planning: {
    label: "Formulating Multi-Angle Search Plan",
    detail: "Structuring dedicated sub-tasks across distinct investigative domains...",
    progress: 38,
  },
  searching: {
    label: "Querying Authoritative Live Sources",
    detail: "Broadcasting parallel web inquiries to index verified publications...",
    progress: 62,
  },
  retrieving: {
    label: "Retrieving & Auditing Full Documentation",
    detail: "Extracting factual claims, evidence datasets, and methodology...",
    progress: 78,
  },
  analyzing: {
    label: "Synthesizing Cross-Source Evidence",
    detail: "Correlating multi-source points, reconciling discrepancies...",
    progress: 88,
  },
  comparing: {
    label: "Validating Perspectives & Empirical Data",
    detail: "Cross-checking citations against primary literature...",
    progress: 94,
  },
  writing: {
    label: "Authoring Comprehensive Analytical Dossier",
    detail: "Writing in-depth Markdown report with verified inline citations...",
    progress: 98,
  },
  completed: {
    label: "Deep Research Dossier Complete",
    detail: "Citation-backed synthesis compiled from authoritative sources.",
    progress: 100,
  },
  error: {
    label: "Research Interrupted",
    detail: "A network or rate limit occurred during deep inquiry.",
    progress: 100,
  },
};

export type SearchActivityProps = {
  mode: ResearchMode;
  stage?: string | null;
  /** True while the research workflow is still running. */
  active: boolean;
  sourceCount: number;
  sources?: Source[];
  plan?: string[];
  className?: string;
};

export function SearchActivity({
  mode,
  stage,
  active,
  sourceCount,
  sources = [],
  plan = [],
  className,
}: SearchActivityProps) {
  const [expanded, setExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // ---------------------------------------------------------------------------
  // 1. Web Search Mode (Fast, Streamlined, Live Web Sources Strip)
  // ---------------------------------------------------------------------------
  if (mode === "web_search") {
    return (
      <div
        id="ksemo-web-search-activity"
        className={cn(
          "my-2.5 overflow-hidden rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xs transition-all",
          className
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-foreground">
              <Search className="size-3.5" />
            </span>
            <span className="text-xs font-semibold tracking-tight text-foreground">
              Web Search
            </span>
            {active ? (
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                {sourceCount > 0
                  ? `Found ${sourceCount} relevant sources`
                  : "Searching the web..."}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                <Check className="size-3 text-primary" />
                {sourceCount} source{sourceCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* Live Discovered Sources Chips */}
        {sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {sources.slice(0, 6).map((s, idx) => (
              <a
                key={s.sourceId || idx}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex max-w-[190px] items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground transition hover:border-foreground/30 hover:bg-secondary hover:text-foreground"
              >
                <Globe className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span className="truncate font-medium">
                  {s.domain || s.publisher || "Source"}
                </span>
                <ExternalLink className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ))}
            {sources.length > 6 && (
              <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground font-medium">
                +{sources.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Deep Research Mode (Rigorous Multi-Stage Investigation & Dossier Matrix)
  // ---------------------------------------------------------------------------
  const currentStageInfo =
    DEEP_RESEARCH_STAGES[stage || "understanding"] ||
    DEEP_RESEARCH_STAGES.understanding;

  return (
    <div
      id="ksemo-deep-research-console"
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all",
        className
      )}
    >
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <BookOpen className="size-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Deep Research Dossier
              </span>
              {active ? (
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  Investigating · {elapsedSeconds}s
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full border border-border bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
                  <FileCheck2 className="size-3 text-primary" />
                  Dossier Compiled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {sourceCount > 0 ? `${sourceCount} sources` : "Multi-vector"}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {expanded ? "Hide Details" : "View Details"}
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        </div>
      </div>

      {/* Progress & Current Stage Info */}
      <div className="p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-foreground flex items-center gap-2">
            {active ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <Check className="size-3.5 text-primary" />
            )}
            {currentStageInfo.label}
          </span>
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            {currentStageInfo.progress}%
          </span>
        </div>

        {/* Clean Neutral Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${currentStageInfo.progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
          {currentStageInfo.detail}
        </p>

        {/* Live Discovered Sources Grid while streaming */}
        {sources.length > 0 && (
          <div className="mt-3.5 border-t border-border pt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Globe className="size-3" />
                Authoritative Sources ({sources.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sources.slice(0, 6).map((s, idx) => (
                <a
                  key={s.sourceId || idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex max-w-[210px] items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:bg-secondary hover:text-foreground"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-foreground">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium text-[11px]">
                    {s.title || s.domain || "Source"}
                  </span>
                  <ExternalLink className="size-2.5 shrink-0 opacity-40 group-hover:opacity-100" />
                </a>
              ))}
              {sources.length > 6 && (
                <span className="flex items-center rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  +{sources.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Expanded Investigation Plan & Methodology */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-border pt-3 text-xs">
            {plan.length > 0 && (
              <div>
                <h5 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                  <Compass className="size-3.5" />
                  Investigation Task Plan
                </h5>
                <div className="space-y-1.5">
                  {plan.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-muted-foreground"
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-foreground">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-[11px] text-foreground leading-relaxed">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">
                Deep Research Protocol:
              </span>{" "}
              Multi-angle factual validation extracts quantitative metrics, primary
              literature, and comparative frameworks, anchoring all conclusions directly
              to citation references.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
