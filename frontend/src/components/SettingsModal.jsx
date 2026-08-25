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
  AlertCircle, 
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
    modelDownloadStates
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
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(15, 23, 42, 0.95)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)'
            }}>
              <Sparkles size={17} color="#FFFFFF" />
            </div>
            <div>
              <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.3px' }}>
                Studio Settings & AI Models
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Manage local Faster-Whisper models and offline storage directory
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => { fetchModelsStatus(); fetchSystemStats(); }}
              className="btn-secondary"
              title="Refresh status"
              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '8px' }}
            >
              <RefreshCw size={13} className={modelsLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setSettingsModalOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px 0 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.15)'
        }}>
          <button
            onClick={() => setActiveTab('models')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'models' ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'models' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 150ms ease'
            }}
          >
            <Layers size={15} />
            <span>Whisper Models</span>
            {modelsData?.models && (
              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-primary)'
              }}>
                {modelsData.models.filter(m => m.is_downloaded).length}/{modelsData.models.length} Ready
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'hardware' ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'hardware' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 150ms ease'
            }}
          >
            <Cpu size={15} />
            <span>System Hardware</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {activeTab === 'models' && (
            <>
              {/* Directory Path Banner */}
              <div style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Folder size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Offline Model Download Directory
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPath}
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Copy full directory path"
                  >
                    {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied!' : 'Copy Path'}</span>
                  </button>
                </div>

                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#E2E8F0',
                  wordBreak: 'break-all',
                  userSelect: 'all'
                }}>
                  {modelsData?.cache_dir || 'Detecting cache directory...'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={13} color="#10B981" />
                  <span>Models are cached locally. Once downloaded, all speech transcription runs 100% offline on your device.</span>
                </div>
              </div>

              {/* Models Catalog Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Available Faster-Whisper Models
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                  {(modelsData?.models || []).map((model) => {
                    const downloadState = modelDownloadStates[model.id] || { status: model.download_status };
                    const isDownloading = downloadState.status === 'downloading';
                    const isDownloaded = model.is_downloaded || downloadState.status === 'completed';

                    return (
                      <div
                        key={model.id}
                        style={{
                          borderRadius: '12px',
                          border: isDownloaded ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                          background: isDownloaded ? 'rgba(16, 185, 129, 0.04)' : 'rgba(0,0,0,0.25)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 150ms ease'
                        }}
                      >
                        {/* Card Header */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>
                                {model.name}
                              </span>
                              {model.recommended && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '1px 6px',
                                  borderRadius: '999px',
                                  background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                                  color: '#FFFFFF'
                                }}>
                                  RECOMMENDED
                                </span>
                              )}
                            </div>

                            {/* Status Badge */}
                            {isDownloading ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: '1px solid rgba(56, 189, 248, 0.3)'
                              }}>
                                <Loader2 size={11} className="animate-spin" />
                                <span>Downloading ({downloadState.percent || 0}%)</span>
                              </span>
                            ) : isDownloaded ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34D399',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                              }}>
                                <CheckCircle2 size={11} />
                                Ready
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-color)'
                              }}>
                                Available
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                            {model.description}
                          </p>

                          {/* Stats Row */}
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.04)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Zap size={11} color="var(--accent-primary)" />
                              <span>{model.speed}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <HardDrive size={11} color="#A78BFA" />
                              <span>{isDownloaded ? model.disk_size_label : model.size_label}</span>
                            </div>
                          </div>

                          {/* Live Download Progress Bar & Percentage */}
                          {isDownloading && (
                            <div style={{
                              marginTop: '10px',
                              padding: '10px',
                              borderRadius: '8px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Download size={12} color="var(--accent-primary)" />
                                  <span>Transferring files... ({downloadState.downloaded_mb || '0 MB'} / {downloadState.total_mb || model.size_label})</span>
                                </span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: '800', fontSize: '12px' }}>
                                  {downloadState.percent || 0}%
                                </span>
                              </div>

                              {/* Progress Track */}
                              <div style={{
                                width: '100%',
                                height: '7px',
                                borderRadius: '999px',
                                background: 'rgba(0, 0, 0, 0.45)',
                                overflow: 'hidden',
                                position: 'relative'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.max(3, downloadState.percent || 0)}%`,
                                  borderRadius: '999px',
                                  background: 'linear-gradient(90deg, #0284C7 0%, #38BDF8 60%, #A78BFA 100%)',
                                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                                  transition: 'width 300ms ease'
                                }} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {model.vram}
                          </span>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {isDownloaded ? (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete the cached '${model.name}' model to free disk space?`)) {
                                    deleteModel(model.id);
                                  }
                                }}
                                className="btn-secondary"
                                title="Delete cached model to free disk space"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  color: '#F87171',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  borderColor: 'rgba(239, 68, 68, 0.25)'
                                }}
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => downloadModel(model.id)}
                                disabled={isDownloading}
                                className="btn-primary"
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>Downloading ({downloadState.percent || 0}%)</span>
                                  </>
                                ) : (
                                  <>
                                    <Download size={12} />
                                    <span>Download ({model.size_label})</span>
                                  </>
                                )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {/* CPU Card */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <Cpu size={15} color="var(--accent-primary)" />
                    <span>CPU Cores & Threads</span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {systemStats?.cpu_threads || 'Detecting...'} Threads
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Current Usage: {systemStats?.cpu_percent ?? 0}%
                  </span>
                </div>

                {/* RAM Card */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <HardDrive size={15} color="#A78BFA" />
                    <span>System Memory (RAM)</span>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {systemStats?.ram_total_gb ? `${systemStats.ram_total_gb} GB` : 'Detecting...'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Used: {systemStats?.ram_used_gb || 0} GB • Avail: {systemStats?.ram_available_gb || 0} GB ({systemStats?.ram_percent || 0}% used)
                  </span>
                </div>

                {/* GPU Card */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: systemStats?.gpu?.available ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0,0,0,0.3)',
                  border: systemStats?.gpu?.available ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: systemStats?.gpu?.available ? '#4ADE80' : 'var(--text-muted)', fontSize: '12px' }}>
                    <Zap size={15} color={systemStats?.gpu?.available ? '#4ADE80' : 'var(--text-muted)'} />
                    <span>GPU Accelerator</span>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: systemStats?.gpu?.available ? '#4ADE80' : 'var(--text-main)' }}>
                    {systemStats?.gpu?.name || 'CPU Mode'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {systemStats?.gpu?.available ? (
                      `Load: ${systemStats.gpu.util_percent}% • ${(systemStats.gpu.used_mb / 1024).toFixed(1)} / ${(systemStats.gpu.total_mb / 1024).toFixed(1)} GB VRAM`
                    ) : (
                      'High-Performance CPU Vector Fallback'
                    )}
                  </span>
                </div>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Inference & Acceleration Engine
                </span>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                  AutoCaption utilizes CTranslate2 with NVIDIA CUDA GPU acceleration (float16) when supported hardware and DLLs are available, seamlessly falling back to high-performance CPU INT8 vector instructions (AVX2/AVX512).
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.25)'
        }}>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="btn-viral"
            style={{ fontSize: '12px', padding: '6px 18px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
