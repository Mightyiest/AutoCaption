import React, { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { CaptionListEditor } from './components/CaptionListEditor';
import { StyleInspector } from './components/StyleInspector';
import { HorizontalTimeline } from './components/HorizontalTimeline';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { useEditorStore } from './store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export function App() {
  const { setBackendAvailable } = useEditorStore();
  const [timelineHeight, setTimelineHeight] = React.useState(160);
  const [isResizingTimeline, setIsResizingTimeline] = React.useState(false);

  useEffect(() => {
    // Check backend health
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => {
        if (res.ok) {
          setBackendAvailable(true);
        } else {
          setBackendAvailable(false);
        }
      })
      .catch(() => {
        setBackendAvailable(false);
      });
  }, [setBackendAvailable]);

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      userSelect: isResizingTimeline ? 'none' : 'auto'
    }}>
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Studio Middle Stage */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '320px 1fr 340px',
        gap: '12px',
        padding: '10px 12px 0 12px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(30, 58, 138, 0.15) 0%, rgba(11, 15, 23, 1) 70%)'
      }}>
        {/* Left Sidebar: Caption & Word Editor */}
        <div style={{ overflow: 'hidden', height: '100%' }}>
          <CaptionListEditor />
        </div>

        {/* Center: 9:16 Video Player & Preview Canvas */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          height: '100%'
        }}>
          <VideoPlayer />
        </div>

        {/* Right Sidebar: Style & Presets Inspector */}
        <div style={{ overflow: 'hidden', height: '100%' }}>
          <StyleInspector />
        </div>
      </div>

      {/* Horizontal Resizable Splitter Handle */}
      <div
        onMouseDown={handleTimelineResizeStart}
        style={{
          height: '8px',
          margin: '2px 0',
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 35,
          position: 'relative'
        }}
        title="Drag up/down to resize timeline height"
      >
        <div style={{
          width: '48px',
          height: '3px',
          borderRadius: '999px',
          background: isResizingTimeline ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)',
          boxShadow: isResizingTimeline ? '0 0 8px var(--accent-primary)' : 'none',
          transition: 'background 120ms ease'
        }} />
      </div>

      {/* Bottom Horizontal Timeline (Resizable) */}
      <div style={{
        height: `${timelineHeight}px`,
        padding: '0 12px 4px 12px',
        transition: isResizingTimeline ? 'none' : 'height 100ms ease'
      }}>
        <HorizontalTimeline />
      </div>

      {/* Bottom Live Hardware Monitor & Console Drawer */}
      <ConsoleDrawer />

      {/* Modals */}
      <UploadModal />
      <ExportModal />
    </div>
  );
}

export default App;
