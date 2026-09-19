import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Loader2,
  Presentation,
  Plus,
  Quote,
  RotateCw,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import React, { memo, useState } from "react";
import {
  PPT_SLIDE_TYPE_LABELS,
  PPT_SLIDE_TYPES,
  createSlideId,
  type PptOutlinePlan,
  type PptOutlineSlide,
  type PptSlideType,
} from "@shared/presentationOutline";

export type PresentationOutlineCardProps = {
  outline: PptOutlinePlan;
  generating?: boolean;
  progressLabel?: string;
  regenerationError?: string | null;
  onApprove: (outline: PptOutlinePlan) => void;
  onChange?: (outline: PptOutlinePlan) => void;
  onRegenerateOutline?: (
    outline: PptOutlinePlan
  ) => Promise<PptOutlinePlan | null | undefined>;
  onRegenerateSlide?: (
    slideId: string,
    outline: PptOutlinePlan,
    instruction?: string
  ) => Promise<PptOutlinePlan | null | undefined>;
};

const COMPLEXITY_LABELS: Record<string, string> = {
  basic: "Basic",
  moderate: "Moderate",
  advanced: "Advanced",
};

const SLIDE_TYPE_STYLES: Record<PptSlideType, string> = {
  title: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  agenda: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  section: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  content: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  process: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  timeline: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  comparison: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  stats: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  chart: "bg-green-500/10 text-green-600 dark:text-green-400",
  quote: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  key_message: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  closing: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
};

function AnalysisChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] leading-none">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className="font-medium text-foreground/80">{value}</span>
    </span>
  );
}

function SlideTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: PptSlideType;
  onChange: (next: PptSlideType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={event => onChange(event.target.value as PptSlideType)}
        disabled={disabled}
        className={cn(
          "appearance-none rounded-full border border-transparent py-1 pl-2.5 pr-7 text-[11px] font-semibold outline-none transition-colors",
          "focus-visible:border-border focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          SLIDE_TYPE_STYLES[value]
        )}
      >
        {PPT_SLIDE_TYPES.map(type => (
          <option key={type} value={type} className="bg-background text-foreground">
            {PPT_SLIDE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 opacity-60" />
    </div>
  );
}

function StructuredDetails({ slide }: { slide: PptOutlineSlide }) {
  const rows: Array<{ icon: React.ReactNode; text: string }> = [];
  if (slide.metrics?.length) {
    slide.metrics.forEach(metric => {
      rows.push({
        icon: <BarChart3 className="size-3.5 shrink-0 opacity-60" />,
        text: [metric.value, metric.label, metric.change]
          .filter(Boolean)
          .join(" · "),
      });
    });
  }
  if (slide.steps?.length) {
    slide.steps.forEach(step => {
      rows.push({
        icon: <span className="w-3.5 shrink-0 text-center text-[10px] font-bold opacity-60">{step.step}</span>,
        text: [step.title, step.description].filter(Boolean).join(" — "),
      });
    });
  }
  if (slide.columns?.length) {
    slide.columns.forEach((column, index) => {
      const text = [column.title, ...(column.bullets ?? [])]
        .filter(Boolean)
        .join(" · ");
      if (text) {
        rows.push({
          icon: <span className="w-3.5 shrink-0 text-center text-[10px] font-bold opacity-60">{index + 1}</span>,
          text,
        });
      }
    });
  }
  if (slide.chart?.length) {
    rows.push({
      icon: <BarChart3 className="size-3.5 shrink-0 opacity-60" />,
      text: slide.chart
        .map(point => `${point.label}: ${point.value}`)
        .join(" · "),
    });
  }
  if (slide.quote?.text) {
    rows.push({
      icon: <Quote className="size-3.5 shrink-0 opacity-60" />,
      text: [slide.quote.text, slide.quote.author]
        .filter(Boolean)
        .join(" — "),
    });
  }
  if (slide.keyMessage?.statement) {
    rows.push({
      icon: <Type className="size-3.5 shrink-0 opacity-60" />,
      text: [slide.keyMessage.statement, slide.keyMessage.context]
        .filter(Boolean)
        .join(" — "),
    });
  }
  if (!rows.length) return null;
  return (
    <div className="mt-1.5 space-y-1 rounded-lg border border-border/50 bg-muted/25 px-2.5 py-2">
      {rows.slice(0, 6).map((row, index) => (
        <div
          key={index}
          className="flex items-start gap-2 text-[12px] leading-snug text-muted-foreground"
        >
          <span className="mt-0.5">{row.icon}</span>
          <span className="min-w-0">{row.text}</span>
        </div>
      ))}
    </div>
  );
}

export const PresentationOutlineCard = memo(function PresentationOutlineCard({
  outline,
  generating = false,
  progressLabel,
  regenerationError,
  onApprove,
  onChange,
  onRegenerateOutline,
  onRegenerateSlide,
}: PresentationOutlineCardProps) {
  const [draft, setDraft] = useState<PptOutlinePlan>(outline);
  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(
    outline.slides[0]?.id ?? null
  );
  const [regeneratingOutline, setRegeneratingOutline] = useState(false);
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(
    null
  );
  const [instructionDraft, setInstructionDraft] = useState<Record<string, string>>(
    {}
  );

  const busy = generating || regeneratingOutline || Boolean(regeneratingSlideId);

  const commit = (next: PptOutlinePlan) => {
    setDraft(next);
    onChange?.(next);
  };

  const updateSlide = (
    slideId: string,
    patch: Partial<PptOutlineSlide>,
    structural = false
  ) => {
    const next: PptOutlinePlan = {
      ...draft,
      slides: draft.slides.map(slide =>
        slide.id === slideId ? { ...slide, ...patch } : slide
      ),
    };
    if (structural) commit(next);
    else {
      setDraft(next);
      onChange?.(next);
    }
  };

  const handleBulletChange = (slideId: string, index: number, value: string) => {
    const slide = draft.slides.find(item => item.id === slideId);
    if (!slide) return;
    const bullets = [...slide.bullets];
    bullets[index] = value;
    updateSlide(slideId, { bullets });
  };

  const addBullet = (slideId: string) => {
    const slide = draft.slides.find(item => item.id === slideId);
    if (!slide) return;
    updateSlide(slideId, { bullets: [...slide.bullets, ""] }, true);
  };

  const removeBullet = (slideId: string, index: number) => {
    const slide = draft.slides.find(item => item.id === slideId);
    if (!slide) return;
    updateSlide(
      slideId,
      { bullets: slide.bullets.filter((_, i) => i !== index) },
      true
    );
  };

  const moveSlide = (slideId: string, direction: -1 | 1) => {
    const index = draft.slides.findIndex(slide => slide.id === slideId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.slides.length) return;
    const slides = [...draft.slides];
    const [moved] = slides.splice(index, 1);
    slides.splice(target, 0, moved);
    commit({ ...draft, slides });
  };

  const deleteSlide = (slideId: string) => {
    commit({
      ...draft,
      slides: draft.slides.filter(slide => slide.id !== slideId),
    });
  };

  const addSlide = () => {
    const newSlide: PptOutlineSlide = {
      id: createSlideId(),
      type: "content",
      title: "New slide",
      bullets: [""],
    };
    const slides = [...draft.slides];
    const closingIndex = slides.findIndex(slide => slide.type === "closing");
    if (closingIndex >= 0) slides.splice(closingIndex, 0, newSlide);
    else slides.push(newSlide);
    commit({ ...draft, slides });
    setExpandedSlideId(newSlide.id);
  };

  const handleRegenerateOutline = async () => {
    if (!onRegenerateOutline || busy) return;
    setRegeneratingOutline(true);
    try {
      const next = await onRegenerateOutline(draft);
      if (next) {
        setDraft(next);
        onChange?.(next);
        setExpandedSlideId(next.slides[0]?.id ?? null);
      }
    } finally {
      setRegeneratingOutline(false);
    }
  };

  const handleRegenerateSlide = async (slideId: string) => {
    if (!onRegenerateSlide || busy) return;
    setRegeneratingSlideId(slideId);
    try {
      const instruction = instructionDraft[slideId]?.trim();
      const next = await onRegenerateSlide(slideId, draft, instruction);
      if (next) {
        setDraft(next);
        onChange?.(next);
        setInstructionDraft(current => ({ ...current, [slideId]: "" }));
      }
    } finally {
      setRegeneratingSlideId(null);
    }
  };

  const analysis = draft.analysis;

  return (
    <div
      data-testid="presentation-outline-card"
      className="my-2 w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur-sm dark:bg-card/60"
    >
      {/* Header */}
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Presentation className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold leading-snug text-foreground">
                {draft.title || "Presentation outline"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {draft.slides.length} slides · {draft.styleName} style · Review
                and edit before generating
              </p>
            </div>
          </div>
          {onRegenerateOutline && (
            <button
              type="button"
              onClick={handleRegenerateOutline}
              disabled={busy}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5",
                "text-[11.5px] font-medium text-foreground shadow-sm transition-all duration-150",
                "hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {regeneratingOutline ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCw className="size-3" />
              )}
              Regenerate
            </button>
          )}
        </div>

        {/* Analysis chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <AnalysisChip
            label="Type"
            value={analysis.contentType || ""}
          />
          <AnalysisChip label="Audience" value={analysis.audience} />
          <AnalysisChip
            label="Level"
            value={COMPLEXITY_LABELS[analysis.complexity] ?? analysis.complexity}
          />
          <AnalysisChip label="Visuals" value={analysis.visualNeed} />
        </div>

        {analysis.styleRationale && (
          <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
            {analysis.styleRationale}
          </p>
        )}
      </div>

      {/* Slides */}
      <div className="max-h-[420px] space-y-1.5 overflow-y-auto px-3 py-3">
        {draft.slides.map((slide, index) => {
          const isExpanded = expandedSlideId === slide.id;
          const isRegenerating = regeneratingSlideId === slide.id;
          return (
            <div
              key={slide.id}
              className={cn(
                "rounded-xl border transition-colors",
                isExpanded
                  ? "border-border bg-background/60"
                  : "border-transparent hover:border-border/60 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSlideId(current =>
                      current === slide.id ? null : slide.id
                    )
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="truncate text-[13.5px] font-medium text-foreground">
                    {slide.title || "Untitled slide"}
                  </span>
                </button>
                <SlideTypeSelect
                  value={slide.type}
                  disabled={busy}
                  onChange={next => updateSlide(slide.id, { type: next }, true)}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move slide up"
                    onClick={() => moveSlide(slide.id, -1)}
                    disabled={busy || index === 0}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move slide down"
                    onClick={() => moveSlide(slide.id, 1)}
                    disabled={busy || index === draft.slides.length - 1}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete slide"
                    onClick={() => deleteSlide(slide.id)}
                    disabled={busy || draft.slides.length <= 1}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-2.5 px-3 pb-3 pt-1">
                  <div className="space-y-1.5">
                    <input
                      value={slide.title}
                      onChange={event =>
                        updateSlide(slide.id, { title: event.target.value })
                      }
                      disabled={busy}
                      placeholder="Slide title"
                      className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[13px] font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60"
                    />
                    <input
                      value={slide.subtitle ?? ""}
                      onChange={event =>
                        updateSlide(slide.id, {
                          subtitle: event.target.value || undefined,
                        })
                      }
                      disabled={busy}
                      placeholder="Subtitle (optional)"
                      className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60"
                    />
                  </div>

                  {slide.purpose && (
                    <p className="text-[11.5px] italic leading-snug text-muted-foreground">
                      {slide.purpose}
                    </p>
                  )}

                  {/* Bullets */}
                  <div className="space-y-1.5">
                    {slide.bullets.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex items-center gap-1.5">
                        <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        <input
                          value={bullet}
                          onChange={event =>
                            handleBulletChange(
                              slide.id,
                              bulletIndex,
                              event.target.value
                            )
                          }
                          disabled={busy}
                          placeholder="Key point"
                          className="w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60"
                        />
                        <button
                          type="button"
                          aria-label="Remove point"
                          onClick={() => removeBullet(slide.id, bulletIndex)}
                          disabled={busy}
                          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addBullet(slide.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                      Add point
                    </button>
                  </div>

                  <StructuredDetails slide={slide} />

                  {/* Per-slide regenerate */}
                  {onRegenerateSlide && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        value={instructionDraft[slide.id] ?? ""}
                        onChange={event =>
                          setInstructionDraft(current => ({
                            ...current,
                            [slide.id]: event.target.value,
                          }))
                        }
                        disabled={busy}
                        placeholder="Optional: how should this slide change?"
                        className="w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-[12px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => handleRegenerateSlide(slide.id)}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRegenerating ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        Rewrite
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {regenerationError && (
        <div className="mx-3 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
          {regenerationError}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3 py-3">
        <button
          type="button"
          onClick={addSlide}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Add slide
        </button>

        <Button
          size="sm"
          onClick={() => onApprove(draft)}
          disabled={busy || draft.slides.length === 0}
          className="shrink-0 rounded-xl bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
        >
          {generating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {progressLabel || "Generating presentation"}
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              Generate presentation
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

export default PresentationOutlineCard;
