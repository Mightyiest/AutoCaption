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
  Zap 
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ConsoleDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);

  const { isTranscribing, transcribeProgress } = useEditorStore();

  useEffect(() => {
    let isMounted = true;
    const pollInterval = isOpen || isTranscribing ? 1000 : 5000;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStats(data.hardware);
            setLogs(data.logs || []);
          }
        }
      } catch (_) {
        // Backend offline
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, isTranscribing]);

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
      case 'SUCCESS': return 'var(--system-success)';
      case 'ERROR': return 'var(--system-error)';
      case 'WARN': return 'var(--system-warning)';
      case 'AI': return 'var(--accent-bright-blue)';
      case 'TRANSCRIBE': return 'var(--accent-bright-blue)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--bg-panel)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40
    }}>
      {/* Bottom Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 14px',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        userSelect: 'none'
      }}>
        {/* Hardware Resource Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* CPU */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={11} color="var(--text-tertiary)" />
            <span>CPU: <strong style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {stats ? `${stats.cpu_percent ?? stats.cpu_usage_percent ?? 0}%` : '--'}
            </strong></span>
          </div>

          {/* RAM */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HardDrive size={11} color="var(--text-tertiary)" />
            <span>RAM: <strong style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {stats && stats.ram_total_gb ? (
                `${stats.ram_used_gb ?? (stats.ram_available_gb !== undefined ? (stats.ram_total_gb - stats.ram_available_gb).toFixed(1) : '0')} / ${stats.ram_total_gb} GB`
              ) : '--'}
            </strong></span>
          </div>

          {/* GPU */}
          {stats?.gpu?.available ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--system-success)'
            }}>
              <Zap size={11} />
              <span>{stats.gpu.name} ({stats.gpu.util_percent}%)</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={11} color="var(--text-tertiary)" />
              <span>CPU Inference</span>
            </div>
          )}

          {/* Active Transcribe Task */}
          {isTranscribing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: 'var(--accent-bright-blue)'
            }}>
              <Activity size={12} className="animate-pulse" />
              <span>{transcribeProgress || 'Processing Speech Alignment...'}</span>
            </div>
          )}
        </div>

        {/* Toggle Terminal Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn-ghost"
          style={{ padding: '2px 6px', fontSize: '10px' }}
        >
          <Terminal size={11} />
          <span>Console ({logs.length})</span>
          {isOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>

      {/* Expandable Console Terminal Window */}
      {isOpen && (
        <div style={{
          height: '140px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-canvas)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Terminal Actions Bar */}
          <div style={{
            padding: '3px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            fontSize: '10px',
            color: 'var(--text-tertiary)'
          }}>
            <span>Execution Log Stream</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleCopyLogs}
                className="btn-ghost"
                style={{ padding: '1px 4px', fontSize: '10px' }}
              >
                {copied ? <Check size={10} color="var(--system-success)" /> : <Copy size={10} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setLogs([])}
                className="btn-ghost"
                style={{ padding: '1px 4px', fontSize: '10px' }}
              >
                <Trash2 size={10} />
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
              padding: '6px 12px',
              fontFamily: 'SF Mono, Menlo, monospace',
              fontSize: '10px',
              lineHeight: '1.4',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px'
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No active execution logs.
              </span>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: 'var(--text-tertiary)', userSelect: 'none' }}>[{log.timestamp}]</span>
                  <span style={{ color: getLevelColor(log.level), fontWeight: '600', minWidth: '60px' }}>
                    [{log.level}]
                  </span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, wordBreak: 'break-all' }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </footer>
  );
};
