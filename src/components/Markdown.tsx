import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';
import { cn, downloadFile } from '../lib/utils';

export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return <div className={cn('md-body', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-800 border border-white/8 border-b-0 rounded-t-xl">
        <span className="text-[11px] font-mono text-ink-300 uppercase">{lang || 'text'}</span>
        <div className="flex gap-1">
          <button onClick={copy} className="h-6 px-2 rounded text-[11px] text-ink-200 hover:text-white hover:bg-white/5 flex items-center gap-1 transition">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => downloadFile(`snippet.${lang || 'txt'}`, code)} className="h-6 px-2 rounded text-[11px] text-ink-200 hover:text-white hover:bg-white/5 transition">
            Save
          </button>
        </div>
      </div>
      <pre className="bg-ink-950 border border-white/8 border-t-0 rounded-b-xl p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="font-mono text-ink-50">{code}</code>
      </pre>
    </div>
  );
}
