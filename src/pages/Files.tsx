import { useEffect, useState } from 'react';
import { FileText, Trash2, Download, Upload as UploadIcon } from 'lucide-react';
import { EmptyState, Button } from '../components/ui';
import { listUploads, deleteUpload } from '../lib/data';
import { formatBytes, formatRelativeTime } from '../lib/utils';
import type { Upload } from '../lib/types';

export default function Files() {
  const [files, setFiles] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); listUploads().then(setFiles).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const remove = async (id: string) => {
    await deleteUpload(id);
    setFiles((f) => f.filter((x) => x.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Files</h1>
            <p className="text-ink-300 mt-2">Files attached to your conversations.</p>
          </div>
        </div>

        {loading && <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}

        {!loading && files.length === 0 && (
          <EmptyState
            icon={<UploadIcon size={20} />}
            title="No files yet"
            description="Attach files to any chat and they'll appear here."
            action={<Button onClick={() => undefined} variant="outline">Open a chat</Button>}
          />
        )}

        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-3.5">
              <div className="h-10 w-10 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white truncate">{f.name}</div>
                <div className="text-[11px] text-ink-300">{formatBytes(f.size)} · {formatRelativeTime(f.created_at)}</div>
              </div>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition">
                  <Download size={15} />
                </a>
              )}
              <button onClick={() => remove(f.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
