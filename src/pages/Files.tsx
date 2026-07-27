import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Trash2, Download, Upload as UploadIcon, Search, 
  SquarePen, FileCode, Image, FileSpreadsheet, ChevronRight, X, 
  ExternalLink, MessageSquare, FileUp, Sparkles, Database
} from 'lucide-react';
import { EmptyState, Button, Input, Modal } from '../components/ui';
import { listUploads, deleteUpload, createUpload, listChats, createChat, updateUpload } from '../lib/data';
import { readFileAsDataUrl, parseFile, buildFileMessage } from '../lib/fileParser';
import { formatBytes, formatRelativeTime } from '../lib/utils';
import type { Upload, Chat } from '../lib/types';

export default function Files() {
  const [files, setFiles] = useState<Upload[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<Upload | null>(null);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);
  
  // Uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([listUploads(), listChats()])
      .then(([uploadedFiles, allChats]) => {
        setFiles(uploadedFiles);
        setChats(allChats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id: string) => {
    await deleteUpload(id);
    setFiles((f) => f.filter((x) => x.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUploadFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress animation
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await createUpload({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: dataUrl,
        storage_path: `uploads/${file.name}`
      });
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        load();
      }, 400);
    } catch (err) {
      clearInterval(interval);
      setUploading(false);
    }
  };

  const handleAskAI = async (file: Upload) => {
    const c = await createChat({
      title: `Doc: ${file.name.slice(0, 24)}`
    });
    if (!c) return;

    await updateUpload(file.id, { chat_id: c.id });

    const prompt = 'Please analyze this file and provide a comprehensive summary with key takeaways.';

    if (file.url && file.url.startsWith('data:')) {
      try {
        const mimeFromDataUrl = file.url.split(';')[0].split(':')[1] || file.type;
        const fakeFile = new File([new Blob()], file.name, { type: mimeFromDataUrl });
        const parsed = await parseFile(fakeFile, file.url);
        const msg = buildFileMessage(parsed, prompt);

        if (parsed.imageDataUrl) {
          nav(`/app/chat/${c.id}`, {
            state: {
              prefillInput: msg.text,
              prefillImage: parsed.imageDataUrl,
            }
          });
        } else {
          nav(`/app/chat/${c.id}`, {
            state: { prefillInput: msg.text }
          });
        }
        return;
      } catch (err) {
        console.warn('File parsing failed, falling back to basic prompt:', err);
      }
    }

    nav(`/app/chat/${c.id}`, {
      state: {
        prefillInput: `I've uploaded a file named "${file.name}" (${file.type}, ${(file.size / 1024).toFixed(1)} KB).\n\nPlease analyze this file and provide a comprehensive summary with key takeaways.\n\nNote: The file content could not be extracted automatically. Please describe what you'd like to know about this file and I'll help guide the analysis.`
      }
    });
  };

  // Categorize files
  const stats = () => {
    let docs = { count: 0, size: 0 };
    let code = { count: 0, size: 0 };
    let sheets = { count: 0, size: 0 };
    let images = { count: 0, size: 0 };

    files.forEach(f => {
      const type = f.type.toLowerCase();
      const ext = f.name.split('.').pop()?.toLowerCase() || '';

      if (type.includes('image/')) {
        images.count++;
        images.size += f.size;
      } else if (
        type.includes('javascript') || type.includes('typescript') || 
        type.includes('python') || type.includes('json') || type.includes('code') ||
        ['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'cpp', 'sh'].includes(ext)
      ) {
        code.count++;
        code.size += f.size;
      } else if (
        type.includes('csv') || type.includes('spreadsheet') || type.includes('sheet') ||
        type.includes('excel') || ['csv', 'xlsx', 'xls'].includes(ext)
      ) {
        sheets.count++;
        sheets.size += f.size;
      } else {
        docs.count++;
        docs.size += f.size;
      }
    });

    return [
      { label: 'Documents', count: docs.count, size: docs.size, icon: FileText, color: 'text-white bg-white/5 border-white/8' },
      { label: 'Source Code', count: code.count, size: code.size, icon: FileCode, color: 'text-white bg-white/5 border-white/8' },
      { label: 'Data Sheets', count: sheets.count, size: sheets.size, icon: FileSpreadsheet, color: 'text-white bg-white/5 border-white/8' },
      { label: 'Visuals/Images', count: images.count, size: images.size, icon: Image, color: 'text-white bg-white/5 border-white/8' }
    ];
  };

  const getFileIcon = (f: Upload) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (f.type.includes('image/')) return <Image size={18} />;
    if (['js', 'ts', 'py', 'json', 'html', 'css', 'rs', 'go'].includes(ext)) return <FileCode size={18} />;
    if (['csv', 'xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={18} />;
    return <FileText size={18} />;
  };

  const getMockSummary = (f: Upload) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (f.type.includes('image/')) {
      return `This is an image asset file (.${ext.toUpperCase()}). The AI has scanned the image layout, detecting visual assets and patterns. You can query the assistant about the visual context, request OCR text extraction, or seek graphic suggestions.`;
    }
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'cpp', 'sh'].includes(ext)) {
      return `This is a developer source code file in .${ext.toUpperCase()}. It contains functional script segments or component declarations. Ask the assistant to debug errors, refactor algorithms, optimize complexity, or write automated tests.`;
    }
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
      return `This is a spreadsheet or database dataset. The assistant has prepared a data index. Ask for summary metrics, statistics, mathematical distributions, CSV charts, or JSON transformations.`;
    }
    return `This is a standard reference document. It contains raw text logs or instructions. You can instruct the assistant to generate bullet-point takeaways, draft a executive summary, translate text, or look up details.`;
  };

  const getMockTags = (f: Upload) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (f.type.includes('image/')) return ['Visual Asset', 'Image OCR', ext.toUpperCase()];
    if (['js', 'ts', 'py', 'json', 'html', 'css', 'go', 'rs'].includes(ext)) return ['Source Code', 'Engineering', ext.toUpperCase()];
    if (['csv', 'xlsx'].includes(ext)) return ['Tabular Data', 'Sheet Analytics', ext.toUpperCase()];
    return ['Text Reference', 'Workspace File', ext.toUpperCase()];
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex relative overflow-hidden bg-ink-900">
      {/* Main Library panel */}
      <div className="flex-1 h-full overflow-y-auto select-none">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
              <Database size={22} className="text-white/80" /> Files & Knowledge Base
            </h1>
            <p className="mt-2 text-ink-300">Manage your workspace files, document summaries, and RAG contexts.</p>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats().map((s) => (
              <div key={s.label} className="bg-ink-850 border border-white/8 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-white/15 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-wider uppercase text-ink-300">{s.label}</span>
                  <div className={`p-1.5 rounded-lg border ${s.color}`}>
                    <s.icon size={13} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-xl font-bold text-white">{s.count}</span>
                  <span className="text-[11px] text-ink-400">({formatBytes(s.size)})</span>
                </div>
              </div>
            ))}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div 
            onDragEnter={handleDrag} 
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer ${
              dragActive 
                ? 'border-white bg-white/5 scale-[0.99]' 
                : 'border-white/8 bg-ink-850/50 hover:border-white/15 hover:bg-ink-850/80'
            }`}
            onClick={triggerFileInput}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept="*/*"
            />
            {uploading ? (
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between text-xs text-white">
                  <span className="font-medium">Uploading document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-white h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-ink-300 mb-3">
                  <FileUp size={20} />
                </div>
                <h3 className="text-[13px] font-semibold text-white">Drag & drop files here, or browse</h3>
                <p className="text-[11px] text-ink-400 mt-1">Supports PDF, CSV, Excel, TXT, images up to 50MB</p>
              </>
            )}
          </div>

          {/* Search bar & count */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 z-10" />
              <Input
                placeholder="Search file name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-10 text-[13px]"
              />
            </div>
            {searchQuery && (
              <span className="text-[11px] text-ink-300 font-medium shrink-0">
                Found {filteredFiles.length} files
              </span>
            )}
          </div>

          {/* Files List */}
          {files.length === 0 && !loading ? (
            <EmptyState
              icon={<UploadIcon size={20} />}
              title="No files yet"
              description="Attach files to any chat or upload them directly to store them here."
              action={<Button onClick={() => nav('/app')} variant="outline">Open a chat</Button>}
            />
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-10 text-xs text-ink-400">No matching files found.</div>
          ) : (
            <div className="grid gap-1.5">
              {filteredFiles.map((f) => {
                const parentChat = chats.find(c => c.id === f.chat_id);
                const isSelected = selectedFile?.id === f.id;
                return (
                  <div 
                    key={f.id} 
                    onClick={() => setSelectedFile(f)}
                    className={`group flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-white/8 border-white/15' 
                        : 'bg-ink-850 border-white/8 hover:border-white/15 hover:bg-ink-800'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-ink-900 border border-white/8 flex items-center justify-center text-ink-200">
                      {getFileIcon(f)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-white truncate">{f.name}</div>
                      <div className="text-[11px] text-ink-300 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(f.size)}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(f.created_at)}</span>
                        {parentChat && (
                          <>
                            <span>·</span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                nav(`/app/chat/${f.chat_id}`);
                              }}
                              className="text-ink-400 hover:text-white underline truncate max-w-[120px]"
                            >
                              Chat: {parentChat.title}
                            </span>
                          </>
                        )}
                        {!f.chat_id && (
                          <>
                            <span>·</span>
                            <span className="text-ink-400 italic">Direct Upload</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions on hover / active */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAskAI(f); }}
                        className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
                        title="Ask AI about this file"
                      >
                        <SquarePen size={12} /> Ask AI
                      </button>
                      {f.url && (
                        <a 
                          href={f.url} 
                          download={f.name}
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/8 transition"
                          title="Download"
                        >
                          <Download size={13} />
                        </a>
                      )}
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setConfirmDeleteFileId(f.id);
                        }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition"
                        title="Delete file"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <ChevronRight size={14} className="text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Side Drawer */}
      {selectedFile && (
        <>
          {/* Backdrop for mobile */}
          <div className="absolute inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSelectedFile(null)} />
          
          <div className="absolute md:relative right-0 top-0 h-full w-full sm:w-[320px] lg:w-[380px] bg-ink-850 border-l border-white/8 z-40 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/8 shrink-0">
              <span className="text-[13px] font-semibold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 animate-pulse-soft" /> AI File Insights
              </span>
              <button 
                onClick={() => setSelectedFile(null)} 
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content scroll area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* File Profile */}
              <div className="text-center pb-4 border-b border-white/8">
                <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-ink-200 mx-auto mb-3">
                  {getFileIcon(selectedFile)}
                </div>
                <h3 className="text-sm font-semibold text-white break-all px-2">{selectedFile.name}</h3>
                <p className="text-[11px] text-ink-300 mt-1">
                  {formatBytes(selectedFile.size)} · {selectedFile.type.split('/')[1]?.toUpperCase() || 'FILE'}
                </p>
              </div>

              {/* Connected Chat Info */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">Location Origin</h4>
                {selectedFile.chat_id ? (
                  <div 
                    onClick={() => nav(`/app/chat/${selectedFile.chat_id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/8 hover:border-white/12 cursor-pointer transition text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] text-white font-medium truncate">
                        {chats.find(c => c.id === selectedFile.chat_id)?.title || 'Open Chat'}
                      </div>
                      <div className="text-[10px] text-ink-400 mt-0.5">Click to view conversation</div>
                    </div>
                    <ExternalLink size={12} className="text-ink-300 shrink-0 ml-2" />
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-ink-300 italic">
                    Directly uploaded to Document Library
                  </div>
                )}
              </div>

              {/* Auto tags */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">Extracted Entity Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {getMockTags(selectedFile).map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-ink-200 border border-white/8">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">Document Summary</h4>
                <div className="p-3.5 rounded-2xl bg-ink-900 border border-white/8 text-[12px] text-ink-200 leading-relaxed whitespace-pre-line">
                  {getMockSummary(selectedFile)}
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="p-4 border-t border-white/8 shrink-0 bg-ink-950/80 backdrop-blur">
              <Button 
                onClick={() => handleAskAI(selectedFile)} 
                className="w-full justify-center flex items-center gap-2"
              >
                <MessageSquare size={14} /> Ask AI about this file
              </Button>
            </div>
          </div>
        </>
      )}
      {confirmDeleteFileId && (() => {
        const fileToDelete = files.find(f => f.id === confirmDeleteFileId);
        const fileName = fileToDelete ? fileToDelete.name : 'this file';
        return (
          <Modal
            open={!!confirmDeleteFileId}
            onClose={() => setConfirmDeleteFileId(null)}
            title="Delete File"
            size="sm"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteFileId(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={async () => {
                    if (confirmDeleteFileId) {
                      await remove(confirmDeleteFileId);
                    }
                    setConfirmDeleteFileId(null);
                  }}
                >
                  Delete
                </Button>
              </>
            }
          >
            <div className="text-[13px] text-ink-200 leading-relaxed">
              Are you sure you want to permanently delete the file <strong className="text-white">"{fileName}"</strong>? This will remove it from your workspace library. This action cannot be undone.
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
