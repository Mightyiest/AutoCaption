import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  Download, 
  Smartphone, 
  Square, 
  Tv, 
  Eye, 
  EyeOff, 
  RotateCcw,
  Film,
  Loader2,
  Settings,
  Cpu,
  ChevronDown,
  Check,
  HelpCircle,
  PanelLeft,
  PanelRight,
  Columns,
  Mic
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

const MODEL_LABELS = {
  'tiny': { name: 'Tiny', speed: '32x Speed', size: '~75 MB' },
  'base': { name: 'Base (Default)', speed: '16x Speed', size: '~145 MB' },
  'small': { name: 'Small', speed: '6x Speed', size: '~480 MB' },
  'medium': { name: 'Medium', speed: '2x Speed', size: '~1.5 GB' },
  'large-v3-turbo': { name: 'Large v3 Turbo', speed: '8x Speed', size: '~1.6 GB' },
  'large-v3': { name: 'Large v3', speed: '1x Speed', size: '~3.1 GB' }
};

export const Navbar = () => {
  const {
    backendAvailable,
    aspectRatio,
    setAspectRatio,
    canvasLayout,
    setCanvasLayout,
    showSafeZones,
    toggleSafeZones,
    setUploadModalOpen,
    setTranscribeModalOpen,
    setExportModalOpen,
    setSettingsModalOpen,
    setHelpModalOpen,
    setVocalExtractorOpen,
    loadDemoData,
    isTranscribing,
    setIsTranscribing,
    videoFile,
    videoFilename,
    setSegments,
    style,
    selectedModel,
    setSelectedModel,
    modelsData,
    fetchModelsStatus,
    ensureModelDownloaded,
    removePunctuation
  } = useEditorStore();

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchModelsStatus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickTranscribe = () => {
    if (isTranscribing) return;
    if (!videoFile && !videoFilename) {
      setUploadModalOpen(true);
      return;
    }
    setTranscribeModalOpen(true);
  };

  const currentModelInfo = modelsData?.models?.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: MODEL_LABELS[selectedModel]?.name || selectedModel,
    is_downloaded: true,
    size_label: MODEL_LABELS[selectedModel]?.size || ''
  };

  return (
    <header style={{
      height: '48px',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(22, 22, 24, 0.85)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      zIndex: 50,
      userSelect: 'none'
    }}>
      {/* Brand Logo & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ 
          width: '28px', 
          height: '28px', 
          borderRadius: '7px', 
          background: 'var(--accent-primary)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0, 113, 227, 0.35)'
        }}>
          <Film size={15} color="#FFFFFF" strokeWidth={2.2} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)'
          }}>
            AutoCaption
          </span>
          <span style={{ 
            fontSize: '9px', 
            fontWeight: '600', 
            letterSpacing: '0.04em',
            padding: '1px 5px', 
            borderRadius: '4px', 
            background: 'rgba(255, 255, 255, 0.08)', 
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)'
          }}>
            PRO
          </span>
        </div>
      </div>

      {/* Center Controls: Segmented Aspect Ratio, Safe Zones, Model Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* macOS Segmented Aspect Ratio Picker */}
        <div className="segmented-control">
          <button
            onClick={() => setAspectRatio('9:16')}
            className={`segmented-control-item ${aspectRatio === '9:16' ? 'active' : ''}`}
            title="9:16 Vertical (TikTok / Reels / Shorts)"
          >
            <Smartphone size={12} />
            <span>9:16</span>
          </button>
          <button
            onClick={() => setAspectRatio('1:1')}
            className={`segmented-control-item ${aspectRatio === '1:1' ? 'active' : ''}`}
            title="1:1 Square Feed"
          >
            <Square size={12} />
            <span>1:1</span>
          </button>
          <button
            onClick={() => setAspectRatio('16:9')}
            className={`segmented-control-item ${aspectRatio === '16:9' ? 'active' : ''}`}
            title="16:9 Standard Landscape"
          >
            <Tv size={12} />
            <span>16:9</span>
          </button>
        </div>

        {/* Layout Switcher (Canvas on Right / Center / Left) */}
        <div className="segmented-control" title="Canvas Stage Layout Position">
          <button
            onClick={() => setCanvasLayout('left')}
            className={`segmented-control-item ${canvasLayout === 'left' ? 'active' : ''}`}
            title="Canvas on Left (Stage First)"
          >
            <PanelLeft size={12} />
            <span>Left</span>
          </button>
          <button
            onClick={() => setCanvasLayout('center')}
            className={`segmented-control-item ${canvasLayout === 'center' ? 'active' : ''}`}
            title="Canvas in Center (Classic 3-Column)"
          >
            <Columns size={12} />
            <span>Center</span>
          </button>
          <button
            onClick={() => setCanvasLayout('right')}
            className={`segmented-control-item ${(!canvasLayout || canvasLayout === 'right') ? 'active' : ''}`}
            title="Canvas on Right (9:16 Dedicated Tower)"
          >
            <PanelRight size={12} />
            <span>Right</span>
          </button>
        </div>

        {/* Safe Zones Toggle */}
        <button
          onClick={toggleSafeZones}
          className="btn-secondary"
          style={{ 
            padding: '5px 9px',
            color: showSafeZones ? 'var(--text-primary)' : 'var(--text-tertiary)',
            backgroundColor: showSafeZones ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)'
          }}
          title="Toggle Social UI Safe Zones Overlay"
        >
          {showSafeZones ? <Eye size={12} color="var(--accent-bright-blue)" /> : <EyeOff size={12} />}
          <span style={{ fontSize: '11px' }}>Safe Zones</span>
        </button>

        {/* Whisper AI Model Selector Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="btn-secondary"
            style={{
              padding: '5px 9px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: modelDropdownOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: modelDropdownOpen ? 'var(--accent-primary)' : 'var(--border-subtle)'
            }}
            title="Select Whisper AI Speech Model"
          >
            <Cpu size={12} color="var(--accent-bright-blue)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Model: <strong style={{ color: 'var(--text-primary)' }}>{currentModelInfo.name}</strong>
            </span>
            <span 
              style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: currentModelInfo.is_downloaded ? 'var(--system-success)' : 'var(--system-warning)' 
              }} 
              title={currentModelInfo.is_downloaded ? 'Model Cached Locally' : 'Needs Download'}
            />
            <ChevronDown 
              size={11} 
              style={{ 
                transform: modelDropdownOpen ? 'rotate(180deg)' : 'none', 
                transition: 'transform 120ms ease',
                color: 'var(--text-tertiary)'
              }} 
            />
          </button>

          {modelDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '290px',
              backgroundColor: 'var(--bg-surface-elevated)',
              backdropFilter: 'saturate(180%) blur(20px)',
              border: '1px solid var(--border-hover)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-popover)',
              padding: '8px',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '4px 6px 6px 6px', 
                borderBottom: '1px solid var(--border-subtle)' 
              }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Whisper Models
                </span>
                <button
                  onClick={() => {
                    setModelDropdownOpen(false);
                    setSettingsModalOpen(true);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--accent-bright-blue)' }}
                >
                  <Settings size={11} />
                  <span>Manage</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '260px', overflowY: 'auto' }}>
                {Object.keys(MODEL_LABELS).map((mid) => {
                  const mInfo = modelsData?.models?.find(m => m.id === mid) || {
                    id: mid,
                    name: MODEL_LABELS[mid].name,
                    is_downloaded: mid === 'base',
                    size_label: MODEL_LABELS[mid].size,
                    speed: MODEL_LABELS[mid].speed
                  };
                  const isSelected = selectedModel === mid;
                  const isDownloaded = mInfo.is_downloaded;

                  return (
                    <button
                      key={mid}
                      onClick={() => {
                        setSelectedModel(mid);
                        setModelDropdownOpen(false);
                      }}
                      style={{
                        padding: '7px 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid transparent',
                        background: isSelected ? 'rgba(0, 113, 227, 0.18)' : 'transparent',
                        borderColor: isSelected ? 'rgba(0, 113, 227, 0.4)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: isSelected ? '600' : '500', 
                            color: isSelected ? 'var(--accent-bright-blue)' : 'var(--text-primary)' 
                          }}>
                            {MODEL_LABELS[mid].name}
                          </span>
                          {mid === 'base' && (
                            <span style={{ 
                              fontSize: '8px', 
                              fontWeight: '600', 
                              padding: '1px 4px', 
                              borderRadius: '3px', 
                              background: 'rgba(255, 255, 255, 0.08)', 
                              color: 'var(--text-secondary)' 
                            }}>
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {mInfo.speed || MODEL_LABELS[mid].speed} • {mInfo.size_label || MODEL_LABELS[mid].size}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isDownloaded ? (
                          <span style={{ fontSize: '9px', fontWeight: '500', color: 'var(--system-success)' }}>
                            Ready
                          </span>
                        ) : (
                          <span style={{ fontSize: '9px', fontWeight: '500', color: 'var(--text-tertiary)' }}>
                            {mInfo.size_label || MODEL_LABELS[mid].size}
                          </span>
                        )}
                        {isSelected && <Check size={13} color="var(--accent-bright-blue)" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Auto-Caption Button */}
        <button
          onClick={handleQuickTranscribe}
          className="btn-secondary"
          disabled={isTranscribing}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            backgroundColor: 'rgba(0, 113, 227, 0.12)',
            borderColor: 'rgba(0, 113, 227, 0.35)',
            color: 'var(--accent-bright-blue)'
          }}
          title="Run speech-to-text with selected AI model"
        >
          {isTranscribing ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Transcribing...</span>
            </>
          ) : (
            <>
              <Sparkles size={12} />
              <span>Auto-Caption</span>
            </>
          )}
        </button>
      </div>

      {/* Right Action CTAs: Help, Settings, Demo, Upload, Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={() => setHelpModalOpen(true)}
          className="btn-secondary"
          title="Studio Guide & Keyboard Shortcuts (?)"
          style={{ padding: '5px 8px', fontSize: '11px' }}
        >
          <HelpCircle size={12} color="var(--accent-bright-blue)" />
          <span>Help</span>
        </button>

        <button
          onClick={() => setSettingsModalOpen(true)}
          className="btn-secondary"
          title="Studio Settings & Models"
          style={{ padding: '5px 10px', fontSize: '11px' }}
        >
          <Settings size={12} />
          <span>Settings</span>
        </button>

        <button
          onClick={loadDemoData}
          className="btn-secondary"
          title="Load Sample Demo Video"
          style={{ padding: '5px 10px', fontSize: '11px' }}
        >
          <RotateCcw size={12} />
          <span>Demo</span>
        </button>

        <button
          onClick={() => setVocalExtractorOpen(true)}
          className="btn-secondary"
          title="Extract & Isolate Vocals from Background Music"
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.12), rgba(88, 86, 214, 0.12))',
            borderColor: 'rgba(255, 45, 85, 0.35)',
            color: '#FF2D55'
          }}
        >
          <Mic size={12} color="#FF2D55" />
          <span>Vocal Extractor</span>
        </button>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="btn-secondary"
          style={{ padding: '5px 10px', fontSize: '11px' }}
        >
          <Upload size={12} />
          <span>Upload</span>
        </button>

        <button
          onClick={() => setExportModalOpen(true)}
          className="btn-primary"
          style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600' }}
        >
          <Download size={13} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
