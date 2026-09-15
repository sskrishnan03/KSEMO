import * as React from "react";
import {
  PPT_SLIDES_OPTIONS,
  PPT_STYLE_OPTIONS,
  type PptVisualStyle,
  type PptSlidesConfig,
  type PresentationConfig,
} from "@shared/presentation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ThemeSlidePreview } from "./ThemeSlidePreview";
import { cn } from "@/lib/utils";

const SLIDE_LABEL = (v: PptSlidesConfig): string =>
  v === "auto" ? "Slides" : v === 1 ? "1 slide" : `${v} slides`;

function SlidesSelect(props: {
  value: PptSlidesConfig;
  onChange: (v: PptSlidesConfig) => void;
}) {
  const { value, onChange } = props;
  return (
    <div className="min-w-0">
      <Select value={String(value)} onValueChange={v => onChange(v as PptSlidesConfig)}>
        <SelectTrigger className="w-full rounded-full border border-border bg-popover">
          <span className="whitespace-nowrap">{SLIDE_LABEL(value)}</span>
        </SelectTrigger>
        <SelectContent style={{ maxHeight: 320 }} className="max-h-80">
          {PPT_SLIDES_OPTIONS.map(option => (
            <SelectItem key={String(option)} value={String(option)}>
              {option === "auto"
                ? "Auto"
                : option === 1
                  ? "1 slide"
                  : `${option} slides`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Landscape style cards: wider than they are tall, with a genuine 16:9
// PowerPoint-style slide preview (128 × 72 inside a 140 × 112 card).
const CARD_W = 140;
const CARD_H = 112;
const LABEL_H = 28;
const GAP = 10;

// All 18 styles are shown, Auto first, then the 17 visual styles.
const PICKER_STYLES = PPT_STYLE_OPTIONS;

function ThemeCard(props: {
  name: PptVisualStyle;
  selected: boolean;
}) {
  const { name, selected } = props;
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-background box-border transition-transform duration-150 hover:scale-[1.03] hover:shadow-md"
      style={{ width: CARD_W, height: CARD_H }}
    >
      <div
        className="mx-1.5 mt-1.5 w-auto shrink-0 overflow-hidden rounded-lg bg-muted/30"
        style={{ aspectRatio: "16 / 9" }}
      >
        <ThemeSlidePreview name={name} />
      </div>
      <div
        className="mx-1.5 flex min-w-0 shrink-0 items-center justify-center gap-1 rounded-b-lg px-1 text-[12px] font-medium text-foreground"
        style={{ height: LABEL_H, flex: "0 0 auto" }}
      >
        <span className="min-w-0 truncate leading-tight">
          {name === "auto" ? "Auto" : name}
        </span>
        {selected && (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white text-black">
            <svg viewBox="0 0 12 12" className="size-3 text-black" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.2 4.9 8.6 9.5 3.6" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

function StylePicker(props: {
  value: PptVisualStyle;
  onChange: (v: PptVisualStyle) => void;
  popupWidth: number;
  isCentered: boolean;
}) {
  const { value, onChange, popupWidth, isCentered } = props;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 760;
  // The Select control always renders up/down chevron bars (~48px of chrome)
  // above and below its scrollable viewport, so the height budget must leave
  // room for those or the card labels get clipped. In the centered composer
  // state show two full rows (6 cards, 3 per row); once the composer sits at
  // the bottom show three full rows (9 cards). Everything after that scrolls
  // inside, and the popup never exceeds the visible page height.
  const visibleRows = isCentered ? 2 : 3;
  const scrollChrome = 48;
  const maxHeight = Math.min(
    visibleRows * CARD_H + (visibleRows - 1) * GAP + 8 + 16 + scrollChrome,
    Math.max(viewportH - 24, 0)
  );

  return (
    <div className="min-w-0">
      <Select value={value} onValueChange={v => onChange(v as PptVisualStyle)}>
        <SelectTrigger className="w-full rounded-full border border-border bg-popover">
          <span className="whitespace-nowrap">
            {`Visual style${value ? ": " + (value === "auto" ? "Auto" : value) : ""}`}
          </span>
        </SelectTrigger>
        <SelectContent
          align="start"
          style={{ width: popupWidth, maxWidth: popupWidth, maxHeight }}
          className="max-w-[calc(100vw-24px)] overflow-y-auto"
        >
          <div
            className="p-2"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(3, ${CARD_W}px)`,
              gridAutoRows: CARD_H,
              gap: GAP,
              justifyContent: "center",
            }}
          >
            {PICKER_STYLES.map(name => (
              <SelectItem
                key={name}
                value={name}
                data-selected={value === name}
                className="p-0 focus:bg-transparent data-[highlighted]:bg-transparent data-[highlighted]:outline-none [&>span.absolute]:hidden"
              >
                <ThemeCard name={name} selected={value === name} />
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}

export function PptConfigStrip(props: {
  config: PresentationConfig;
  onChange: (config: PresentationConfig) => void;
  isCentered?: boolean;
}) {
  const { config, onChange, isCentered = false } = props;
  const [stripWidth, setStripWidth] = React.useState<number | null>(null);
  const stripRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => setStripWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The popup is sized for exactly three landscape cards in a row; the
// Select viewport adds its own small padding, so this accounts for that.
  const popupWidth =
    Math.min(
      stripWidth ?? 0,
      488,
      typeof window !== "undefined" ? window.innerWidth - 24 : 488
    ) || 464;
  const set = <K extends keyof PresentationConfig>(
    key: K,
    value: PresentationConfig[K]
  ) => onChange({ ...config, [key]: value });

  return (
    <div ref={stripRef} className="mb-2 flex w-full max-w-full flex-nowrap items-center gap-1 overflow-x-auto">
      <SlidesSelect value={config.slides} onChange={v => set("slides", v)} />
      <StylePicker
        value={config.visualStyle}
        onChange={v => set("visualStyle", v)}
        popupWidth={popupWidth}
        isCentered={isCentered}
      />
    </div>
  );
}