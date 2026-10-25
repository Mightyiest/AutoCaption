import React from 'react';
import { 
  Layers, 
  Trash2, 
  Scissors, 
  ZoomIn, 
  ZoomOut, 
  Magnet, 
  Maximize2, 
  Undo2, 
  Redo2, 
  Navigation 
} from 'lucide-react';
import { formatTimecode } from '../engine/animator';

export const TimelineToolbar = ({
  currentTime = 0,
  totalDuration = 10,
  historyPast = [],
  historyFuture = [],
  selectedSegment = null,
  segmentsCount = 0,
  timelineSnapEnabled = true,
  followPlayhead = false,
  timelineZoom = 1.0,
  onUndo,
  onRedo,
  onSplitSelected,
  onDeleteSelected,
  onFocusSelected,
  onToggleSnap,
  onToggleFollowPlayhead,
  onZoomIn,
  onZoomOut,
  onZoomFit
}) => {
  return (
    <div style={{
      padding: '5px 12px',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg-panel)',
      fontSize: '11px',
      gap: '8px',
      flexWrap: 'wrap',
      flexShrink: 0
    }}>
      {/* Left: Title, Timecode & Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-primary)', fontWeight: '600' }}>
          <Layers size={13} color="var(--accent-primary)" />
          <span>Timeline</span>
        </div>

        {/* Prominent Timecode Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'var(--bg-surface)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontFamily: 'SF Mono, Menlo, monospace'
        }}>
          <span style={{ color: 'var(--accent-primary)', fontWeight: '700', fontSize: '11px' }}>
            {formatTimecode(currentTime)}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '11px' }}>
            {formatTimecode(totalDuration)}
          </span>
        </div>

        {/* Undo / Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginLeft: '4px' }}>
          <button
            onClick={onUndo}
            disabled={historyPast.length === 0}
            className="btn-ghost"
            style={{ padding: '2px 5px', opacity: historyPast.length === 0 ? 0.3 : 1 }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={11} />
          </button>
          <button
            onClick={onRedo}
            disabled={historyFuture.length === 0}
            className="btn-ghost"
            style={{ padding: '2px 5px', opacity: historyFuture.length === 0 ? 0.3 : 1 }}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={11} />
          </button>
        </div>
      </div>

      {/* Center: Selected Block Controls */}
      {selectedSegment ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-active)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600' }}>
            Selected: "{selectedSegment.text.slice(0, 18)}..."
          </span>
          <button
            onClick={onSplitSelected}
            className="btn-ghost"
            style={{ padding: '1px 4px', fontSize: '10px', height: '18px' }}
            title="Split at playhead (S)"
          >
            <Scissors size={10} /> Split
          </button>
          <button
            onClick={onDeleteSelected}
            className="btn-ghost"
            style={{ padding: '1px 4px', fontSize: '10px', height: '18px', color: 'var(--system-error)' }}
            title="Delete block (Del)"
          >
            <Trash2 size={10} /> Delete
          </button>
          <button
            onClick={onFocusSelected}
            className="btn-ghost"
            style={{ padding: '1px 4px', fontSize: '10px', height: '18px', color: 'var(--text-primary)' }}
            title="Zoom & focus block"
          >
            <Maximize2 size={10} /> Focus
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
          {segmentsCount} Captions
        </div>
      )}

      {/* Right: Snapping, Follow Playhead, & Zoom Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Snapping Toggle */}
        <button
          onClick={onToggleSnap}
          className="btn-ghost"
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            color: timelineSnapEnabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
            background: timelineSnapEnabled ? 'var(--bg-active)' : 'transparent'
          }}
          title={timelineSnapEnabled ? 'Snapping ON' : 'Snapping OFF'}
        >
          <Magnet size={11} /> Snap
        </button>

        {/* Follow Playhead Toggle */}
        <button
          onClick={onToggleFollowPlayhead}
          className="btn-ghost"
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            color: followPlayhead ? 'var(--system-success)' : 'var(--text-tertiary)',
            background: followPlayhead ? 'rgba(48, 209, 88, 0.12)' : 'transparent'
          }}
          title={followPlayhead ? 'Auto-Follow ON' : 'Auto-Follow OFF'}
        >
          <Navigation size={11} /> Follow
        </button>

        {/* Zoom Controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1px', 
          background: 'var(--bg-surface)', 
          padding: '1px 3px', 
          borderRadius: 'var(--radius-sm)', 
          border: '1px solid var(--border-subtle)' 
        }}>
          <button
            onClick={onZoomOut}
            disabled={timelineZoom <= 0.5}
            className="btn-ghost"
            style={{ padding: '1px 3px', height: '18px' }}
            title="Zoom Out"
          >
            <ZoomOut size={10} />
          </button>

          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            fontFamily: 'SF Mono, monospace', 
            minWidth: '28px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)' 
          }}>
            {timelineZoom.toFixed(1)}x
          </span>

          <button
            onClick={onZoomIn}
            disabled={timelineZoom >= 20.0}
            className="btn-ghost"
            style={{ padding: '1px 3px', height: '18px' }}
            title="Zoom In"
          >
            <ZoomIn size={10} />
          </button>

          <button
            onClick={onZoomFit}
            className="btn-ghost"
            style={{ padding: '1px 4px', height: '18px', fontSize: '10px', fontWeight: '600', color: 'var(--accent-primary)' }}
            title="Fit entire duration"
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
};
