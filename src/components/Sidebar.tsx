'use client';

import { Inbox, Mail, Tag, Briefcase, DollarSign, Bell, User, Newspaper, RefreshCw, PenSquare, LogOut } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { EmailCategory } from '@/types';
import dynamic from 'next/dynamic';
import aiAnim from '../../public/animations/ai.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const categories: { key: EmailCategory | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all', label: 'All Mail', icon: <Inbox size={18} />, color: 'var(--text-secondary)' },
  { key: 'personal', label: 'Personal', icon: <User size={18} />, color: 'var(--cat-personal)' },
  { key: 'work_professional', label: 'Work', icon: <Briefcase size={18} />, color: 'var(--cat-work)' },
  { key: 'newsletters', label: 'Newsletters', icon: <Newspaper size={18} />, color: 'var(--cat-newsletter)' },
  { key: 'job_recruitment', label: 'Jobs', icon: <Tag size={18} />, color: 'var(--cat-job)' },
  { key: 'finance', label: 'Finance', icon: <DollarSign size={18} />, color: 'var(--cat-finance)' },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={18} />, color: 'var(--cat-notification)' },
];

export default function Sidebar() {
  const { 
    activeCategory, setActiveCategory, categoryCounts, 
    setIsComposing, isSyncing, setIsSyncing, 
    isTerminalOpen, setTerminalOpen,
    userEmail, userName, userPicture, clearUser,
    sidebarOpen, setSidebarOpen
  } = useAppStore();

  const handleSync = async () => {
    const userId = useAppStore.getState().userId;
    if (!userId) return;
    
    if (isSyncing) {
      setTerminalOpen(true);
      return;
    }

    setIsSyncing(true, 'Syncing...');
    setTerminalOpen(true);

    try {
      const res = await fetch('/api/emails/sync', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ userId }) 
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Sync failed to start:', data.error);
        if (data.error === 'Sync already in progress') {
          // Already running, keep terminal open to poll progress
          setIsSyncing(true, 'Syncing...');
        } else {
          setIsSyncing(false);
          setTerminalOpen(false);
        }
      }
    } catch (e) { 
      console.error('Sync error:', e); 
      setIsSyncing(false);
      setTerminalOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('repeatless_user_id');
    clearUser();
    window.location.href = '/';
  };

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* User info */}
      <div style={{ padding: '20px 16px', borderBottom: '2px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {userPicture ? (
            <img src={userPicture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              <Mail size={16} color="black" />
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{userName || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{userEmail}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => setIsComposing(true)}>
            <PenSquare size={14} /> Compose
          </button>
          <button className="btn-icon" onClick={handleSync} title="Sync emails" style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}}>
            <RefreshCw size={16} />
          </button>
          <button className="btn-icon" onClick={handleLogout} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categories</div>
        {categories.map((cat) => (
          <div
            key={cat.key}
            className={`sidebar-item ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(cat.key);
              setSidebarOpen(false);
            }}
            id={`sidebar-${cat.key}`}
          >
            <span style={{ color: activeCategory === cat.key ? 'black' : cat.color }}>{cat.icon}</span>
            <span>{cat.label}</span>
            {categoryCounts[cat.key] !== undefined && cat.key !== 'all' && (
              <span className="sidebar-count">{categoryCounts[cat.key]}</span>
            )}
          </div>
        ))}
      </div>

      {/* AI Badge */}
      <div style={{ padding: 16, borderTop: '2px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center' }}>
            <Lottie animationData={aiAnim} loop={true} />
          </div>
          Powered by Gemini + NVIDIA NIM
        </div>
      </div>
    </div>
  );
}
