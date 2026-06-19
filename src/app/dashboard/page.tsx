'use client';

import { useCallback, useEffect, Suspense, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore, type Toast } from '@/lib/store';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import EmailList from '@/components/EmailList';
import EmailDetail from '@/components/EmailDetail';
import ChatPanel from '@/components/ChatPanel';
import ComposeModal from '@/components/ComposeModal';
import ReplyModal from '@/components/ReplyModal';
import SyncTerminal from '@/components/SyncTerminal';

const AUTO_SYNC_INTERVAL_MS = 60 * 1000;
const EMAIL_REFRESH_INTERVAL_MS = 15 * 1000;

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [refreshTick, setRefreshTick] = useState(0);
  const syncRequestInFlightRef = useRef(false);
  const syncWasInProgressRef = useRef(false);
  const {
    userId, setUser, setEmails, setThreads, setCategoryCounts,
    activeCategory, searchQuery, currentPage, isThreadView,
    isSyncing, setIsSyncing, clearUser,
    isTerminalOpen, setTerminalOpen,
    toasts, removeToast,
    sidebarOpen, setSidebarOpen
  } = useAppStore();

  const refreshMailbox = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  const startBackgroundSync = useCallback(async () => {
    if (!userId || syncRequestInFlightRef.current || useAppStore.getState().isSyncing) {
      return;
    }

    syncRequestInFlightRef.current = true;

    try {
      const res = await fetch('/api/emails/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'Sync already in progress') {
          setIsSyncing(true, 'Syncing...');
          return;
        }

        throw new Error(data.error || 'Sync failed to start');
      }

      setIsSyncing(true, data.message || 'Checking Gmail for new mail...');
    } catch (err) {
      console.error('Automatic sync failed:', err);
      setIsSyncing(false);
    } finally {
      syncRequestInFlightRef.current = false;
      refreshMailbox();
    }
  }, [userId, setIsSyncing, refreshMailbox]);

  // Initialize user from URL params or localStorage
  useEffect(() => {
    const urlUserId = searchParams.get('userId');
    const storedUserId = localStorage.getItem('repeatless_user_id');
    const targetUserId = urlUserId || storedUserId;

    if (targetUserId) {
      if (urlUserId) {
        localStorage.setItem('repeatless_user_id', urlUserId);
        // Clean up URL parameters without refreshing
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      if (!userId) {
        fetch(`/api/auth/session?userId=${targetUserId}`)
          .then((r) => {
            if (!r.ok) throw new Error('Session invalid');
            return r.json();
          })
          .then((data) => {
            if (data.user) {
              setUser(data.user.id, data.user.email, data.user.name, data.user.picture);
            } else {
              throw new Error('User not found');
            }
          })
          .catch((err) => {
            console.error('Session loading failed:', err);
            localStorage.removeItem('repeatless_user_id');
            clearUser();
            router.push('/');
          });
      }
    } else {
      router.push('/');
    }
  }, [searchParams, userId, setUser, clearUser, router]);

  // Start syncing automatically when the dashboard has an authenticated user,
  // then keep checking Gmail for newly arrived messages in the background.
  useEffect(() => {
    if (!userId) return;

    startBackgroundSync();
    const intervalId = setInterval(startBackgroundSync, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [userId, startBackgroundSync]);

  // Poll sync status if sync is in progress
  useEffect(() => {
    if (!userId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/emails/sync?userId=${userId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.sync_in_progress) {
          const progressMsg = data.phase === 'enumerating'
            ? `Listing emails: found ${data.total_discovered || 0}...`
            : `Syncing: ${data.total_hydrated || 0} / ${data.total_discovered || 0} loaded...`;
          setIsSyncing(true, progressMsg);
          syncWasInProgressRef.current = true;
          if (!intervalId) {
            intervalId = setInterval(checkStatus, 2000);
          }
        } else {
          setIsSyncing(false);
          if (syncWasInProgressRef.current) {
            syncWasInProgressRef.current = false;
            refreshMailbox();
          }
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (err) {
        console.error('Error polling sync status:', err);
      }
    };

    checkStatus();

    // Check again if isSyncing is externally set to true (e.g. from clicking Sync button)
    if (isSyncing && !intervalId) {
      intervalId = setInterval(checkStatus, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userId, isSyncing, setIsSyncing, refreshMailbox]);

  // Fetch emails when filters change and keep the visible mailbox fresh.
  useEffect(() => {
    if (!userId) return;

    const fetchEmails = () => {
      const params = new URLSearchParams({ userId, page: String(currentPage), limit: '50' });
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (searchQuery) params.set('search', searchQuery);
      if (isThreadView) params.set('threadView', 'true');

      fetch(`/api/emails?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (isThreadView && data.threads) setThreads(data.threads, data.total || 0);
          else if (data.emails) setEmails(data.emails, data.total || 0);
        })
        .catch(console.error);
    };

    fetchEmails();

    const intervalId = setInterval(
      fetchEmails,
      isSyncing ? 5000 : EMAIL_REFRESH_INTERVAL_MS
    );

    return () => {
      clearInterval(intervalId);
    };
  }, [userId, activeCategory, searchQuery, currentPage, isThreadView, isSyncing, refreshTick, setEmails, setThreads]);

  // Fetch category counts
  useEffect(() => {
    if (!userId) return;
    const fetchCategoryCounts = () => {
      fetch(`/api/categorize?userId=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.counts) {
            const map: Record<string, number> = {};
            for (const c of data.counts) map[c.category] = c.count;
            setCategoryCounts(map);
          }
        })
        .catch(console.error);
    };

    fetchCategoryCounts();
    const intervalId = setInterval(
      fetchCategoryCounts,
      isSyncing ? 5000 : EMAIL_REFRESH_INTERVAL_MS
    );

    return () => clearInterval(intervalId);
  }, [userId, isSyncing, refreshTick, setCategoryCounts]);

  if (!userId) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <EmailList />
      <EmailDetail />
      <ChatPanel />
      <ComposeModal />
      <ReplyModal />
      <SyncTerminal isOpen={isTerminalOpen} onClose={() => setTerminalOpen(false)} userId={userId} />

      {/* Sync indicator */}
      {isSyncing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, var(--accent), #8b5cf6, var(--accent))',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s ease-in-out infinite',
          zIndex: 200,
        }} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && <Check size={13} />}
            {toast.type === 'error' && <AlertTriangle size={13} />}
            {toast.type === 'info' && <Info size={13} />}
          </div>
          <div className="toast-content">
            <div className="toast-message">{toast.message}</div>
          </div>
          <button className="toast-close" onClick={() => onDismiss(toast.id)}>
            <X size={14} />
          </button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
