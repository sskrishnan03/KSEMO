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
  letterSpacing?: number;
}) {
  const { box, color, weight, size, align, letterSpacing } = props;
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
        letterSpacing: letterSpacing ? `${letterSpacing}em` : undefined,
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

function Line(props: {
  x: number;
  y: number;
  w: number;
  c: string;
  h?: number;
  o?: number;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.w}%`,
        height: `${props.h ?? 1}%`,
        background: props.c,
        opacity: props.o ?? 100,
      }}
    />
  );
}

function Dot(props: { x: number; y: number; s: number; c: string }) {
  const { x, y, s, c } = props;
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${s}%`,
        height: `${s}%`,
        background: c,
      }}
    />
  );
}

function Ring(props: { x: number; y: number; s: number; c: string }) {
  const { x, y, s, c } = props;
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${s}%`,
        height: `${s}%`,
        border: `0.8px solid ${c}`,
        opacity: 70,
      }}
    />
  );
}

function Blob(props: {
  x: number;
  y: number;
  s: number;
  from: string;
  to: string;
}) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.s}%`,
        height: `${props.s}%`,
        background: `linear-gradient(135deg, ${props.from}, ${props.to})`,
        opacity: 0.6,
      }}
    />
  );
}

function Diamond(props: { x: number; y: number; s: number; c: string }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.s}%`,
        height: `${props.s}%`,
        background: props.c,
        transform: "rotate(45deg)",
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
  radius?: number;
  opacity?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.w}%`,
        height: `${props.h}%`,
        background: props.c,
        border: `1px solid ${props.b}`,
        borderRadius: props.radius != null ? `${props.radius}px` : "3px",
        opacity: props.opacity,
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
  const barW = w / 5;
  const segs = [0.55, 0.85, 0.62, 1, 0.72];
  return (
    <div
      className="absolute items-end"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        display: "flex",
        gap: "4%",
      }}
    >
      {segs.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${barW}%`,
            height: `${s * 100}%`,
            background: i % 2 === 0 ? a : b,
            borderTopLeftRadius: 1.5,
            borderTopRightRadius: 1.5,
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
      className="absolute flex flex-col justify-center rounded-[3px] px-[6%]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: "20%",
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
        className="mt-[5%] text-[8px] leading-none font-bold"
        style={{ color: hex(theme.accent) }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniLineChart(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  a: string;
  b: string;
}) {
  const { x, y, w, h, a, b } = props;
  const pts = "2,84 34,58 66,66 98,22";
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polyline
          points={`2,96 ${pts}`}
          fill="none"
          stroke={a}
          strokeWidth="2"
          strokeLinejoin="round"
          pathLength="100"
        />
        <polyline points={`2,84 ${pts} 98,22 98,96 2,96`} fill={b} opacity="0.18" />
      </svg>
    </div>
  );
}

/** Renders a miniature 16:9 slide using the ACTUAL theme definition, so the
 *  picker thumbnail is the same design (palette, type, structure) the
 *  presentation engine will generate. Each style renders its own archetype:
 *  the composition itself differs per style, not just the colors. */
export function ThemeSlidePreview({ name }: { name: string }) {
  const theme = VISUAL_THEMES[name];
  if (!theme) {
    return (
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[3px] border border-border bg-background"
        aria-label="Auto theme"
      >
        <div className="flex items-center gap-[4%] px-[6%] pt-[6%]">
          <div className="h-[10%] w-[10%] rounded-full bg-muted/40" />
          <div className="h-[10%] w-[46%] rounded-sm bg-foreground/80" />
        </div>
        <div className="mt-[4%] flex gap-[3%] px-[6%]">
          <div className="h-[30%] w-[30%] rounded-sm bg-muted/15" />
          <div className="h-[30%] w-[30%] rounded-sm bg-muted/25" />
          <div className="h-[30%] w-[30%] rounded-sm bg-muted/15" />
        </div>
        <div className="mt-[3%] px-[6%]">
          <div className="h-[5%] w-[86%] rounded-sm bg-muted/40" />
          <div className="mt-[3%] h-[5%] w-[64%] rounded-sm bg-muted/30" />
        </div>
        <div className="mt-[6%] px-[6%]">
          <div className="h-[2%] w-[10%] rounded-full bg-accent/70" />
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
              left: "0%",
              top: "0%",
              width: "100%",
              height: "8%",
              background: hex(theme.accent),
            }}
          />
          <TextRow
            box={{ x: 6, y: 13, w: 30, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.4}
            letterSpacing={0.1}
          />
          <TextRow
            box={{ x: 6, y: 20, w: 52, h: 8 }}
            color={hex(theme.primary)}
            weight={800}
            size={4.8}
          />
          <TextRow
            box={{ x: 6, y: 31, w: 38, h: 6 }}
            color={hex(theme.primary)}
            weight={700}
            size={3}
          />
          <Msg x={6} y={41} w={30} color={hex(theme.muted)} />
          <Panel
            x={54}
            y={10}
            w={42}
            h={86}
            c={`linear-gradient(145deg, ${hex(theme.accent)}, ${hex(theme.accent2)})`}
            b="transparent"
          >
            <Ring x={12} y={16} s={30} c={hex(theme.invertedText)} />
            <Msg x={12} y={58} w={34} color={hex(theme.invertedText)} />
            <Msg x={12} y={66} w={26} color={hex(theme.invertedText)} />
            <div
              className="absolute"
              style={{
                left: "12%",
                top: "74%",
                width: "40%",
                height: "10%",
                background: hex(theme.invertedText),
                opacity: 0.5,
                borderRadius: 2,
              }}
            />
          </Panel>
        </>
      )}

      {theme.preview === "minimal" && (
        <>
          <TextRow
            box={{ x: 7, y: 14, w: 82, h: 9 }}
            color={hex(theme.primary)}
            weight={800}
            size={5.2}
          />
          <Line x={7} y={28} w={12} h={1.6} c={hex(theme.accent)} />
          <Msg x={7} y={34} w={28} color={hex(theme.muted)} />
          <Line x={7} y={86} w={44} h={0.8} c={hex(theme.panelBorder)} />
          <Msg x={7} y={90} w={16} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "classic" && (
        <>
          <TextRow
            box={{ x: 6, y: 8, w: 60, h: 5 }}
            color={hex(theme.accent)}
            weight={700}
            size={2.3}
            letterSpacing={0.08}
          />
          <TextRow
            box={{ x: 6, y: 14, w: 72, h: 6 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.7}
          />
          <Line x={6} y={23} w={88} h={1} c={hex(theme.accent)} />
          <Msg x={6} y={27} w={36} color={hex(theme.muted)} />
          <Panel x={6} y={34} w={41} h={50} c={hex(theme.panel)} b={hex(theme.panelBorder)}>
            <Msg x={8} y={10} w={30} color={hex(theme.accent)} />
            <Msg x={8} y={28} w={52} color={hex(theme.muted)} />
            <Msg x={8} y={40} w={44} color={hex(theme.muted)} />
            <Msg x={8} y={52} w={50} color={hex(theme.muted)} />
          </Panel>
          <Panel x={53} y={34} w={41} h={50} c={hex(theme.panel)} b={hex(theme.panelBorder)}>
            <Msg x={8} y={10} w={30} color={hex(theme.accent)} />
            <Msg x={8} y={28} w={46} color={hex(theme.muted)} />
            <Msg x={8} y={40} w={52} color={hex(theme.muted)} />
            <Msg x={8} y={52} w={40} color={hex(theme.muted)} />
          </Panel>
        </>
      )}

      {theme.preview === "consultant" && (
        <>
          <TextRow
            box={{ x: 6, y: 6, w: 34, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.3}
            letterSpacing={0.1}
          />
          <TextRow
            box={{ x: 6, y: 11, w: 74, h: 6 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.8}
          />
          <Line x={6} y={20} w={26} h={1.5} c={hex(theme.accent)} />
          <Metric x={6} y={26} w={36} label="REVENUE" value="$124M" theme={theme} />
          <Metric x={6} y={52} w={36} label="GROWTH" value="+18.4%" theme={theme} />
          <Panel x={48} y={26} w={46} h={46} c={hex(theme.panel)} b={hex(theme.panelBorder)}>
            <Bars
              x={8}
              y={10}
              w={84}
              h={80}
              a={hex(theme.chartColors[0])}
              b={hex(theme.chartColors[1])}
            />
          </Panel>
          <Msg x={6} y={86} w={22} color={hex(theme.accent)} />
        </>
      )}

      {theme.preview === "editorial" && (
        <>
          <Line x={4} y={16} w={0.8} h={60} c={hex(theme.panelBorder)} />
          <TextRow
            box={{ x: 9, y: 10, w: 30, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.3}
            letterSpacing={0.1}
          />
          <TextRow
            box={{ x: 9, y: 42, w: 54, h: 26 }}
            color={hex(theme.primary)}
            weight={800}
            size={5.4}
          />
          <Msg x={9} y={72} w={22} color={hex(theme.muted)} />
          <Panel
            x={68}
            y={12}
            w={26}
            h={64}
            c={`linear-gradient(150deg, ${hex(theme.accent)}, ${hex(theme.accent2)})`}
            b="transparent"
          >
            <div
              className="absolute"
              style={{
                left: "10%",
                bottom: "12%",
                width: "52%",
                height: "9%",
                background: hex(theme.invertedText),
                opacity: 0.55,
                borderRadius: 2,
              }}
            />
          </Panel>
        </>
      )}

      {theme.preview === "modern" && (
        <>
          <Dot x={6} y={10} s={3} c={hex(theme.accent)} />
          <TextRow
            box={{ x: 12, y: 9, w: 66, h: 5 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.4}
          />
          <Msg x={12} y={17} w={24} color={hex(theme.muted)} />
          <Panel x={6} y={26} w={26} h={34} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={5}>
            <div
              className="absolute"
              style={{ left: "10%", top: "14%", width: "40%", height: "8%", background: hex(theme.accent), borderRadius: 3 }}
            />
            <Msg x={10} y={34} w={44} color={hex(theme.muted)} />
            <Msg x={10} y={46} w={38} color={hex(theme.muted)} />
          </Panel>
          <Panel x={37} y={26} w={26} h={34} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={5}>
            <div
              className="absolute"
              style={{ left: "10%", top: "14%", width: "30%", height: "8%", background: hex(theme.accent2), borderRadius: 3 }}
            />
            <Msg x={10} y={34} w={40} color={hex(theme.muted)} />
            <Msg x={10} y={46} w={46} color={hex(theme.muted)} />
          </Panel>
          <Panel x={68} y={26} w={26} h={34} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={5}>
            <div
              className="absolute"
              style={{ left: "10%", top: "14%", width: "52%", height: "8%", background: hex(theme.accent), borderRadius: 3 }}
            />
            <Msg x={10} y={34} w={36} color={hex(theme.muted)} />
            <Msg x={10} y={46} w={42} color={hex(theme.muted)} />
          </Panel>
          <Panel x={6} y={66} w={88} h={24} c={hex(theme.accent)} b="transparent" radius={5}>
            <Msg x={6} y={34} w={24} color={hex(theme.invertedText)} />
            <Msg x={6} y={56} w={16} color={hex(theme.invertedText)} />
          </Panel>
        </>
      )}

      {theme.preview === "bold" && (
        <>
          <TextRow
            box={{ x: 8, y: 18, w: 44, h: 40 }}
            color={hex(theme.accent)}
            weight={900}
            size={20}
          />
          <TextRow
            box={{ x: 8, y: 64, w: 54, h: 28 }}
            color={hex(theme.primary)}
            weight={900}
            size={9}
          />
          <Msg x={8} y={92} w={20} color={hex(theme.muted)} />
          <div
            className="absolute"
            style={{
              left: "80%",
              top: "0%",
              width: "20%",
              height: "100%",
              background: hex(theme.accent2),
              opacity: 0.92,
            }}
          />
        </>
      )}

      {theme.preview === "elegant" && (
        <>
          <Diamond x={48} y={10} s={2.6} c={hex(theme.accent)} />
          <TextRow
            box={{ x: 16, y: 28, w: 68, h: 12 }}
            color={hex(theme.primary)}
            weight={700}
            size={5}
            align="center"
          />
          <Line x={36} y={46} w={28} h={1} c={hex(theme.accent)} />
          <Msg x={34} y={52} w={32} color={hex(theme.muted)} />
          <Msg x={38} y={84} w={24} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "professional" && (
        <>
          <Msg x={6} y={6} w={18} color={hex(theme.accent)} />
          <TextRow
            box={{ x: 6, y: 12, w: 62, h: 6 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.6}
          />
          <Line x={6} y={21} w={20} h={1.2} c={hex(theme.accent)} />
          <Dot x={6} y={30} s={1.6} c={hex(theme.accent)} />
          <Msg x={11} y={29} w={34} color={hex(theme.muted)} />
          <Dot x={6} y={40} s={1.6} c={hex(theme.accent)} />
          <Msg x={11} y={39} w={30} color={hex(theme.muted)} />
          <Dot x={6} y={50} s={1.6} c={hex(theme.accent)} />
          <Msg x={11} y={49} w={36} color={hex(theme.muted)} />
          <Panel x={50} y={26} w={44} h={52} c={hex(theme.panel)} b={hex(theme.panelBorder)}>
            <Bars
              x={8}
              y={12}
              w={84}
              h={76}
              a={hex(theme.chartColors[0])}
              b={hex(theme.chartColors[1])}
            />
          </Panel>
          <Msg x={6} y={86} w={24} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "creative" && (
        <>
          <div
            className="absolute"
            style={{
              left: "44%",
              top: "70%",
              width: "58%",
              height: "34%",
              background: hex(theme.accent),
              opacity: 0.6,
              transform: "rotate(-14deg)",
            }}
          />
          <Blob x={76} y={4} s={18} from={hex(theme.accent)} to={hex(theme.accent2)} />
          <Ring x={6} y={70} s={16} c={hex(theme.accent)} />
          <TextRow
            box={{ x: 8, y: 12, w: 32, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.4}
            letterSpacing={0.1}
          />
          <div
            className="absolute"
            style={{
              left: "6%",
              top: "22%",
              width: "56%",
              height: "12%",
              transform: "rotate(2deg)",
            }}
          >
            <div
              className="h-full w-full overflow-hidden text-[5px] font-black whitespace-nowrap"
              style={{ color: hex(theme.primary) }}
            >
              Aa
            </div>
          </div>
          <Panel x={40} y={52} w={18} h={11} c={hex(theme.accent)} b="transparent" radius={8} />
          <Panel x={62} y={46} w={22} h={11} c={hex(theme.accent2)} b="transparent" radius={8} />
          <Msg x={42} y={84} w={24} color={hex(theme.accent)} />
        </>
      )}

      {theme.preview === "tech" && (
        <>
          <Line x={33} y={0} w={0.7} h={100} c={hex(theme.accent)} o={22} />
          <Line x={66} y={0} w={0.7} h={100} c={hex(theme.accent)} o={22} />
          <Line x={0} y={50} w={100} h={0.7} c={hex(theme.accent)} o={22} />
          <div
            className="absolute"
            style={{
              left: "0%",
              top: "0%",
              width: "100%",
              height: "16%",
              background: hex(theme.primary),
            }}
          />
          <Dot x={5} y={6} s={3} c={hex(theme.accent2)} />
          <TextRow
            box={{ x: 11, y: 6, w: 50, h: 5 }}
            color={hex(theme.invertedText)}
            weight={700}
            size={2.4}
            letterSpacing={0.06}
          />
          <Panel x={6} y={24} w={24} h={13} c={hex(theme.panel)} b={hex(theme.accent)} radius={2} />
          <Panel x={6} y={44} w={24} h={13} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2} />
          <Panel x={6} y={64} w={24} h={13} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2}>
            <Msg x={8} y={30} w={40} color={hex(theme.accent)} />
          </Panel>
          <Panel x={40} y={25} w={26} h={22} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2}>
            <Bars x={8} y={14} w={84} h={70} a={hex(theme.chartColors[0])} b={hex(theme.chartColors[1])} />
          </Panel>
          <Panel x={70} y={25} w={26} h={22} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2}>
            <Line x={12} y={20} w={26} h={1.6} c={hex(theme.accent2)} />
            <Line x={12} y={50} w={18} h={1.6} c={hex(theme.accent2)} />
          </Panel>
          <Panel x={40} y={52} w={26} h={22} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2}>
            <Msg x={10} y={16} w={34} color={hex(theme.muted)} />
            <Msg x={10} y={40} w={26} color={hex(theme.accent)} />
          </Panel>
          <Panel x={70} y={52} w={26} h={22} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={2}>
            <Bars x={8} y={20} w={84} h={60} a={hex(theme.accent2)} b={hex(theme.chartColors[0])} />
          </Panel>
          <Msg x={40} y={82} w={16} color={hex(theme.accent)} />
        </>
      )}

      {theme.preview === "cinematic" && (
        <>
          <div
            className="absolute"
            style={{
              left: "0%",
              top: "0%",
              width: "100%",
              height: "100%",
              background: `linear-gradient(160deg, ${hex(theme.titleBackground)}, ${hex(theme.background)})`,
            }}
          />
          <div
            className="absolute"
            style={{ left: "0%", top: "0%", width: "100%", height: "7%", background: "#000", opacity: 0.4 }}
          />
          <div
            className="absolute"
            style={{ left: "0%", top: "93%", width: "100%", height: "7%", background: "#000", opacity: 0.4 }}
          />
          <TextRow
            box={{ x: 9, y: 20, w: 36, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.4}
            letterSpacing={0.12}
          />
          <TextRow
            box={{ x: 9, y: 44, w: 62, h: 26 }}
            color={hex(theme.primary)}
            weight={900}
            size={8}
          />
          <Ring x={82} y={14} s={11} c={hex(theme.accent)} />
          <div
            className="absolute"
            style={{ left: "0%", top: "70%", width: "100%", height: "23%", background: "#000", opacity: 0.35 }}
          />
          <Msg x={9} y={78} w={30} color={hex(theme.primary)} />
          <Msg x={9} y={86} w={22} color={hex(theme.accent)} />
        </>
      )}

      {theme.preview === "playful" && (
        <>
          <Blob x={72} y={2} s={22} from={hex(theme.accent)} to={hex(theme.accent2)} />
          <Blob x={0} y={58} s={24} from={hex(theme.accent2)} to={hex(theme.accent)} />
          <Dot x={66} y={14} s={6} c={hex(theme.accent)} />
          <TextRow
            box={{ x: 8, y: 18, w: 58, h: 10 }}
            color={hex(theme.primary)}
            weight={900}
            size={4.8}
          />
          <div
            className="absolute"
            style={{
              left: "8%",
              top: "33%",
              width: "30%",
              height: "5%",
              background: hex(theme.accent),
              borderRadius: 999,
            }}
          />
          <Panel x={6} y={46} w={25} h={38} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={8}>
            <Dot x={12} y={14} s={5} c={hex(theme.accent)} />
            <Msg x={12} y={44} w={40} color={hex(theme.muted)} />
          </Panel>
          <Panel x={37} y={46} w={25} h={38} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={8}>
            <Dot x={12} y={14} s={5} c={hex(theme.accent2)} />
            <Msg x={12} y={44} w={34} color={hex(theme.muted)} />
          </Panel>
          <Panel x={68} y={46} w={26} h={38} c={hex(theme.panel)} b={hex(theme.panelBorder)} radius={8}>
            <Dot x={12} y={14} s={5} c={hex(theme.accent)} />
            <Msg x={12} y={44} w={42} color={hex(theme.muted)} />
          </Panel>
        </>
      )}

      {theme.preview === "luxury" && (
        <>
          <Panel x={6} y={6} w={88} h={88} c="transparent" b={hex(theme.panelBorder)} radius={2} />
          <TextRow
            box={{ x: 14, y: 16, w: 26, h: 4 }}
            color={hex(theme.accent)}
            weight={700}
            size={2.2}
            letterSpacing={0.14}
          />
          <TextRow
            box={{ x: 14, y: 42, w: 58, h: 18 }}
            color={hex(theme.primary)}
            weight={700}
            size={6.2}
          />
          <Line x={14} y={66} w={16} h={1.2} c={hex(theme.accent)} />
          <Diamond x={14} y={74} s={2.2} c={hex(theme.muted)} />
          <Msg x={66} y={80} w={24} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "academic" && (
        <>
          <TextRow
            box={{ x: 6, y: 8, w: 62, h: 5 }}
            color={hex(theme.primary)}
            weight={800}
            size={3.4}
          />
          <Line x={6} y={16} w={88} h={0.8} c={hex(theme.panelBorder)} />
          <Panel x={6} y={22} w={42} h={56} c={hex(theme.panel)} b={hex(theme.panelBorder)}>
            <MiniLineChart
              x={8}
              y={12}
              w={84}
              h={70}
              a={hex(theme.chartColors[0])}
              b={hex(theme.accent)}
            />
          </Panel>
          <Dot x={54} y={24} s={2} c={hex(theme.chartColors[0])} />
          <Msg x={60} y={23} w={34} color={hex(theme.text)} />
          <Dot x={54} y={44} s={2} c={hex(theme.chartColors[1])} />
          <Msg x={60} y={43} w={34} color={hex(theme.text)} />
          <Dot x={54} y={64} s={2} c={hex(theme.accent)} />
          <Msg x={60} y={63} w={34} color={hex(theme.text)} />
          <Line x={6} y={84} w={88} h={0.8} c={hex(theme.panelBorder)} />
          <Msg x={6} y={88} w={30} color={hex(theme.muted)} />
        </>
      )}

      {theme.preview === "futuristic" && (
        <>
          <Line x={0} y={0} w={100} h={2} c={hex(theme.accent2)} />
          <div
            className="absolute"
            style={{
              left: "0%",
              top: "66%",
              width: "100%",
              height: "36%",
              background: hex(theme.accent),
              opacity: 0.16,
              transform: "rotate(-12deg)",
            }}
          />
          <Panel x={7} y={20} w={42} h={54} c={hex(theme.panel)} b={hex(theme.accent)} radius={2}>
            <TextRow
              box={{ x: 12, y: 14, w: 70, h: 8 }}
              color={hex(theme.primary)}
              weight={800}
              size={4.4}
            />
            <Line x={12} y={30} w={60} h={1} c={hex(theme.accent)} />
            <Msg x={12} y={40} w={48} color={hex(theme.muted)} />
            <Msg x={12} y={50} w={40} color={hex(theme.accent)} />
            <Ring x={12} y={64} s={14} c={hex(theme.accent2)} />
          </Panel>
          <MiniLineChart
            x={56}
            y={26}
            w={38}
            h={40}
            a={hex(theme.accent2)}
            b={hex(theme.accent)}
          />
          <Diamond x={80} y={56} s={4} c={hex(theme.accent2)} />
        </>
      )}

      {theme.preview === "storytelling" && (
        <>
          <TextRow
            box={{ x: 8, y: 8, w: 28, h: 4 }}
            color={hex(theme.accent)}
            weight={800}
            size={2.3}
            letterSpacing={0.1}
          />
          <TextRow
            box={{ x: 8, y: 16, w: 72, h: 14 }}
            color={hex(theme.primary)}
            weight={800}
            size={4.8}
          />
          <Panel x={6} y={62} w={26} h={22} c={hex(theme.accent)} b="transparent" radius={4} />
          <Panel x={37} y={54} w={26} h={30} c={hex(theme.accent)} b="transparent" radius={4} opacity={0.75} />
          <Panel x={68} y={46} w={26} h={38} c={hex(theme.accent)} b="transparent" radius={4} opacity={0.5} />
          <Dot x={39} y={88} s={2} c={hex(theme.accent)} />
          <Msg x={45} y={87} w={26} color={hex(theme.muted)} />
        </>
      )}
    </MiniSlide>
  );
}