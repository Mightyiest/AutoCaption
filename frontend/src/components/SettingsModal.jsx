import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Folder, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  HardDrive, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const SettingsModal = () => {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    modelsData,
    modelsLoading,
    fetchModelsStatus,
    downloadModel,
    deleteModel,
    modelDownloadStates,
    selectedModel,
    setSelectedModel
  } = useEditorStore();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('models'); // 'models' | 'hardware'
  const [systemStats, setSystemStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (isSettingsModalOpen) {
      fetchModelsStatus();
      fetchSystemStats();
    }
  }, [isSettingsModalOpen]);

  const fetchSystemStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('http://127.0.0.1:8000/api/system-status');
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCopyPath = () => {
    if (!modelsData?.cache_dir) return;
    navigator.clipboard.writeText(modelsData.cache_dir);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isSettingsModalOpen) return null;

  return (
    <div className="modal-backdrop">
      <div 
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Studio Settings
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => { fetchModelsStatus(); fetchSystemStats(); }}
              className="btn-ghost"
              title="Refresh status"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <RefreshCw size={12} className={modelsLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setSettingsModalOpen(false)}
              className="btn-ghost"
              style={{ padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div style={{
          padding: '10px 20px 0 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => setActiveTab('models')}
            className="segmented-control-item"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'models' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'models' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none'
            }}
          >
            <Layers size={13} />
            <span>Whisper Models</span>
            {modelsData?.models && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(0, 113, 227, 0.15)',
                color: 'var(--accent-bright-blue)',
                marginLeft: '4px'
              }}>
                {modelsData.models.filter(m => m.is_downloaded).length}/{modelsData.models.length} Ready
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className="segmented-control-item"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'hardware' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'hardware' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none'
            }}
          >
            <Cpu size={13} />
            <span>Hardware Resources</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeTab === 'models' && (
            <>
              {/* Directory Path Info Box */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Folder size={14} color="var(--accent-bright-blue)" />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Local Cache Location
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPath}
                    className="btn-ghost"
                    style={{ padding: '2px 6px', fontSize: '10px' }}
                  >
                    {copied ? <Check size={11} color="var(--system-success)" /> : <Copy size={11} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  fontFamily: 'SF Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-all'
                }}>
                  {modelsData?.cache_dir || 'Detecting cache directory...'}
                </div>
              </div>

              {/* Models List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Models
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
                  {(modelsData?.models || []).map((model) => {
                    const downloadState = modelDownloadStates[model.id] || { status: model.download_status };
                    const isDownloading = downloadState.status === 'downloading';
                    const isDownloaded = model.is_downloaded || downloadState.status === 'completed';

                    return (
                      <div
                        key={model.id}
                        style={{
                          borderRadius: 'var(--radius-md)',
                          border: isDownloaded ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid var(--border-subtle)',
                          background: isDownloaded ? 'rgba(48, 209, 88, 0.03)' : 'var(--bg-surface)',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {model.name}
                              </span>
                              {model.id === selectedModel && (
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(0, 113, 227, 0.18)',
                                  color: 'var(--accent-bright-blue)'
                                }}>
                                  ACTIVE
                                </span>
                              )}
                            </div>

                            {isDownloading ? (
                              <span style={{ fontSize: '10px', color: 'var(--accent-bright-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Loader2 size={10} className="animate-spin" />
                                <span>{downloadState.percent || 0}%</span>
                              </span>
                            ) : isDownloaded ? (
                              <span style={{ fontSize: '10px', color: 'var(--system-success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={11} /> Ready
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                {model.size_label}
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                            {model.description}
                          </p>

                          <div style={{
                            display: 'flex',
                            gap: '10px',
                            fontSize: '10px',
                            color: 'var(--text-tertiary)',
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            <span>{model.speed}</span>
                            <span>•</span>
                            <span>{isDownloaded ? model.disk_size_label : model.size_label}</span>
                          </div>

                          {/* Progress bar */}
                          {isDownloading && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.max(3, downloadState.percent || 0)}%`,
                                  background: 'var(--accent-primary)',
                                  borderRadius: 'var(--radius-pill)',
                                  transition: 'width 200ms ease'
                                }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                            {model.vram}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {model.id === selectedModel ? (
                              <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--accent-bright-blue)' }}>
                                Selected
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedModel(model.id)}
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '10px' }}
                              >
                                Select
                              </button>
                            )}

                            {isDownloaded ? (
                              <button
                                onClick={() => {
                                  if (confirm(`Delete cached '${model.name}' model to free disk space?`)) {
                                    deleteModel(model.id);
                                  }
                                }}
                                className="btn-ghost"
                                style={{ padding: '3px 6px', color: 'var(--system-error)', fontSize: '10px' }}
                                title="Delete offline cache"
                              >
                                <Trash2 size={11} />
                              </button>
                            ) : (
                              <button
                                onClick={() => downloadModel(model.id)}
                                disabled={isDownloading}
                                className="btn-primary"
                                style={{ padding: '3px 10px', fontSize: '10px' }}
                              >
                                <Download size={11} />
                                <span>Download</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'hardware' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {/* CPU Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>CPU Cores</span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {systemStats?.cpu_threads || '...'} Threads
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    Usage: {systemStats?.cpu_percent ?? 0}%
                  </span>
                </div>

                {/* RAM Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>System RAM</span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {systemStats?.ram_total_gb ? `${systemStats.ram_total_gb} GB` : '...'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {systemStats?.ram_used_gb || 0} GB Used ({systemStats?.ram_percent || 0}%)
                  </span>
                </div>

                {/* GPU Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>GPU Device</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: systemStats?.gpu?.available ? 'var(--system-success)' : 'var(--text-primary)' }}>
                    {systemStats?.gpu?.name || 'CPU Mode'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {systemStats?.gpu?.available ? `${systemStats.gpu.util_percent}% Load` : 'Vector Fallback'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="btn-primary"
            style={{ padding: '5px 16px', fontSize: '12px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
