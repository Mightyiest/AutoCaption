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
  Mic,
  Sun,
  Moon,
  Folder,
  Link2,
  FolderOpen
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
    triggerVideoPicker,
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
    removePunctuation,
    theme,
    toggleTheme,
    // Projects & Media Linking
    setCurrentView,
    activeProjectTitle,
    renameCurrentProject,
    saveStatus,
    isMediaLinked,
    linkedSourcePath,
    mediaOffline
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
      triggerVideoPicker();
      return;
    }
    setTranscribeModalOpen(true);
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const titleInputRef = useRef(null);

  const startRename = () => {
    setTempTitle(activeProjectTitle || 'Untitled Project');
    setIsEditingTitle(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);
  };

  const handleTitleCommit = () => {
    setIsEditingTitle(false);
    if (tempTitle && tempTitle.trim() && tempTitle.trim() !== activeProjectTitle) {
      renameCurrentProject(tempTitle.trim());
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleCommit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
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
      backgroundColor: 'var(--glass-bg)',
      backdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      userSelect: 'none',
      zIndex: 50
    }}>
      {/* Left section: App Brand & Project Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setCurrentView('hub')}
          className="btn-secondary"
          style={{
            padding: '5px 11px',
            borderRadius: 'var(--radius-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
          title="Return to Projects Hub"
        >
          <Folder size={13} />
          <span style={{ fontSize: '11.5px', fontWeight: 600 }}>Projects</span>
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Project Title with Apple inline click-to-rename */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleCommit}
            onKeyDown={handleTitleKeyDown}
            style={{
              fontSize: '13px',
              fontWeight: '600',
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--btn-primary-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              outline: 'none',
              width: '180px',
              height: '24px'
            }}
          />
        ) : (
          <div 
            onClick={startRename}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'background var(--transition-fast)'
            }}
            title="Click to rename project"
          >
            <span style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              maxWidth: '180px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {activeProjectTitle || 'Untitled Project'}
            </span>
            <span style={{
              fontSize: '9.5px',
              fontWeight: '600',
              color: saveStatus === 'saving' ? 'var(--system-warning)' : 'var(--system-success)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              ● {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          </div>
        )}

        {isMediaLinked && (
          <span 
            style={{ 
              fontSize: '10px', 
              fontWeight: '600', 
              padding: '2px 7px', 
              borderRadius: 'var(--radius-pill)', 
              background: 'var(--bg-surface)', 
              border: '1px solid var(--border-subtle)',
              color: mediaOffline ? 'var(--system-error)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={`Video File: ${linkedSourcePath || ''}`}
          >
            <Link2 size={11} />
            <span>{mediaOffline ? 'Offline' : 'Linked Video'}</span>
          </span>
        )}
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
            color: showSafeZones ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderColor: showSafeZones ? 'var(--accent-primary)' : 'var(--border-subtle)',
            backgroundColor: showSafeZones ? 'var(--bg-active)' : 'var(--btn-secondary-bg)'
          }}
          title="Toggle Social UI Safe Zones Overlay"
        >
          {showSafeZones ? <Eye size={12} color="var(--accent-primary)" /> : <EyeOff size={12} />}
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
              backgroundColor: modelDropdownOpen ? 'var(--bg-surface-hover)' : 'var(--btn-secondary-bg)',
              borderColor: modelDropdownOpen ? 'var(--border-hover)' : 'var(--border-subtle)'
            }}
            title="Select Whisper AI Speech Model"
          >
            <Cpu size={12} color="var(--text-secondary)" />
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
                        background: isSelected ? 'var(--accent-blue-subtle)' : 'transparent',
                        borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
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
                              background: 'var(--border-subtle)', 
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
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--btn-secondary-bg)'
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
              <Sparkles size={12} color="var(--accent-primary)" />
              <span>Auto-Caption</span>
            </>
          )}
        </button>
      </div>

      {/* Right Action CTAs: Theme Toggle, Help, Settings, Demo, Upload, Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={toggleTheme}
          className="btn-secondary"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{ padding: '5px 8px', fontSize: '11px' }}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={12} color="var(--text-primary)" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon size={12} color="var(--text-secondary)" />
              <span>Dark</span>
            </>
          )}
        </button>

        <button
          onClick={() => setHelpModalOpen(true)}
          className="btn-secondary"
          title="Studio Guide & Keyboard Shortcuts (?)"
          style={{ padding: '5px 8px', fontSize: '11px' }}
        >
          <HelpCircle size={12} color="var(--text-secondary)" />
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
            fontSize: '11px'
          }}
        >
          <Mic size={12} color="#E11D48" />
          <span>Vocal Extractor</span>
        </button>

        <button
          onClick={triggerVideoPicker}
          className="btn-secondary"
          style={{ padding: '5px 10px', fontSize: '11px' }}
          title="Import or replace video footage"
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
