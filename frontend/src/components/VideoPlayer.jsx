import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  MoveVertical,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw as ResetZoom
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { getActiveSegmentAndWord, formatTimecode } from '../engine/animator';
import { captureAndLogLayoutMetrics } from '../engine/layoutMeasurer';

export const VideoPlayer = () => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const captionBoxRef = useRef(null);
  const rafSeekRef = useRef(null);

  const {
    videoUrl,
    currentTime,
    seekRequestTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    playbackRate,
    aspectRatio,
    showSafeZones,
    segments,
    style,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    updateStyle
  } = useEditorStore();

  const [activeSegment, setActiveSegment] = useState(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0); // 0.75, 1.0, 1.25, 1.5, 2.0

  // Sync external seek requests (e.g. from Horizontal Timeline dragging/clicking)
  useEffect(() => {
    if (seekRequestTime !== null && videoRef.current) {
      if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
      rafSeekRef.current = requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = seekRequestTime;
          const match = getActiveSegmentAndWord(segments, seekRequestTime);
          setActiveSegment(match.activeSegment);
          setActiveWordIndex(match.activeWordIndex);
        }
      });
    }
    return () => {
      if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
    };
  }, [seekRequestTime, segments]);

  // Capture and log DOM layout metrics when active segment or style changes
  useEffect(() => {
    if (activeSegment) {
      const w = containerRef.current?.clientWidth || 310;
      const h = containerRef.current?.clientHeight || 550;
      captureAndLogLayoutMetrics(activeSegment, style, w, h);
    }
  }, [activeSegment?.id, style]);

  // Sync video duration when media loads
  const handleMediaLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    video.volume = volume;
    video.playbackRate = playbackRate;
  };

  // Sync state with HTML5 video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animFrameId;
    const updateLoop = () => {
      if (!video.paused && !video.ended) {
        const time = video.currentTime;
        setCurrentTime(time);
        const match = getActiveSegmentAndWord(segments, time);
        setActiveSegment(match.activeSegment);
        setActiveWordIndex(match.activeWordIndex);
      }
      animFrameId = requestAnimationFrame(updateLoop);
    };

    animFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animFrameId);
  }, [segments, setCurrentTime]);

  // Handle Play/Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  // Keyboard shortcuts (Spacebar play/pause, Left/Right skip)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, (videoRef.current?.currentTime || 0) - 2));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(duration || 100, (videoRef.current?.currentTime || 0) + 2));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, duration]);

  const seek = (time) => {
    if (!videoRef.current) return;
    const safeTime = Math.max(0, Math.min(duration || 1000, time));
    if (rafSeekRef.current) cancelAnimationFrame(rafSeekRef.current);
    rafSeekRef.current = requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = safeTime;
        setCurrentTime(safeTime);
        const match = getActiveSegmentAndWord(segments, safeTime);
        setActiveSegment(match.activeSegment);
        setActiveWordIndex(match.activeWordIndex);
      }
    });
  };

  const handleSeekChange = (e) => {
    const time = parseFloat(e.target.value);
    seek(time);
  };

  // Drag-to-position caption overlay
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingCaption(true);

    const handleMouseMove = (moveEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const clampedY = Math.max(10, Math.min(90, Math.round(relativeY)));
      updateStyle({ positionY: clampedY });
    };

    const handleMouseUp = () => {
      setIsDraggingCaption(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Compute container dimensions based on selected aspect ratio
  const getAspectRatioDimensions = () => {
    if (aspectRatio === '9:16') {
      return { width: 310, height: 550, aspect: '9 / 16' };
    }
    if (aspectRatio === '1:1') {
      return { width: 420, height: 420, aspect: '1 / 1' };
    }
    return { width: 540, height: 304, aspect: '16 / 9' };
  };

  const dims = getAspectRatioDimensions();

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.0, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  const handleResetZoom = () => setZoomLevel(1.0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
      {/* Canvas Viewport Zoom & Inspection Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: `${dims.width}px`,
        maxWidth: '100%',
        padding: '3px 8px',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid var(--border-color)',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '10px' }}>CANVAS</span>
          <span style={{ fontSize: '9px', opacity: 0.6 }}>({aspectRatio})</span>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            className="btn-secondary"
            style={{ padding: '2px 5px', fontSize: '10px', height: '22px' }}
            title="Zoom Out (-25%)"
          >
            <ZoomOut size={11} />
          </button>

          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)',
              color: 'var(--accent-primary)',
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 4px',
              borderRadius: '4px',
              cursor: 'pointer',
              height: '22px'
            }}
          >
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2.0">200%</option>
          </select>

          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2.0}
            className="btn-secondary"
            style={{ padding: '2px 5px', fontSize: '10px', height: '22px' }}
            title="Zoom In (+25%)"
          >
            <ZoomIn size={11} />
          </button>

          {zoomLevel !== 1.0 && (
            <button
              onClick={handleResetZoom}
              className="btn-secondary"
              style={{ padding: '2px 5px', fontSize: '9px', height: '22px', color: 'var(--accent-viral-yellow)' }}
              title="Reset Zoom to 100%"
            >
              <ResetZoom size={10} /> 1x
            </button>
          )}
        </div>
      </div>

      {/* Outer Scalable Viewport Host with Smooth Scrolling when Zoomed */}
      <div style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: zoomLevel > 1.0 ? 'auto' : 'visible',
        borderRadius: '16px',
        position: 'relative'
      }}>
        {/* Scaled Video Viewport Container */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: `${dims.width}px`,
            height: `${dims.height}px`,
            aspectRatio: dims.aspect,
            backgroundColor: '#000000',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0
          }}
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              muted={isMuted}
              onClick={togglePlay}
              onLoadedMetadata={handleMediaLoaded}
              onDurationChange={handleMediaLoaded}
              onEnded={() => setIsPlaying(false)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700' }}>No Video Loaded</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Click "Upload" or "Demo" to begin</p>
            </div>
          )}

          {/* TikTok / Shorts UI Safe Zones Overlay */}
          {showSafeZones && aspectRatio === '9:16' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
              {/* Top Bar Safe Zone */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '65px',
                borderBottom: '1px dashed rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '9px', color: 'rgba(239, 68, 68, 0.8)', fontWeight: '600', letterSpacing: '1px' }}>
                  HEADER SAFE ZONE
                </span>
              </div>

              {/* Right Action Buttons Safe Zone */}
              <div style={{
                position: 'absolute',
                top: '100px',
                right: 0,
                bottom: '100px',
                width: '55px',
                borderLeft: '1px dashed rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '9px', color: 'rgba(239, 68, 68, 0.8)', fontWeight: '600', transform: 'rotate(90deg)', whiteSpace: 'nowrap' }}>
                  LIKE / SHARE
                </span>
              </div>

              {/* Bottom Caption & Audio Safe Zone */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '95px',
                borderTop: '1px dashed rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '9px', color: 'rgba(239, 68, 68, 0.8)', fontWeight: '600', letterSpacing: '1px' }}>
                  SOUND / CAPTION SAFE ZONE
                </span>
              </div>
            </div>
          )}

          {/* Dynamic Animated Caption Overlay */}
          {activeSegment && (
            <div
              ref={captionBoxRef}
              className="caption-drag-handle"
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                top: `${style.positionY}%`,
                left: `${style.positionX}%`,
                transform: 'translate(-50%, -50%)',
                width: '90%',
                textAlign: 'center',
                zIndex: 20,
                backgroundColor: style.backgroundColor || 'transparent',
                padding: style.backgroundPadding ? `${style.backgroundPadding}px` : '0px',
                borderRadius: style.borderRadius ? `${style.borderRadius}px` : '0px',
                backdropFilter: style.backgroundColor && style.backgroundColor !== 'transparent' ? 'blur(8px)' : 'none',
                cursor: isDraggingCaption ? 'grabbing' : 'grab'
              }}
            >
              {/* Drag Handle Tag */}
              <div style={{
                position: 'absolute',
                top: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '1px 7px',
                borderRadius: '999px',
                fontSize: '9px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                pointerEvents: 'none'
              }}>
                <MoveVertical size={10} /> {Math.round(style.positionY)}%
              </div>

              {/* Word Tokens */}
              <div style={{
                fontFamily: style.fontFamily,
                fontSize: `${style.fontSize}px`,
                fontWeight: style.fontWeight,
                lineHeight: 1.15,
                textTransform: style.textTransform,
                letterSpacing: style.fontFamily === 'Bebas Neue' ? '1px' : '-0.5px'
              }}>
                {activeSegment.words.map((w, idx) => {
                  const isActive = idx === activeWordIndex;
                  const animClass = isActive ? `anim-${style.animationType}` : '';
                  
                  return (
                    <span
                      key={w.id || idx}
                      className={`word-token ${isActive ? 'is-active' : ''} ${animClass}`}
                      style={{
                        color: isActive ? style.activeColor : style.primaryColor,
                        WebkitTextStroke: style.strokeWidth ? `${style.strokeWidth}px ${style.strokeColor}` : 'none',
                        textShadow: style.shadowBlur 
                          ? `0 4px ${style.shadowBlur}px ${style.shadowColor}` 
                          : 'none',
                        display: 'inline-block',
                        margin: '0 4px'
                      }}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls & Scrubber */}
      <div className="glass-card" style={{ width: `${dims.width}px`, maxWidth: '100%', padding: '10px 14px', borderRadius: '12px' }}>
        {/* Scrubber Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary)', minWidth: '46px' }}>
            {formatTimecode(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration || 1)}
            step={0.02}
            value={currentTime}
            onChange={handleSeekChange}
            style={{
              flex: 1,
              accentColor: 'var(--accent-primary)',
              cursor: 'pointer',
              height: '5px'
            }}
          />
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: '46px', textAlign: 'right' }}>
            {formatTimecode(duration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => seek(Math.max(0, currentTime - 2))}
              className="btn-secondary"
              style={{ padding: '5px 7px' }}
              title="Back 2s"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={togglePlay}
              className="btn-primary"
              style={{ padding: '5px 12px', borderRadius: '6px' }}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={() => seek(Math.min(duration, currentTime + 2))}
              className="btn-secondary"
              style={{ padding: '5px 7px' }}
              title="Forward 2s"
            >
              <RotateCw size={13} />
            </button>
          </div>

          {/* Volume & Speed Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <select
              value={playbackRate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value);
                setPlaybackRate(rate);
                if (videoRef.current) videoRef.current.playbackRate = rate;
              }}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '3px 5px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
