export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncate(str: string, n: number): string {
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

export function downloadFile(filename: string, content: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export function groupByDate<T extends { created_at?: string; updated_at?: string }>(items: T[], key: 'created_at' | 'updated_at' = 'created_at'): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const now = new Date();
  for (const item of items) {
    const d = new Date((item[key] as string) ?? Date.now());
    const diff = (now.getTime() - d.getTime()) / 1000;
    let label: string;
    if (diff < 86400 && now.getDate() === d.getDate()) label = 'Today';
    else if (diff < 172800) label = 'Yesterday';
    else if (diff < 604800) label = 'Previous 7 days';
    else if (diff < 2592000) label = 'Previous 30 days';
    else label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
