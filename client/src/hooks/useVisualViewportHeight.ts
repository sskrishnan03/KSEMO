import { useEffect, useState } from "react";

// Tracks the browser's visible viewport height. On mobile the on-screen
// keyboard and dynamic url bars shrink the visual viewport, which otherwise
// causes the page to jump / auto-scroll upward while typing. The returned
// value can be used as an explicit height so the layout stays pinned and only
// the chat input rises above the keyboard.
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    update();

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}