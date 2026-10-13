// A client stop can arrive while a provider is still unwinding its stream.
// Preserve the exact text the client had displayed so the provider's eventual
// cancellation write cannot replace it with text the user never saw.
const overrides = new Map<string, { content: string; expiresAt: number }>();

export function setInterruptedResponseOverride(
  messageId: string,
  content: string
) {
  const now = Date.now();
  for (const [id, value] of overrides) {
    if (value.expiresAt <= now) overrides.delete(id);
  }
  overrides.set(messageId, { content, expiresAt: now + 5 * 60_000 });
}

export function takeInterruptedResponseOverride(messageId: string) {
  const value = overrides.get(messageId);
  overrides.delete(messageId);
  return value && value.expiresAt > Date.now() ? value.content : undefined;
}
