'use client';

import { useState, useRef, useEffect } from 'react';
import { Activity, AlertTriangle, BookOpen, Bot, Check, Mail, MessageSquareText, Send, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMode, AgentPendingAction, ChatMessage, EmailThread } from '@/types';
import dynamic from 'next/dynamic';
import aiAnim from '../../public/animations/ai.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function ChatPanel() {
  const { isChatOpen, setChatOpen, chatMessages, addChatMessage, userId, setSelectedEmail, setSelectedThread, selectedEmail, threadMessages, addToast } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AgentMode>('assistant');
  const [useEmailContext, setUseEmailContext] = useState(true);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSelectSource = async (gmailId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/emails/${gmailId}?userId=${userId}`);
      const data = await res.json();
      if (data.email) setSelectedEmail(data.email);
      if (data.threadMessages) {
        setSelectedThread({ gmail_thread_id: data.email.thread_id } as EmailThread, data.threadMessages);
      }
    } catch (e) {
      console.error('Failed to select email source:', e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Build the context-enriched query
  const buildQuery = (rawInput: string) => {
    if (!useEmailContext || !selectedEmail) return rawInput;
    const orderedThread = threadMessages.length > 0
      ? [...threadMessages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      : [selectedEmail];
    const threadContext = orderedThread.map((message, index) => [
      `Message ${index + 1}${message.gmail_id === selectedEmail.gmail_id ? ' [CURRENTLY SELECTED]' : ''}`,
      `Gmail ID: ${message.gmail_id}`,
      `Thread ID: ${message.thread_id}`,
      `From: ${message.from_name} <${message.from_address}>`,
      `Date: ${message.date}`,
      `Summary: ${message.summary || 'Not generated yet'}`,
      `Content: ${(message.body_text || message.snippet || '').slice(0, 1200)}`,
    ].join('\n')).join('\n---\n');
    const emailContext = [
      `[CONTEXT: Currently viewing email${orderedThread.length > 1 ? ' within full thread' : ''}]`,
      `Gmail ID: ${selectedEmail.gmail_id}`,
      `Thread ID: ${selectedEmail.thread_id}`,
      `Subject: ${selectedEmail.subject}`,
      `From: ${selectedEmail.from_name} <${selectedEmail.from_address}>`,
      `Date: ${selectedEmail.date}`,
      `Category: ${selectedEmail.category || 'uncategorized'}`,
      `Thread messages: ${orderedThread.length}`,
      `Thread context:\n${threadContext.slice(0, 7000)}`,
    ].join('\n');
    return `${rawInput}\n\n---\n${emailContext}`;
  };

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || !userId || loading) return;
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: messageText, mode, timestamp: new Date().toISOString() };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const enrichedQuery = buildQuery(messageText);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query: enrichedQuery, conversationHistory: history, mode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat agent failed');
      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that.',
        sources: data.sources,
        activities: data.activities,
        pendingAction: data.pendingAction,
        actionResult: data.actionResult,
        model: data.model,
        mode,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);

      // Show toast for agent actions on the main UI
      if (data.activities && data.activities.length > 0) {
        for (const act of data.activities) {
          if (act.type === 'create_draft') {
            addToast('✉️ Draft created in Gmail', 'success');
          } else if (act.type === 'sync_inbox') {
            addToast('📥 Inbox sync started', 'info');
          } else if (act.type === 'search_emails') {
            // silent — search is a read-only action
          }
        }
      }
      if (data.actionResult?.success) {
        const toolName = data.actionResult.toolName;
        if (toolName === 'create_draft') addToast('✉️ Draft created in Gmail', 'success');
        else if (toolName === 'send_email') addToast('🚀 Email sent successfully', 'success');
        else if (toolName === 'modify_labels' || toolName === 'modify_thread_labels') addToast('🏷️ Labels updated', 'success');
      }
    } catch (error) {
      let message = 'An error occurred. Please try again.';
      if (error instanceof DOMException && error.name === 'AbortError') {
        message = 'Request timed out. Please try again with a simpler query.';
      } else if (error instanceof Error) {
        message = error.message;
      }
      addChatMessage({ id: uuidv4(), role: 'assistant', content: message, timestamp: new Date().toISOString() });
    }
    setLoading(false);
  };

  const handleConfirmAction = async (action: AgentPendingAction) => {
    if (!userId || runningActionId) return;
    setRunningActionId(action.id);

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: 'agent', confirmedAction: action, conversationHistory: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent action failed');

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.response || 'Action completed.',
        sources: data.sources,
        activities: data.activities,
        actionResult: data.actionResult,
        model: data.model,
        mode: 'agent',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);
      setDismissedActionIds((current) => new Set(current).add(action.id));

      // Fire toast notification for the main UI
      if (data.actionResult?.success) {
        const toastMessages: Record<string, string> = {
          send_email: '🚀 Email sent successfully!',
          modify_labels: '🏷️ Email labels updated',
          modify_thread_labels: '🏷️ Thread labels updated',
          create_draft: '✉️ Draft created in Gmail',
        };
        addToast(toastMessages[action.toolName] || '✅ Action completed', 'success');
      } else if (data.actionResult && !data.actionResult.success) {
        addToast(`❌ ${data.actionResult.message || 'Action failed'}`, 'error');
      }

      const gmailId = typeof action.args.gmailId === 'string' ? action.args.gmailId : selectedEmail?.gmail_id;
      if (gmailId && data.actionResult?.success) {
        await handleSelectSource(gmailId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent action failed.';
      addToast(`❌ ${message}`, 'error');
      addChatMessage({
        id: uuidv4(),
        role: 'assistant',
        content: message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRunningActionId(null);
    }
  };

  const handleCancelAction = (actionId: string) => {
    setDismissedActionIds((current) => new Set(current).add(actionId));
  };

  // Context-aware suggestions
  const contextSuggestions = mode === 'agent'
    ? (selectedEmail && useEmailContext ? [
      'Create a Gmail draft reply to this email',
      'Archive this thread',
      'Mark this thread unread',
    ] : [
      'Sync my inbox now',
      'Find unread emails and summarize them',
      'Create a draft about my availability tomorrow',
    ])
    : (selectedEmail && useEmailContext ? [
      'Summarize this email',
      'List action items from this email',
      'What should I reply?',
    ] : [
      'Show my unread emails',
      'Summarize emails from today',
      'Any job updates this week?',
    ]);

  if (!isChatOpen) {
    return (
      <button className="chat-fab" onClick={() => setChatOpen(true)} id="chat-fab" title="Open AI Chat">
        <MessageSquareText size={24} />
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'white' }}>
          {mode === 'agent' ? <Bot size={24} /> : <Sparkles size={24} />}
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {mode === 'agent' ? 'AI Email Agent' : 'AI Email Assistant'}
          </span>
        </div>
        <button className="btn-icon" style={{ color: 'white' }} onClick={() => setChatOpen(false)}>
          <X size={18} />
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: '10px 12px',
        borderBottom: '2px solid var(--border)',
        background: 'var(--bg-primary)',
      }}>
        {(['assistant', 'agent'] as AgentMode[]).map((item) => {
          const active = mode === item;
          return (
            <button
              key={item}
              onClick={() => setMode(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 34,
                border: '2px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: active ? '#000000' : 'var(--text-primary)',
                boxShadow: active ? '2px 2px 0px var(--border)' : 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
              title={item === 'agent' ? 'Agent Mode can create drafts and prepare Gmail actions' : 'Assistant Mode reads and explains email context'}
            >
              {item === 'agent' ? <Bot size={15} /> : <MessageSquareText size={15} />}
              {item === 'agent' ? 'Agent' : 'Ask'}
            </button>
          );
        })}
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 140, height: 140, marginBottom: 16 }}>
              <Lottie animationData={aiAnim} loop={true} />
            </div>
            <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
              {mode === 'agent' ? 'Tell me what to do with your email' : 'Ask me anything about your emails'}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              {selectedEmail && useEmailContext
                ? <>I have context of &ldquo;{(selectedEmail.subject || '').slice(0, 40)}{(selectedEmail.subject || '').length > 40 ? '...' : ''}&rdquo;.</>
                : mode === 'agent'
                  ? <>Try syncing, drafting, or organizing selected emails.</>
                  : <>Try: &quot;Summarize all emails from this week&quot; or &quot;Which companies sent me job offers?&quot;</>
              }
            </div>
            {/* Quick action suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
              {contextSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(suggestion)}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1.5px solid var(--border)',
                    padding: '8px 14px',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                    boxShadow: '2px 2px 0px var(--border)',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id}>
            <div className={`chat-message ${msg.role}`}>
              <FormattedMarkdown content={msg.content} />
            </div>
            {msg.role === 'assistant' && msg.pendingAction && !dismissedActionIds.has(msg.pendingAction.id) && (
              <PendingActionCard
                action={msg.pendingAction}
                running={runningActionId === msg.pendingAction.id}
                onConfirm={handleConfirmAction}
                onCancel={handleCancelAction}
              />
            )}
            {msg.role === 'assistant' && msg.actionResult && (
              <div style={{
                margin: '4px 16px 8px 16px',
                padding: '10px 12px',
                border: '2px solid var(--border)',
                background: msg.actionResult.success ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '2px 2px 0px var(--border)',
              }}>
                {msg.actionResult.success ? <Check size={15} /> : <AlertTriangle size={15} />}
                <span>{msg.actionResult.message}</span>
              </div>
            )}
            {msg.role === 'assistant' && msg.activities && msg.activities.length > 0 && (
              <div style={{
                margin: '4px 16px 8px 16px',
                padding: '8px 12px',
                border: '2px solid var(--border)',
                background: 'var(--bg-tertiary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '2px 2px 0px var(--border)'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={13} /> Agent Actions:
                </div>
                {msg.activities.map((act, index) => {
                  let argsStr = '';
                  if (act.args && typeof act.args === 'object' && Object.keys(act.args).length > 0) {
                    argsStr = `(${Object.entries(act.args).map(([k, v]) => `${k}: "${typeof v === 'string' && v.length > 20 ? v.slice(0, 20) + '...' : v}"`).join(', ')})`;
                  }
                  return (
                    <div key={index} style={{ color: 'var(--text-muted)', paddingLeft: '8px', borderLeft: '2px solid var(--accent)' }}>
                      &gt; {act.type}{argsStr}
                    </div>
                  );
                })}
              </div>
            )}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{
                margin: '8px 16px',
                padding: '10px 14px',
                border: '2px solid var(--border)',
                background: 'var(--bg-primary)',
                boxShadow: '3px 3px 0px var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={13} /> Reference Sources ({msg.sources.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {msg.sources.slice(0, 5).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSource(s.gmail_id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '12px',
                        color: 'var(--accent-light)',
                        textDecoration: 'underline',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: 'var(--font-sans)',
                        borderRadius: '0px'
                      }}
                      title={`From: ${s.from}\nSubject: ${s.subject}`}
                    >
                      <Mail size={13} />
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.subject || '(No Subject)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" /> {mode === 'agent' ? 'Planning action...' : 'Thinking...'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context bar + Input area */}
      <div style={{ borderTop: '2px solid var(--border)' }}>
        {/* Email context indicator */}
        {selectedEmail && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: useEmailContext ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            transition: 'background 0.2s ease',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              flex: 1,
              minWidth: 0,
              color: useEmailContext ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}>
              <input
                type="checkbox"
                checked={useEmailContext}
                onChange={(e) => setUseEmailContext(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontWeight: 600, flexShrink: 0 }}>▲</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {useEmailContext ? 'Sharing' : 'Not sharing'}: &ldquo;{(selectedEmail.subject || 'Untitled').slice(0, 36)}{(selectedEmail.subject || '').length > 36 ? '…' : ''}&rdquo;
              </span>
            </label>
            {useEmailContext && (
              <button
                onClick={() => setUseEmailContext(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                title="Remove context"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="chat-input-area">
          <textarea
            className="chat-input"
            placeholder={selectedEmail && useEmailContext
              ? `${mode === 'agent' ? 'Ask or act on' : 'Ask about'} "${(selectedEmail.subject || '').slice(0, 30)}..."`
              : mode === 'agent' ? 'Tell the agent what to do...' : 'Ask about your emails...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
            id="chat-input"
          />
          <button className="btn btn-primary" onClick={() => handleSend()} disabled={loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function cleanPreviewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  const raw = typeof value === 'string' ? value : String(value || '');
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function getActionRows(action: AgentPendingAction) {
  const rows: { label: string; value: string }[] = [];

  if (action.toolName === 'send_email') {
    rows.push({ label: 'To', value: cleanPreviewValue(action.args.to) || '(missing)' });
    rows.push({ label: 'Subject', value: cleanPreviewValue(action.args.subject) || '(no subject)' });
    rows.push({ label: 'Body', value: cleanPreviewValue(action.args.bodyHtml).slice(0, 180) });
    return rows;
  }

  if (action.toolName === 'modify_thread_labels') {
    rows.push({ label: 'Thread', value: cleanPreviewValue(action.args.threadId) });
  } else {
    rows.push({ label: 'Email', value: cleanPreviewValue(action.args.gmailId) });
  }

  rows.push({ label: 'Add', value: cleanPreviewValue(action.args.addLabelIds) || 'None' });
  rows.push({ label: 'Remove', value: cleanPreviewValue(action.args.removeLabelIds) || 'None' });
  return rows;
}

function PendingActionCard({
  action,
  running,
  onConfirm,
  onCancel,
}: {
  action: AgentPendingAction;
  running: boolean;
  onConfirm: (action: AgentPendingAction) => void;
  onCancel: (actionId: string) => void;
}) {
  const rows = getActionRows(action);

  return (
    <div style={{
      margin: '4px 16px 8px 16px',
      padding: 12,
      border: '2px solid var(--border)',
      background: 'var(--bg-primary)',
      boxShadow: '3px 3px 0px var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertTriangle size={17} style={{ flexShrink: 0, color: action.risk === 'high' ? 'var(--accent)' : 'var(--accent-light)' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{action.title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{action.description}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: 8, fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{row.label}</span>
            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.value || 'None'}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          onClick={() => onConfirm(action)}
          disabled={running}
          style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {running ? <span className="spinner" /> : <Check size={14} />}
          {running ? 'Running...' : action.confirmationLabel}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onCancel(action.id)}
          disabled={running}
          style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}

function parseInline(text: string): React.ReactNode[] {
  // Regex to split by bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Check for inline code
    const subParts = part.split(/(`[^`]+`)/g);
    return subParts.map((subPart, subIndex) => {
      if (subPart.startsWith('`') && subPart.endsWith('`')) {
        return (
          <code
            key={`${index}-${subIndex}`}
            style={{
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-tertiary)',
              padding: '2px 4px',
              border: '1px solid var(--border)',
              fontSize: '11px',
            }}
          >
            {subPart.slice(1, -1)}
          </code>
        );
      }
      return subPart;
    });
  });
}

function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, idx) => {
        const leadingSpaces = line.match(/^(\s*)/)?.[0].length || 0;
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} style={{ height: 4 }} />;
        }

        const indentPadding = leadingSpaces * 6; // 6px per space

        // Check for headers
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              style={{
                fontWeight: 700,
                fontSize: '12px',
                marginTop: 4,
                textDecoration: 'underline',
                paddingLeft: indentPadding,
              }}
            >
              {parseInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              style={{
                fontWeight: 700,
                fontSize: '13px',
                marginTop: 6,
                textDecoration: 'underline',
                paddingLeft: indentPadding,
              }}
            >
              {parseInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2
              key={idx}
              style={{
                fontWeight: 700,
                fontSize: '14px',
                marginTop: 8,
                textDecoration: 'underline',
                paddingLeft: indentPadding,
              }}
            >
              {parseInline(trimmed.slice(2))}
            </h2>
          );
        }

        // Check for lists
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 6,
                paddingLeft: Math.max(8, indentPadding),
              }}
            >
              <span>•</span>
              <div>{parseInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        return (
          <div key={idx} style={{ paddingLeft: indentPadding }}>
            {parseInline(trimmed)}
          </div>
        );
      })}
    </div>
  );
}
