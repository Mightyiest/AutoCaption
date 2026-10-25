import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/useEditorStore';

export const TimelineMinimap = ({
  scrollContainerRef,
  pps = 60,
  trackPadding = 16,
  totalDuration = 10,
  onSeek
}) => {
  const minimapRef = useRef(null);
  const canvasRef = useRef(null);

  const {
    audioPeaks,
    segments,
    currentTime
  } = useEditorStore();

  const [scrollInfo, setScrollInfo] = React.useState({ scrollLeft: 0, clientWidth: 800 });

  // Track scroll position of the main timeline
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollInfo({
        scrollLeft: el.scrollLeft,
        clientWidth: el.clientWidth
      });
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scrollContainerRef]);

  const safeDuration = Math.max(0.1, totalDuration || 1);

  // Draw bird's eye canvas representation of waveform and captions
  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width) || 300;
    const height = 18;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Draw mini audio waveform
    if (audioPeaks && audioPeaks.length > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      const totalSamples = audioPeaks.length;
      const centerY = height / 2;

      for (let x = 0; x < width; x += 2) {
        const progress = x / width;
        const sampleIdx = Math.floor(progress * totalSamples);
        const amp = audioPeaks[sampleIdx] || 0.05;
        const barH = Math.max(2, amp * (height - 4));
        ctx.fillRect(x, centerY - barH / 2, 1.5, barH);
      }
    }

    // 2. Draw mini caption block pills
    for (const seg of segments || []) {
      const segStartPct = Math.max(0, seg.start / safeDuration);
      const segEndPct = Math.min(1, seg.end / safeDuration);
      const startX = segStartPct * width;
      const blockW = Math.max(3, (segEndPct - segStartPct) * width);

      ctx.fillStyle = 'rgba(0, 113, 227, 0.7)';
      ctx.fillRect(startX, 2, blockW, 3);
    }

    // 3. Draw mini current playhead line
    const playheadX = (currentTime / safeDuration) * width;
    ctx.fillStyle = '#2997ff';
    ctx.fillRect(playheadX - 1, 0, 2, height);

    ctx.restore();
  }, [safeDuration, audioPeaks, segments, currentTime]);

  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

  // Calculate visible time window in main scroll view
  const visibleStartTime = Math.max(0, (scrollInfo.scrollLeft - trackPadding) / pps);
  const visibleEndTime = Math.min(safeDuration, (scrollInfo.scrollLeft + scrollInfo.clientWidth - trackPadding) / pps);

  const viewportLeftPct = Math.max(0, Math.min(99, (visibleStartTime / safeDuration) * 100));
  const viewportWidthPct = Math.max(1, Math.min(100 - viewportLeftPct, ((visibleEndTime - visibleStartTime) / safeDuration) * 100));

  // Direct click or drag on minimap to seek & scroll timeline
  const handlePointerDown = (e) => {
    if (e.button !== 0 || !minimapRef.current || !scrollContainerRef.current) return;
    e.preventDefault();

    const rect = minimapRef.current.getBoundingClientRect();

    const updatePosition = (clientX) => {
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const progress = clickX / rect.width;
      const targetTime = progress * safeDuration;

      onSeek(Math.max(0, Math.min(safeDuration, targetTime)));

      // Center the main timeline scroll container around this position
      const targetCenterPx = trackPadding + (targetTime * pps);
      const targetScroll = targetCenterPx - (scrollInfo.clientWidth / 2);
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    };

    const handlePointerMove = (moveEvent) => {
      updatePosition(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    updatePosition(e.clientX);
  };

  return (
    <div
      ref={minimapRef}
      onPointerDown={handlePointerDown}
      style={{
        height: '18px',
        width: '100%',
        background: '#0e0e10',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0
      }}
      title="Timeline Minimap (Click or Drag to navigate entire video)"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none'
        }}
      />

      {/* Draggable Viewport Window Box */}
      {viewportWidthPct < 98 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${viewportLeftPct}%`,
            width: `${viewportWidthPct}%`,
            background: 'rgba(0, 113, 227, 0.22)',
            borderLeft: '1.5px solid var(--accent-bright-blue)',
            borderRight: '1.5px solid var(--accent-bright-blue)',
            borderTop: '1px solid rgba(41, 151, 255, 0.4)',
            borderBottom: '1px solid rgba(41, 151, 255, 0.4)',
            borderRadius: '2px',
            pointerEvents: 'none',
            boxShadow: '0 0 8px rgba(0, 113, 227, 0.3)'
          }}
        />
      )}
    </div>
  );
};
