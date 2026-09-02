import React, { useRef, useEffect, useCallback } from 'react';
import { Volume2, Loader2, Music } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { contentXToTime, snapTime } from '../engine/timelineGeometry';

export const AudioWaveformTrack = ({
  totalDuration,
  pps,
  currentTime,
  onSeek
}) => {
  const canvasRef = useRef(null);
  const trackRef = useRef(null);

  const {
    audioPeaks,
    isExtractingAudio,
    videoFilename,
    videoFps,
    timelineSnapEnabled,
    segments
  } = useEditorStore();

  const trackWidth = Math.max(10, totalDuration * pps);
  const trackHeight = 36;

  // Draw Audio Waveform on Canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = Math.floor(trackWidth);
    const height = trackHeight;

    // Handle high DPI crisp rendering
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const playheadPx = currentTime * pps;

    // Background track fill
    ctx.fillStyle = 'rgba(28, 28, 30, 0.6)';
    ctx.fillRect(0, 0, width, height);

    // Subtle Center Reference Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (!audioPeaks || audioPeaks.length === 0) {
      // Empty or loading state placeholder bars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let x = 0; x < width; x += 4) {
        const h = 4 + Math.sin(x * 0.05) * 3;
        ctx.fillRect(x, centerY - h / 2, 2, h);
      }
      ctx.restore();
      return;
    }

    const totalSamples = audioPeaks.length;
    const samplesPerSec = totalSamples / Math.max(0.1, totalDuration);

    // Render bar-by-bar (step = 2px or 3px depending on density)
    const barWidth = pps > 100 ? 2 : pps > 40 ? 1.5 : 1;
    const barSpacing = barWidth <= 1 ? 1 : 2;

    for (let x = 0; x < width; x += (barWidth + barSpacing)) {
      const timeAtX = x / pps;
      const sampleIdx = Math.floor(timeAtX * samplesPerSec);

      if (sampleIdx >= 0 && sampleIdx < totalSamples) {
        const amp = audioPeaks[sampleIdx] || 0.05;
        // Symmetrical wave height with a minimum of 2px
        const barHeight = Math.max(2, amp * (height - 6));
        const topY = centerY - barHeight / 2;

        const isPlayed = x <= playheadPx;

        if (isPlayed) {
          ctx.fillStyle = '#2997ff'; // Apple Bright Blue for played portion
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.32)'; // Clean subtle white for unplayed
        }

        // Draw rounded/clean vertical bar
        ctx.fillRect(x, topY, barWidth, barHeight);
      }
    }

    ctx.restore();
  }, [trackWidth, trackHeight, currentTime, pps, totalDuration, audioPeaks]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Direct Click/Drag Scrub on Waveform
  const handlePointerDown = (e) => {
    if (e.button !== 0 || !trackRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = trackRef.current.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      const x = moveEvent.clientX - rect.left;
      let targetTime = contentXToTime(x, pps);

      if (timelineSnapEnabled) {
        targetTime = snapTime({ targetTime, currentTime, segments, fps: videoFps || 30, enabled: true });
      }

      onSeek(Math.max(0, Math.min(totalDuration, targetTime)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    handleMove(e);
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      style={{
        height: `${trackHeight}px`,
        borderRadius: 'var(--radius-xs)',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        width: `${trackWidth}px`,
        backgroundColor: '#161618'
      }}
      title="Audio Waveform Track (Click/Drag to scrub)"
    >
      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Only display loading indicator during extraction */}
      {isExtractingAudio && (
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '10px',
          fontWeight: '600',
          color: '#FFFFFF',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          padding: '2px 7px',
          borderRadius: '4px',
          pointerEvents: 'none',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
        }}>
          <Loader2 size={10} className="animate-spin" color="var(--accent-bright-blue)" />
          <span>Analyzing Audio Waveform...</span>
        </div>
      )}
    </div>
  );
};
