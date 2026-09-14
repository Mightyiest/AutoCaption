import React, { useEffect } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { CaptionListEditor } from './components/CaptionListEditor';
import { StyleInspector } from './components/StyleInspector';
import { HorizontalTimeline } from './components/HorizontalTimeline';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { ProjectsHub } from './components/ProjectsHub';
import { ReplaceVideoModal } from './components/ReplaceVideoModal';
import { TranscribeModal } from './components/TranscribeModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { KeywordLibraryModal } from './components/KeywordLibraryModal';
import { VocalExtractorModal } from './components/VocalExtractorModal';
import { useEditorStore } from './store/useEditorStore';
import { useGlobalShortcuts } from './engine/useGlobalShortcuts';
import './App.css';

const BACKEND_URL = 'http://127.0.0.1:8000';

export function App() {
  useGlobalShortcuts();

  const { 
    currentView,
    setCurrentView,
    fetchProjectsList,
    setBackendAvailable, 
    fetchModelsStatus, 
    canvasLayout,
    registerVideoPickerTrigger,
    handleFileSelected,
    studioToast,
    hideStudioToast
  } = useEditorStore();
  const fileInputRef = React.useRef(null);
  const [timelineHeight, setTimelineHeight] = React.useState(160);
  const [isResizingTimeline, setIsResizingTimeline] = React.useState(false);

  // Sync route with URL hash (#projects vs #editor)
  useEffect(() => {
    fetchProjectsList();

    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#projects' || hash === '#hub') {
        setCurrentView('hub');
      } else if (hash === '#editor') {
        setCurrentView('editor');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [fetchProjectsList, setCurrentView]);

  useEffect(() => {
    registerVideoPickerTrigger(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    });
  }, [registerVideoPickerTrigger]);

  useEffect(() => {
    // Check backend health and fetch model cache status
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => {
        if (res.ok) {
          setBackendAvailable(true);
          fetchModelsStatus();
        } else {
          setBackendAvailable(false);
        }
      })
      .catch(() => {
        setBackendAvailable(false);
      });
  }, [setBackendAvailable, fetchModelsStatus]);

  // Draggable timeline height resize handler
  const handleTimelineResizeStart = (e) => {
    e.preventDefault();
    setIsResizingTimeline(true);

    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY; // moving up increases height
      const newHeight = Math.max(90, Math.min(420, startHeight + deltaY));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const layoutClass = `layout-${canvasLayout || 'right'}`;

  if (currentView === 'hub') {
    return (
      <div className="app-container" style={{ overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ProjectsHub />
        <SettingsModal />
        <HelpModal />
      </div>
    );
  }

  return (
    <div
      className="app-container"
      style={{ userSelect: isResizingTimeline ? 'none' : 'auto' }}
    >
      {/* 48px Translucent Apple Glass Header */}
      <Navbar />

      {/* Main Studio 3-Column Grid Stage */}
      <main className={`studio-grid ${layoutClass}`}>
        {canvasLayout === 'left' && (
          <>
            {/* Left: Video Player & Preview Canvas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', height: '100%', position: 'relative' }}>
              <VideoPlayer />
            </div>
            {/* Center: Caption & Word Editor */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <CaptionListEditor />
            </div>
            {/* Right: Style & Presets Inspector */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <StyleInspector />
            </div>
          </>
        )}

        {canvasLayout === 'center' && (
          <>
            {/* Left: Caption & Word Editor */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <CaptionListEditor />
            </div>
            {/* Center: Video Player & Preview Canvas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', height: '100%', position: 'relative' }}>
              <VideoPlayer />
            </div>
            {/* Right: Style & Presets Inspector */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <StyleInspector />
            </div>
          </>
        )}

        {(!canvasLayout || canvasLayout === 'right') && (
          <>
            {/* Left: Caption & Word Editor */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <CaptionListEditor />
            </div>
            {/* Center: Style & Presets Inspector */}
            <div style={{ overflow: 'hidden', height: '100%' }}>
              <StyleInspector />
            </div>
            {/* Right: Dedicated Video Player & Preview Canvas Tower */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', height: '100%', position: 'relative' }}>
              <VideoPlayer />
            </div>
          </>
        )}
      </main>

      {/* Draggable Resizer Splitter Thumb */}
      <div 
        className={`timeline-splitter ${isResizingTimeline ? 'is-resizing' : ''}`}
        onMouseDown={handleTimelineResizeStart}
        title="Drag up/down to resize timeline"
      >
        <div className="timeline-splitter-thumb" />
      </div>

      {/* Bottom Docked Multi-Track Timeline */}
      <section 
        className="timeline-container"
        style={{
          height: `${timelineHeight}px`,
          transition: isResizingTimeline ? 'none' : 'height 100ms ease'
        }}
      >
        <HorizontalTimeline />
      </section>

      {/* Bottom Live Hardware Monitor & Console Drawer */}
      <ConsoleDrawer />

      {/* Hidden Global Video Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelected(file);
          }
          e.target.value = '';
        }}
      />

      {/* Studio Sheets / Modals */}
      <ReplaceVideoModal />
      <TranscribeModal />
      <ExportModal />
      <SettingsModal />
      <HelpModal />
      <KeywordLibraryModal />
      <VocalExtractorModal />

      {/* Apple Studio Global Toast Notification */}
      {studioToast && (
        <div
          onClick={hideStudioToast}
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(18, 20, 26, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: studioToast.type === 'warning'
              ? '1px solid rgba(255, 153, 0, 0.45)'
              : studioToast.type === 'error'
              ? '1px solid rgba(255, 59, 48, 0.45)'
              : '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            borderRadius: '999px',
            padding: '10px 20px',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            cursor: 'pointer',
            maxWidth: '90vw'
          }}
        >
          {studioToast.type === 'warning' ? (
            <AlertTriangle size={16} color="#FF9900" />
          ) : (
            <Sparkles size={16} color="var(--accent-primary)" />
          )}
          <span>{studioToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
