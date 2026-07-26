import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Square, Copy, Check, Download, Sparkles, Volume2, Languages,
} from 'lucide-react';
import { TOOLS, runTool } from '../lib/tools';
import { Button, Textarea, Input, EmptyState, Badge } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { downloadFile } from '../lib/utils';
import { ToolIcon, renderCustomOutput } from '../components/ToolCustomUI';

export default function Tools() {
  const { toolId } = useParams();
  const [query, setQuery] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const tool = TOOLS.find((t) => t.id === toolId);

  useEffect(() => {
    setInputs({});
    setOutput('');
    setError('');
  }, [toolId]);

  const filtered = TOOLS.filter((t) =>
    !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase()),
  );

  const run = async () => {
    if (!tool) return;
    const missing = tool.inputs.find((f) => !inputs[f.name]?.trim());
    if (missing) { setError(`Please fill in: ${missing.label}`); return; }
    setError('');
    setOutput('');
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runTool(tool.id, inputs, { signal: controller.signal, onToken: (t) => setOutput((s) => s + t) });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => { abortRef.current?.abort(); setStreaming(false); };

  const copy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (!tool) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">AI Tools</h1>
            <p className="mt-2 text-ink-300">Purpose-built AI assistants for common tasks.</p>
          </div>
          <div className="relative mb-6">
            <Input placeholder="Search tools…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => (
              <Link
                key={t.id}
                to={`/app/tools/${t.id}`}
                className="group rounded-2xl bg-ink-850 border border-white/8 p-5 hover:border-white/15 hover:shadow-lift transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ToolIcon name={t.icon} size={18} className="text-white" />
                </div>
                <h3 className="text-[14px] font-semibold text-white">{t.name}</h3>
                <p className="mt-1 text-[12px] text-ink-300 leading-relaxed">{t.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 1. STUNNING CUSTOM TRANSLATOR SCREEN OVERRIDE
  if (tool.id === 'translator') {
    return (
      <div className="h-full flex flex-col">
        <div className="h-14 px-4 border-b border-white/8 flex items-center gap-3 glass">
          <Link to="/app/tools" className="flex items-center gap-1.5 text-[13px] text-ink-200 hover:text-white transition">
            <ArrowLeft size={15} /> Tools
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <ToolIcon name={tool.icon} size={16} className="text-white" />
            <span className="text-[14px] font-medium text-white">{tool.name}</span>
            <Badge>AI tool</Badge>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 overflow-y-auto">
          {/* Header configuration info */}
          <div className="flex flex-wrap items-center gap-3 bg-ink-850 border border-white/5 p-3 rounded-2xl max-w-xl">
            <div className="text-xs text-ink-300 font-medium px-2">Source: Auto Detect</div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <Languages size={14} className="text-ink-400" />
              <input
                type="text"
                placeholder="Target e.g. Spanish"
                value={inputs.to ?? ''}
                onChange={(e) => setInputs((s) => ({ ...s, to: e.target.value }))}
                className="w-full bg-ink-900 border border-white/8 rounded-xl h-9 px-3 text-xs text-white placeholder:text-ink-400 focus:outline-none focus:border-white/20 transition"
              />
            </div>
          </div>

          {/* Side by side translator boxes */}
          <div className="grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Input card */}
            <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Source Text</span>
                <span className="text-[10px] text-ink-400">{(inputs.text ?? '').length} characters</span>
              </div>
              <textarea
                placeholder="Type or paste text to translate..."
                value={inputs.text ?? ''}
                onChange={(e) => setInputs((s) => ({ ...s, text: e.target.value }))}
                className="flex-1 bg-transparent border-0 text-white placeholder:text-ink-500 focus:outline-none focus:ring-0 text-sm resize-none scrollbar-hide min-h-[120px]"
              />
              <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                {streaming ? (
                  <Button variant="danger" size="sm" onClick={stop}><Square size={13} /> Stop</Button>
                ) : (
                  <Button size="sm" onClick={run} disabled={streaming || !inputs.text || !inputs.to}><Sparkles size={13} /> Translate</Button>
                )}
                {inputs.text && <Button variant="outline" size="sm" onClick={() => { setInputs({}); setOutput(''); }}>Clear</Button>}
              </div>
            </div>

            {/* Translation Output Card */}
            <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Translation Output</span>
                {output && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const utterance = new SpeechSynthesisUtterance(output);
                          // Try to set language code if matches target input
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="h-7 px-2.5 rounded-lg text-[11px] text-ink-200 hover:text-white bg-white/5 border border-white/8 hover:bg-white/10 transition flex items-center gap-1.5"
                      title="Speak translated text"
                    >
                      <Volume2 size={12} /> Speak
                    </button>
                    <button
                      onClick={copy}
                      className="h-7 px-2.5 rounded-lg text-[11px] text-ink-200 hover:text-white bg-white/5 border border-white/8 hover:bg-white/10 transition flex items-center gap-1.5"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 text-sm text-white overflow-y-auto leading-relaxed select-text font-sans min-h-[120px]">
                {streaming && !output ? (
                  <div className="flex items-center gap-2 text-ink-300 italic"><span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" /> Translating...</div>
                ) : (
                  output || <span className="text-ink-400 italic">Translated text will appear here...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. STANDARD DESIGN UI WITH PREMIUM INTERACTIVE COMPONENTS
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-4 border-b border-white/8 flex items-center gap-3 glass">
        <Link to="/app/tools" className="flex items-center gap-1.5 text-[13px] text-ink-200 hover:text-white transition">
          <ArrowLeft size={15} /> Tools
        </Link>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <ToolIcon name={tool.icon} size={16} className="text-white" />
          <span className="text-[14px] font-medium text-white">{tool.name}</span>
          <Badge>AI tool</Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-2">
        {/* Input side */}
        <div className="overflow-y-auto p-6 border-r border-white/8">
          <p className="text-[13px] text-ink-200 mb-5">{tool.description}</p>
          <div className="space-y-4">
            {tool.inputs.map((f) => (
              f.type === 'textarea' ? (
                <Textarea
                  key={f.name}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={inputs[f.name] ?? ''}
                  onChange={(e) => setInputs((s) => ({ ...s, [f.name]: e.target.value }))}
                  rows={6}
                />
              ) : (
                <Input
                  key={f.name}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={inputs[f.name] ?? ''}
                  onChange={(e) => setInputs((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )
            ))}
          </div>
          {error && <p className="mt-3 text-[12px] text-white">{error}</p>}
          <div className="mt-5 flex gap-2">
            {streaming ? (
              <Button variant="danger" onClick={stop}><Square size={14} /> Stop</Button>
            ) : (
              <Button onClick={run} disabled={streaming}><Sparkles size={15} /> Generate</Button>
            )}
            {output && <Button variant="outline" onClick={() => { setOutput(''); setInputs({}); }}>Clear</Button>}
          </div>
        </div>

        {/* Output side */}
        <div className="overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] uppercase tracking-wider text-ink-300">Result</span>
            {output && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadFile(`${tool.id}-result.md`, output, 'text/markdown')}><Download size={13} /> Save</Button>
              </div>
            )}
          </div>
          {!output && !streaming && (
            <EmptyState icon={<ToolIcon name={tool.icon} size={20} />} title="No output yet" description="Fill in the inputs and hit Generate." />
          )}
          {output && (
            renderCustomOutput(tool.id, output, inputs.text || '') || (
              <Markdown content={output} className={streaming ? 'typing-caret' : ''} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

