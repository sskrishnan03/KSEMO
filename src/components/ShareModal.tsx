import { useState, useEffect } from 'react';
import { Globe, Lock, Check, Copy } from 'lucide-react';
import { Modal, Button } from './ui';
import { listMessages } from '../lib/data';
import type { Chat, Message } from '../lib/types';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  chat: Chat;
}

export function ShareModal({ open, onClose, chat }: ShareModalProps) {
  const [shareType, setShareType] = useState<'private' | 'public'>('private');
  const [copied, setCopied] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [generatedLink, setGeneratedLink] = useState('');

  // Fetch messages if we toggle to public or when modal opens
  useEffect(() => {
    if (!open) {
      setGeneratedLink('');
      setCopied(false);
      return;
    }
    
    const fetchMsgs = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await listMessages(chat.id);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to load messages for share:', err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMsgs();
  }, [open, chat.id]);

  const handleCreateOrCopy = async () => {
    if (shareType === 'private') {
      const privateLink = `${window.location.origin}/app/chat/${chat.id}`;
      try {
        await navigator.clipboard.writeText(privateLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error(err);
      }
    } else {
      if (generatedLink) {
        // Copy the already generated link
        try {
          await navigator.clipboard.writeText(generatedLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error(err);
        }
      } else {
        // Generate the public link
        const cleanMsgs = messages.map(m => ({ role: m.role, content: m.content }));
        const payload = { title: chat.title, messages: cleanMsgs };
        
        // Encode payload
        const json = JSON.stringify(payload);
        const bytes = new TextEncoder().encode(json);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const safeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const publicLink = `${window.location.origin}/share/${safeBase64}`;
        setGeneratedLink(publicLink);
        
        // Auto-copy
        try {
          await navigator.clipboard.writeText(publicLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  // Reset link if they change type
  useEffect(() => {
    setGeneratedLink('');
  }, [shareType]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share chat"
      size="md"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="text-[11px] text-ink-400 select-none">
            {copied && <span className="text-emerald-400 font-medium animate-pulse">Link copied to clipboard!</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleCreateOrCopy}
              disabled={loadingMessages && shareType === 'public'}
            >
              {shareType === 'private' 
                ? (copied ? 'Copied!' : 'Copy link') 
                : (generatedLink ? (copied ? 'Copied!' : 'Copy link') : 'Create share link')
              }
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-[12px] text-ink-200 select-none">
          Only messages up to this point will be shared.
        </p>

        <div className="border border-white/8 rounded-2xl overflow-hidden bg-ink-950/50 select-none">
          {/* Keep Private option */}
          <div 
            onClick={() => setShareType('private')}
            className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-white/3 transition border-b border-white/8 ${shareType === 'private' ? 'bg-white/[0.02]' : ''}`}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${shareType === 'private' ? 'bg-white/5 border-white/15 text-white' : 'border-white/5 text-ink-300'}`}>
              <Lock size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white">Keep private</div>
              <div className="text-[11px] text-ink-300">Only you have access</div>
            </div>
            {shareType === 'private' && (
              <Check size={16} className="text-white" />
            )}
          </div>

          {/* Create Public Link option */}
          <div 
            onClick={() => setShareType('public')}
            className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-white/3 transition ${shareType === 'public' ? 'bg-white/[0.02]' : ''}`}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${shareType === 'public' ? 'bg-white/5 border-white/15 text-white' : 'border-white/5 text-ink-300'}`}>
              <Globe size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white">Create public link</div>
              <div className="text-[11px] text-ink-300">Anyone with the link can view</div>
            </div>
            {shareType === 'public' && (
              <Check size={16} className="text-white" />
            )}
          </div>
        </div>

        {/* Display generated link if public */}
        {shareType === 'public' && generatedLink && (
          <div className="p-3 rounded-xl bg-ink-950/60 border border-white/8 flex items-center gap-2">
            <span className="text-[11px] font-mono text-ink-200 truncate flex-1">{generatedLink}</span>
            <button 
              onClick={handleCreateOrCopy}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white transition shrink-0"
              title="Copy link"
            >
              <Copy size={13} />
            </button>
          </div>
        )}

        <p className="text-[10px] text-ink-400 leading-relaxed select-none">
          Don't share personal information or third-party content without permission, and see our <span className="underline cursor-pointer hover:text-white">Usage Policy</span>.
        </p>
      </div>
    </Modal>
  );
}
