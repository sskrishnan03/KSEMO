const CLASS = "ksemo-touch-hover";

let active: Element[] = [];
let armed = false;

function clear() {
  for (const el of active) el.classList.remove(CLASS);
  active = [];
}

function apply(target: Element) {
  clear();
  const chain: Element[] = [];
  let node: Element | null = target;
  while (node) {
    chain.push(node);
    node = node.parentElement;
  }
  for (const el of chain) el.classList.add(CLASS);
  active = chain;
}

function arm() {
  if (armed) return;
  armed = true;

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (!(e.target instanceof Element)) return;
      if ("pointerType" in e && e.pointerType !== "touch") return;
      apply(e.target);
    },
    true
  );

  window.addEventListener(
    "scroll",
    () => {
      if (active.length) clear();
    },
    true
  );

  const release = (e: Event) => {
    if (!(e instanceof PointerEvent) || e.pointerType === "touch") clear();
  };
  window.addEventListener("pointerup", release, true);
  window.addEventListener(
    "pointercancel",
    (e) => {
      if ("pointerType" in e && e.pointerType === "touch") clear();
    },
    true
  );

  document.addEventListener("touchend", clear, true);
  document.addEventListener("touchcancel", clear, true);
}

export function initTouchHover() {
  if (typeof window === "undefined") return;

  if (window.matchMedia("(hover: none), (pointer: coarse)").matches) {
    arm();
    return;
  }

  // Some devices (e.g. tablets in desktop-site mode) misreport their pointer
  // capabilities above, so fall back to arming on the first real touch.
  const probe = (e: Event) => {
    if (!(e instanceof PointerEvent) || e.pointerType !== "touch") return;
    window.removeEventListener("pointerdown", probe, true);
    arm();
  };
  window.addEventListener("pointerdown", probe, true);
}