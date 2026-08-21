export type LibraryItem = {
  id: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
};

export function filterLibraryItems(
  items: LibraryItem[] | undefined,
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items ?? [];
  return (items ?? []).filter(item =>
    item.filename.toLowerCase().includes(normalizedQuery)
  );
}

export function createPrivateConversationUrl(
  origin: string,
  conversationId: string
) {
  return `${origin}/?conversation=${encodeURIComponent(conversationId)}`;
}

export function createPublicConversationUrl(
  origin: string,
  shareToken: string
) {
  return `${origin}/share/${encodeURIComponent(shareToken)}`;
}
