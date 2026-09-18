import { VISUAL_THEMES, type ThemeSpec } from "@shared/pptThemes";
import { isLightOrWhiteBorder } from "./PdfDrawer";

const hex = (c: string) => `#${c}`;

type Box = { x: number; y: number; w: number; h: number };

function MiniSlide(props: { theme: ThemeSpec; children?: React.ReactNode }) {
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
  italic?: boolean;
}) {
  const { box, color, weight, size, align, letterSpacing, italic } = props;
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
        fontStyle: italic ? "italic" : undefined,
        fontSize: `${size}px`,
        lineHeight: 1.15,
        textAlign: align ?? "left",
        letterSpacing: letterSpacing ? `${letterSpacing}em` : undefined,
        whiteSpace: "nowrap",
      }}
    >
      Aa
    </div>
  );
}

function Msg(props: { x: number; y: number; w: number; color: string; h?: number }) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        left: `${props.x}%`,
        top: `${props.y}%`,
        width: `${props.w}%`,
        height: `${props.h ?? 3}%`,
        background: props.color,
      }}
    />
  );
}

function Line(props: { x: number; y: number; w: number; c: string; h?: number; o?: number }) {
  if (isLightOrWhiteBorder(props.c)) return null;
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
  return (
    <div
      className="absolute rounded-full"
      style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.s}%`, height: `${props.s}%`, background: props.c }}
    />
  );
}

function Ring(props: { x: number; y: number; s: number; c: string }) {
  return (
    <div
      className="absolute rounded-full"
      style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.s}%`, height: `${props.s}%`, border: `0.8px solid ${props.c}`, opacity: 70 }}
    />
  );
}

function Blob(props: { x: number; y: number; s: number; from: string; to: string }) {
  return (
    <div
      className="absolute rounded-full"
      style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.s}%`, height: `${props.s}%`, background: `linear-gradient(135deg, ${props.from}, ${props.to})`, opacity: 0.6 }}
    />
  );
}

function Diamond(props: { x: number; y: number; s: number; c: string }) {
  return (
    <div
      className="absolute"
      style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.s}%`, height: `${props.s}%`, background: props.c, transform: "rotate(45deg)" }}
    />
  );
}

function Panel(props: {
  x: number; y: number; w: number; h: number;
  c: string; b?: string; radius?: number; opacity?: number;
  children?: React.ReactNode;
}) {
  const showBorder = props.b && !isLightOrWhiteBorder(props.b);
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${props.x}%`, top: `${props.y}%`, width: `${props.w}%`, height: `${props.h}%`,
        background: props.c, border: showBorder ? `1px solid ${props.b}` : undefined,
        borderRadius: props.radius != null ? `${props.radius}px` : "3px", opacity: props.opacity,
      }}
    >
      {props.children}
    </div>
  );
}

function Bars(props: { x: number; y: number; w: number; h: number; a: string; b: string }) {
  const { x, y, w, h, a, b } = props;
  const barW = w / 5;
  const segs = [0.55, 0.85, 0.62, 1, 0.72];
  return (
    <div className="absolute items-end" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, display: "flex", gap: "4%" }}>
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${barW}%`, height: `${s * 100}%`, background: i % 2 === 0 ? a : b, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 }} />
      ))}
    </div>
  );
}

function Metric(props: { x: number; y: number; w: number; label: string; value: string; theme: ThemeSpec }) {
  const { x, y, w, label, value, theme } = props;
  return (
    <div className="absolute flex flex-col justify-center rounded-[3px] px-[6%]" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: "20%", background: hex(theme.panel) }}>
      <div className="whitespace-nowrap text-[4px] leading-none tracking-wide" style={{ color: hex(theme.muted) }}>{label}</div>
      <div className="mt-[5%] text-[8px] leading-none font-bold" style={{ color: hex(theme.accent) }}>{value}</div>
    </div>
  );
}

function MiniLineChart(props: { x: number; y: number; w: number; h: number; a: string; b: string }) {
  const { x, y, w, h, a, b } = props;
  const pts = "2,84 34,58 66,66 98,22";
  return (
    <div className="absolute overflow-hidden" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polyline points={`2,96 ${pts}`} fill="none" stroke={a} strokeWidth="2" strokeLinejoin="round" pathLength="100" />
        <polyline points={`2,84 ${pts} 98,22 98,96 2,96`} fill={b} opacity="0.18" />
      </svg>
    </div>
  );
}

function Chevron(props: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <div className="absolute" style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.w}%`, height: `${props.h}%`, clipPath: "polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%, 20% 50%)", background: props.color }} />
  );
}

function FrameBox(props: { x: number; y: number; w: number; h: number; c: string; radius?: number }) {
  return (
    <div
      className="absolute"
      style={{ left: `${props.x}%`, top: `${props.y}%`, width: `${props.w}%`, height: `${props.h}%`, border: `1.5px solid ${props.c}`, borderRadius: props.radius ?? 0, opacity: 0.7 }}
    />
  );
}

/** Auto fallback when no theme found */
function AutoPreview() {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[3px] border border-border bg-background" aria-label="Auto theme">
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

function renderComposition(theme: ThemeSpec) {
  const T = theme;
  switch (T.preview) {

    /* ───────────── MINIMAL ───────────── */
    case "minimal":
      return (
        <>
          <Line x={8} y={36} w={50} h={0.7} c={hex(T.accent)} />
          <TextRow box={{ x: 8, y: 20, w: 80, h: 10 }} color={hex(T.primary)} weight={700} size={6} />
          <Msg x={8} y={50} w={24} color={hex(T.muted)} />
          <Line x={8} y={80} w={32} h={0.5} c={hex(T.panelBorder)} />
          <Msg x={8} y={85} w={14} color={hex(T.muted)} />
        </>
      );

    /* ───────────── MODERN ───────────── */
    case "modern":
      return (
        <>
          <Dot x={6} y={10} s={3} c={hex(T.accent)} />
          <TextRow box={{ x: 12, y: 9, w: 66, h: 5 }} color={hex(T.primary)} weight={800} size={3.4} />
          <Msg x={12} y={17} w={24} color={hex(T.muted)} />
          <Panel x={6} y={26} w={26} h={34} c={hex(T.panel)} b={hex(T.panelBorder)} radius={5}>
            <div className="absolute" style={{ left: "10%", top: "14%", width: "40%", height: "8%", background: hex(T.accent), borderRadius: 3 }} />
            <Msg x={10} y={34} w={44} color={hex(T.muted)} />
            <Msg x={10} y={46} w={38} color={hex(T.muted)} />
          </Panel>
          <Panel x={37} y={26} w={26} h={34} c={hex(T.panel)} b={hex(T.panelBorder)} radius={5}>
            <div className="absolute" style={{ left: "10%", top: "14%", width: "30%", height: "8%", background: hex(T.accent2), borderRadius: 3 }} />
            <Msg x={10} y={34} w={40} color={hex(T.muted)} />
            <Msg x={10} y={46} w={46} color={hex(T.muted)} />
          </Panel>
          <Panel x={68} y={26} w={26} h={34} c={hex(T.panel)} b={hex(T.panelBorder)} radius={5}>
            <div className="absolute" style={{ left: "10%", top: "14%", width: "52%", height: "8%", background: hex(T.accent), borderRadius: 3 }} />
            <Msg x={10} y={34} w={36} color={hex(T.muted)} />
            <Msg x={10} y={46} w={42} color={hex(T.muted)} />
          </Panel>
          <Panel x={6} y={66} w={88} h={24} c={hex(T.accent)} b="transparent" radius={5}>
            <Msg x={6} y={34} w={24} color={hex(T.invertedText)} />
            <Msg x={6} y={56} w={16} color={hex(T.invertedText)} />
          </Panel>
        </>
      );

    /* ───────────── CORPORATE ───────────── */
    case "corporate":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "18%", background: hex(T.primary) }} />
          <Dot x={5} y={6} s={3} c={hex(T.accent2)} />
          <TextRow box={{ x: 11, y: 6, w: 50, h: 5 }} color={hex(T.invertedText)} weight={700} size={2.4} letterSpacing={0.06} />
          <Line x={33} y={0} w={0.6} h={100} c={hex(T.panelBorder)} o={25} />
          <Line x={66} y={0} w={0.6} h={100} c={hex(T.panelBorder)} o={25} />
          <Panel x={6} y={24} w={24} h={13} c={hex(T.panel)} b={hex(T.accent)} radius={2} />
          <Panel x={6} y={44} w={24} h={13} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2} />
          <Panel x={6} y={64} w={24} h={13} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2}>
            <Msg x={8} y={30} w={40} color={hex(T.accent)} />
          </Panel>
          <Panel x={40} y={25} w={26} h={22} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2}>
            <Bars x={8} y={14} w={84} h={70} a={hex(T.chartColors[0])} b={hex(T.chartColors[1])} />
          </Panel>
          <Panel x={70} y={25} w={26} h={22} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2}>
            <Line x={12} y={20} w={26} h={1.6} c={hex(T.accent2)} />
            <Line x={12} y={50} w={18} h={1.6} c={hex(T.accent2)} />
          </Panel>
          <Panel x={40} y={52} w={26} h={22} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2}>
            <Msg x={10} y={16} w={34} color={hex(T.muted)} />
            <Msg x={10} y={40} w={26} color={hex(T.accent)} />
          </Panel>
          <Panel x={70} y={52} w={26} h={22} c={hex(T.panel)} b={hex(T.panelBorder)} radius={2}>
            <Bars x={8} y={20} w={84} h={60} a={hex(T.accent2)} b={hex(T.chartColors[0])} />
          </Panel>
          <Msg x={40} y={82} w={16} color={hex(T.accent)} />
        </>
      );

    /* ───────────── EDITORIAL ───────────── */
    case "editorial":
      return (
        <>
          <Line x={4} y={16} w={0.8} h={60} c={hex(T.panelBorder)} />
          <TextRow box={{ x: 9, y: 10, w: 30, h: 4 }} color={hex(T.accent)} weight={800} size={2.3} letterSpacing={0.1} />
          <TextRow box={{ x: 9, y: 42, w: 54, h: 26 }} color={hex(T.primary)} weight={800} size={5.4} />
          <Msg x={9} y={72} w={22} color={hex(T.muted)} />
          <Panel x={68} y={12} w={26} h={64} c={`linear-gradient(150deg, ${hex(T.accent)}, ${hex(T.accent2)})`} b="transparent">
            <div className="absolute" style={{ left: "10%", bottom: "12%", width: "52%", height: "9%", background: hex(T.invertedText), opacity: 0.55, borderRadius: 2 }} />
          </Panel>
        </>
      );

    /* ───────────── BOLD ───────────── */
    case "bold":
      return (
        <>
          <TextRow box={{ x: 8, y: 18, w: 44, h: 40 }} color={hex(T.accent)} weight={900} size={20} />
          <TextRow box={{ x: 8, y: 64, w: 54, h: 28 }} color={hex(T.primary)} weight={900} size={9} />
          <Msg x={8} y={92} w={20} color={hex(T.muted)} />
          <div className="absolute" style={{ left: "80%", top: "0%", width: "20%", height: "100%", background: hex(T.accent2), opacity: 0.92 }} />
        </>
      );

    /* ───────────── ELEGANT ───────────── */
    case "elegant":
      return (
        <>
          <Diamond x={48} y={10} s={2.6} c={hex(T.accent)} />
          <TextRow box={{ x: 16, y: 28, w: 68, h: 12 }} color={hex(T.primary)} weight={700} size={5} align="center" />
          <Line x={36} y={46} w={28} h={1} c={hex(T.accent)} />
          <Msg x={34} y={52} w={32} color={hex(T.muted)} />
          <Msg x={38} y={84} w={24} color={hex(T.muted)} />
        </>
      );

    /* ───────────── CREATIVE ───────────── */
    case "creative":
      return (
        <>
          <div className="absolute" style={{ left: "44%", top: "70%", width: "58%", height: "34%", background: hex(T.accent), opacity: 0.6, transform: "rotate(-14deg)" }} />
          <Blob x={76} y={4} s={18} from={hex(T.accent)} to={hex(T.accent2)} />
          <Ring x={6} y={70} s={16} c={hex(T.accent)} />
          <TextRow box={{ x: 8, y: 12, w: 32, h: 4 }} color={hex(T.accent)} weight={800} size={2.4} letterSpacing={0.1} />
          <div className="absolute" style={{ left: "6%", top: "22%", width: "56%", height: "12%", transform: "rotate(2deg)" }}>
            <div className="h-full w-full overflow-hidden text-[5px] font-black whitespace-nowrap" style={{ color: hex(T.primary) }}>Aa</div>
          </div>
          <Panel x={40} y={52} w={18} h={11} c={hex(T.accent)} b="transparent" radius={8} />
          <Panel x={62} y={46} w={22} h={11} c={hex(T.accent2)} b="transparent" radius={8} />
          <Msg x={42} y={84} w={24} color={hex(T.accent)} />
        </>
      );

    /* ───────────── DARK ───────────── */
    case "dark":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "100%", background: `linear-gradient(160deg, ${hex(T.titleBackground)}, ${hex(T.background)})` }} />
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "7%", background: "#000", opacity: 0.4 }} />
          <div className="absolute" style={{ left: "0%", top: "93%", width: "100%", height: "7%", background: "#000", opacity: 0.4 }} />
          <TextRow box={{ x: 9, y: 20, w: 36, h: 4 }} color={hex(T.accent)} weight={800} size={2.4} letterSpacing={0.12} />
          <TextRow box={{ x: 9, y: 44, w: 62, h: 26 }} color={hex(T.primary)} weight={900} size={8} />
          <Ring x={82} y={14} s={11} c={hex(T.accent)} />
          <div className="absolute" style={{ left: "0%", top: "70%", width: "100%", height: "23%", background: "#000", opacity: 0.35 }} />
          <Msg x={9} y={78} w={30} color={hex(T.primary)} />
          <Msg x={9} y={86} w={22} color={hex(T.accent)} />
        </>
      );

    /* ───────────── LIGHT ───────────── */
    case "light":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "100%", background: hex(T.background) }} />
          <TextRow box={{ x: 8, y: 8, w: 70, h: 5 }} color={hex(T.accent)} weight={700} size={2.2} letterSpacing={0.1} />
          <TextRow box={{ x: 8, y: 18, w: 72, h: 8 }} color={hex(T.primary)} weight={700} size={4.2} />
          <Line x={8} y={30} w={38} h={0.7} c={hex(T.accent)} o={50} />
          <Panel x={6} y={38} w={28} h={18} c={hex(T.surfaceAlt)} b="transparent" radius={8}>
            <Dot x={10} y={16} s={5} c={hex(T.accent)} />
            <Msg x={10} y={50} w={40} color={hex(T.muted)} />
          </Panel>
          <Panel x={38} y={38} w={28} h={18} c={hex(T.surfaceAlt)} b="transparent" radius={8}>
            <Dot x={10} y={16} s={5} c={hex(T.accent2)} />
            <Msg x={10} y={50} w={40} color={hex(T.muted)} />
          </Panel>
          <Panel x={70} y={38} w={24} h={18} c={hex(T.surfaceAlt)} b="transparent" radius={8}>
            <Dot x={10} y={16} s={5} c={hex(T.chartColors[0])} />
            <Msg x={10} y={50} w={36} color={hex(T.muted)} />
          </Panel>
          <Msg x={8} y={68} w={60} color={hex(T.muted)} />
          <Msg x={8} y={76} w={40} color={hex(T.muted)} />
          <Line x={8} y={90} w={16} h={0.6} c={hex(T.accent)} />
        </>
      );

    /* ───────────── GLASS ───────────── */
    case "glass":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "100%", background: `linear-gradient(135deg, ${hex(T.background)}, ${hex(T.surfaceAlt)})` }} />
          <Blob x={60} y={0} s={40} from={hex(T.accent)} to={hex(T.accent2)} />
          <Panel x={6} y={6} w={88} h={88} c="rgba(255,255,255,0.35)" b="rgba(255,255,255,0.45)" radius={8} opacity={0.9}>
            <TextRow box={{ x: 8, y: 8, w: 50, h: 4 }} color={hex(T.accent)} weight={700} size={2.2} letterSpacing={0.08} />
            <TextRow box={{ x: 8, y: 18, w: 60, h: 10 }} color={hex(T.primary)} weight={800} size={5} />
            <Msg x={8} y={36} w={44} color={hex(T.muted)} />
            <Panel x={8} y={50} w={38} h={22} c="rgba(255,255,255,0.5)" b="rgba(255,255,255,0.3)" radius={5}>
              <Bars x={8} y={14} w={84} h={70} a={hex(T.chartColors[0])} b={hex(T.chartColors[1])} />
            </Panel>
            <Panel x={50} y={50} w={38} h={22} c="rgba(255,255,255,0.5)" b="rgba(255,255,255,0.3)" radius={5}>
              <Msg x={10} y={20} w={40} color={hex(T.muted)} />
              <Msg x={10} y={46} w={32} color={hex(T.accent)} />
            </Panel>
          </Panel>
        </>
      );

    /* ───────────── ACADEMIC ───────────── */
    case "academic":
      return (
        <>
          <TextRow box={{ x: 6, y: 8, w: 62, h: 5 }} color={hex(T.primary)} weight={800} size={3.4} />
          <Line x={6} y={16} w={88} h={0.8} c={hex(T.panelBorder)} />
          <Panel x={6} y={22} w={42} h={56} c={hex(T.panel)} b={hex(T.panelBorder)}>
            <MiniLineChart x={8} y={12} w={84} h={70} a={hex(T.chartColors[0])} b={hex(T.accent)} />
          </Panel>
          <Dot x={54} y={24} s={2} c={hex(T.chartColors[0])} />
          <Msg x={60} y={23} w={34} color={hex(T.text)} />
          <Dot x={54} y={44} s={2} c={hex(T.chartColors[1])} />
          <Msg x={60} y={43} w={34} color={hex(T.text)} />
          <Dot x={54} y={64} s={2} c={hex(T.accent)} />
          <Msg x={60} y={63} w={34} color={hex(T.text)} />
          <Line x={6} y={84} w={88} h={0.8} c={hex(T.panelBorder)} />
          <Msg x={6} y={88} w={30} color={hex(T.muted)} />
        </>
      );

    /* ───────────── TECHNICAL ───────────── */
    case "technical":
      return (
        <>
          <Line x={0} y={0} w={100} h={2} c={hex(T.accent2)} />
          <div className="absolute" style={{ left: "0%", top: "66%", width: "100%", height: "36%", background: hex(T.accent), opacity: 0.16, transform: "rotate(-12deg)" }} />
          <Panel x={7} y={20} w={42} h={54} c={hex(T.panel)} b={hex(T.accent)} radius={2}>
            <TextRow box={{ x: 12, y: 14, w: 70, h: 8 }} color={hex(T.primary)} weight={800} size={4.4} />
            <Line x={12} y={30} w={60} h={1} c={hex(T.accent)} />
            <Msg x={12} y={40} w={48} color={hex(T.muted)} />
            <Msg x={12} y={50} w={40} color={hex(T.accent)} />
            <Ring x={12} y={64} s={14} c={hex(T.accent2)} />
          </Panel>
          <MiniLineChart x={56} y={26} w={38} h={40} a={hex(T.accent2)} b={hex(T.accent)} />
          <Diamond x={80} y={56} s={4} c={hex(T.accent2)} />
        </>
      );

    /* ───────────── LUXURY ───────────── */
    case "luxury":
      return (
        <>
          <Panel x={6} y={6} w={88} h={88} c="transparent" b={hex(T.panelBorder)} radius={2} />
          <TextRow box={{ x: 14, y: 16, w: 26, h: 4 }} color={hex(T.accent)} weight={700} size={2.2} letterSpacing={0.14} />
          <TextRow box={{ x: 14, y: 42, w: 58, h: 18 }} color={hex(T.primary)} weight={700} size={6.2} />
          <Line x={14} y={66} w={16} h={1.2} c={hex(T.accent)} />
          <Diamond x={14} y={74} s={2.2} c={hex(T.muted)} />
          <Msg x={66} y={80} w={24} color={hex(T.muted)} />
        </>
      );

    /* ───────────── STARTUP ───────────── */
    case "startup":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "38%", height: "100%", background: hex(T.primary) }} />
          <TextRow box={{ x: 8, y: 14, w: 24, h: 4 }} color={hex(T.accent2)} weight={700} size={2.2} letterSpacing={0.08} />
          <TextRow box={{ x: 8, y: 28, w: 24, h: 20 }} color={hex(T.invertedText)} weight={800} size={6} />
          <Msg x={8} y={60} w={18} color={hex(T.invertedText)} />
          <Panel x={44} y={12} w={50} h={32} c={hex(T.panel)} b={hex(T.panelBorder)} radius={5}>
            <Bars x={8} y={12} w={84} h={72} a={hex(T.chartColors[0])} b={hex(T.chartColors[1])} />
          </Panel>
          <Panel x={44} y={50} w={23} h={34} c={hex(T.surfaceAlt)} b="transparent" radius={5}>
            <Dot x={12} y={14} s={6} c={hex(T.accent)} />
            <Msg x={12} y={50} w={50} color={hex(T.muted)} />
          </Panel>
          <Panel x={71} y={50} w={23} h={34} c={hex(T.surfaceAlt)} b="transparent" radius={5}>
            <Dot x={12} y={14} s={6} c={hex(T.accent2)} />
            <Msg x={12} y={50} w={50} color={hex(T.muted)} />
          </Panel>
        </>
      );

    /* ───────────── MAGAZINE ───────────── */
    case "magazine":
      return (
        <>
          <div className="absolute" style={{ left: "0%", top: "0%", width: "100%", height: "42%", background: hex(T.panel) }} />
          <TextRow box={{ x: 6, y: 6, w: 40, h: 4 }} color={hex(T.accent)} weight={800} size={2.2} letterSpacing={0.1} />
          <TextRow box={{ x: 6, y: 16, w: 60, h: 14 }} color={hex(T.primary)} weight={800} size={6} />
          <Msg x={6} y={34} w={40} color={hex(T.muted)} />
          <Panel x={68} y={6} w={26} h={30} c={hex(T.accent)} b="transparent" radius={3}>
            <Msg x={12} y={28} w={50} color={hex(T.invertedText)} />
            <Msg x={12} y={52} w={40} color={hex(T.invertedText)} />
          </Panel>
          <Panel x={6} y={50} w={26} h={36} c={hex(T.surfaceAlt)} b="transparent" radius={3}>
            <Msg x={10} y={10} w={50} color={hex(T.accent)} />
            <Msg x={10} y={34} w={60} color={hex(T.muted)} />
            <Msg x={10} y={54} w={56} color={hex(T.muted)} />
          </Panel>
          <Panel x={36} y={50} w={26} h={36} c={hex(T.surfaceAlt)} b="transparent" radius={3}>
            <Msg x={10} y={10} w={50} color={hex(T.accent)} />
            <Msg x={10} y={34} w={60} color={hex(T.muted)} />
            <Msg x={10} y={54} w={56} color={hex(T.muted)} />
          </Panel>
          <Panel x={66} y={50} w={28} h={36} c={hex(T.surfaceAlt)} b="transparent" radius={3}>
            <Msg x={10} y={10} w={50} color={hex(T.accent)} />
            <Msg x={10} y={34} w={60} color={hex(T.muted)} />
          </Panel>
          <Line x={6} y={92} w={88} h={0.8} c={hex(T.panelBorder)} />
        </>
      );

    /* ───────────── DATA ───────────── */
    case "data":
      return (
        <>
          <Line x={6} y={24} w={88} h={0.6} c={hex(T.panelBorder)} />
          <TextRow box={{ x: 6, y: 6, w: 60, h: 4 }} color={hex(T.accent)} weight={800} size={2.4} letterSpacing={0.08} />
          <TextRow box={{ x: 6, y: 13, w: 80, h: 8 }} color={hex(T.primary)} weight={700} size={4} />
          <Panel x={6} y={30} w={42} h={54} c={hex(T.panel)} b={hex(T.panelBorder)} radius={3}>
            <MiniLineChart x={8} y={10} w={84} h={50} a={hex(T.chartColors[0])} b={hex(T.accent)} />
            <Bars x={8} y={62} w={84} h={30} a={hex(T.chartColors[1])} b={hex(T.chartColors[0])} />
          </Panel>
          <Metric x={54} y={30} w={40} label="METRIC A" value="$2.4M" theme={T} />
          <Metric x={54} y={54} w={40} label="METRIC B" value="+34%" theme={T} />
          <Panel x={54} y={74} w={40} h={10} c={hex(T.accent)} b="transparent" radius={2}>
            <Msg x={10} y={24} w={50} color={hex(T.invertedText)} />
          </Panel>
        </>
      );

    /* ───────────── PRESENTATION ───────────── */
    case "presentation":
      return (
        <>
          <TextRow box={{ x: 6, y: 8, w: 62, h: 5 }} color={hex(T.accent)} weight={800} size={2.3} letterSpacing={0.08} />
          <TextRow box={{ x: 6, y: 14, w: 72, h: 6 }} color={hex(T.primary)} weight={800} size={3.7} />
          <Line x={6} y={23} w={88} h={1} c={hex(T.accent)} />
          <Msg x={6} y={27} w={36} color={hex(T.muted)} />
          <Panel x={6} y={34} w={41} h={50} c={hex(T.panel)} b={hex(T.panelBorder)}>
            <Msg x={8} y={10} w={30} color={hex(T.accent)} />
            <Msg x={8} y={28} w={52} color={hex(T.muted)} />
            <Msg x={8} y={40} w={44} color={hex(T.muted)} />
            <Msg x={8} y={52} w={50} color={hex(T.muted)} />
          </Panel>
          <Panel x={53} y={34} w={41} h={50} c={hex(T.panel)} b={hex(T.panelBorder)}>
            <Msg x={8} y={10} w={30} color={hex(T.accent)} />
            <Msg x={8} y={28} w={46} color={hex(T.muted)} />
            <Msg x={8} y={40} w={52} color={hex(T.muted)} />
            <Msg x={8} y={52} w={40} color={hex(T.muted)} />
          </Panel>
        </>
      );

    default:
      return <AutoPreview />;
  }
}

export function ThemeSlidePreview({ name }: { name: string }) {
  const theme = VISUAL_THEMES[name] || VISUAL_THEMES[name.toLowerCase()];
  if (!theme) return <AutoPreview />;
  return (
    <MiniSlide theme={theme}>
      {renderComposition(theme)}
    </MiniSlide>
  );
}
