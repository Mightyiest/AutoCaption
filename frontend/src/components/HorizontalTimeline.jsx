import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTimecode } from '../engine/animator';
import { 
  getPixelsPerSecond, 
  snapTime, 
  calculateRulerTicks,
  formatAdaptiveTimecode
} from '../engine/timelineGeometry';
import { AudioWaveformTrack } from './AudioWaveformTrack';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineTrackHeaders } from './TimelineTrackHeaders';

const TRACK_PADDING = 16; // Exact subpixel track margin in pixels

export const HorizontalTimeline = () => {
  const scrollContainerRef = useRef(null);
  const trackContainerRef = useRef(null);

  const {
    duration,
    currentTime,
    videoFps,
    segments,
    selectedSegmentId,
    timelineZoom,
    timelineSnapEnabled,
    followPlayhead,
    historyPast,
    historyFuture,
    isMuted,
    setTimelineZoom,
    toggleTimelineSnap,
    toggleFollowPlayhead,
    seekTo,
    setSelectedSegmentId,
    setSelectedWordId,
    moveSegment,
    trimSegmentStart,
    trimSegmentEnd,
    splitSegmentAtPlayhead,
    deleteSegment,
    pushHistoryState,
    undo,
    redo,
    setIsMuted
  } = useEditorStore();

  const totalDuration = Math.max(0.1, duration || 14.52);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [dragState, setDragState] = useState(null);

  // Measure container viewport width for fit calculations
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setViewportWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pps = getPixelsPerSecond({
    duration: totalDuration,
    viewportWidth: viewportWidth - TRACK_PADDING * 2,
    zoom: timelineZoom,
    minPps: 12
  });

  const contentWidth = Math.max(viewportWidth, totalDuration * pps + TRACK_PADDING * 2);
  const { ticks, step } = calculateRulerTicks(totalDuration, pps);

  // Auto-follow playhead during playback
  useEffect(() => {
    if (!followPlayhead || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const playheadPx = TRACK_PADDING + (currentTime * pps);
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    if (playheadPx < viewLeft + 60 || playheadPx > viewRight - 60) {
      container.scrollLeft = Math.max(0, playheadPx - container.clientWidth * 0.3);
    }
  }, [currentTime, followPlayhead, pps]);

  // Non-passive Wheel zoom (Ctrl + Wheel) on timeline
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 0.83;
        setTimelineZoom(timelineZoom * factor);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [timelineZoom, setTimelineZoom]);

  // Ruler pointer down -> Scrub playhead
  const handleRulerPointerDown = (e) => {
    if (e.button !== 0 || !trackContainerRef.current) return;
    e.preventDefault();

    const rect = trackContainerRef.current.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      const rawX = moveEvent.clientX - rect.left - TRACK_PADDING;
      let targetTime = Math.max(0, Math.min(totalDuration, rawX / pps));

      if (timelineSnapEnabled) {
        targetTime = snapTime({ targetTime, currentTime, segments, fps: videoFps || 30, enabled: true });
      }

      seekTo(Math.max(0, Math.min(totalDuration, targetTime)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    handleMove(e);
  };

  // Playhead needle scrub handler
  const handlePlayheadPointerDown = (e) => {
    if (e.button !== 0 || !trackContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = trackContainerRef.current.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      const rawX = moveEvent.clientX - rect.left - TRACK_PADDING;
      let targetTime = Math.max(0, Math.min(totalDuration, rawX / pps));

      if (timelineSnapEnabled) {
        targetTime = snapTime({ targetTime, currentTime, segments, fps: videoFps || 30, enabled: true });
      }

      seekTo(Math.max(0, Math.min(totalDuration, targetTime)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // Segment Block Pointer Down -> Drag/Move
  const handleSegmentPointerDown = (e, seg) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedSegmentId(seg.id);
    setSelectedWordId(null);
    pushHistoryState();

    setDragState({
      type: 'move',
      segmentId: seg.id,
      initialStart: seg.start,
      initialEnd: seg.end,
      startX: e.clientX
    });
  };

  // Trim Left Handle Pointer Down
  const handleTrimLeftPointerDown = (e, seg) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedSegmentId(seg.id);
    pushHistoryState();

    setDragState({
      type: 'trim_left',
      segmentId: seg.id,
      initialStart: seg.start,
      initialEnd: seg.end,
      startX: e.clientX
    });
  };

  // Trim Right Handle Pointer Down
  const handleTrimRightPointerDown = (e, seg) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedSegmentId(seg.id);
    pushHistoryState();

    setDragState({
      type: 'trim_right',
      segmentId: seg.id,
      initialStart: seg.start,
      initialEnd: seg.end,
      startX: e.clientX
    });
  };

  // Global Pointer Move & Up handlers for dragging
  const handlePointerMove = (e) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaSeconds = deltaX / pps;
    const targetSeg = segments.find(s => s.id === dragState.segmentId);
    if (!targetSeg) return;

    if (dragState.type === 'move') {
      let newStart = Math.max(0, dragState.initialStart + deltaSeconds);
      if (timelineSnapEnabled) {
        newStart = snapTime({
          targetTime: newStart,
          currentTime,
          segments,
          ignoreSegmentId: targetSeg.id,
          enabled: true
        });
      }
      moveSegment(targetSeg.id, newStart - targetSeg.start);
    } else if (dragState.type === 'trim_left') {
      let newStart = Math.max(0, dragState.initialStart + deltaSeconds);
      if (timelineSnapEnabled) {
        newStart = snapTime({
          targetTime: newStart,
          currentTime,
          segments,
          ignoreSegmentId: targetSeg.id,
          enabled: true
        });
      }
      trimSegmentStart(targetSeg.id, newStart);
    } else if (dragState.type === 'trim_right') {
      let newEnd = Math.min(totalDuration, dragState.initialEnd + deltaSeconds);
      if (timelineSnapEnabled) {
        newEnd = snapTime({
          targetTime: newEnd,
          currentTime,
          segments,
          ignoreSegmentId: targetSeg.id,
          enabled: true
        });
      }
      trimSegmentEnd(targetSeg.id, newEnd);
    }
  };

  const handlePointerUp = () => {
    if (!dragState) return;
    setDragState(null);
  };

  const handleZoomFit = () => {
    if (!scrollContainerRef.current) return;
    const containerW = scrollContainerRef.current.clientWidth - (TRACK_PADDING * 2) - 20;
    const fitPps = Math.max(10, containerW / Math.max(1, totalDuration));
    const targetZoom = fitPps / 60;
    setTimelineZoom(targetZoom);
    scrollContainerRef.current.scrollLeft = 0;
  };

  const handleFocusSelection = () => {
    if (!selectedSegment || !scrollContainerRef.current) return;
    const segCenterPx = TRACK_PADDING + (((selectedSegment.start + selectedSegment.end) / 2) * pps);
    scrollContainerRef.current.scrollLeft = Math.max(0, segCenterPx - scrollContainerRef.current.clientWidth / 2);
  };

  const selectedSegment = segments.find(s => s.id === selectedSegmentId);
  const playheadX = TRACK_PADDING + (currentTime * pps);

  return (
    <div 
      className="studio-panel" 
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 1. Modular Top Toolbar */}
      <TimelineToolbar
        currentTime={currentTime}
        totalDuration={totalDuration}
        historyPast={historyPast}
        historyFuture={historyFuture}
        selectedSegment={selectedSegment}
        segmentsCount={segments.length}
        timelineSnapEnabled={timelineSnapEnabled}
        followPlayhead={followPlayhead}
        timelineZoom={timelineZoom}
        onUndo={undo}
        onRedo={redo}
        onSplitSelected={() => {
          if (selectedSegment) {
            pushHistoryState();
            splitSegmentAtPlayhead(selectedSegment.id);
          }
        }}
        onDeleteSelected={() => {
          if (selectedSegment) {
            pushHistoryState();
            deleteSegment(selectedSegment.id);
          }
        }}
        onFocusSelected={handleFocusSelection}
        onToggleSnap={toggleTimelineSnap}
        onToggleFollowPlayhead={toggleFollowPlayhead}
        onZoomIn={() => setTimelineZoom(timelineZoom * 1.25)}
        onZoomOut={() => setTimelineZoom(timelineZoom * 0.8)}
        onZoomFit={handleZoomFit}
      />

      {/* 2. Main Multi-Track NLE Layout (Left Header Column + Right Scrollable Tracks) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Modular Left Track Headers */}
        <TimelineTrackHeaders
          isMuted={isMuted}
          segmentsCount={segments.length}
          onToggleMute={() => setIsMuted(!isMuted)}
        />

        {/* Right-Side Virtual Scrollable Track Area */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative',
            background: 'var(--bg-canvas)',
            userSelect: 'none'
          }}
        >
          <div
            ref={trackContainerRef}
            style={{
              width: `${contentWidth}px`,
              minWidth: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around'
            }}
          >
            {/* Time Ruler Track */}
            <div
              onPointerDown={handleRulerPointerDown}
              style={{
                position: 'relative',
                height: '24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-panel)',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              {ticks.map((t) => {
                const tickX = TRACK_PADDING + (t.time * pps);
                return (
                  <div
                    key={t.time}
                    style={{
                      position: 'absolute',
                      left: `${tickX}px`,
                      bottom: 0,
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'SF Mono, monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatAdaptiveTimecode(t.time, step)}
                    </span>
                    <div style={{
                      width: t.isMajor ? '1.5px' : '1px',
                      height: t.isMajor ? '7px' : '4px',
                      background: t.isMajor ? 'var(--text-secondary)' : 'var(--border-hover)'
                    }} />
                  </div>
                );
              })}
            </div>

            {/* Audio Waveform Track */}
            <div style={{ position: 'relative', height: '36px' }}>
              <div style={{ position: 'absolute', left: `${TRACK_PADDING}px` }}>
                <AudioWaveformTrack
                  totalDuration={totalDuration}
                  pps={pps}
                  currentTime={currentTime}
                  onSeek={(t) => seekTo(t)}
                />
              </div>
            </div>

            {/* Subtitle / Caption Blocks Track */}
            <div style={{
              height: '42px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: `${TRACK_PADDING}px`,
                width: `${totalDuration * pps}px`,
                height: '100%',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)'
              }}>
                {segments.map((seg) => {
                  const segLeft = seg.start * pps;
                  const segWidth = Math.max(24, (seg.end - seg.start) * pps);
                  const segDuration = (seg.end - seg.start).toFixed(2);
                  const isSelected = selectedSegmentId === seg.id;
                  const isActive = currentTime >= seg.start && currentTime <= seg.end;

                  return (
                    <div
                      key={seg.id}
                      onPointerDown={(e) => handleSegmentPointerDown(e, seg)}
                      style={{
                        position: 'absolute',
                        left: `${segLeft}px`,
                        width: `${segWidth}px`,
                        top: '2px',
                        bottom: '2px',
                        borderRadius: '6px',
                        background: isSelected 
                          ? 'var(--accent-primary)' 
                          : isActive 
                          ? 'var(--accent-primary)' 
                          : 'var(--accent-blue-subtle)',
                        border: isSelected 
                          ? '1.5px solid var(--text-primary)' 
                          : isActive 
                          ? '1px solid var(--accent-primary)' 
                          : '1px solid var(--border-hover)',
                        color: isSelected || isActive ? '#FFFFFF' : 'var(--text-primary)',
                        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'grab',
                        zIndex: isSelected ? 15 : 5,
                        userSelect: 'none',
                        touchAction: 'none'
                      }}
                      title={`[${formatTimecode(seg.start)} - ${formatTimecode(seg.end)}] (${segDuration}s) • ${seg.text}`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => handleTrimLeftPointerDown(e, seg)}
                        style={{
                          width: '9px',
                          height: '100%',
                          cursor: 'ew-resize',
                          background: isSelected ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.08)',
                          borderRadius: '5px 0 0 5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Trim start"
                      >
                        <div style={{ width: '1.5px', height: '10px', background: isSelected ? '#000' : 'rgba(255,255,255,0.7)', borderRadius: '1px' }} />
                      </div>

                      {/* Caption Text Label & Duration */}
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        padding: '0 4px',
                        pointerEvents: 'none'
                      }}>
                        <span style={{
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {seg.text}
                        </span>
                        {segWidth > 80 && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '500',
                            opacity: 0.75,
                            fontFamily: 'SF Mono, monospace'
                          }}>
                            {segDuration}s
                          </span>
                        )}
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => handleTrimRightPointerDown(e, seg)}
                        style={{
                          width: '9px',
                          height: '100%',
                          cursor: 'ew-resize',
                          background: isSelected ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.08)',
                          borderRadius: '0 5px 5px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Trim end"
                      >
                        <div style={{ width: '1.5px', height: '10px', background: isSelected ? '#000' : 'rgba(255,255,255,0.7)', borderRadius: '1px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vertical Playhead Needle */}
            <div
              onPointerDown={handlePlayheadPointerDown}
              style={{
                position: 'absolute',
                left: `${playheadX}px`,
                top: 0,
                bottom: 0,
                width: '1.5px',
                background: 'var(--accent-primary)',
                zIndex: 30,
                cursor: 'ew-resize',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                touchAction: 'none'
              }}
            >
              {/* Playhead Top Needle Marker with Micro Time Bubble */}
              <div style={{
                position: 'absolute',
                top: '-1px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <div style={{
                  background: 'var(--accent-primary)',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: '700',
                  fontFamily: 'SF Mono, monospace',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}>
                  {formatTimecode(currentTime)}
                </div>
                <div style={{
                  width: '8px',
                  height: '6px',
                  background: 'var(--accent-primary)',
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
