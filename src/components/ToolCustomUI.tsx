import React, { useState, useEffect } from 'react';
import {
  FileText, Languages, SpellCheck, Code2, Bug, BookOpen, Database, Braces,
  Mail, PenLine, User, Sigma, Image, FileSearch, Microscope,
  NotebookPen, Layers, HelpCircle, Network, Workflow, Wand2,
  Copy, Check, ChevronLeft, ChevronRight, Eye, Sparkles
} from 'lucide-react';
import { Markdown } from './Markdown';
import { Button } from './ui';

// 1. DYNAMIC ICON RESOLUTION
export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Languages,
  SpellCheck,
  Code2,
  Bug,
  BookOpen,
  Database,
  Braces,
  Mail,
  PenLine,
  FileUser: User,
  Sigma,
  Image,
  FileSearch,
  Microscope,
  NotebookPen,
  Layers,
  CircleHelp: HelpCircle,
  Network,
  Workflow
};

export function ToolIcon({ name, className, size = 18 }: { name: string; className?: string; size?: number }) {
  const IconComponent = ICON_MAP[name] || Wand2;
  return <IconComponent className={className} size={size} />;
}

// 2. QUIZ GENERATOR UI
interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

function parseQuiz(text: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const lines = text.split('\n');
  let currentQuestion: Partial<QuizQuestion> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect question (e.g., "1. What is...")
    const qMatch = trimmed.match(/^\d+[\.\:\)]\s*(.+)/i);
    if (qMatch) {
      if (currentQuestion && currentQuestion.question && currentQuestion.options && currentQuestion.options.length > 1 && currentQuestion.correctAnswerIndex !== undefined && currentQuestion.correctAnswerIndex >= 0) {
        questions.push(currentQuestion as QuizQuestion);
      }
      currentQuestion = {
        question: qMatch[1],
        options: [],
        correctAnswerIndex: -1
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Detect options (e.g., "A) Option" or "a. Option" or "A. Option")
    const optMatch = trimmed.match(/^[a-d][\.\)\s-]+\s*(.+)/i);
    if (optMatch) {
      currentQuestion.options!.push(optMatch[1].trim());
      continue;
    }

    // Detect correct answer (e.g., "Correct: A" or "Correct Answer: B" or "Answer: C")
    const ansMatch = trimmed.match(/(?:correct(?:\s*answer)?|answer)[\s\:\-]*([a-d])\b/i);
    if (ansMatch) {
      const letter = ansMatch[1].toUpperCase();
      currentQuestion.correctAnswerIndex = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
    }
  }

  if (currentQuestion && currentQuestion.question && currentQuestion.options && currentQuestion.options.length > 1 && currentQuestion.correctAnswerIndex !== undefined && currentQuestion.correctAnswerIndex >= 0) {
    questions.push(currentQuestion as QuizQuestion);
  }

  return questions;
}

export function QuizApp({ content }: { content: string }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setQuestions(parseQuiz(content));
    setAnswers({});
    setSubmitted(false);
  }, [content]);

  if (questions.length === 0) {
    return <Markdown content={content} />;
  }

  const handleSelect = (qIdx: number, oIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleSubmit = () => {
    let finalScore = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswerIndex) {
        finalScore++;
      }
    });
    setScore(finalScore);
    setSubmitted(true);
  };

  return (
    <div className="space-y-6 animate-fade-in p-1">
      <div className="flex items-center justify-between bg-ink-850 border border-white/5 rounded-2xl p-4">
        <div>
          <h4 className="text-sm font-semibold text-white">Interactive Quiz Mode</h4>
          <p className="text-xs text-ink-300">Test your knowledge on the generated content.</p>
        </div>
        {submitted && (
          <div className="text-right">
            <span className="text-lg font-bold text-white">{score} / {questions.length}</span>
            <div className="text-[10px] text-ink-300">Score: {Math.round((score / questions.length) * 100)}%</div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const isCorrect = answers[qIdx] === q.correctAnswerIndex;
          return (
            <div key={qIdx} className="bg-ink-850 border border-white/5 rounded-2xl p-5 space-y-3">
              <h5 className="text-[13px] font-medium text-white">{qIdx + 1}. {q.question}</h5>
              <div className="grid gap-2">
                {q.options.map((opt, oIdx) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isSelected = answers[qIdx] === oIdx;
                  const isRightAnswer = q.correctAnswerIndex === oIdx;
                  
                  let optionStyle = "border-white/5 bg-white/2 hover:bg-white/5 text-ink-200";
                  if (isSelected && !submitted) {
                    optionStyle = "border-white/20 bg-white/10 text-white font-medium";
                  }
                  if (submitted) {
                    if (isRightAnswer) {
                      optionStyle = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-medium";
                    } else if (isSelected && !isCorrect) {
                      optionStyle = "border-red-500/30 bg-red-500/10 text-red-300";
                    } else {
                      optionStyle = "border-white/5 bg-transparent opacity-60 text-ink-400";
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelect(qIdx, oIdx)}
                      disabled={submitted}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-xs transition-all ${optionStyle}`}
                    >
                      <span className={`h-5 w-5 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                        isSelected ? 'border-current bg-white/5' : 'border-white/10'
                      }`}>
                        {letter}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full justify-center"
        >
          Submit Quiz
        </Button>
      )}

      {submitted && (
        <Button
          variant="outline"
          onClick={() => {
            setAnswers({});
            setSubmitted(false);
          }}
          className="w-full justify-center"
        >
          Retake Quiz
        </Button>
      )}
    </div>
  );
}

// 3. FLASHCARDS UI
interface Flashcard {
  question: string;
  answer: string;
}

function parseFlashcards(text: string): Flashcard[] {
  const cards: Flashcard[] = [];
  const lines = text.split('\n');
  let currentQ = '';
  let currentA = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect question
    const qMatch = trimmed.match(/(?:\d+[\.\)]\s*)?Q(?:uestion)?\s*[\:\-]\s*(.+)/i) || 
                   trimmed.match(/^\d+[\.\)]\s*(.+)/) || 
                   trimmed.match(/^\-\s*\*\*Question\*\*[\:\-]\s*(.+)/i);
    if (qMatch) {
      if (currentQ && currentA) {
        cards.push({ question: currentQ, answer: currentA });
        currentA = '';
      }
      currentQ = qMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
      continue;
    }

    // Detect answer
    const aMatch = trimmed.match(/^A(?:nswer)?\s*[\:\-]\s*(.+)/i) || 
                   trimmed.match(/^\-\s*\*\*Answer\*\*[\:\-]\s*(.+)/i);
    if (aMatch) {
      currentA = aMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
    } else if (currentQ && !currentA && trimmed.startsWith('-')) {
      currentA = trimmed.substring(1).trim();
    }
  }

  if (currentQ && currentA) {
    cards.push({ question: currentQ, answer: currentA });
  }

  return cards;
}

export function FlashcardApp({ content }: { content: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownList, setKnownList] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCards(parseFlashcards(content));
    setActiveIndex(0);
    setFlipped(false);
    setKnownList(new Set());
  }, [content]);

  if (cards.length === 0) {
    return <Markdown content={content} />;
  }

  const activeCard = cards[activeIndex];

  const handleNext = () => {
    if (activeIndex < cards.length - 1) {
      setFlipped(false);
      setTimeout(() => setActiveIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setFlipped(false);
      setTimeout(() => setActiveIndex(prev => prev - 1), 150);
    }
  };

  const toggleKnown = () => {
    setKnownList(prev => {
      const next = new Set(prev);
      if (next.has(activeIndex)) {
        next.delete(activeIndex);
      } else {
        next.add(activeIndex);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-md mx-auto py-2">
      <div className="flex items-center justify-between text-xs text-ink-300">
        <span>Card {activeIndex + 1} of {cards.length}</span>
        <span>{knownList.size} Learned</span>
      </div>

      {/* 3D Flip Card Container */}
      <div 
        onClick={() => setFlipped(!flipped)}
        className="relative h-64 w-full cursor-pointer select-none group [perspective:1000px]"
      >
        <div className={`relative w-full h-full duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* Front Side */}
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-ink-850 border border-white/8 p-6 flex flex-col items-center justify-center text-center shadow-lg backface-hidden [backface-visibility:hidden]">
            <span className="text-[10px] uppercase tracking-wider text-ink-400 mb-4">Question</span>
            <p className="text-[14px] font-medium text-white leading-relaxed flex-1 flex items-center justify-center">{activeCard.question}</p>
            <span className="text-[11px] text-ink-300 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition"><Eye size={12} /> Click to flip</span>
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-ink-800 border border-white/12 p-6 flex flex-col items-center justify-center text-center shadow-lg [transform:rotateY(180deg)] backface-hidden [backface-visibility:hidden]">
            <span className="text-[10px] uppercase tracking-wider text-ink-400 mb-4">Answer</span>
            <p className="text-[13px] text-ink-100 leading-relaxed flex-1 flex items-center justify-center">{activeCard.answer}</p>
            <span className="text-[11px] text-ink-300 flex items-center gap-1.5 opacity-60"><Eye size={12} /> Click to see question</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="icon" onClick={handlePrev} disabled={activeIndex === 0}>
          <ChevronLeft size={16} />
        </Button>
        
        <Button 
          variant={knownList.has(activeIndex) ? "primary" : "outline"}
          onClick={toggleKnown}
          className="flex-1 justify-center text-xs"
        >
          {knownList.has(activeIndex) ? "Learned ✓" : "Mark as Learned"}
        </Button>

        <Button variant="outline" size="icon" onClick={handleNext} disabled={activeIndex === cards.length - 1}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {knownList.size === cards.length && (
        <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-fade-in">
          <Sparkles className="text-emerald-400 mx-auto mb-2" size={18} />
          <h4 className="text-xs font-semibold text-white">Congratulations!</h4>
          <p className="text-[11px] text-emerald-300 mt-1">You have mastered all flashcards in this set.</p>
        </div>
      )}
    </div>
  );
}

// 4. GRAMMAR DIFF VIEW
function getWordDiff(original: string, corrected: string) {
  const orig = original.trim().split(/\s+/).filter(Boolean);
  const corr = corrected.trim().split(/\s+/).filter(Boolean);

  const dp: number[][] = Array(orig.length + 1).fill(0).map(() => Array(corr.length + 1).fill(0));
  for (let i = 1; i <= orig.length; i++) {
    for (let j = 1; j <= corr.length; j++) {
      if (orig[i - 1] === corr[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: { type: 'common' | 'removed' | 'added'; word: string }[] = [];
  let i = orig.length;
  let j = corr.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && orig[i - 1] === corr[j - 1]) {
      diff.unshift({ type: 'common', word: orig[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', word: corr[j - 1] });
      j--;
    } else {
      diff.unshift({ type: 'removed', word: orig[i - 1] });
      i--;
    }
  }
  return diff;
}

export function GrammarApp({ content, originalText }: { content: string; originalText: string }) {
  const [correctedText, setCorrectedText] = useState('');
  const [explanations, setExplanations] = useState('');

  useEffect(() => {
    // LLM outputs corrected text first, then maybe a separator like '---' or 'Changes:' followed by list
    const parts = content.split(/(?:Changes|Correction details|Changes list|Explanation):/i);
    const corrected = parts[0]?.trim() || content;
    const notes = parts[1]?.trim() || '';
    setCorrectedText(corrected);
    setExplanations(notes);
  }, [content]);

  if (!originalText) {
    return <Markdown content={content} />;
  }

  const diff = getWordDiff(originalText, correctedText);

  return (
    <div className="space-y-6">
      <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Visual Revision Comparison</h4>
        <div className="p-4 bg-ink-900 border border-white/5 rounded-xl text-xs leading-relaxed font-sans min-h-[100px] flex flex-wrap gap-x-1.5 gap-y-1">
          {diff.map((item, idx) => {
            if (item.type === 'added') {
              return <ins key={idx} className="bg-emerald-500/20 text-emerald-300 px-1 rounded no-underline border-b border-emerald-500/30">{item.word}</ins>;
            }
            if (item.type === 'removed') {
              return <del key={idx} className="bg-red-500/20 text-red-300/80 px-1 rounded line-through border-b border-red-500/30">{item.word}</del>;
            }
            return <span key={idx} className="text-ink-100">{item.word}</span>;
          })}
        </div>
        <div className="flex gap-4 text-[10px] text-ink-300 border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Corrected additions
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Original errors removed
          </div>
        </div>
      </div>

      {explanations && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Changes Explanation</h4>
          <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 text-xs text-ink-200">
            <Markdown content={explanations} />
          </div>
        </div>
      )}
    </div>
  );
}

// 5. CODE EXPLORER & PREVIEWER
interface CodePart {
  lang: string;
  code: string;
  beforeText: string;
  afterText: string;
}

function parseCodeBlocks(text: string): CodePart[] {
  const parts = text.split('```');
  const blocks: CodePart[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const blockContent = parts[i];
    const firstNewline = blockContent.indexOf('\n');
    let lang = 'code';
    let code = blockContent;
    if (firstNewline !== -1) {
      lang = blockContent.substring(0, firstNewline).trim();
      code = blockContent.substring(firstNewline + 1);
    }
    blocks.push({
      lang: lang || 'code',
      code: code,
      beforeText: parts[i - 1] || '',
      afterText: parts[i + 1] || ''
    });
  }
  return blocks;
}

export function CodeApp({ content }: { content: string }) {
  const [blocks, setBlocks] = useState<CodePart[]>([]);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setBlocks(parseCodeBlocks(content));
    setActiveTab('code');
  }, [content]);

  if (blocks.length === 0) {
    return <Markdown content={content} />;
  }

  const mainBlock = blocks[0];
  const isWebCode = ['html', 'js', 'javascript', 'css', 'svg'].includes(mainBlock.lang.toLowerCase()) || 
                    (mainBlock.lang === 'code' && (mainBlock.code.includes('<html') || mainBlock.code.includes('</div>')));

  let srcDocContent = mainBlock.code;
  if (mainBlock.lang.toLowerCase() === 'css') {
    srcDocContent = `<style>${mainBlock.code}</style><div style="font-family: sans-serif; padding: 24px; color: white;"><h3>CSS Template styling loaded</h3><p>Custom css has been injected.</p></div>`;
  } else if (['js', 'javascript'].includes(mainBlock.lang.toLowerCase())) {
    srcDocContent = `<script>${mainBlock.code}</script><div style="font-family: sans-serif; padding: 24px; color: white;"><h3>JavaScript Code Loaded</h3><p>Execution script is active in sandbox iframe.</p></div>`;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mainBlock.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {mainBlock.beforeText && (
        <div className="text-xs text-ink-200">
          <Markdown content={mainBlock.beforeText} />
        </div>
      )}

      {/* Code Editor Container */}
      <div className="rounded-xl border border-white/8 bg-ink-950 overflow-hidden shadow-lift flex flex-col">
        {/* Terminal Header */}
        <div className="h-10 px-4 bg-ink-900 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/60" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="text-[10px] text-ink-300 font-mono ml-2 uppercase">{mainBlock.lang}</span>
          </div>

          <div className="flex items-center gap-2">
            {isWebCode && (
              <div className="flex border border-white/5 rounded-lg p-0.5 bg-ink-950">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    activeTab === 'code' ? 'bg-white/10 text-white' : 'text-ink-300 hover:text-white'
                  }`}
                >
                  Code
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    activeTab === 'preview' ? 'bg-white/10 text-white' : 'text-ink-300 hover:text-white'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-ink-200 hover:text-white bg-white/5 border border-white/8 rounded-lg px-2 py-0.5 transition"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Panel body */}
        <div className="flex-1 min-h-0">
          {activeTab === 'code' ? (
            <pre className="p-4 overflow-x-auto text-[11.5px] font-mono text-zinc-100 bg-ink-950 max-h-96 whitespace-pre leading-relaxed">
              <code>{mainBlock.code}</code>
            </pre>
          ) : (
            <div className="p-2 bg-zinc-900">
              <iframe
                title="Sandbox Preview"
                srcDoc={srcDocContent}
                sandbox="allow-scripts"
                className="w-full h-80 bg-zinc-950 rounded-lg border border-white/5 shadow-inner"
              />
            </div>
          )}
        </div>
      </div>

      {mainBlock.afterText && (
        <div className="text-xs text-ink-200 border-t border-white/5 pt-3 mt-3">
          <Markdown content={mainBlock.afterText} />
        </div>
      )}
    </div>
  );
}

// 6. EMAIL WRITER MOCK CLIENT
interface ParsedEmail {
  subject: string;
  body: string;
}

function parseEmail(text: string): ParsedEmail {
  const lines = text.split('\n');
  let subject = '';
  let bodyLines: string[] = [];
  let foundSubject = false;

  for (const line of lines) {
    if (!foundSubject && line.toLowerCase().startsWith('subject:')) {
      subject = line.substring(8).trim();
      foundSubject = true;
    } else {
      bodyLines.push(line);
    }
  }

  if (!foundSubject) {
    const match = text.match(/Subject\s*:\s*(.+)/i);
    if (match) {
      subject = match[1].trim();
      return { subject, body: text.replace(match[0], '').trim() };
    }
    return { subject: 'No Subject', body: text };
  }

  return { subject, body: bodyLines.join('\n').trim() };
}

export function EmailApp({ content }: { content: string }) {
  const [email, setEmail] = useState<ParsedEmail | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  useEffect(() => {
    setEmail(parseEmail(content));
  }, [content]);

  if (!email) return <Markdown content={content} />;

  const copySubject = () => {
    navigator.clipboard.writeText(email.subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 1500);
  };

  const copyBody = () => {
    navigator.clipboard.writeText(email.body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Mock Client Window */}
      <div className="rounded-2xl border border-white/8 bg-ink-850 overflow-hidden shadow-lift flex flex-col">
        {/* Header bar */}
        <div className="px-4 py-3 bg-ink-900 border-b border-white/5 space-y-2">
          <div className="flex items-center text-xs text-ink-300 border-b border-white/5 pb-2">
            <span className="w-16 font-medium text-ink-400">To:</span>
            <span className="text-white italic">client@example.com</span>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-300">
            <div className="flex items-center flex-1 min-w-0 mr-2">
              <span className="w-16 font-medium text-ink-400">Subject:</span>
              <span className="text-white font-medium truncate">{email.subject}</span>
            </div>
            <button
              onClick={copySubject}
              className="text-[10px] text-ink-300 hover:text-white flex items-center gap-1 border border-white/8 bg-white/5 px-2 py-0.5 rounded-lg"
            >
              {copiedSubject ? <Check size={11} /> : <Copy size={11} />} {copiedSubject ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 min-h-[200px] text-xs text-ink-100 leading-relaxed font-sans whitespace-pre-wrap select-text">
          {email.body}
        </div>

        {/* Footer controls */}
        <div className="px-4 py-3 bg-ink-900 border-t border-white/5 flex justify-end">
          <Button size="sm" onClick={copyBody} className="text-xs">
            {copiedBody ? <Check size={13} /> : <Copy size={13} />} {copiedBody ? 'Copied' : 'Copy Email Body'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 7. MEETING NOTES CHECKLIST
interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

function parseMeetingNotes(text: string): { notes: string; items: ActionItem[] } {
  const lines = text.split('\n');
  const items: ActionItem[] = [];
  const noteLines: string[] = [];
  let inActionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.toLowerCase().includes('action item') || trimmed.toLowerCase().includes('next steps') || trimmed.toLowerCase().includes('task list')) {
      inActionSection = true;
      noteLines.push(line);
      continue;
    }

    if (inActionSection) {
      const listMatch = trimmed.match(/^[-*+]\s+(?:\[([ xX])\])?\s*(.+)/);
      if (listMatch) {
        const checked = listMatch[1] ? (listMatch[1].toLowerCase() === 'x') : false;
        items.push({
          id: `task-${i}`,
          text: listMatch[2].trim(),
          done: checked
        });
        continue;
      } else if (trimmed === '') {
        // preserve empty spacing
      } else {
        inActionSection = false;
      }
    }
    noteLines.push(line);
  }
  return { notes: noteLines.join('\n'), items };
}

export function MeetingNotesApp({ content }: { content: string }) {
  const [data, setData] = useState<{ notes: string; items: ActionItem[] } | null>(null);

  useEffect(() => {
    setData(parseMeetingNotes(content));
  }, [content]);

  if (!data) return <Markdown content={content} />;

  const toggleItem = (itemId: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item => item.id === itemId ? { ...item, done: !item.done } : item)
      };
    });
  };

  return (
    <div className="space-y-5 p-1">
      {data.items.length > 0 && (
        <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Interactive Action Items</h4>
          <div className="space-y-2">
            {data.items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/5 text-left text-xs transition ${
                  item.done ? 'bg-white/2 text-ink-400 border-dashed opacity-75' : 'bg-white/4 text-ink-100 hover:bg-white/8'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-all ${
                  item.done ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/20'
                }`}>
                  {item.done && <span className="text-[10px]">✓</span>}
                </div>
                <span className={item.done ? 'line-through' : ''}>{item.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {data.items.length > 0 && <h4 className="text-xs font-semibold text-white uppercase tracking-wider mt-5">Notes & Minutes</h4>}
        <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 text-xs text-ink-200">
          <Markdown content={data.notes} />
        </div>
      </div>
    </div>
  );
}

// 8. MIND MAP INTERACTIVE TREE
interface MindMapNode {
  text: string;
  level: number;
  children: MindMapNode[];
}

function parseMindMap(text: string): MindMapNode[] {
  const lines = text.split('\n');
  const rootNodes: MindMapNode[] = [];
  const stack: MindMapNode[] = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (!match) continue;

    const indent = match[1].length;
    const textVal = match[2].replace(/^\*\*|\*\*$/g, '').trim();
    const level = Math.floor(indent / 2);

    const node: MindMapNode = {
      text: textVal,
      level,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return rootNodes;
}

export function MindMapApp({ content }: { content: string }) {
  const [tree, setTree] = useState<MindMapNode[]>([]);

  useEffect(() => {
    setTree(parseMindMap(content));
  }, [content]);

  if (tree.length === 0) {
    return <Markdown content={content} />;
  }

  const renderNode = (node: MindMapNode, index: number) => {
    return (
      <div key={index} className="pl-4 border-l border-white/8 ml-2 mt-2 space-y-1">
        <div className="flex items-center gap-2 group">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <div className="px-3 py-1.5 rounded-lg bg-ink-800 border border-white/5 text-xs font-medium text-white hover:border-white/10 transition">
            {node.text}
          </div>
        </div>
        {node.children.map((child, cIdx) => renderNode(child, cIdx))}
      </div>
    );
  };

  return (
    <div className="space-y-4 p-1">
      <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Visual Map View</h4>
        <div className="py-2">
          {tree.map((root, idx) => (
            <div key={idx} className="mb-4">
              <div className="px-4 py-2.5 rounded-xl bg-indigo-600 border border-white/10 text-xs font-bold text-white inline-flex items-center gap-2">
                <Network size={14} /> {root.text}
              </div>
              {root.children.map((child, cIdx) => renderNode(child, cIdx))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 9. FLOWCHART STEPPER
export function FlowchartApp({ content }: { content: string }) {
  const [steps, setSteps] = useState<string[]>([]);

  useEffect(() => {
    const list = parseMindMap(content);
    const parsedSteps: string[] = [];
    
    const extractSteps = (nodes: MindMapNode[]) => {
      nodes.forEach(node => {
        parsedSteps.push(node.text);
        if (node.children.length > 0) {
          extractSteps(node.children);
        }
      });
    };
    
    extractSteps(list);
    setSteps(parsedSteps);
  }, [content]);

  if (steps.length === 0) {
    return <Markdown content={content} />;
  }

  return (
    <div className="space-y-4 p-1">
      <div className="bg-ink-850 border border-white/5 rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Vertical Process Flow</h4>
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/8">
          {steps.map((step, idx) => (
            <div key={idx} className="relative group flex items-start gap-4">
              <div className="absolute -left-5 top-1 h-2 w-2 rounded-full bg-white/30 border border-ink-850 group-hover:bg-white/70 group-hover:scale-125 transition-all" />
              
              <div className="flex-1 px-4 py-3 rounded-xl bg-ink-800 border border-white/5 hover:border-white/10 transition">
                <span className="text-[10px] text-ink-300 font-mono uppercase tracking-wider">Step {idx + 1}</span>
                <p className="text-xs text-white font-medium mt-0.5">{step}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 10. OVERALL ROUTER COMPONENT
export function renderCustomOutput(toolId: string, output: string, originalText: string) {
  if (!output) return null;

  switch (toolId) {
    case 'quiz':
      return <QuizApp content={output} />;
    case 'flashcards':
      return <FlashcardApp content={output} />;
    case 'grammar':
      return <GrammarApp content={output} originalText={originalText} />;
    case 'code-gen':
    case 'bug-fixer':
    case 'sql-gen':
    case 'regex-gen':
      return <CodeApp content={output} />;
    case 'email-writer':
      return <EmailApp content={output} />;
    case 'meeting-notes':
      return <MeetingNotesApp content={output} />;
    case 'mind-map':
      return <MindMapApp content={output} />;
    case 'flowchart':
      return <FlowchartApp content={output} />;
    default:
      return null;
  }
}
