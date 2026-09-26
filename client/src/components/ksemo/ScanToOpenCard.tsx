import React, { useState } from "react";
import { X } from "lucide-react";

import scannerImage from "@/img/scanner.png";
import { useIsMobile } from "@/hooks/useIsMobile";

/** Matches Tailwind's `lg`, so the CSS gate and the JS gate agree. */
const DESKTOP_BREAKPOINT = 1024;

/**
 * Scan-to-open card for signed-out visitors, pinned to the bottom-left of the
 * viewport as a sibling of the sidebar rather than a child of it, so it never
 * participates in the sidebar's own layout or scroll.
 *
 * Desktop only: a phone has no use for a code meant for a second device, and
 * the card would cover the composer. `hidden lg:block` keeps it off phones even
 * before hydration, and the `useIsMobile` guard stops it mounting there at all.
 *
 * The caller supplies the horizontal offset through `className` because the
 * sidebar is 17.25rem wide when expanded and w-16 when collapsed.
 *
 * The cancel button flips local state only: the card disappears and nothing
 * else on the page reacts.
 */
export function ScanToOpenCard({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(false);
  const isMobile = useIsMobile(DESKTOP_BREAKPOINT);
  if (dismissed || isMobile) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-5 z-[60] hidden lg:block ${className ?? ""}`}
    >
      <div className="pointer-events-auto relative w-fit rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg shadow-black/5">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute -right-2.5 -top-2.5 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss scanner"
        >
          <X className="size-4" />
        </button>

        {/* The code stays a sharp-cornered square: rounding its corners eats
            into the quiet zone and makes it harder for a camera to lock on.
            `size-36` is deliberate — scanner.png is a 702x702 mark and a phone
            camera cannot resolve it much below that. */}
        <img
          src={scannerImage}
          alt="Scan to open KSEMO on your phone"
          width={144}
          height={144}
          className="block size-36 bg-white object-contain"
          draggable={false}
        />
        <p className="mt-2.5 whitespace-nowrap text-center text-xs font-medium leading-tight text-foreground">
          Scan to open on mobile
        </p>
      </div>
    </div>
  );
}

export default ScanToOpenCard;
