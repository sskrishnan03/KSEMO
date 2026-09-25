import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MessageFeedbackValue } from "@/lib/messageFeedback";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import React, { memo } from "react";

export type { MessageFeedbackValue };

const LABEL: Record<MessageFeedbackValue, string> = {
  up: "Good response",
  down: "Bad response",
};

/**
 * Identical to the neighbouring action buttons — no extra chrome. The only
 * feedback is on the thumb glyph itself, which fills in and pops.
 */
const FeedbackToggle = memo(function FeedbackToggle({
  value,
  active,
  onToggle,
}: {
  value: MessageFeedbackValue;
  active: boolean;
  onToggle: (value: MessageFeedbackValue) => void;
}) {
  const Icon = value === "up" ? ThumbsUp : ThumbsDown;
  const label = LABEL[value];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          onClick={() => onToggle(value)}
          className={cn(
            "size-7 rounded-md text-muted-foreground transition-colors",
            // Once chosen, the thumb keeps the same look under the pointer, so
            // hovering can never leave a lingering highlight on it.
            active
              ? "bg-accent/70 text-foreground hover:bg-accent/70 hover:text-foreground"
              : "hover:bg-accent hover:text-foreground"
          )}
        >
          {/* Nothing wraps the thumb: the glyph is the only thing that changes. */}
          <Icon
            aria-hidden="true"
            className={cn(
              "size-4",
              active && "ksemo-feedback-thumb-active ksemo-feedback-thumb-pop"
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {active ? `Remove ${label.toLowerCase()}` : label}
      </TooltipContent>
    </Tooltip>
  );
});

/**
 * Good/bad response rating for an assistant message.
 *
 * The two thumbs are an exclusive pair: choosing one deselects the other, and
 * pressing the active thumb again clears the rating entirely. State is owned by
 * the caller so the choice can persist across reloads; pass `null` for unrated.
 */
export const MessageFeedback = memo(function MessageFeedback({
  value,
  onToggle,
}: {
  value?: MessageFeedbackValue | null;
  onToggle: (value: MessageFeedbackValue) => void;
}) {
  return (
    <>
      <FeedbackToggle
        value="up"
        active={value === "up"}
        onToggle={onToggle}
      />
      <FeedbackToggle
        value="down"
        active={value === "down"}
        onToggle={onToggle}
      />
    </>
  );
});
