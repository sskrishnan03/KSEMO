import {
  AudioLines,
  BrainCircuit,
  FileUp,
  FileText,
  Gauge,
  History,
  MessageCircle,
  PenLine,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const plans = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    summary: "Everything you need to get started with KSEMO.",
    features: [
      [MessageCircle, "Everyday AI conversations"],
      [Gauge, "Standard usage limits"],
      [History, "Chat history and search"],
      [PenLine, "Writing and chat tools"],
      [FileUp, "Basic file uploads"],
    ] as const,
    action: "Your current plan",
    current: true,
  },
  {
    name: "Plus",
    price: "₹199",
    cadence: "per month",
    summary: "More room for daily work, study, and creative projects.",
    features: [
      [MessageCircle, "More messages for longer sessions"],
      [FileUp, "More uploads and larger documents"],
      [FileText, "Create Word, PDF, and presentation files"],
      [AudioLines, "Voice conversations"],
      [Zap, "Faster access at busy times"],
    ] as const,
    action: "Choose Plus",
    featured: true,
  },
  {
    name: "Pro",
    price: "₹499",
    cadence: "per month",
    summary: "For demanding workflows and frequent, in-depth work.",
    features: [
      [Gauge, "Highest message and upload limits"],
      [Search, "In-depth research tools"],
      [AudioLines, "Extended voice sessions"],
      [BrainCircuit, "Long context for complex work"],
      [Sparkles, "Early access to new capabilities"],
    ] as const,
    action: "Choose Pro",
  },
];

export default function UpgradePage() {
  const [, setLocation] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState("Plus");
  const selected = plans.find(plan => plan.name === selectedPlan) ?? plans[1];
  const PlanCard = ({ plan }: { plan: (typeof plans)[number] }) => (
    <article
      className={`relative flex h-full min-h-0 flex-col rounded-3xl border p-6 sm:p-8 ${plan.featured ? "border-foreground/40 bg-card shadow-xl shadow-black/10 ring-1 ring-foreground/10" : "border-border bg-card/70"}`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
          Best value
        </span>
      )}
      <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
        {plan.summary}
      </p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-[-0.05em]">
          {plan.price}
        </span>
        <span className="text-xs text-muted-foreground">{plan.cadence}</span>
      </div>
      <button
        type="button"
        disabled={plan.current}
        className={`mt-4 flex h-12 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${plan.featured ? "bg-foreground text-background hover:bg-foreground/90" : plan.current ? "border border-border bg-background text-muted-foreground" : "border border-border bg-background hover:bg-accent"}`}
      >
        {plan.action}
      </button>
      <div className="my-5 h-px shrink-0 bg-border" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Plan includes
      </p>
      <ul className="flex flex-1 flex-col justify-center gap-5 text-sm">
        {plan.features.map(([Icon, label]) => (
          <li key={label} className="flex items-center gap-3 leading-5">
            <Icon
              className="size-[18px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background px-4 py-3 text-foreground sm:px-8 sm:py-5">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Cancel and return to chat"
            title="Cancel"
          >
            <X className="size-4" />
          </button>
        </div>
        <header className="mx-auto mt-1 shrink-0 text-center sm:mt-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            KSEMO plans
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
            Choose your workspace.
          </h1>
        </header>
        <div
          className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1 md:hidden"
          role="tablist"
          aria-label="Plan options"
        >
          {plans.map(plan => (
            <button
              key={plan.name}
              type="button"
              role="tab"
              aria-selected={selectedPlan === plan.name}
              onClick={() => setSelectedPlan(plan.name)}
              className={`rounded-lg px-1 py-2 text-xs font-medium transition ${selectedPlan === plan.name ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {plan.name}{" "}
              <span className="block text-[10px]">{plan.price}</span>
            </button>
          ))}
        </div>
        <section
          aria-label="Choose a plan"
          className="mx-auto mt-3 grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 md:mt-8 md:grid-cols-3 md:gap-5"
        >
          <div className="min-h-0 md:hidden">
            <PlanCard plan={selected} />
          </div>
          {plans.map(plan => (
            <div className="hidden min-h-0 md:block" key={plan.name}>
              <PlanCard plan={plan} />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
