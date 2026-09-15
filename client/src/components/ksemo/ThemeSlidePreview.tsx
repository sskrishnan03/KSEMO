import { VISUAL_THEMES, type ThemeSpec } from "@shared/pptThemes";

const hex = (c: string) => `#${c}`;

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function MiniSlide(props: {
  theme: ThemeSpec;
  children?: React.ReactNode;
}) {
  const { theme, children } = props;
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[3px]"
      style={{
        background: hex(theme.background),
        fontFamily: `${theme.bodyFont}, ${theme.titleFont}, sans-serif`,
      }}
    >
      {children}
    </div>
  );
}

function TextRow(props: {
  box: Box;
  color: string;
  weight?: number;
  size: number;
  align?: "left" | "center" | "right";
}) {
  const { box, color, weight, size, align } = props;
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        color,
        fontWeight: weight ?? 400,
        fontSize: `${size}px`,
        lineHeight: 1.15,
        textAlign: align ?? "left",
        whiteSpace: "nowrap",
      }}
    >
      {"Aa"}
    </div>
  );
}

function Msg(props: { x: number; y: number; w: number; color: string }) {
  return (
    <div
      className="absolute h-[3%] rounded-full"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.w}%`,
        background: props.color,
      }}
    />
  );
}

function Panel(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  b: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="absolute overflow-hidden rounded-[3px]"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.w}%`,
        height: `${props.h}%`,
        background: props.c,
        border: `1px solid ${props.b}`,
      }}
    >
      {props.children}
    </div>
  );
}

function Bars(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  a: string;
  b: string;
}) {
  const { x, y, w, h, a, b } = props;
  const barW = w / 6;
  const segs = [0.55, 0.85, 0.62, 1, 0.72, 0.9];
  return (
    <div
      className="absolute items-end gap-[3%]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        display: "flex",
      }}
    >
      {segs.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${barW}%`,
            height: `${s * 100}%`,
            background: i % 2 === 0 ? a : b,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function Metric(props: {
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  theme: ThemeSpec;
}) {
  const { x, y, w, label, value, theme } = props;
  return (
    <div
      className="absolute flex flex-col justify-center rounded-[3px] px-[5%]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: "14%",
        background: hex(theme.panel),
        border: `1px solid ${hex(theme.panelBorder)}`,
      }}
    >
      <div
        className="whitespace-nowrap text-[4px] leading-none tracking-wide"
        style={{ color: hex(theme.muted) }}
      >
        {label}
      </div>
      <div
        className="mt-[3px] whitespace-nowrap text-[8px] leading-none font-bold"
        style={{ color: hex(theme.primary) }}
      >
        {value}
      </div>
    </div>
  );
}

/** Renders a miniature 16:9 slide using the ACTUAL theme definition, so the
 *  picker thumbnail is the same design (palette, type, structure) the
 *  presentation engine will generate. */
export function ThemeSlidePreview({ name }: { name: string }) {
  const theme = VISUAL_THEMES[name];
  if (!theme) {
    return (
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[3px] border border-border bg-background"
        aria-label="Auto theme"
      >
        <div className="border-b border-border bg-muted/15 px-[6%] pt-[6%] pb-[4%]">
          <div className="h-[8%] w-[7%] rounded-full bg-muted/50" />
          <div className="mt-[8%] h-[10%] w-[60%] rounded-sm bg-foreground/85" />
          <div className="mt-[4%] h-[8%] w-[42%] rounded-sm bg-muted/70" />
        </div>
        <div className="mt-[4%] flex gap-[3%] px-[6%]">
          <div className="h-[22%] w-[30%] rounded-sm bg-muted/15" />
          <div className="h-[22%] w-[30%] rounded-sm bg-muted/25" />
          <div className="h-[22%] w-[30%] rounded-sm bg-muted/15" />
        </div>
        <div className="mt-[3%] px-[6%]">
          <div className="h-[5%] w-[90%] rounded-sm bg-muted/40" />
          <div className="mt-[3%] h-[5%] w-[70%] rounded-sm bg-muted/30" />
          <div className="mt-[3%] h-[5%] w-[80%] rounded-sm bg-muted/25" />
        </div>
      </div>
    );
  }

  return (
    <MiniSlide theme={theme}>
      {theme.preview === "hero" && (
        <>
          <div
            className="absolute"
            style={{
              left: theme.heroBand === "right" ? "38%" : "0%",
              top: "0%",
              width: theme.heroBand === "full" ? "100%" : "62%",
              height: "100%",
              background: hex(theme.titleBackground),
            }}
          />
          <div
            className="absolute overflow-hidden"
            style={{
              color: hex(theme.accent),
              fontSize: "3px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              left: "7%",
              top: "14%",
            }}
          >
            {theme.useKicker ? "KICKER" : "·"}
          </div>
          <TextRow
            box={{ x: 7, y: 18, w: 62, h: 7 }}
            color={hex(theme.primary)}
            weight={800}
            size={4.4}
          />
          <TextRow
            box={{ x: 7, y: 27, w: 55, h: 4 }}
            color={hex(theme.muted)}
            size={2.8}
          />
          <Bars
            x={7}
            y={40}
            w={60}
            h={13}
            a={hex(theme.chartColors[0])}
            b={hex(theme.chartColors[1])}
          />
        </>
      )}

      {theme.preview === "minimal" && (
        <>
          <TextRow
            box={{ x: 7, y: 10, w: 80, h: 7 }}
            color={hex(theme.primary)}
            weight={800}
            size={4.4}
          />
          <Msg x={7} y={21} w={30} color={hex(theme.accent)} />
          <Msg x={7} y={25} w={52} color={hex(theme.muted)} />
          <Metric x={7} y={40} w={30} label="REVENUE" value="84%" theme={theme} />
          <Metric x={39} y={40} w={30} label="MARGIN" value="31%" theme={theme} />
          <Msg x={7} y={62} w={46} color={hex(theme.secondary)} />
          <Msg x={7} y={66} w={40} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "columns" && (
        <>
          <TextRow
            box={{ x: 7, y: 8, w: 60, h: 5 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.2}
          />
          <Msg x={7} y={17} w={24} color={hex(theme.accent)} />
          <Panel
            x={7}
            y={25}
            w={26}
            h={48}
            c={hex(theme.panel)}
            b={hex(theme.panelBorder)}
          />
          <Panel
            x={37}
            y={25}
            w={26}
            h={48}
            c={hex(theme.panel)}
            b={hex(theme.panelBorder)}
          />
          <Panel
            x={67}
            y={25}
            w={26}
            h={48}
            c={hex(theme.panel)}
            b={hex(theme.panelBorder)}
          />
        </>
      )}

      {theme.preview === "editorial" && (
        <>
          <TextRow
            box={{ x: 7, y: 15, w: 62, h: 7 }}
            color={hex(theme.primary)}
            weight={800}
            size={4.2}
          />
          <TextRow
            box={{ x: 7, y: 26, w: 52, h: 4 }}
            color={hex(theme.secondary)}
            size={2.8}
          />
          <div
            className="absolute overflow-hidden rounded-[3px] bg-cover"
            style={{
              left: "68%",
              top: "16%",
              width: "25%",
              height: "50%",
              background: `linear-gradient(135deg, ${hex(theme.accent)}, ${hex(theme.accent2)})`,
            }}
          >
            <div className="absolute right-[8%] bottom-[10%] h-[10%] w-[34%] rounded-[2px] bg-background/50" />
          </div>
          <Msg x={7} y={40} w={52} color={hex(theme.muted)} />
          <Msg x={7} y={45} w={44} color={hex(theme.muted)} />
          <Msg x={7} y={50} w={50} color={hex(theme.muted)} />
          <Msg x={7} y={60} w={26} color={hex(theme.accent)} />
        </>
      )}

      {theme.preview === "data" && (
        <>
          <TextRow
            box={{ x: 7, y: 8, w: 60, h: 5 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.2}
          />
          <Msg x={7} y={17} w={24} color={hex(theme.accent)} />
          <Panel
            x={7}
            y={25}
            w={38}
            h={46}
            c={hex(theme.panel)}
            b={hex(theme.panelBorder)}
          >
            <Bars
              x={8}
              y={12}
              w={84}
              h={64}
              a={hex(theme.chartColors[0])}
              b={hex(theme.chartColors[1])}
            />
          </Panel>
          <Metric
            x={49}
            y={25}
            w={44}
            label="TOTAL REVENUE"
            value="$124M"
            theme={theme}
          />
          <Metric
            x={49}
            y={44}
            w={44}
            label="GROWTH / QoQ"
            value="+18.4%"
            theme={theme}
          />
          <Metric
            x={49}
            y={63}
            w={44}
            label="NPS"
            value="72"
            theme={theme}
          />
        </>
      )}
    </MiniSlide>
  );
}