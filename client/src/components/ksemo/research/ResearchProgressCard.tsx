import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchMode } from "@shared/research";

const STEPS: Record<
  ResearchMode,
  Array<{ key: string; label: string }>
> = {
  web_search: [
    { key: "searching", label: "Searching the web" },
    { key: "analyzing", label: "Analyzing results" },
    { key: "writing", label: "Writing your answer" },
  ],
  deep_research: [
    { key: "understanding", label: "Understanding question" },
    { key: "planning", label: "Planning research" },
    { key: "searching", label: "Searching sources" },
    { key: "retrieving", label: "Retrieving content" },
    { key: "analyzing", label: "Analyzing evidence" },
    { key: "comparing", label: "Comparing findings" },
    { key: "writing", label: "Writing report" },
  ],
};

/**
 * Live progress panel shown while a Web Search or Deep Research run is
 * streaming. It surfaces the real backend stage sequence and marks steps as
 * done / current / pending based on the latest `research.stage` event, rather
 * than inventing progress on the client.
 */
export function ResearchProgressCard({
  mode,
  currentStage,
  label,
  error = false,
}: {
  mode: ResearchMode;
  currentStage?: string;
  label?: string;
  error?: boolean;
}) {
  const steps = STEPS[mode] ?? STEPS.deep_research;
  const currentIndex = steps.findIndex(step => step.key === currentStage);

  return (
    <div className="mb-2 w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {mode === "web_search" ? "Searching the web" : "Deep Research"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {error
            ? "Something went wrong"
            : label ?? (currentStage ? steps[currentIndex]?.label : "")}
        </span>
      </div>
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {steps.map((step, index) => {
          const done = currentIndex > index;
          const isCurrent = currentIndex === index && !error;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                done
                  ? "text-muted-foreground"
                  : isCurrent
                    ? "text-foreground"
                    : error
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground/50"
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  done
                    ? "border-transparent bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary text-primary"
                      : error && currentIndex === index
                        ? "border-destructive text-destructive"
                        : "border-border text-muted-foreground"
                )}
              >
                {done ? (
                  <Check className="size-2.5" />
                ) : isCurrent ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <span className="size-1 rounded-full bg-current" />
                )}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
