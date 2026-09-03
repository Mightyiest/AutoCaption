import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Loader2, 
  RefreshCw, 
  Layers, 
  Music,
  Terminal,
  ArrowUpCircle,
  Package,
  ShieldCheck,
  StopCircle,
  ChevronDown,
  ChevronUp
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
    setSelectedModel,
    // Dependencies & Vocal Models
    dependenciesData,
    dependenciesLoading,
    vocalModelsData,
    vocalModelsLoading,
    activeInstallTask,
    fetchDependenciesStatus,
    installDependency,
    uninstallDependency,
    cancelDependencyTask,
    fetchVocalModelsStatus,
    downloadVocalModel,
    deleteVocalModel
  } = useEditorStore();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('dependencies'); // 'dependencies' | 'whisper' | 'vocal' | 'hardware'
  const [systemStats, setSystemStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'ai_compute' | 'vocal_separation' | 'media_engine'
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  const consoleLogsEndRef = useRef(null);

  useEffect(() => {
    if (isSettingsModalOpen) {
      fetchModelsStatus();
      fetchDependenciesStatus();
      fetchVocalModelsStatus();
      fetchSystemStats();
    }
  }, [isSettingsModalOpen]);

  // Auto-scroll console output when new logs arrive
  useEffect(() => {
    if (activeInstallTask && consoleLogsEndRef.current) {
      consoleLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeInstallTask?.logs?.length]);

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

  const handleRefreshAll = () => {
    fetchModelsStatus();
    fetchDependenciesStatus(false);
    fetchVocalModelsStatus();
    fetchSystemStats();
  };

  const handleCopyPath = () => {
    if (!modelsData?.cache_dir) return;
    navigator.clipboard.writeText(modelsData.cache_dir);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isSettingsModalOpen) return null;

  const packages = dependenciesData?.packages || [];
  const filteredPackages = categoryFilter === 'all' 
    ? packages 
    : packages.filter(p => p.category === categoryFilter);

  const torchCuda = dependenciesData?.torch_cuda;
  const isCudaReady = torchCuda?.cuda_available;

  const downloadedWhisperCount = (modelsData?.models || []).filter(m => m.is_downloaded).length;
  const totalWhisperCount = (modelsData?.models || []).length;

  const downloadedVocalCount = (vocalModelsData || []).filter(m => m.is_downloaded).length;
  const totalVocalCount = (vocalModelsData || []).length;

  const installedPkgCount = packages.filter(p => p.is_installed).length;
  const totalPkgCount = packages.length;

  return (
    <div className="modal-backdrop">
      <div 
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
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
              Studio Settings & Dependencies
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefreshAll}
              className="btn-ghost"
              title="Refresh status from backend"
              style={{ padding: '4px 10px', fontSize: '11px', gap: '5px' }}
            >
              <RefreshCw size={12} className={(modelsLoading || dependenciesLoading || vocalModelsLoading) ? 'animate-spin' : ''} />
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
          padding: '8px 20px 0 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('dependencies')}
            className="segmented-control-item"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'dependencies' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'dependencies' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Package size={13} />
            <span>Dependencies & CUDA</span>
            {totalPkgCount > 0 && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: 'var(--radius-pill)',
                background: installedPkgCount === totalPkgCount ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                color: installedPkgCount === totalPkgCount ? 'var(--system-success)' : 'var(--system-warning)'
              }}>
                {installedPkgCount}/{totalPkgCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('whisper')}
            className="segmented-control-item"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'whisper' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'whisper' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={13} />
            <span>Whisper Models</span>
            {totalWhisperCount > 0 && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(0, 113, 227, 0.15)',
                color: 'var(--accent-bright-blue)'
              }}>
                {downloadedWhisperCount}/{totalWhisperCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('vocal')}
            className="segmented-control-item"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'vocal' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'vocal' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Music size={13} />
            <span>Vocal Separation Models</span>
            {totalVocalCount > 0 && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: 'var(--radius-pill)',
                background: downloadedVocalCount > 0 ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: downloadedVocalCount > 0 ? 'var(--system-success)' : 'var(--text-tertiary)'
              }}>
                {downloadedVocalCount}/{totalVocalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className="segmented-control-item"
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'hardware' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'hardware' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Cpu size={13} />
            <span>Hardware Resources</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* ========================================================================= */}
          {/* TAB 1: DEPENDENCIES & CUDA ACCELERATION                                 */}
          {/* ========================================================================= */}
          {activeTab === 'dependencies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* CUDA Hardware Acceleration Hero Banner */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: isCudaReady 
                  ? 'linear-gradient(135deg, rgba(48, 209, 88, 0.08) 0%, rgba(0, 113, 227, 0.04) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 159, 10, 0.08) 0%, rgba(255, 69, 58, 0.03) 100%)',
                border: isCudaReady 
                  ? '1px solid rgba(48, 209, 88, 0.25)' 
                  : '1px solid rgba(255, 159, 10, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCudaReady ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                    color: isCudaReady ? 'var(--system-success)' : 'var(--system-warning)',
                    flexShrink: 0
                  }}>
                    {isCudaReady ? <Zap size={20} /> : <AlertTriangle size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {isCudaReady ? 'NVIDIA CUDA GPU Acceleration Active' : 'CPU Inference Mode (No CUDA)'}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-pill)',
                        background: isCudaReady ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 159, 10, 0.15)',
                        color: isCudaReady ? 'var(--system-success)' : 'var(--system-warning)'
                      }}>
                        {isCudaReady ? `CUDA ${torchCuda?.cuda_version || '12.x'}` : 'CPU FALLBACK'}
                      </span>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                      {isCudaReady ? (
                        <>
                          Operating on <strong>{torchCuda?.device_name}</strong>
                          {torchCuda?.vram_total_mb > 0 && ` (${torchCuda.vram_free_mb} MB free / ${torchCuda.vram_total_mb} MB total VRAM)`}.
                          Whisper transcription and vocal separation operate at maximum neural throughput.
                        </>
                      ) : (
                        <>
                          PyTorch is currently executing on CPU cores without GPU acceleration.
                          If you have an NVIDIA GeForce or RTX GPU, install CUDA 12 PyTorch for up to 15x faster transcription.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                  {!isCudaReady ? (
                    <button
                      onClick={() => installDependency('torch_cuda')}
                      disabled={activeInstallTask?.status === 'running'}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '11px', gap: '6px' }}
                    >
                      <Zap size={12} />
                      <span>Install PyTorch CUDA 12</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => installDependency('torch_cpu')}
                      disabled={activeInstallTask?.status === 'running'}
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '10px', color: 'var(--text-tertiary)' }}
                      title="Switch to CPU-only mode to save VRAM"
                    >
                      Switch to CPU Mode
                    </button>
                  )}
                </div>
              </div>

              {/* Action Toolbar & Category Filters */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'ai_compute', label: 'AI & Compute' },
                    { id: 'vocal_separation', label: 'Vocal Isolation' },
                    { id: 'media_engine', label: 'Media & Codecs' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCategoryFilter(tab.id)}
                      className="btn-ghost"
                      style={{
                        padding: '3px 10px',
                        fontSize: '11px',
                        borderRadius: 'var(--radius-pill)',
                        background: categoryFilter === tab.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        color: categoryFilter === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => fetchDependenciesStatus(true)}
                    disabled={dependenciesLoading || activeInstallTask?.status === 'running'}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', gap: '5px' }}
                  >
                    <ArrowUpCircle size={12} />
                    <span>Check Latest Versions</span>
                  </button>
                  <button
                    onClick={() => installDependency('all_essential')}
                    disabled={activeInstallTask?.status === 'running'}
                    className="btn-primary"
                    style={{ padding: '4px 12px', fontSize: '11px', gap: '5px' }}
                  >
                    <Download size={12} />
                    <span>Install Essentials</span>
                  </button>
                </div>
              </div>

              {/* Package Dependency Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredPackages.map((pkg) => {
                  const isInstalled = pkg.is_installed;
                  const isTaskTarget = activeInstallTask?.description?.toLowerCase().includes(pkg.pypi_name.toLowerCase());
                  const isRunning = isTaskTarget && activeInstallTask?.status === 'running';

                  return (
                    <div
                      key={pkg.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: isInstalled ? 'var(--bg-surface)' : 'rgba(255, 255, 255, 0.015)',
                        border: isInstalled ? '1px solid var(--border-subtle)' : '1px dashed rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isInstalled ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: isInstalled ? 'var(--system-success)' : 'var(--text-tertiary)',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          {isInstalled ? <CheckCircle2 size={15} /> : <Package size={15} />}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {pkg.name}
                            </span>
                            
                            {/* Installed / Not Installed Badge */}
                            {isInstalled ? (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(48, 209, 88, 0.15)',
                                color: 'var(--system-success)',
                                border: '1px solid rgba(48, 209, 88, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <Check size={10} /> INSTALLED
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(255, 159, 10, 0.12)',
                                color: 'var(--system-warning)',
                                border: '1px solid rgba(255, 159, 10, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                NOT INSTALLED
                              </span>
                            )}

                            {pkg.update_available && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(0, 113, 227, 0.15)',
                                color: 'var(--accent-bright-blue)',
                                border: '1px solid rgba(0, 113, 227, 0.3)'
                              }}>
                                Update available: v{pkg.latest_version}
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: '1.35' }}>
                            {pkg.description}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                            <span>Package: <code style={{ color: 'var(--text-secondary)' }}>{pkg.pypi_name}</code></span>
                            {isInstalled && (
                              <span>Version: <strong style={{ color: 'var(--text-primary)' }}>{pkg.installed_version}</strong></span>
                            )}
                            {pkg.latest_version && (
                              <span>Latest PyPI: <strong style={{ color: 'var(--accent-bright-blue)' }}>{pkg.latest_version}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isRunning ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-bright-blue)' }}>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Processing...</span>
                          </div>
                        ) : !isInstalled ? (
                          <button
                            onClick={() => installDependency(pkg.id)}
                            disabled={activeInstallTask?.status === 'running'}
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
                          >
                            <Download size={11} />
                            <span>Install</span>
                          </button>
                        ) : (
                          <>
                            {pkg.update_available ? (
                              <button
                                onClick={() => installDependency(pkg.id)}
                                disabled={activeInstallTask?.status === 'running'}
                                className="btn-primary"
                                style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
                              >
                                <ArrowUpCircle size={11} />
                                <span>Update</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => installDependency(pkg.id)}
                                disabled={activeInstallTask?.status === 'running'}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '10px' }}
                                title="Reinstall or force update"
                              >
                                Reinstall
                              </button>
                            )}

                            {pkg.id !== 'ffmpeg' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to uninstall '${pkg.name}'?`)) {
                                    uninstallDependency(pkg.id);
                                  }
                                }}
                                disabled={activeInstallTask?.status === 'running'}
                                className="btn-ghost"
                                style={{ padding: '4px 6px', color: 'var(--system-error)', fontSize: '10px' }}
                                title="Uninstall package"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: WHISPER MODELS                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'whisper' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Directory Path Info Box */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Folder size={13} color="var(--accent-bright-blue)" />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Local Whisper Cache Location
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
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  fontFamily: 'SF Mono, monospace',
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-all'
                }}>
                  {modelsData?.cache_dir || 'Detecting cache directory...'}
                </div>
              </div>

              {/* Models List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' }}>
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
                        background: isDownloaded ? 'rgba(48, 209, 88, 0.02)' : 'var(--bg-surface)',
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
                            {model.recommended && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(0, 113, 227, 0.18)',
                                color: 'var(--accent-bright-blue)'
                              }}>
                                RECOMMENDED
                              </span>
                            )}
                            {model.id === selectedModel && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(48, 209, 88, 0.18)',
                                color: 'var(--system-success)'
                              }}>
                                ACTIVE
                              </span>
                            )}
                          </div>

                          {/* Status Badge */}
                          {isDownloading ? (
                            <span style={{ fontSize: '10px', color: 'var(--accent-bright-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Loader2 size={10} className="animate-spin" />
                              <span>{downloadState.percent || 0}%</span>
                            </span>
                          ) : isDownloaded ? (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(48, 209, 88, 0.15)',
                              color: 'var(--system-success)',
                              border: '1px solid rgba(48, 209, 88, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <Check size={10} /> INSTALLED
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-tertiary)',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              NOT INSTALLED
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
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
                          <span>Speed: {model.speed}</span>
                          <span>•</span>
                          <span>{isDownloaded ? model.disk_size_label : model.size_label}</span>
                          <span>•</span>
                          <span>{model.vram}</span>
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
                        <div>
                          {model.id === selectedModel ? (
                            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--accent-bright-blue)' }}>
                              Current Selection
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedModel(model.id)}
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '10px' }}
                            >
                              Set as Default
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                              <Trash2 size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => downloadModel(model.id)}
                              disabled={isDownloading}
                              className="btn-primary"
                              style={{ padding: '3px 10px', fontSize: '10px', gap: '4px' }}
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
          )}

          {/* ========================================================================= */}
          {/* TAB 3: VOCAL SEPARATION MODELS                                          */}
          {/* ========================================================================= */}
          {activeTab === 'vocal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 113, 227, 0.05)',
                border: '1px solid rgba(0, 113, 227, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Music size={18} color="var(--accent-bright-blue)" />
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Meta AI Demucs neural networks isolate speech from background music, drums, and environmental noise.
                  Pre-caching models ensures instant audio vocal separation without download delays during editing.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vocalModelsData.map((vModel) => {
                  const isDownloaded = vModel.is_downloaded;
                  const isTaskTarget = activeInstallTask?.description?.includes(vModel.id);
                  const isDownloading = isTaskTarget && activeInstallTask?.status === 'running';

                  return (
                    <div
                      key={vModel.id}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: isDownloaded ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid var(--border-subtle)',
                        background: isDownloaded ? 'rgba(48, 209, 88, 0.02)' : 'var(--bg-surface)',
                        padding: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {vModel.name}
                          </span>
                          {vModel.recommended && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: '600',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(0, 113, 227, 0.18)',
                              color: 'var(--accent-bright-blue)'
                            }}>
                              RECOMMENDED
                            </span>
                          )}

                          {/* Status Badge */}
                          {isDownloaded ? (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(48, 209, 88, 0.15)',
                              color: 'var(--system-success)',
                              border: '1px solid rgba(48, 209, 88, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <Check size={10} /> INSTALLED ({vModel.disk_size_label})
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-tertiary)',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              NOT INSTALLED ({vModel.size_label})
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                          {vModel.description}
                        </p>

                        <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          <span>Inference Speed: <strong>{vModel.speed}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isDownloading ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--accent-bright-blue)' }}>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Downloading weights...</span>
                          </div>
                        ) : !isDownloaded ? (
                          <button
                            onClick={() => downloadVocalModel(vModel.id)}
                            disabled={activeInstallTask?.status === 'running'}
                            className="btn-primary"
                            style={{ padding: '5px 12px', fontSize: '11px', gap: '5px' }}
                          >
                            <Download size={11} />
                            <span>Pre-Download</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Delete cached weights for '${vModel.name}'?`)) {
                                deleteVocalModel(vModel.id);
                              }
                            }}
                            className="btn-ghost"
                            style={{ padding: '5px 8px', color: 'var(--system-error)', fontSize: '11px', gap: '4px' }}
                            title="Delete model weights"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: HARDWARE & TELEMETRY                                             */}
          {/* ========================================================================= */}
          {activeTab === 'hardware' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {/* CPU Card */}
                <div style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>CPU Cores</span>
                    <Cpu size={14} color="var(--accent-bright-blue)" />
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {systemStats?.cpu_threads || '...'} Logical Threads
                  </span>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, systemStats?.cpu_percent || 0)}%`,
                      background: 'var(--accent-bright-blue)',
                      borderRadius: 'var(--radius-pill)'
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    Current Utilization: {systemStats?.cpu_percent ?? 0}%
                  </span>
                </div>

                {/* RAM Card */}
                <div style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>System Memory</span>
                    <HardDrive size={14} color="var(--system-success)" />
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {systemStats?.ram_total_gb ? `${systemStats.ram_total_gb} GB` : '...'}
                  </span>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, systemStats?.ram_percent || 0)}%`,
                      background: 'var(--system-success)',
                      borderRadius: 'var(--radius-pill)'
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {systemStats?.ram_used_gb || 0} GB Used ({systemStats?.ram_percent || 0}%)
                  </span>
                </div>

                {/* GPU Card */}
                <div style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>GPU Accelerator</span>
                    <Zap size={14} color={systemStats?.gpu?.available ? 'var(--system-warning)' : 'var(--text-tertiary)'} />
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: systemStats?.gpu?.available ? 'var(--system-success)' : 'var(--text-primary)' }}>
                    {systemStats?.gpu?.name || 'CPU Mode'}
                  </span>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, systemStats?.gpu?.util_percent || 0)}%`,
                      background: 'var(--system-warning)',
                      borderRadius: 'var(--radius-pill)'
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {systemStats?.gpu?.available ? `${systemStats.gpu.util_percent}% Load • ${systemStats.gpu.used_mb}MB / ${systemStats.gpu.total_mb}MB VRAM` : 'No Hardware GPU detected'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LIVE IN-MODAL TERMINAL CONSOLE DRAWER                                   */}
          {/* ========================================================================= */}
          {activeInstallTask && (
            <div style={{
              marginTop: 'auto',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: '#0d0d0f',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Console Header */}
              <div style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={13} color="var(--accent-bright-blue)" />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {activeInstallTask.description}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-pill)',
                    background: activeInstallTask.status === 'completed' 
                      ? 'rgba(48, 209, 88, 0.2)' 
                      : activeInstallTask.status === 'failed'
                        ? 'rgba(255, 69, 58, 0.2)'
                        : 'rgba(0, 113, 227, 0.2)',
                    color: activeInstallTask.status === 'completed' 
                      ? 'var(--system-success)' 
                      : activeInstallTask.status === 'failed'
                        ? 'var(--system-error)'
                        : 'var(--accent-bright-blue)'
                  }}>
                    {activeInstallTask.status.toUpperCase()} ({activeInstallTask.percent}%)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {activeInstallTask.status === 'running' && (
                    <button
                      onClick={() => cancelDependencyTask(activeInstallTask.id)}
                      className="btn-ghost"
                      style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--system-error)', gap: '4px' }}
                    >
                      <StopCircle size={11} />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
                    className="btn-ghost"
                    style={{ padding: '2px 6px' }}
                  >
                    {isConsoleExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </button>
                </div>
              </div>

              {/* Collapsible Console Log Body */}
              {isConsoleExpanded && (
                <div style={{
                  padding: '10px 12px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  fontFamily: 'SF Mono, Consolas, Monaco, monospace',
                  fontSize: '10px',
                  lineHeight: '1.45',
                  color: '#cfcfcf',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  {(activeInstallTask.logs || []).map((logLine, idx) => (
                    <div key={idx} style={{ wordBreak: 'break-all', opacity: idx === (activeInstallTask.logs.length - 1) ? 1 : 0.8 }}>
                      {logLine}
                    </div>
                  ))}
                  <div ref={consoleLogsEndRef} />
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={13} color="var(--system-success)" />
            <span>AutoCaption Studio v2.0 • Python {dependenciesData?.python_version || '3.10+'}</span>
          </div>

          <button
            onClick={() => setSettingsModalOpen(false)}
            className="btn-primary"
            style={{ padding: '5px 18px', fontSize: '12px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
