import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverPortal({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Portal>) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverClose({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
  className,
  align = "end",
  side = "bottom",
  sideOffset = 8,
  showOverlay = false,
  overlayClassName,
  onOverlayClick,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  showOverlay?: boolean;
  overlayClassName?: string;
  onOverlayClick?: () => void;
}) {
  return (
    <>
      {showOverlay && (
        <PopoverPrimitive.Portal>
          <div
            data-slot="popover-overlay"
            className={cn(
              "fixed inset-0 z-[70] bg-black/20 dark:bg-black/40 backdrop-blur-[2.5px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
              overlayClassName
            )}
            onClick={onOverlayClick}
            aria-hidden="true"
          />
        </PopoverPrimitive.Portal>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="popover-content"
          align={align}
          side={side}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[80] origin-(--radix-popover-content-transform-origin) outline-hidden",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Portal>
    </>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverPortal, PopoverAnchor, PopoverClose };

