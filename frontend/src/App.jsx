import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { CaptionListEditor } from './components/CaptionListEditor';
import { StyleInspector } from './components/StyleInspector';
import { HorizontalTimeline } from './components/HorizontalTimeline';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { UploadModal } from './components/UploadModal';
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

  const { setBackendAvailable, fetchModelsStatus, canvasLayout } = useEditorStore();
  const [timelineHeight, setTimelineHeight] = React.useState(160);
  const [isResizingTimeline, setIsResizingTimeline] = React.useState(false);

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

      {/* Studio Sheets / Modals */}
      <UploadModal />
      <TranscribeModal />
      <ExportModal />
      <SettingsModal />
      <HelpModal />
      <KeywordLibraryModal />
      <VocalExtractorModal />
    </div>
  );
}

export default App;
