export type MessageFeedbackValue = "up" | "down";

/** Ratings for the open conversation, keyed by message id. Unrated messages are absent. */
export type MessageFeedbackMap = Record<string, MessageFeedbackValue>;

export type ToggledMessageFeedback = {
  ratings: MessageFeedbackMap;
  /** What to persist: `null` clears the rating. */
  value: MessageFeedbackValue | null;
};

/**
 * Good/bad response is an exclusive pair. Pressing the other thumb switches the
 * rating over to it; pressing the thumb that is already active clears it.
 *
 * Returns the next ratings map plus the value to persist, so the caller can
 * apply the change optimistically and hand the same value to the server.
 */
export function toggleMessageFeedback(
  current: MessageFeedbackMap,
  messageId: string,
  value: MessageFeedbackValue,
): ToggledMessageFeedback {
  const next = current[messageId] === value ? null : value;
  const ratings = { ...current };
  if (next) ratings[messageId] = next;
  else delete ratings[messageId];
  return { ratings, value: next };
}

/** Value identity check so re-reading the same ratings never re-renders the chat. */
export function isSameMessageFeedback(
  a: MessageFeedbackMap,
  b: MessageFeedbackMap,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => a[key] === b[key]);
}
