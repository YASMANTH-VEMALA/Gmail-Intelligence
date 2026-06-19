'use client';

import { useState, useRef } from 'react';
import { 
  X, Send, Wand2, Paperclip, Smile, Link2, 
  Trash2,
  Folder, Shield, PenTool, Image as ImageIcon, ChevronDown 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import RichTextEditor, { hasRichTextContent, type RichTextEditorHandle } from './RichTextEditor';

const splitRecipients = (value: string) => (
  value
    .split(/[,;\n]+/)
    .map((recipient) => recipient.replace(/[\r\n]+/g, ' ').trim())
    .filter(Boolean)
);

const mergeRecipients = (...groups: string[][]) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const recipient of groups.flat()) {
    const key = recipient.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(recipient);
    }
  }

  return merged;
};

export default function ComposeModal() {
  const { isComposing, setIsComposing, userId, composeBody: body, setComposeBody: setBody, composeTo: to, setComposeTo: setTo, composeSubject: subject, setComposeSubject: setSubject } = useAppStore();
  
  // States
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');
  const [sendError, setSendError] = useState('');
  const [aiError, setAiError] = useState('');
  
  // Formatting & Attachments States
  const [showFormatting, setShowFormatting] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [attachments, setAttachments] = useState<{ filename: string; mimeType: string; content: string; size: number }[]>([]);
  
  // Refs
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isComposing) return null;

  const recipients = splitRecipients(to);
  const pendingRecipients = splitRecipients(recipientInput);
  const canSend = (recipients.length > 0 || pendingRecipients.length > 0) && hasRichTextContent(body) && Boolean(userId);

  const updateRecipients = (nextRecipients: string[]) => {
    setTo(nextRecipients.join(', '));
    setSendError('');
  };

  const addRecipients = (rawValue: string) => {
    const additions = splitRecipients(rawValue);
    if (additions.length === 0) return;
    updateRecipients(mergeRecipients(recipients, additions));
    setRecipientInput('');
  };

  const commitRecipientInput = () => {
    addRecipients(recipientInput);
  };

  const removeRecipient = (index: number) => {
    updateRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', ',', ';'].includes(e.key)) {
      if (recipientInput.trim()) {
        e.preventDefault();
        commitRecipientInput();
      }
      return;
    }

    if (e.key === 'Backspace' && !recipientInput && recipients.length > 0) {
      e.preventDefault();
      removeRecipient(recipients.length - 1);
    }
  };

  const handleRecipientPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!/[,;\n]/.test(pastedText)) return;

    e.preventDefault();
    addRecipients([recipientInput, pastedText].filter(Boolean).join(','));
  };

  const getRecipientsForSend = () => mergeRecipients(recipients, splitRecipients(recipientInput));

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

  // Generate draft using AI
  const handleGenerate = async () => {
    if (!prompt.trim() || !userId) return;
    setGenerating(true);
    setAiError('');
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(typeof data.error === 'string' ? data.error : 'AI draft failed.');
        return;
      }
      if (data.draft) {
        setTo(data.draft.to || '');
        setRecipientInput('');
        setSendError('');
        setSubject(data.draft.subject || '');
        setBody(data.draft.body || '');
        setShowAIAssistant(false); // Hide the prompt helper on success
      } else {
        setAiError('AI did not return a draft. Try a more specific prompt.');
      }
    } catch (e) {
      console.error(e);
      setAiError('AI draft failed. Check your Gemini API key and server logs.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    const recipientsToSend = getRecipientsForSend();
    if (recipientsToSend.length === 0 || !hasRichTextContent(body) || !userId) return;

    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, sendNow: true, 
          to: recipientsToSend, subject, body,
          attachments 
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(typeof data.error === 'string' ? data.error : 'Unable to send email.');
        return;
      }
      handleClose();
    } catch (e) {
      console.error(e);
      setSendError('Unable to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsComposing(false);
    setPrompt(''); setTo(''); setSubject(''); setBody('');
    setRecipientInput(''); setSendError(''); setAiError('');
    setAttachments([]); setShowFormatting(true); setShowEmojis(false); setShowAIAssistant(false);
  };

  const emojis = ['😀', '😂', '😊', '👍', '🙏', '❤️', '🔥', '✨', '💡', '🎉', '🚀', '⭐'];

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" style={{ maxWidth: 700, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✉️</span> New Message
          </h3>
          <button className="btn-icon" onClick={handleClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* To & Subject Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, width: 60, color: 'var(--text-muted)' }}>To</span>
              <div
                className="recipient-input-shell"
                onClick={() => recipientInputRef.current?.focus()}
                style={{ flex: 1 }}
              >
                {recipients.map((recipient, index) => (
                  <span className="recipient-chip" key={`${recipient}-${index}`}>
                    <span className="recipient-chip-text" title={recipient}>{recipient}</span>
                    <button
                      type="button"
                      className="recipient-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecipient(index);
                      }}
                      title={`Remove ${recipient}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  ref={recipientInputRef}
                  className="recipient-chip-input"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setSendError('');
                  }}
                  onKeyDown={handleRecipientKeyDown}
                  onPaste={handleRecipientPaste}
                  onBlur={commitRecipientInput}
                  placeholder={recipients.length ? '' : 'name@example.com'}
                  id="compose-to"
                />
              </div>
            </div>
            
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500, width: 60, color: 'var(--text-muted)' }}>Subject</span>
              <input 
                className="form-input" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="Subject"
                id="compose-subject" 
                style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
              />
            </div>

            {sendError && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginLeft: 68 }}>
                {sendError}
              </div>
            )}
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
                  placeholder="e.g., 'Draft a follow-up to Acme Corp about their proposal status'"
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
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
            <RichTextEditor
              ref={editorRef}
              value={body}
              onChange={(value) => {
                setBody(value);
                setSendError('');
              }}
              placeholder="Write your email body here..."
              id="compose-body"
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
                disabled={sending || !canSend}
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
