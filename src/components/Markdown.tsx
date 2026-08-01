import { useMemo } from 'react';
import { renderMarkdown } from '../lib/markdown';
import { cn } from '../lib/utils';

export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className={cn('md-body', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
