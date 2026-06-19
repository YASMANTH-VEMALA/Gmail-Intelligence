'use client';

import { useCallback, useMemo, useState, useRef, useEffect, type RefObject } from 'react';
import { Reply, Sparkles, Mail } from 'lucide-react';
import { useAppStore } from '@/lib/store';

import { formatDate, getCategoryColor, getCategoryLabel, stripHtml } from '@/lib/utils';

const MAX_EMAIL_FRAME_HEIGHT = 620;
const MIN_EMAIL_FRAME_HEIGHT = 240;

// Helper component to render HTML safely inside a sandboxed iframe
function HtmlEmailRenderer({
  html,
  onContentReady,
  scrollContainerRef,
}: {
  html: string;
  onContentReady?: () => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState('300px');
  const [isScrollable, setIsScrollable] = useState(false);

  const handleLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const body = doc.body;
      if (body) {
        // Insert custom styles inside iframe to ensure layout behaves
        const style = doc.createElement('style');
        style.innerHTML = `
          html {
            min-height: 100%;
            overflow-y: auto;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333333;
            background: #ffffff;
            margin: 16px;
            min-height: calc(100% - 32px);
            overflow-y: auto;
          }
          img { max-width: 100% !important; height: auto !important; }
          a { color: #1a73e8; text-decoration: underline; }
          /* Reset any forced dark background style inside the iframe so it's readable */
          * { max-width: 100%; box-sizing: border-box; }
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            width: 10px;
          }
          html::-webkit-scrollbar-thumb,
          body::-webkit-scrollbar-thumb {
            background: #c4c4c4;
            border-radius: 8px;
          }
        `;
        doc.head.appendChild(style);

        const syncHeight = () => {
          const contentHeight = Math.max(body.scrollHeight, doc.documentElement.scrollHeight);
          const desiredHeight = contentHeight + 30;
          const nextHeight = Math.max(
            MIN_EMAIL_FRAME_HEIGHT,
            Math.min(desiredHeight, MAX_EMAIL_FRAME_HEIGHT)
          );

          setHeight(nextHeight + 'px');
          setIsScrollable(desiredHeight > MAX_EMAIL_FRAME_HEIGHT);
          onContentReady?.();
        };

        const forwardWheel = (event: WheelEvent) => {
          const scrollElement = doc.scrollingElement || doc.documentElement;
          const canScrollInside = scrollElement.scrollHeight > scrollElement.clientHeight;
          const atTop = scrollElement.scrollTop <= 0;
          const atBottom = scrollElement.scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - 2;

          if (canScrollInside && ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom))) {
            return;
          }

          const scrollContainer = scrollContainerRef?.current;
          if (!scrollContainer || event.ctrlKey) return;
          if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return;

          scrollContainer.scrollTop += event.deltaY;
          event.preventDefault();
          event.stopPropagation();
        };

        doc.addEventListener('wheel', forwardWheel, { passive: false, capture: true });
        iframe.contentWindow.addEventListener('wheel', forwardWheel, { passive: false });

        if (typeof ResizeObserver !== 'undefined') {
          const resizeObserver = new ResizeObserver(syncHeight);
          resizeObserver.observe(body);
          resizeObserver.observe(doc.documentElement);
        }

        Array.from(doc.images).forEach((image) => {
          image.addEventListener('load', syncHeight, { once: true });
          image.addEventListener('error', syncHeight, { once: true });
        });

        syncHeight();
        setTimeout(syncHeight, 250);
        setTimeout(syncHeight, 1000);
      }
    } catch (e) {
      console.warn('Iframe styling injection failed:', e);
    }
  };

  // Safe wrapper to ensure target="_blank" is respected for links
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_blank">
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      style={{
        width: '100%',
        border: 'none',
        height: height,
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: isScrollable ? 'auto' : 'hidden',
        transition: 'height 0.2s ease-in-out'
      }}
      scrolling="auto"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
    />
  );
}

export default function EmailDetail() {
  const { selectedEmail, selectedThread, threadMessages, userId, setIsReplying, userEmail } = useAppStore();
  const [summaryResult, setSummaryResult] = useState<{ gmailId: string; summary: string } | null>(null);
  const [threadSummaryResult, setThreadSummaryResult] = useState<{ threadId: string; summary: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [collapsedOverride, setCollapsedOverride] = useState<{ threadKey: string; collapsed: Set<number> } | null>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const threadKey = threadMessages.map((message) => message.gmail_id).join('|');
  const selectedEmailId = selectedEmail?.gmail_id;
  const defaultCollapsedMessages = useMemo(() => {
    const collapsed = new Set<number>();
    if (threadMessages.length > 2) {
      for (let i = 0; i < threadMessages.length - 2; i++) collapsed.add(i);
    }
    return collapsed;
  }, [threadMessages]);
  const collapsedMessages = collapsedOverride?.threadKey === threadKey
    ? collapsedOverride.collapsed
    : defaultCollapsedMessages;

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scrollContainer = detailBodyRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior,
      });
      return;
    }

    threadEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll to bottom when thread messages change. HTML email iframes can resize
  // after initial render, so repeat the scroll after their content settles.
  useEffect(() => {
    if (threadMessages.length > 1) {
      const timers = [80, 350, 900, 1600].map((delay, index) =>
        window.setTimeout(
          () => scrollThreadToBottom(index === 0 ? 'auto' : 'smooth'),
          delay
        )
      );

      return () => timers.forEach(window.clearTimeout);
    }
  }, [scrollThreadToBottom, selectedEmailId, threadKey, threadMessages.length]);

  if (!selectedEmail) {
    return (
      <div className="email-detail">
        <div className="empty-state">
          <Mail size={48} />
          <div style={{ fontSize: 16 }}>Select an email to read</div>
          <div style={{ fontSize: 13 }}>Choose an email from the list to view its contents</div>
        </div>
      </div>
    );
  }

  const handleSummarize = async () => {
    if (!userId) return;
    setSummarizing(true);
    try {
      if (threadMessages.length > 1) {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, threadId: selectedEmail.thread_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Thread summarization failed');
        setThreadSummaryResult({ threadId: selectedEmail.thread_id, summary: data.summary });
      } else {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, emailId: selectedEmail.gmail_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Email summarization failed');
        setSummaryResult({ gmailId: selectedEmail.gmail_id, summary: data.summary });
      }
    } catch (e) { console.error(e); }
    setSummarizing(false);
  };

  const toggleCollapse = (index: number) => {
    setCollapsedOverride(() => {
      const next = new Set(collapsedMessages);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { threadKey, collapsed: next };
    });
  };

  const isThread = threadMessages.length > 1;
  const activeSummary = summaryResult && summaryResult.gmailId === selectedEmail.gmail_id
    ? summaryResult.summary
    : null;
  const activeThreadSummary = threadSummaryResult && selectedEmail.thread_id && threadSummaryResult.threadId === selectedEmail.thread_id
    ? threadSummaryResult.summary
    : null;
  const selectedThreadSummary = selectedEmail.thread_id && selectedThread?.gmail_thread_id === selectedEmail.thread_id
    ? selectedThread.summary
    : null;
  const detailSummary = activeThreadSummary || activeSummary || selectedThreadSummary || selectedEmail.summary;

  // Check if a message is sent by the user
  const isSentByMe = (fromAddress: string) => {
    if (!userEmail) return false;
    return fromAddress?.toLowerCase() === userEmail.toLowerCase();
  };

  // Generate initials for avatar
  const getInitials = (name: string | null, address: string | null) => {
    const source = name || address || '?';
    const parts = source.split(/[\s@]+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  };

  // Generate a consistent color from a string
  const getAvatarColor = (str: string) => {
    const colors = [
      '#e53935', '#8e24aa', '#3949ab', '#039be5',
      '#00897b', '#43a047', '#f4511e', '#6d4c41',
      '#5c6bc0', '#00acc1', '#7cb342', '#c0ca33',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="email-detail">
      <div className="email-detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{selectedEmail.subject}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{selectedEmail.from_name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>&lt;{selectedEmail.from_address}&gt;</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(selectedEmail.date)}</span>
              {selectedEmail.category && (
                <span className="category-badge" style={{ background: `${getCategoryColor(selectedEmail.category)}20`, color: getCategoryColor(selectedEmail.category) }}>
                  {getCategoryLabel(selectedEmail.category)}
                </span>
              )}
              {isThread && (
                <span style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: 10 }}>
                  {threadMessages.length} messages in thread
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSummarize} disabled={summarizing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {summarizing ? <span className="spinner" /> : <Sparkles size={18} />}
              {summarizing ? 'Summarizing...' : 'Summarize'}
            </button>
            <button className="btn btn-primary" onClick={() => setIsReplying(true)} id="detail-reply-btn">
              <Reply size={14} /> Reply
            </button>
          </div>
        </div>

        {/* Summary Card */}
        {detailSummary && (
          <div className="summary-card" style={{ marginTop: 16, padding: 14, background: 'var(--accent-glow)', border: '1px solid var(--accent-border)', borderRadius: 8 }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 6 }}>
              <Sparkles size={24} />
              AI Summary
            </h4>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {detailSummary}
            </p>
          </div>
        )}
      </div>

      <div ref={detailBodyRef} className="email-detail-body" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '16px 0 96px' }}>
        {isThread ? (
          <>
            {/* Collapsed messages indicator */}
            {collapsedMessages.size > 0 && (
              <button
                onClick={() => setCollapsedOverride({ threadKey, collapsed: new Set() })}
                style={{
                  background: 'none',
                  border: '1px dashed var(--border)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--accent-primary)',
                  fontWeight: 500,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                ••• {collapsedMessages.size} earlier {collapsedMessages.size === 1 ? 'message' : 'messages'} — click to expand
              </button>
            )}

            {threadMessages.map((msg, i) => {
              const sentByMe = isSentByMe(msg.from_address || '');
              const isCollapsed = collapsedMessages.has(i);
              const initials = getInitials(msg.from_name, msg.from_address);
              const avatarBg = sentByMe ? '#1a73e8' : getAvatarColor(msg.from_address || msg.from_name || '');

              if (isCollapsed) return null; // Hidden by the "expand" button above

              return (
                <div
                  key={msg.gmail_id || i}
                  style={{
                    marginBottom: 12,
                    border: '2px solid var(--border)',
                    borderLeft: sentByMe ? '4px solid #1a73e8' : '4px solid var(--border)',
                    background: 'var(--bg-primary)',
                    boxShadow: '3px 3px 0px var(--border)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Message Header */}
                  <div
                    onClick={() => toggleCollapse(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: sentByMe ? 'rgba(26, 115, 232, 0.06)' : 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: avatarBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}>
                      {initials}
                    </div>

                    {/* Sender Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {sentByMe ? 'You' : (msg.from_name || msg.from_address)}
                        </span>
                        {sentByMe && (
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            background: '#1a73e820',
                            color: '#1a73e8',
                            border: '1px solid #1a73e840',
                            fontWeight: 600,
                            letterSpacing: '0.3px',
                          }}>
                            SENT
                          </span>
                        )}
                      </div>
                      {!sentByMe && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.from_address}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                      {formatDate(msg.date)}
                    </span>
                  </div>

                  {/* Message Body */}
                  <div style={{ padding: '16px 20px' }}>
                    {(() => {
                      // For short/simple messages, render inline instead of in a heavy iframe
                      const textContent = msg.body_text || stripHtml(msg.body_html || '') || msg.snippet || '';
                      const isShortMessage = textContent.length < 500 && !msg.body_html?.includes('<table') && !msg.body_html?.includes('<img');

                      if (isShortMessage || !msg.body_html) {
                        return (
                          <div style={{
                            fontSize: 14,
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            color: 'var(--text-primary)',
                          }}>
                            {textContent || '(empty message)'}
                          </div>
                        );
                      }
	                      return (
	                        <HtmlEmailRenderer
	                          html={msg.body_html}
	                          onContentReady={i === threadMessages.length - 1 ? () => scrollThreadToBottom('smooth') : undefined}
	                          scrollContainerRef={detailBodyRef}
	                        />
	                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* Single Email Details */
          selectedEmail.body_html ? (
            <HtmlEmailRenderer
              html={selectedEmail.body_html}
              scrollContainerRef={detailBodyRef}
            />
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
              {selectedEmail.body_text || selectedEmail.snippet}
            </div>
          )
        )}
        <div ref={threadEndRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}
