'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, X, RefreshCw, CheckCircle2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

interface SyncTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function SyncTerminal({ isOpen, onClose, userId }: SyncTerminalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [totalSynced, setTotalSynced] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [phase, setPhase] = useState<string>('idle');
  const [totalDiscovered, setTotalDiscovered] = useState(0);
  const [totalHydrated, setTotalHydrated] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Reset states when terminal is opened by parent
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Poll logs and sync status
  useEffect(() => {
    if (!isOpen || !userId) return;

    // Reset logging state when starting fresh
    setLogs(['[SYSTEM] Initializing logging stream...']);
    setIsSyncing(true);
    setTotalSynced(0);
    setError(null);

    let pollInterval: NodeJS.Timeout;

    const fetchLogsAndStatus = async () => {
      try {
        // 1. Fetch logs
        const logsRes = await fetch(`/api/emails/sync/logs?userId=${userId}`);
        const logsData = await logsRes.json();
        if (logsData.logs && logsData.logs.length > 0) {
          setLogs(logsData.logs);
        }

        // 2. Fetch sync status
        const statusRes = await fetch(`/api/emails/sync?userId=${userId}`);
        const statusData = await statusRes.json();
        
        setTotalSynced(statusData.total_hydrated || statusData.total_messages_synced || 0);
        setIsSyncing(statusData.sync_in_progress);
        setPhase(statusData.phase || 'idle');
        setTotalDiscovered(statusData.total_discovered || 0);
        setTotalHydrated(statusData.total_hydrated || 0);
        setTotalErrors(statusData.total_errors || 0);

        // If finished, clear interval
        if (!statusData.sync_in_progress) {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling sync progress:', err);
        setError('Connection lost. Retrying...');
      }
    };

    // Initial fetch
    fetchLogsAndStatus();

    // Poll every 1200ms
    pollInterval = setInterval(fetchLogsAndStatus, 1200);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isOpen, userId]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250); // Match CSS fade-out animation length
  };

  // If minimized, display floating pill in bottom-right corner
  if (isMinimized) {
    return (
      <div
        className="terminal-minimized-btn"
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#090d16',
          border: '1px solid #10b981',
          borderRadius: 30,
          padding: '10px 20px',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 1200,
          fontFamily: 'monospace',
          fontSize: 13,
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <RefreshCw size={14} className={isSyncing ? "spin" : ""} style={{ color: isSyncing ? '#60a5fa' : '#34d399' }} />
        <span>
          {isSyncing ? `Syncing (${totalHydrated}/${totalDiscovered})` : 'Sync Complete'}
        </span>
        <style dangerouslySetInnerHTML={{ __html: `
          .spin {
            animation: spin 1.5s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .terminal-minimized-btn:hover {
            transform: scale(1.05);
            border-color: #34d399;
            box-shadow: 0 10px 25px -5px rgba(16,185,129,0.3);
          }
          .terminal-minimized-btn {
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          @keyframes slideIn {
            from { transform: translateY(100px) scale(0.8); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div 
      className={`modal-overlay-custom ${isClosing ? 'closing' : ''}`} 
      style={{ zIndex: 1100 }} 
      onClick={isSyncing ? undefined : handleClose}
    >
      <div 
        className={`modal-custom ${isClosing ? 'closing' : ''}`} 
        style={{ 
          maxWidth: isMaximized ? '95vw' : 750, 
          width: '100%', 
          height: isMaximized ? '90vh' : 'auto',
          background: '#090d16', 
          border: '1px solid #1f2937',
          color: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div 
          style={{ 
            background: '#111827', 
            padding: '12px 18px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '1px solid #1f2937' 
          }}
        >
          {/* macOS window controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Close Button (Red) */}
            <div 
              className="window-btn"
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              onClick={handleClose}
              title="Close terminal"
            >
              <span className="btn-icon">×</span>
            </div>
            {/* Minimize Button (Orange) */}
            <div 
              className="window-btn"
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setIsMinimized(true)}
              title="Minimize to floating widget"
            >
              <span className="btn-icon" style={{ marginTop: -5 }}>-</span>
            </div>
            {/* Maximize Button (Green) */}
            <div 
              className="window-btn"
              style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Restore window size" : "Maximize window"}
            >
              <span className="btn-icon" style={{ fontSize: 7 }}>{isMaximized ? '▼' : '▲'}</span>
            </div>
            
            <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: 'monospace', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={14} />
              gmail-sync-terminal.sh
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSyncing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                <RefreshCw size={12} className="spin" />
                {phase.toUpperCase()}: {totalHydrated}/{totalDiscovered}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                <CheckCircle2 size={12} />
                COMPLETED
              </span>
            )}
          </div>
        </div>

        {/* Terminal Body */}
        <div 
          style={{ 
            padding: 20, 
            height: isMaximized ? 'calc(90vh - 120px)' : 380, 
            overflowY: 'auto', 
            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
            fontSize: 13,
            lineHeight: 1.6,
            background: '#040711',
            color: '#10b981',
            flexGrow: 1
          }}
        >
          {logs.map((log, idx) => {
            let color = '#34d399'; // Default light green
            if (log.includes('error') || log.includes('Pipeline error') || log.includes('Warning')) {
              color = '#f87171'; // Red for errors
            } else if (log.includes('[SUCCESS]') || log.includes('complete') || log.includes('finished')) {
              color = '#60a5fa'; // Blue for success stages
            } else if (log.includes('[SYSTEM]')) {
              color = '#9ca3af'; // Grey for system messages
            }

            return (
              <div key={idx} style={{ color, display: 'flex', gap: 8 }}>
                <span style={{ color: '#4b5563', userSelect: 'none' }}>$</span>
                <span>{log}</span>
              </div>
            );
          })}

          {error && (
            <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {isSyncing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#10b981' }}>
              <span style={{ color: '#4b5563', userSelect: 'none' }}>$</span>
              <span style={{ display: 'inline-block' }}>
                {phase === 'enumerating' && 'Listing message IDs from Gmail'}
                {phase === 'hydrating' && 'Fetching raw email content and attachments'}
                {phase === 'categorizing' && 'Running AI classification on emails'}
                {phase === 'embedding' && 'Generating semantic search vectors'}
                {!['enumerating', 'hydrating', 'categorizing', 'embedding'].includes(phase) && 'Processing sync pipeline'}
                <span className="dot-pulse" style={{ marginLeft: 4 }}>...</span>
              </span>
              <span className="cursor-blink" style={{ fontWeight: 'bold' }}>▋</span>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer */}
        <div 
          style={{ 
            background: '#111827', 
            padding: '16px 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderTop: '1px solid #1f2937' 
          }}
        >
          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
            {isSyncing ? (
              <span>
                Progress: {totalHydrated} / {totalDiscovered} messages processed
                {totalErrors > 0 && <span style={{ color: '#f87171', marginLeft: 6 }}>({totalErrors} errors)</span>}
              </span>
            ) : (
              <span>Sync complete. Hydrated {totalHydrated} messages successfully ({totalErrors} errors).</span>
            )}
          </div>

          <button 
            className={`btn ${isSyncing ? 'btn-secondary' : 'btn-success'}`}
            disabled={isSyncing}
            onClick={handleClose}
            style={{ 
              fontFamily: 'monospace', 
              padding: '6px 16px',
              fontSize: 13,
              borderRadius: 6,
              background: isSyncing ? '#374151' : '#10b981',
              color: '#ffffff',
              border: 'none',
              cursor: isSyncing ? 'not-allowed' : 'pointer'
            }}
          >
            {isSyncing ? 'Syncing...' : 'Close & Refresh Feed'}
          </button>
        </div>

        {/* Global style injections */}
        <style dangerouslySetInnerHTML={{ __html: `
          .modal-overlay-custom {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 1;
          }
          .modal-overlay-custom.closing {
            opacity: 0;
          }
          
          .modal-custom {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            transform: scale(1);
          }
          .modal-custom.closing {
            transform: scale(0.95) translateY(12px);
            opacity: 0;
          }
          
          .window-btn {
            position: relative;
            transition: transform 0.1s ease;
          }
          .window-btn:hover {
            transform: scale(1.15);
          }
          .window-btn:active {
            transform: scale(0.9);
          }
          
          .btn-icon {
            font-size: 10px;
            color: rgba(0,0,0,0.4);
            font-weight: bold;
            opacity: 0;
            transition: opacity 0.15s ease;
            user-select: none;
          }
          
          /* Show window control symbols on header hover (macOS style) */
          div:hover > .window-btn .btn-icon {
            opacity: 1;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1.5s linear infinite;
          }
          @keyframes blink {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
          .cursor-blink {
            animation: blink 1s step-end infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: .2; }
            20% { opacity: 1; }
          }
          .dot-pulse {
            display: inline-block;
          }
          .dot-pulse::after {
            content: '...';
            animation: pulse 1.5s infinite;
          }
        `}} />
      </div>
    </div>
  );
}
