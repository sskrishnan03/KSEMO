import { useEffect, useState } from "react";

function checkIsMobile(breakpoint: number): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < breakpoint) return true;
  if (
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  ) {
    return true;
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth <= 1024
  ) {
    return true;
  }
  return false;
}

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobile(breakpoint));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(checkIsMobile(breakpoint));

    mql.addEventListener("change", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [breakpoint]);

  return isMobile;
}
