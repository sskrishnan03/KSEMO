import { streamChat, type ChatMessage } from './ai';

export type ToolId =
  | 'summarizer' | 'translator' | 'grammar' | 'code-gen' | 'bug-fixer'
  | 'code-explainer' | 'sql-gen' | 'regex-gen' | 'email-writer' | 'blog-writer'
  | 'resume-writer' | 'math-solver' | 'image-analyzer' | 'document-analyzer'
  | 'research' | 'meeting-notes' | 'flashcards' | 'quiz' | 'mind-map' | 'flowchart';

export interface ToolDef {
  id: ToolId;
  name: string;
  description: string;
  icon: string; // lucide icon name
  inputs: { name: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[];
}

export const TOOLS: ToolDef[] = [
  { id: 'summarizer', name: 'Summarizer', description: 'Condense long text into key points', icon: 'FileText', inputs: [{ name: 'text', label: 'Text to summarize', type: 'textarea', placeholder: 'Paste any article, document, or transcript…' }] },
  { id: 'translator', name: 'Translator', description: 'Translate text between languages', icon: 'Languages', inputs: [{ name: 'text', label: 'Text', type: 'textarea', placeholder: 'Text to translate' }, { name: 'to', label: 'Target language', type: 'text', placeholder: 'e.g. Spanish' }] },
  { id: 'grammar', name: 'Grammar Fix', description: 'Correct grammar, spelling, and tone', icon: 'SpellCheck', inputs: [{ name: 'text', label: 'Text', type: 'textarea', placeholder: 'Paste text to fix' }] },
  { id: 'code-gen', name: 'Code Generator', description: 'Generate code from a description', icon: 'Code2', inputs: [{ name: 'text', label: 'What should the code do?', type: 'textarea', placeholder: 'e.g. A React hook that debounces a value' }] },
  { id: 'bug-fixer', name: 'Bug Fixer', description: 'Find and fix bugs in your code', icon: 'Bug', inputs: [{ name: 'text', label: 'Code + error', type: 'textarea', placeholder: 'Paste your code and describe the bug' }] },
  { id: 'code-explainer', name: 'Code Explainer', description: 'Explain what code does, step by step', icon: 'BookOpen', inputs: [{ name: 'text', label: 'Code', type: 'textarea', placeholder: 'Paste code to explain' }] },
  { id: 'sql-gen', name: 'SQL Generator', description: 'Turn plain English into SQL', icon: 'Database', inputs: [{ name: 'text', label: 'Describe the query', type: 'textarea', placeholder: 'e.g. Top 10 customers by revenue last month' }] },
  { id: 'regex-gen', name: 'Regex Generator', description: 'Generate and explain regular expressions', icon: 'Braces', inputs: [{ name: 'text', label: 'What should it match?', type: 'textarea', placeholder: 'e.g. US phone numbers' }] },
  { id: 'email-writer', name: 'Email Writer', description: 'Draft professional emails', icon: 'Mail', inputs: [{ name: 'text', label: 'Email goal + context', type: 'textarea', placeholder: 'e.g. Follow up with a client after a demo' }] },
  { id: 'blog-writer', name: 'Blog Writer', description: 'Outline and draft blog posts', icon: 'PenLine', inputs: [{ name: 'text', label: 'Topic + angle', type: 'textarea', placeholder: 'e.g. Why monochrome design improves focus' }] },
  { id: 'resume-writer', name: 'Resume Writer', description: 'Rewrite resume bullet points', icon: 'FileUser', inputs: [{ name: 'text', label: 'Experience + role', type: 'textarea', placeholder: 'Paste your bullets and target role' }] },
  { id: 'math-solver', name: 'Math Solver', description: 'Solve and explain math problems', icon: 'Sigma', inputs: [{ name: 'text', label: 'Problem', type: 'textarea', placeholder: 'e.g. integrate x^2 from 0 to 3' }] },
  { id: 'image-analyzer', name: 'Image Analyzer', description: 'Describe and analyze images', icon: 'Image', inputs: [{ name: 'text', label: 'Describe the image + question', type: 'textarea', placeholder: 'What do you want to know about the image?' }] },
  { id: 'document-analyzer', name: 'Document Analyzer', description: 'Extract insights from documents', icon: 'FileSearch', inputs: [{ name: 'text', label: 'Paste document text', type: 'textarea', placeholder: 'Paste the document content' }] },
  { id: 'research', name: 'Research Assistant', description: 'Structure research and surface questions', icon: 'Microscope', inputs: [{ name: 'text', label: 'Research topic', type: 'textarea', placeholder: 'e.g. Market landscape for AI coding tools' }] },
  { id: 'meeting-notes', name: 'Meeting Notes', description: 'Turn transcripts into action items', icon: 'NotebookPen', inputs: [{ name: 'text', label: 'Transcript / notes', type: 'textarea', placeholder: 'Paste the meeting transcript' }] },
  { id: 'flashcards', name: 'Flashcards', description: 'Generate study flashcards', icon: 'Layers', inputs: [{ name: 'text', label: 'Topic or notes', type: 'textarea', placeholder: 'e.g. Biology: cell structure' }] },
  { id: 'quiz', name: 'Quiz Generator', description: 'Create quiz questions with answers', icon: 'CircleHelp', inputs: [{ name: 'text', label: 'Topic', type: 'textarea', placeholder: 'e.g. World history 1900–1950' }] },
  { id: 'mind-map', name: 'Mind Maps', description: 'Outline ideas as a structured map', icon: 'Network', inputs: [{ name: 'text', label: 'Central idea', type: 'textarea', placeholder: 'e.g. Product launch plan' }] },
  { id: 'flowchart', name: 'Flowcharts', description: 'Describe a process as a flowchart', icon: 'Workflow', inputs: [{ name: 'text', label: 'Process description', type: 'textarea', placeholder: 'e.g. User signup and onboarding' }] },
];

const SYSTEM_PROMPTS: Record<ToolId, string> = {
  summarizer: 'You are an expert summarizer. Produce a concise bulleted summary with the key points and a one-line takeaway.',
  translator: 'You are a professional translator. Translate the user text into the requested language. Preserve tone and meaning. Start with the translation, then add a note on nuance.',
  grammar: 'You are a copyeditor. Fix grammar, spelling, and clarity. Return the corrected text first, then a short list of changes.',
  'code-gen': 'You are a senior engineer. Generate clean, typed, well-structured code for the request. Include a brief explanation after the code block.',
  'bug-fixer': 'You are a debugger. Identify the bug, explain why it happens, and provide the fixed code. Be specific.',
  'code-explainer': 'You are a patient teacher. Explain the code step by step for a competent developer who is new to this code. Use numbered steps.',
  'sql-gen': 'You are a SQL expert. Produce a correct, readable SQL query for the request. Explain key clauses briefly after the query.',
  'regex-gen': 'You are a regex expert. Provide the regex, a breakdown of each part, and 2–3 test cases. Use a code block for the regex.',
  'email-writer': 'You are a professional communications writer. Draft a clear, concise, well-structured email. Use a subject line and a polite sign-off.',
  'blog-writer': 'You are a content strategist. Produce a structured blog outline with section headings and a short draft intro.',
  'resume-writer': 'You are a resume writer. Rewrite the bullets to be achievement-oriented and quantified. Keep them concise.',
  'math-solver': 'You are a math expert. Solve the problem step by step, then state the final answer clearly.',
  'image-analyzer': 'You are a vision-capable assistant. Given the user description and question, provide a structured analysis.',
  'document-analyzer': 'You are a document analyst. Extract key entities, themes, and action items. Use sections.',
  research: 'You are a research assistant. Structure the topic into sub-questions, key sources to consult, and a preliminary synthesis.',
  'meeting-notes': 'You are a note-taker. Produce a structured summary: decisions, action items (with owners if mentioned), and open questions.',
  flashcards: 'You are a study coach. Generate 8 flashcards in a Q/A format. Use a list. Keep answers short.',
  quiz: 'You are a quiz maker. Generate 5 multiple-choice questions with 4 options each. Mark the correct answer after each.',
  'mind-map': 'You are an ideation coach. Output a structured mind map as a nested markdown list with the central idea as the root.',
  flowchart: 'You are a process designer. Output a flowchart as a nested markdown list representing steps, decisions, and branches.',
};

export function buildToolMessages(toolId: ToolId, inputs: Record<string, string>): ChatMessage[] {
  const tool = TOOLS.find((t) => t.id === toolId)!;
  const system = SYSTEM_PROMPTS[toolId];
  const body = tool.inputs.map((f) => `${f.label}:\n${inputs[f.name] ?? ''}`).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: body },
  ];
}

export async function runTool(
  toolId: ToolId,
  inputs: Record<string, string>,
  opts: { onToken: (t: string) => void; signal?: AbortSignal },
): Promise<string> {
  const messages = buildToolMessages(toolId, inputs);
  const res = await streamChat({
    model: 'ksemo-pro',
    messages,
    temperature: 0.4,
    maxTokens: 1500,
    signal: opts.signal,
    onToken: opts.onToken,
  });
  return res.content;
}
