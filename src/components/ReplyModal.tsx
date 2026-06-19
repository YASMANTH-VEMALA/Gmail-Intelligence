'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, Send, Wand2, Paperclip, Smile, Link2, 
  Trash2,
  Folder, Shield, PenTool, Image as ImageIcon, ChevronDown 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import RichTextEditor, { hasRichTextContent, type RichTextEditorHandle } from './RichTextEditor';

import type { EmailThread } from '@/types';

export default function ReplyModal() {
  const { isReplying, setIsReplying, selectedEmail, userId, setSelectedThread, setSelectedEmail, replyBody: body, setReplyBody: setBody } = useAppStore();
  
  // States
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState('');
  const [sendError, setSendError] = useState('');
  const [replyMeta, setReplyMeta] = useState<{ inReplyTo: string; references: string[]; threadId: string; to: string; subject: string } | null>(null);
  
  // Formatting & Attachments States
  const [showFormatting, setShowFormatting] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [attachments, setAttachments] = useState<{ filename: string; mimeType: string; content: string; size: number }[]>([]);
  
  // Refs
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load reply headers / metadata when the modal opens
  useEffect(() => {
    if (isReplying && selectedEmail && userId) {
      // Pre-fetch the reply headers (e.g. In-Reply-To, References, To, Subject) without AI generation
      fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          threadId: selectedEmail.thread_id, 
          prompt: 'default_headers_only_no_ai' 
        }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.draft) {
          setReplyMeta({
            inReplyTo: data.draft.inReplyTo,
            references: data.draft.references,
            threadId: data.draft.threadId,
            to: data.draft.to,
            subject: data.draft.subject,
          });
        }
      })
      .catch(err => console.error('[ReplyModal] Init headers error:', err));
    }
  }, [isReplying, selectedEmail, userId]);

  if (!isReplying || !selectedEmail) return null;

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            content: reader.result as string,
            size: file.size
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Insert link handler
  const handleInsertLink = () => {
    const url = promptForLink();
    if (url) {
      editorRef.current?.insertLink(url);
    }
  };

  const promptForLink = () => {
    if (typeof window !== 'undefined') {
      return window.prompt('Enter link URL (e.g. https://google.com):');
    }
    return '';
  };

  // Insert emoji/text at cursor
  const insertTextAtCursor = (textToInsert: string) => {
    editorRef.current?.insertText(textToInsert);
    setShowEmojis(false);
  };

  // Generate reply using AI
  const handleGenerate = async () => {
    if (!prompt.trim() || !userId) return;
    setGenerating(true);
    setAiError('');
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, threadId: selectedEmail.thread_id, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(typeof data.error === 'string' ? data.error : 'AI reply failed.');
        return;
      }
      if (data.draft) {
        setBody(data.draft.body);
        setShowAIAssistant(false); // Hide the prompt bar on successful generation
      } else {
        setAiError('AI did not return a reply. Try a more specific prompt.');
      }
    } catch (e) {
      console.error(e);
      setAiError('AI reply failed. Check your Gemini API key and server logs.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    const activeMeta = replyMeta || {
      to: selectedEmail.from_address || '',
      subject: `Re: ${(selectedEmail.subject || '').replace(/^Re:\s*/i, '')}`,
      inReplyTo: selectedEmail.headers?.['Message-ID'] || selectedEmail.headers?.['Message-Id'] || '',
      references: [...(selectedEmail.references || []), selectedEmail.headers?.['Message-ID'] || selectedEmail.headers?.['Message-Id'] || ''].filter(Boolean),
      threadId: selectedEmail.thread_id
    };

    if (!hasRichTextContent(body) || !userId) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, sendNow: true,
          to: activeMeta.to, subject: activeMeta.subject, body,
          inReplyTo: activeMeta.inReplyTo, references: activeMeta.references,
          threadId: activeMeta.threadId,
          attachments
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(typeof data.error === 'string' ? data.error : 'Unable to send reply.');
        return;
      }

      // Refresh thread view with updated messages (including the just-sent reply)
      if (data.threadMessages && data.threadMessages.length > 0) {
        const threadId = activeMeta.threadId || selectedEmail.thread_id;
        setSelectedThread(
          { gmail_thread_id: threadId } as EmailThread,
          data.threadMessages
        );
        // Set selected email to the latest message (our reply)
        setSelectedEmail(data.threadMessages[data.threadMessages.length - 1]);
      }

      handleClose();
    } catch (e) {
      console.error(e);
      setSendError('Unable to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsReplying(false);
    setPrompt(''); setBody(''); setReplyMeta(null);
    setAiError(''); setSendError('');
    setAttachments([]); setShowEmojis(false); setShowAIAssistant(false);
  };

  const emojis = ['😀', '😂', '😊', '👍', '🙏', '❤️', '🔥', '✨', '💡', '🎉', '🚀', '⭐'];

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" style={{ maxWidth: 700, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>↩️</span> Reply to: {selectedEmail.subject}
          </h3>
          <button className="btn-icon" onClick={handleClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header Info Panel */}
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              Replying to <strong style={{ color: 'var(--text-primary)' }}>{selectedEmail.from_name}</strong> &lt;{selectedEmail.from_address}&gt;
            </div>
            <div style={{ fontSize: 11, background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
              Subject: Re: {(selectedEmail.subject || '').replace(/^Re:\s*/i, '')}
            </div>
          </div>

          {/* Inline AI Assistant Trigger / input box */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowAIAssistant(!showAIAssistant)}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
                <Wand2 size={14} /> ✨ AI Assistant Draft Helper
              </span>
              <button style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showAIAssistant ? 'Hide' : 'Show / Write with AI'}
              </button>
            </div>
            {showAIAssistant && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1, padding: '6px 12px', fontSize: 13 }}
                  placeholder="e.g., 'Say yes and suggest Thursday 3 PM instead'"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setAiError('');
                  }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleGenerate} 
                  disabled={generating || !prompt.trim()}
                  style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6 }}
                >
                  {generating ? 'Drafting...' : 'Draft'}
                </button>
              </div>
            )}
            {aiError && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>
                {aiError}
              </div>
            )}
          </div>

          {/* Main rich text editor */}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
            <RichTextEditor
              ref={editorRef}
              value={body}
              onChange={(value) => {
                setBody(value);
                setSendError('');
              }}
              placeholder="Type your reply here..."
              id="reply-body"
              showToolbar={showFormatting}
              minHeight={240}
            />

            {/* Inline Emoji Selector */}
            {showEmojis && (
              <div style={{ position: 'absolute', bottom: 50, left: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8, display: 'flex', gap: 6, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {emojis.map((emoji) => (
                  <button 
                    key={emoji} 
                    onClick={() => insertTextAtCursor(emoji)} 
                    style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                    className="hover-bg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sendError && (
            <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
              {sendError}
            </div>
          )}

          {/* Attachment list */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Attachments ({attachments.length})</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {attachments.map((att, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: '6px 12px', 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 20,
                      fontSize: 12,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Paperclip size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.filename}>
                      {att.filename}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({formatSize(att.size)})</span>
                    <button 
                      onClick={() => removeAttachment(idx)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                      className="hover-red"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
        </div>

        {/* Gmail Style Footer / Toolbars */}
        <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Gmail Send Button with Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button 
                className="btn btn-success" 
                onClick={handleSend} 
                disabled={sending || !hasRichTextContent(body)}
                style={{ 
                  borderRadius: '20px 0 0 20px', 
                  padding: '8px 18px', 
                  fontWeight: 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  background: '#1a73e8',
                  color: '#ffffff',
                  border: 'none',
                  height: 36
                }}
              >
                {sending ? <span className="spinner" /> : <Send size={14} />}
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button 
                className="btn btn-success" 
                style={{ 
                  borderRadius: '0 20px 20px 0', 
                  padding: '8px 8px', 
                  background: '#155cb0', 
                  border: 'none',
                  borderLeft: '1px solid #1a73e8',
                  color: '#ffffff',
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Send Options"
                disabled={sending}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Editor Action Buttons (Gmail-like) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              {/* Aa Format Options Toggle */}
              <button 
                className={`btn-icon ${showFormatting ? 'active' : ''}`} 
                onClick={() => setShowFormatting(!showFormatting)} 
                title="Formatting options"
                style={{ height: 32, width: 32, borderRadius: '50%', background: showFormatting ? 'var(--bg-tertiary)' : 'none' }}
              >
                <span style={{ fontSize: 15, fontWeight: 'bold', fontFamily: 'serif' }}>A</span>
                <span style={{ fontSize: 11, verticalAlign: 'sub' }}>a</span>
              </button>

              {/* Attach File Button */}
              <button 
                className="btn-icon" 
                onClick={() => fileInputRef.current?.click()} 
                title="Attach files"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <Paperclip size={15} />
              </button>

              {/* Insert Link Button */}
              <button 
                className="btn-icon" 
                onClick={handleInsertLink} 
                title="Insert link"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <Link2 size={15} />
              </button>

              {/* Emoji Palette Toggle */}
              <button 
                className="btn-icon" 
                onClick={() => setShowEmojis(!showEmojis)} 
                title="Insert emoji"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <Smile size={15} />
              </button>

              {/* Drive Link Placeholder */}
              <button 
                className="btn-icon" 
                onClick={() => insertTextAtCursor('\n[Google Drive File Link]\n')} 
                title="Insert files using Drive"
                style={{ height: 32, width: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Folder size={15} />
              </button>

              {/* Image Link Placeholder */}
              <button 
                className="btn-icon" 
                onClick={() => fileInputRef.current?.click()} 
                title="Insert photo"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <ImageIcon size={15} />
              </button>

              {/* Confidentiality Lock */}
              <button 
                className="btn-icon" 
                onClick={() => insertTextAtCursor('\n--- CONFIDENTIAL EMAIL ---\n')} 
                title="Toggle confidential mode"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <Shield size={14} />
              </button>

              {/* Digital Signature Pen */}
              <button 
                className="btn-icon" 
                onClick={() => insertTextAtCursor(`\n\nBest regards,\n${userId ? 'Yas' : 'User'}`)} 
                title="Insert signature"
                style={{ height: 32, width: 32, borderRadius: '50%' }}
              >
                <PenTool size={14} />
              </button>
            </div>
          </div>

          <div>
            {/* Discard / Trash Button */}
            <button 
              className="btn-icon hover-red" 
              onClick={handleClose} 
              title="Discard draft"
              style={{ height: 36, width: 36, borderRadius: '50%', color: 'var(--text-muted)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
