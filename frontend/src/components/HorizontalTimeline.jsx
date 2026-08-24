import React, { useRef, useState, useEffect } from 'react';
import { 
  Layers, 
  Trash2, 
  Scissors, 
  Clock, 
  GripHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTimecode } from '../engine/animator';

export const HorizontalTimeline = () => {
  const timelineRef = useRef(null);

  const {
    duration,
    currentTime,
    seekTo,
    segments,
    selectedSegmentId,
    setSelectedSegmentId,
    deleteSegment,
    moveSegment,
    trimSegmentStart,
    trimSegmentEnd,
    splitSegmentAtPlayhead
  } = useEditorStore();

  const totalDuration = Math.max(1.0, duration || 10.0);

  // Keyboard shortcut listener (Delete key to remove selected segment, S to split)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSegmentId) {
          e.preventDefault();
          deleteSegment(selectedSegmentId);
        }
      } else if (e.key.toLowerCase() === 's') {
        if (selectedSegmentId) {
          e.preventDefault();
          splitSegmentAtPlayhead(selectedSegmentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSegmentId, deleteSegment, splitSegmentAtPlayhead]);

  // Timeline click or drag to seek with RAF smoothing
  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const trackPad = 16;
    const clickX = e.clientX - rect.left - trackPad;
    const availableW = Math.max(1, rect.width - trackPad * 2);
    const percentage = Math.max(0, Math.min(1, clickX / availableW));
    seekTo(percentage * totalDuration);
  };

  // Drag red playhead smoothly
  const handleDragPlayhead = (e) => {
    e.preventDefault();
    e.stopPropagation();

    let rafId = null;
    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const trackPad = 16;
        const clickX = moveEvent.clientX - rect.left - trackPad;
        const availableW = Math.max(1, rect.width - trackPad * 2);
        const percentage = Math.max(0, Math.min(1, clickX / availableW));
        seekTo(percentage * totalDuration);
      });
    };

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Drag to move entire subtitle block
  const handleStartMoveSegment = (e, seg) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSegmentId(seg.id);
    seekTo(seg.start);

    const startX = e.clientX;
    const initialStart = seg.start;
    const initialEnd = seg.end;
    const segDur = initialEnd - initialStart;
    let rafId = null;

    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const trackPad = 16;
        const availableW = Math.max(1, rect.width - trackPad * 2);
        const deltaX = moveEvent.clientX - startX;
        const deltaSeconds = (deltaX / availableW) * totalDuration;
        
        const newStart = Math.max(0, Math.min(totalDuration - segDur, initialStart + deltaSeconds));
        moveSegment(seg.id, newStart - seg.start);
        seekTo(newStart);
      });
    };

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Drag Left Edge to Trim Start
  const handleStartTrimLeft = (e, seg) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSegmentId(seg.id);

    let rafId = null;
    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const trackPad = 16;
        const availableW = Math.max(1, rect.width - trackPad * 2);
        const clickX = moveEvent.clientX - rect.left - trackPad;
        const newTime = Math.max(0, (clickX / availableW) * totalDuration);
        trimSegmentStart(seg.id, newTime);
        seekTo(newTime);
      });
    };

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Drag Right Edge to Trim End
  const handleStartTrimRight = (e, seg) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSegmentId(seg.id);

    let rafId = null;
    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const trackPad = 16;
        const availableW = Math.max(1, rect.width - trackPad * 2);
        const clickX = moveEvent.clientX - rect.left - trackPad;
        const newTime = Math.min(totalDuration, (clickX / availableW) * totalDuration);
        trimSegmentEnd(seg.id, newTime);
        seekTo(newTime);
      });
    };

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Generate tick marks
  const getTicks = () => {
    const ticks = [];
    const step = totalDuration <= 10 ? 1 : totalDuration <= 30 ? 2 : totalDuration <= 90 ? 5 : 10;
    for (let t = 0; t <= totalDuration; t += step) {
      ticks.push(t);
    }
    return ticks;
  };

  const playheadPercent = (currentTime / totalDuration) * 100;
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  return (
    <div className="glass-panel" style={{
      height: '100%',
      borderRadius: '14px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Timeline Controls Header */}
      <div style={{
        padding: '5px 14px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.3)',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-primary)', fontWeight: '800' }}>
            <Layers size={13} />
            <span>Timeline</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', color: '#FFF' }}>
            <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{formatTimecode(currentTime)}</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-muted)' }}>{formatTimecode(totalDuration)}</span>
          </div>
        </div>

        {/* Selected Segment Quick Action Bar */}
        {selectedSegment && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.15)',
            padding: '2px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: '700' }}>
              Selected: "{selectedSegment.text.slice(0, 16)}..."
            </span>
            <button
              onClick={() => splitSegmentAtPlayhead(selectedSegment.id)}
              style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
              title="Split selected block at playhead (Shortcut: S)"
            >
              <Scissors size={11} /> Split
            </button>
            <button
              onClick={() => deleteSegment(selectedSegment.id)}
              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}
              title="Delete selected block (Shortcut: Del)"
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        )}

        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {segments.length} Blocks • Click block to edit / drag to reposition
        </div>
      </div>

      {/* Multi-Track Interactive Area */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        style={{
          flex: 1,
          position: 'relative',
          padding: '0 16px',
          background: 'rgba(15, 23, 42, 0.6)',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around'
        }}
      >
        {/* Time Ruler */}
        <div style={{
          position: 'relative',
          height: '18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'none'
        }}>
          {getTicks().map((t) => {
            const leftPercent = (t / totalDuration) * 100;
            return (
              <div
                key={t}
                style={{
                  position: 'absolute',
                  left: `${leftPercent}%`,
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#64748B' }}>
                  {formatTimecode(t).slice(0, 5)}
                </span>
                <div style={{ width: '1px', height: '4px', background: 'rgba(255,255,255,0.2)' }} />
              </div>
            );
          })}
        </div>

        {/* Video Track */}
        <div style={{
          height: '24px',
          borderRadius: '5px',
          background: 'linear-gradient(90deg, #1E293B 0%, #334155 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          fontSize: '9px',
          fontWeight: '700',
          color: 'var(--text-muted)',
          userSelect: 'none'
        }}>
          🎬 Video Track
        </div>

        {/* Subtitle / Caption Track */}
        <div style={{
          height: '38px',
          borderRadius: '6px',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative'
        }}>
          {segments.map((seg) => {
            const left = (seg.start / totalDuration) * 100;
            const width = Math.max(1.8, ((seg.end - seg.start) / totalDuration) * 100);
            const isSelected = selectedSegmentId === seg.id;
            const isActive = currentTime >= seg.start && currentTime <= seg.end;

            return (
              <div
                key={seg.id}
                onMouseDown={(e) => handleStartMoveSegment(e, seg)}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: '2px',
                  bottom: '2px',
                  borderRadius: '5px',
                  background: isSelected 
                    ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' 
                    : isActive 
                    ? 'rgba(56, 189, 248, 0.45)' 
                    : 'rgba(56, 189, 248, 0.2)',
                  border: isSelected 
                    ? '2px solid #FFFFFF' 
                    : isActive 
                    ? '1.5px solid rgba(56, 189, 248, 0.8)' 
                    : '1px solid rgba(56, 189, 248, 0.4)',
                  color: isSelected || isActive ? '#FFFFFF' : 'var(--text-main)',
                  boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.8)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 4px',
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'grab',
                  zIndex: isSelected ? 15 : 5,
                  userSelect: 'none',
                  overflow: 'hidden'
                }}
                title={`Drag to reposition • [${formatTimecode(seg.start)} - ${formatTimecode(seg.end)}]`}
              >
                {/* Left Trim Handle */}
                <div
                  onMouseDown={(e) => handleStartTrimLeft(e, seg)}
                  style={{
                    width: '6px',
                    height: '100%',
                    cursor: 'ew-resize',
                    background: isSelected ? 'rgba(255,255,255,0.4)' : 'transparent',
                    borderRadius: '2px 0 0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Trim start time"
                />

                {/* Block Text */}
                <span style={{
                  flex: 1,
                  textAlign: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  padding: '0 2px'
                }}>
                  {seg.text}
                </span>

                {/* Right Trim Handle */}
                <div
                  onMouseDown={(e) => handleStartTrimRight(e, seg)}
                  style={{
                    width: '6px',
                    height: '100%',
                    cursor: 'ew-resize',
                    background: isSelected ? 'rgba(255,255,255,0.4)' : 'transparent',
                    borderRadius: '0 2px 2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Trim end time"
                />
              </div>
            );
          })}
        </div>

        {/* Vertical Red Playhead */}
        <div
          onMouseDown={handleDragPlayhead}
          style={{
            position: 'absolute',
            left: `${playheadPercent}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: '#EF4444',
            zIndex: 30,
            cursor: 'ew-resize',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto'
          }}
        >
          {/* Top Marker */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '12px',
            height: '14px',
            background: '#EF4444',
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.9)'
          }} />
        </div>
      </div>
    </div>
  );
};
