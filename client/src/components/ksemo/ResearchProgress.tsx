/**
 * ResearchProgress - Displays progress stages for Web Search and Deep Research.
 * 
 * This component shows the current stage of research with:
 * - Stage name
 * - Progress indicator
 * - Visual feedback for completed, in-progress, and pending stages
 */

import { cn } from "@/lib/utils";
import { Check, Loader2, Search, Brain, FileText, Globe, FlaskConical } from "lucide-react";
import type { ResearchProgressStage } from "@shared/research";

interface ResearchProgressProps {
  currentStage: ResearchProgressStage;
  mode: "web_search" | "deep_research";
  className?: string;
}

const STAGE_CONFIG: Record<ResearchProgressStage, { label: string; icon: typeof Search }> = {
  understanding: { label: "Understanding your question", icon: Brain },
  planning: { label: "Planning research", icon: FileText },
  searching: { label: "Searching reliable sources", icon: Search },
  retrieving: { label: "Retrieving information", icon: Globe },
  analyzing: { label: "Analyzing information", icon: Brain },
  comparing: { label: "Comparing findings", icon: Brain },
  writing: { label: "Writing research report", icon: FileText },
  completed: { label: "Research completed", icon: Check },
  error: { label: "Research failed", icon: Search },
};

const WEB_SEARCH_STAGES: ResearchProgressStage[] = [
  "searching",
  "retrieving",
  "analyzing",
  "writing",
  "completed",
];

const DEEP_RESEARCH_STAGES: ResearchProgressStage[] = [
  "understanding",
  "planning",
  "searching",
  "retrieving",
  "analyzing",
  "comparing",
  "writing",
  "completed",
];

export function ResearchProgress({ currentStage, mode, className }: ResearchProgressProps) {
  const stages = mode === "web_search" ? WEB_SEARCH_STAGES : DEEP_RESEARCH_STAGES;
  const currentIndex = stages.indexOf(currentStage);
  
  // If current stage is not in the expected stages (e.g., error), show as error state
  if (currentIndex === -1 && currentStage !== "completed") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        <span>Research in progress...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {mode === "deep_research" ? (
          <FlaskConical className="size-4 text-violet-500" />
        ) : (
          <Search className="size-4 text-sky-500" />
        )}
        <span>
          {mode === "deep_research" ? "Deep Research" : "Web Search"}
        </span>
      </div>
      
      <div className="space-y-1.5">
        {stages.map((stage, index) => {
          const config = STAGE_CONFIG[stage];
          const Icon = config.icon;
          const status = 
            index < currentIndex ? "completed" :
            index === currentIndex ? "in-progress" : "pending";
          
          return (
            <div
              key={stage}
              className="flex items-center gap-2 text-xs"
            >
              {status === "completed" ? (
                <div className="flex size-4 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check className="size-3" />
                </div>
              ) : status === "in-progress" ? (
                <div className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Loader2 className="size-3 animate-spin" />
                </div>
              ) : (
                <div className="flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <div className="size-1.5 rounded-full bg-muted-foreground/30" />
                </div>
              )}
              
              <span
                className={cn(
                  "flex-1",
                  status === "completed" ? "text-foreground" :
                  status === "in-progress" ? "text-foreground font-medium" :
                  "text-muted-foreground"
                )}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}