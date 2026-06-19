'use client';

import { useState, useEffect } from 'react';
import { Search, LayoutList, MessageSquare, Newspaper, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDate, getCategoryColor, getCategoryLabel } from '@/lib/utils';
import type { EmailMessage, EmailThread, NewsItem } from '@/types';

type SelectableEmail = Pick<EmailMessage, 'gmail_id'> & Partial<EmailMessage>;

export default function EmailList() {
  const {
    emails, threads, isThreadView, setIsThreadView, searchQuery, setSearchQuery,
    selectedEmail, setSelectedEmail, selectedThread, setSelectedThread, userId,
    totalEmails, currentPage, setCurrentPage, activeCategory
  } = useAppStore();

  const [digestMode, setDigestMode] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loadingDigest, setLoadingDigest] = useState(false);

  // Automatically turn off digest mode if the category changes from newsletters
  useEffect(() => {
    if (activeCategory !== 'newsletters') {
      setDigestMode(false);
    }
  }, [activeCategory]);

  // Fetch newsletter news digest from API
  useEffect(() => {
    if (digestMode && userId) {
      setLoadingDigest(true);
      fetch(`/api/newsletter?userId=${userId}&days=7`)
        .then((r) => r.json())
        .then((data) => {
          if (data.items) setNewsItems(data.items);
          else setNewsItems([]);
        })
        .catch(console.error)
        .finally(() => setLoadingDigest(false));
    }
  }, [digestMode, userId]);

  const handleSelectEmail = async (email: SelectableEmail) => {
    if (!userId || !email.gmail_id) return;

    const hasFullEmailData = Boolean(email.thread_id);
    setSelectedThread(null);
    setSelectedEmail(hasFullEmailData ? (email as EmailMessage) : null);

    // Fetch full email with thread
    try {
      const res = await fetch(`/api/emails/${email.gmail_id}?userId=${userId}`);
      const data = await res.json();
      if (data.email) setSelectedEmail(data.email);
      if (data.threadMessages) {
        const threadId = data.email?.thread_id || email.thread_id || data.threadMessages[0]?.thread_id;
        if (threadId) {
          setSelectedThread({ gmail_thread_id: threadId } as EmailThread, data.threadMessages);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleSelectThread = async (thread: EmailThread) => {
    try {
      const res = await fetch(`/api/emails/${thread.gmail_thread_id}?userId=${userId}&isThread=true`);
      const data = await res.json();
      if (data.thread) setSelectedThread(data.thread, data.messages || []);
      if (data.messages?.length) setSelectedEmail(data.messages[data.messages.length - 1]);
    } catch (e) { console.error(e); }
  };

  const totalPages = Math.ceil(totalEmails / 50);

  return (
    <div className="email-list">
      <div className="email-list-header">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="email-search"
          />
        </div>
        <button
          className="btn-icon"
          onClick={() => setIsThreadView(!isThreadView)}
          title={isThreadView ? 'Message view' : 'Thread view'}
          disabled={activeCategory === 'newsletters' && digestMode}
        >
          {isThreadView ? <MessageSquare size={16} /> : <LayoutList size={16} />}
        </button>
      </div>

      {activeCategory === 'newsletters' && (
        <div style={{ padding: '8px 16px', borderBottom: '2px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg-tertiary)' }}>
          <button
            className={`btn ${!digestMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '6px 12px', fontSize: 11, transform: 'none', borderRadius: '0px', boxShadow: !digestMode ? '2px 2px 0px var(--border)' : 'none' }}
            onClick={() => setDigestMode(false)}
          >
            <Newspaper size={14} />
            Inbox View
          </button>
          <button
            className={`btn ${digestMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '6px 12px', fontSize: 11, transform: 'none', borderRadius: '0px', boxShadow: digestMode ? '2px 2px 0px var(--border)' : 'none' }}
            onClick={() => setDigestMode(true)}
            id="newsletter-digest-btn"
          >
            <Sparkles size={14} />
            AI News Digest
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeCategory === 'newsletters' && digestMode ? (
          loadingDigest ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <span className="spinner" style={{ width: 28, height: 28, marginBottom: 12 }} />
              <div>Gemini is deduplicating stories...</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analyzing newsletters from the past 7 days</div>
            </div>
          ) : newsItems.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Sparkles size={36} style={{ color: 'var(--accent)', marginBottom: 12 }} />
              <div>No news digest items found</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Try syncing or wait for newsletter emails</div>
            </div>
          ) : (
            newsItems.map((item, idx) => (
              <div key={idx} className="digest-card">
                <div className="digest-title">{item.title}</div>
                <div className="digest-summary">{item.summary}</div>
                <div className="digest-sources">
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>Sources:</span>
                  {item.sources?.map((src, sIdx) => (
                    <button
                      key={sIdx}
                      className="digest-source-badge"
                      onClick={() => handleSelectEmail({ gmail_id: src.email_id })}
                      disabled={!src.email_id}
                      title={`Open original newsletter sent on ${src.date}`}
                    >
                      <Newspaper size={10} />
                      {src.newsletter || 'Newsletter'}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )
        ) : isThreadView ? (
          threads.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <LayoutList size={40} />
              <div>No threads found</div>
              <div style={{ fontSize: 12 }}>Try syncing your emails</div>
            </div>
          ) : threads.map((thread) => (
            <div
              key={thread.gmail_thread_id}
              className={`email-item ${selectedThread?.gmail_thread_id === thread.gmail_thread_id ? 'active' : ''}`}
              onClick={() => handleSelectThread(thread)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div className="email-sender" style={{ flex: 1 }}>
                  {thread.participants?.slice(0, 2).join(', ')}
                  {(thread.message_count || 0) > 1 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>({thread.message_count})</span>
                  )}
                </div>
                <span className="email-date">{formatDate(thread.last_message_date)}</span>
              </div>
              <div className="email-subject">{thread.subject}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div className="email-snippet" style={{ flex: 1 }}>{thread.snippet}</div>
                {thread.category && (
                  <span className="category-badge" style={{ background: `${getCategoryColor(thread.category)}20`, color: getCategoryColor(thread.category) }}>
                    {getCategoryLabel(thread.category)}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          emails.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <LayoutList size={40} />
              <div>No emails found</div>
            </div>
          ) : emails.map((email) => (
            <div
              key={email.gmail_id}
              className={`email-item ${!email.is_read ? 'unread' : ''} ${selectedEmail?.gmail_id === email.gmail_id ? 'active' : ''}`}
              onClick={() => handleSelectEmail(email)}
            >
              <div className="email-sender">{email.from_name || email.from_address}</div>
              <div className="email-subject">{email.subject}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="email-snippet" style={{ flex: 1 }}>{email.snippet}</div>
                {email.category && (
                  <span className="category-badge" style={{ background: `${getCategoryColor(email.category)}20`, color: getCategoryColor(email.category) }}>
                    {getCategoryLabel(email.category)}
                  </span>
                )}
              </div>
              <span className="email-date">{formatDate(email.date)}</span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!(activeCategory === 'newsletters' && digestMode) && totalPages > 1 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button className="btn btn-ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{currentPage} / {totalPages}</span>
          <button className="btn btn-ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
