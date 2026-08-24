import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  ChevronUp, 
  ChevronDown, 
  Cpu, 
  HardDrive, 
  Activity, 
  Trash2, 
  Copy, 
  Check, 
  Zap,
  Server
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ConsoleDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);

  const { isTranscribing, transcribeProgress, backendAvailable } = useEditorStore();

  // Poll backend stats every 1.2s
  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStats(data.hardware);
            setLogs(data.logs || []);
          }
        }
      } catch (err) {
        // Backend offline
      }
    }, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'SUCCESS': return '#4ADE80';
      case 'ERROR': return '#F87171';
      case 'WARN': return '#FBBF24';
      case 'AI': return '#A855F7';
      case 'TRANSCRIBE': return '#38BDF8';
      case 'FFMPEG': return '#EC4899';
      default: return '#94A3B8';
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-color)',
      backgroundColor: 'rgba(11, 15, 23, 0.95)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      transition: 'all 200ms ease'
    }}>
      {/* Bottom Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        {/* Hardware Resource Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* CPU Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Cpu size={13} color="var(--accent-primary)" />
            <span>CPU: <strong style={{ color: '#FFF' }}>{stats ? `${stats.cpu_percent}%` : '--'}</strong></span>
          </div>

          {/* RAM Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <HardDrive size={13} color="#F59E0B" />
            <span>RAM: <strong style={{ color: '#FFF' }}>
              {stats ? `${stats.ram_used_gb} / ${stats.ram_total_gb} GB (${stats.ram_percent}%)` : '--'}
            </strong></span>
          </div>

          {/* GPU Pill */}
          {stats?.gpu?.available ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ADE80'
            }}>
              <Zap size={12} />
              <span>
                <strong>{stats.gpu.name}</strong>: {stats.gpu.util_percent}% • {(stats.gpu.used_mb / 1024).toFixed(1)} / {(stats.gpu.total_mb / 1024).toFixed(1)} GB VRAM
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={13} color="var(--text-muted)" />
              <span>GPU: <strong style={{ color: 'var(--text-muted)' }}>CPU Mode</strong></span>
            </div>
          )}

          {/* Active Task status */}
          {isTranscribing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent-primary)',
              fontWeight: '700'
            }}>
              <Activity size={13} className="animate-pulse" />
              <span>{transcribeProgress || 'Processing AI Speech Alignment...'}</span>
            </div>
          )}
        </div>

        {/* Toggle Terminal Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: isOpen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: isOpen ? 'var(--accent-primary)' : 'var(--text-main)',
              fontSize: '11px',
              fontWeight: '700',
              padding: '4px 10px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Terminal size={12} />
            <span>Console Logs ({logs.length})</span>
            {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {/* Expandable Console Terminal Window */}
      {isOpen && (
        <div style={{
          height: '160px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#05080E',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Terminal Actions Bar */}
          <div style={{
            padding: '4px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.3)',
            fontSize: '10px',
            color: 'var(--text-muted)'
          }}>
            <span>Real-time Whisper & FFmpeg Execution Stream</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyLogs}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
              >
                {copied ? <Check size={11} color="#4ADE80" /> : <Copy size={11} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setLogs([])}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Terminal Logs Output */}
          <div
            ref={logContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 14px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '11px',
              lineHeight: '1.45',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                No active execution logs. Ready for video upload or transcription.
              </span>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#64748B', userSelect: 'none' }}>[{log.timestamp}]</span>
                  <span style={{ color: getLevelColor(log.level), fontWeight: '700', minWidth: '70px' }}>
                    [{log.level}]
                  </span>
                  <span style={{ color: '#E2E8F0', flex: 1, wordBreak: 'break-all' }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
