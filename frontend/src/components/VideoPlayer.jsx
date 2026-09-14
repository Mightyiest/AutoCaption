import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  Film, 
  Eye, 
  EyeOff, 
  Maximize, 
  Music,
  RotateCcw,
  Hand,
  Link2,
  AlertTriangle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { renderPreviewOverlay } from '../engine/captionCanvasRenderer';
import { createCaptionScene } from '../engine/captionScene';
import { getActiveSegmentAndWord } from '../engine/animator';
import { TransportControls } from './TransportControls';
import { CaptionDragHandle } from './CaptionDragHandle';

export const VideoPlayer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stageViewportRef = useRef(null);
  const isRenderingRef = useRef(false);
  const lastDrawnTimeRef = useRef(-1);

  const {
    videoFile,
    videoUrl,
    videoFilename,
    videoFps,
    currentTime,
    seekRequestTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    playbackRate,
    aspectRatio,
    setAspectRatio,
    showSafeZones,
    segments,
    style,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    updateStyle,
    triggerVideoPicker,
    handleFileSelected,
    loadDemoData,
    setMediaElement,
    togglePlay,
    // Premiere Pro Zero-Copy Media Linking state & actions
    isMediaLinked,
    linkedSourcePath,
    mediaOffline,
    activeProjectId,
    linkLocalVideoFile,
    relinkProjectMedia,
    customKeywordRules,
    getCustomDictionary,
    getCustomEmphasisKeywords
  } = useEditorStore();

  // Drag and Drop Import State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Display Viewport & Zoom State
  const [viewportDims, setViewportDims] = useState({ width: 380, height: 560 });
  const [previewZoom, setPreviewZoom] = useState(1.0); // 1.0 = Fit scale
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Determine media type (Video vs Audio-Only)
  const isAudioOnly = Boolean(
    (videoFile && videoFile.type && videoFile.type.startsWith('audio/')) ||
    (videoFilename && (videoFilename.endsWith('.wav') || videoFilename.endsWith('.mp3') || videoFilename.endsWith('.m4a') || videoFilename.endsWith('.aac'))) ||
    (videoUrl && (videoUrl.includes('.wav') || videoUrl.includes('.mp3') || videoUrl.includes('demo_audio')))
  );

  // ResizeObserver for the exact middle stage viewport area (No cyclic reflows)
  useEffect(() => {
    const el = stageViewportRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = Math.floor(entry.contentRect.width);
        const newH = Math.floor(entry.contentRect.height);
        if (newW > 50 && newH > 50) {
          setViewportDims((prev) => {
            if (Math.abs(prev.width - newW) > 2 || Math.abs(prev.height - newH) > 2) {
              return { width: newW, height: newH };
            }
            return prev;
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Canonical resolution metrics
  const canonical = useMemo(() => {
    switch (aspectRatio) {
      case '16:9':
        return { aspect: '16/9', exportW: 1920, exportH: 1080, cssAspect: 16 / 9 };
      case '1:1':
        return { aspect: '1/1', exportW: 1080, exportH: 1080, cssAspect: 1 / 1 };
      case '4:5':
        return { aspect: '4/5', exportW: 1080, exportH: 1350, cssAspect: 4 / 5 };
      case '9:16':
      default:
        return { aspect: '9/16', exportW: 1080, exportH: 1920, cssAspect: 9 / 16 };
    }
  }, [aspectRatio]);

  // Scaled Stage Transform (Maximized full-bleed canvas)
  const transform = useMemo(() => {
    const padding = 10;
    const availW = Math.max(80, viewportDims.width - padding * 2);
    const availH = Math.max(80, viewportDims.height - padding * 2);

    let fitW, fitH;
    if (availW / availH > canonical.cssAspect) {
      fitH = availH;
      fitW = fitH * canonical.cssAspect;
    } else {
      fitW = availW;
      fitH = fitW / canonical.cssAspect;
    }

    const scale = previewZoom;
    const displayW = Math.round(fitW * scale);
    const displayH = Math.round(fitH * scale);

    return {
      displayW,
      displayH,
      pan: panOffset
    };
  }, [viewportDims, canonical, previewZoom, panOffset]);

  // Handle Wheel Zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setPreviewZoom((prev) => Math.max(0.5, Math.min(3.0, prev + delta)));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Handle Spacebar Pan toggle with capture phase to avoid global play/pause conflict
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (previewZoom > 1.05) {
          // Intercept in capture phase so global shortcuts don't toggle playback
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!spacePressed) {
            setSpacePressed(true);
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        if (previewZoom > 1.05) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [previewZoom, spacePressed]);

  // Render Canvas Caption Overlay Frame
  const drawOverlay = useCallback((time) => {
    if (!canvasRef.current) return;

    try {
      const customDict = typeof getCustomDictionary === 'function' ? getCustomDictionary() : {};
      const customEmphasis = typeof getCustomEmphasisKeywords === 'function' ? getCustomEmphasisKeywords() : [];

      const scene = createCaptionScene({
        style,
        segments,
        canvasSize: { width: canonical.exportW, height: canonical.exportH, fps: videoFps || 30 },
        currentTime: time,
        videoInfo: {
          file: videoFile,
          url: videoUrl,
          duration
        },
        customDictionary: customDict,
        customEmphasisKeywords: customEmphasis
      });

      renderPreviewOverlay({
        canvas: canvasRef.current,
        scene,
        currentTime: time,
        isPlaying
      });
    } catch (err) {
      console.warn('Canvas render error:', err);
    }
  }, [style, segments, canonical.exportW, canonical.exportH, videoFile, videoUrl, duration, videoFps, isPlaying, customKeywordRules, getCustomDictionary, getCustomEmphasisKeywords]);

  // Re-render canvas on state / style changes
  useEffect(() => {
    drawOverlay(currentTime);
  }, [drawOverlay, currentTime, style, segments, aspectRatio, customKeywordRules]);

  // Keep drawOverlay ref updated for animation loop without recreating RAF
  const drawOverlayRef = useRef(drawOverlay);
  useEffect(() => {
    drawOverlayRef.current = drawOverlay;
  }, [drawOverlay]);

  // Sync external seek requests (direct and synchronous)
  useEffect(() => {
    if (seekRequestTime !== null) {
      const targetTime = seekRequestTime;
      const video = videoRef.current;
      if (video && Math.abs(video.currentTime - targetTime) > 0.01) {
        try {
          video.currentTime = targetTime;
        } catch (err) {
          console.warn('Direct video seek error:', err);
        }
      }
      if (drawOverlayRef.current) {
        drawOverlayRef.current(targetTime);
      }
      // Immediately clear seekRequestTime so subsequent seeks to the same time trigger reliably
      useEditorStore.setState({ seekRequestTime: null });
    }
  }, [seekRequestTime]);

  // Sync audio properties
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume));
    video.muted = isMuted;
    video.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // Guard against dual-play promise collisions
  const isPlayPendingRef = useRef(false);

  // Sync isPlaying state to media element (handles external play/pause triggers)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (isPlaying && video.paused && !isPlayPendingRef.current) {
      if (video.currentTime >= (video.duration || duration || 0) - 0.05) {
        video.currentTime = 0;
        setCurrentTime(0);
      }
      isPlayPendingRef.current = true;
      video.play()
        .catch((err) => {
          console.warn('Auto play recovery:', err);
          if (err.name === 'NotAllowedError') {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          }
        })
        .finally(() => {
          isPlayPendingRef.current = false;
        });
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, videoUrl, duration, setCurrentTime, setIsMuted]);

  // Callback ref to guarantee media element is always registered in store
  const handleMediaRef = useCallback((el) => {
    videoRef.current = el;
    setMediaElement(el);
  }, [setMediaElement]);

  // Sync video duration & dimensions when media loads
  const handleMediaLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    setMediaElement(video);
    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    video.volume = Math.max(0, Math.min(1, volume));
    video.muted = isMuted;
    video.playbackRate = playbackRate;

    // Auto-detect aspect ratio for fresh projects when video is clearly landscape
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const vidRatio = video.videoWidth / video.videoHeight;
      if (vidRatio >= 1.35 && aspectRatio === '9:16' && (!segments || segments.length === 0)) {
        setAspectRatio('16:9');
      } else if (vidRatio >= 0.95 && vidRatio <= 1.05 && aspectRatio === '9:16' && (!segments || segments.length === 0)) {
        setAspectRatio('1:1');
      }
    }
  };

  // Playback animation frame loop (Hardware Video + Software fallback)
  useEffect(() => {
    let animFrameId;
    let lastTs = performance.now();

    const updateLoop = (now) => {
      const video = videoRef.current;
      if (video && videoUrl) {
        if (!video.paused && !video.ended) {
          const time = video.currentTime;
          setCurrentTime(time);
          if (drawOverlayRef.current) {
            drawOverlayRef.current(time);
          }
        }
      } else if (isPlaying) {
        const delta = (now - lastTs) / 1000;
        const maxDur = duration > 0 ? duration : (segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 10);
        const cur = useEditorStore.getState().currentTime;
        const nextTime = cur + delta * (playbackRate || 1.0);
        if (nextTime >= maxDur) {
          setCurrentTime(0);
          if (drawOverlayRef.current) drawOverlayRef.current(0);
        } else {
          setCurrentTime(nextTime);
          if (drawOverlayRef.current) drawOverlayRef.current(nextTime);
        }
      }
      lastTs = now;
      animFrameId = requestAnimationFrame(updateLoop);
    };

    if (isPlaying || (videoRef.current && !videoRef.current.paused)) {
      animFrameId = requestAnimationFrame(updateLoop);
    }
    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [isPlaying, videoUrl, duration, playbackRate, segments, setCurrentTime]);

  // Seek helper
  const seek = (time) => {
    const maxDur = duration > 0 ? duration : 1000;
    const safeTime = Math.max(0, Math.min(maxDur, time));
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = safeTime;
      } catch (err) {
        console.warn('Direct video seek error:', err);
      }
    }
    setCurrentTime(safeTime);
    if (drawOverlayRef.current) {
      drawOverlayRef.current(safeTime);
    }
  };

  const handleSeekChange = (e) => {
    seek(parseFloat(e.target.value));
  };

  // Drag-to-position caption overlay
  const handleCaptionMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCaption(true);

    const handleMouseMove = (moveEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - rect.top;
      const pctY = Math.max(10, Math.min(90, (relativeY / rect.height) * 100));
      updateStyle({ positionY: Math.round(pctY) });
    };

    const handleMouseUp = () => {
      setIsDraggingCaption(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Pan stage handling
  const handleStageMouseDown = (e) => {
    if (spacePressed || previewZoom > 1.05) {
      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX - panOffset.x,
          y: e.clientY - panOffset.y
        };
      }
    }
  };

  const handleStageMouseMove = (e) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y
    });
  };

  const handleStageMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetPanZoom = () => {
    setPreviewZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Drag-and-drop video import onto stage
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
    }
  };

  const { activeSegment } = getActiveSegmentAndWord(segments, currentTime);
  const hasActiveSegment = Boolean(activeSegment);

  return (
    <div
      ref={containerRef}
      className="studio-panel"
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onMouseLeave={handleStageMouseUp}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: spacePressed ? 'grab' : isPanning ? 'grabbing' : 'default',
        backgroundColor: 'var(--video-stage-bg)',
        userSelect: 'none'
      }}
    >
      {/* Top Floating Viewport Glass Overlay Bar */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 35,
        pointerEvents: 'auto'
      }}>
        {/* Aspect Ratio Badge */}
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 9px',
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <span>{aspectRatio}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>
            {canonical.exportW}x{canonical.exportH}
          </span>
        </div>

        {/* Safe Zones Toggle */}
        <button
          onClick={() => useEditorStore.getState().toggleSafeZones()}
          className="btn-ghost"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-pill)',
            background: showSafeZones ? 'var(--accent-blue-subtle)' : 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: showSafeZones ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            color: showSafeZones ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            fontSize: '11px',
            boxShadow: 'var(--shadow-subtle)'
          }}
          title={showSafeZones ? 'Hide Safe Zone Overlay' : 'Show Safe Zone Overlay'}
        >
          {showSafeZones ? <Eye size={12} /> : <EyeOff size={12} />}
          <span style={{ marginLeft: '4px' }}>Safe Zones</span>
        </button>

        {/* Zoom Reset */}
        {previewZoom !== 1.0 && (
          <button
            onClick={handleResetPanZoom}
            className="btn-ghost"
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: 'var(--shadow-subtle)'
            }}
            title="Reset Zoom to Fit (Ctrl + 0)"
          >
            <RotateCcw size={11} />
            <span>Fit ({Math.round(previewZoom * 100)}%)</span>
          </button>
        )}

        {/* Space Pan Help Badge */}
        {previewZoom > 1.05 && (
          <div style={{
            background: spacePressed ? 'var(--accent-primary)' : 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: spacePressed ? '#FFFFFF' : 'var(--text-tertiary)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 8px',
            border: '1px solid var(--border-subtle)',
            fontSize: '10px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <Hand size={11} />
            <span>Space + Drag</span>
          </div>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={handleFullscreen}
          className="btn-ghost"
          style={{
            padding: '4px 6px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-subtle)'
          }}
          title="Toggle Fullscreen"
        >
          <Maximize size={12} />
        </button>
      </div>

      {/* Full-Height Scaled Stage Area */}
      <div
        ref={stageViewportRef}
        onMouseDown={handleStageMouseDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Dynamic Scaled Canvas Stage */}
        <div
          style={{
            position: 'relative',
            width: `${transform.displayW}px`,
            height: `${transform.displayH}px`,
            aspectRatio: canonical.aspect,
            backgroundColor: isAudioOnly ? '#FFFFFF' : (videoUrl ? '#000000' : 'var(--bg-panel)'),
            borderRadius: '16px',
            overflow: 'hidden',
            border: videoUrl ? 'none' : '1px solid var(--border-subtle)',
            boxShadow: isAudioOnly 
              ? 'var(--shadow-card)'
              : videoUrl 
                ? '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' 
                : 'var(--shadow-card)',
            transform: `translate(${transform.pan.x}px, ${transform.pan.y}px)`,
            flexShrink: 0
          }}
        >
          {/* Animated Glowing Dropzone Overlay */}
          {isDraggingOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 60,
              background: 'rgba(0, 113, 227, 0.28)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '2px dashed #0071E3',
              boxShadow: 'inset 0 0 45px rgba(0, 113, 227, 0.5), 0 0 35px rgba(41, 151, 255, 0.6)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              pointerEvents: 'none'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0, 113, 227, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0, 113, 227, 0.4)'
              }}>
                <UploadCloud size={32} color="#FFFFFF" />
              </div>
              <div style={{ textAlign: 'center', padding: '0 16px' }}>
                <p style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
                  Drop Video to Import
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', margin: '4px 0 0 0', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                  Instantly loads into player & timeline
                </p>
              </div>
            </div>
          )}

          {/* HTML5 Media Player Layer (Audio or Video) */}
          {videoUrl ? (
            <>
              {isAudioOnly ? (
                <>
                  <audio
                    ref={handleMediaRef}
                    src={videoUrl}
                    preload="auto"
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={handleMediaLoaded}
                    onDurationChange={handleMediaLoaded}
                    onEnded={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                      if (videoRef.current) videoRef.current.currentTime = 0;
                    }}
                  />
                  {/* Clean White Audio Stage Background */}
                  <div 
                    onClick={togglePlay}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '16px',
                      zIndex: 1
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(0, 0, 0, 0.06)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#1C1C1E',
                      userSelect: 'none',
                      alignSelf: 'flex-start',
                      border: '1px solid rgba(0, 0, 0, 0.08)'
                    }}>
                      <Music size={12} color="var(--accent-bright-blue)" />
                      <span>{videoFilename || 'demo_audio.wav'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <video
                  ref={handleMediaRef}
                  src={videoUrl}
                  playsInline
                  crossOrigin="anonymous"
                  preload="auto"
                  muted={isMuted}
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={handleMediaLoaded}
                  onDurationChange={handleMediaLoaded}
                  onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                    if (videoRef.current) videoRef.current.currentTime = 0;
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                />
              )}
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              padding: '24px',
              textAlign: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-active)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Film size={24} color="var(--text-primary)" />
              </div>

              <div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  No Video Loaded
                </p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-tertiary)', maxWidth: '280px', lineHeight: '1.4' }}>
                  Import video (.mp4, .avi, .mov, .mkv) or drop footage to begin.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', justifyContent: 'center' }}>
                <button
                  onClick={() => linkLocalVideoFile()}
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '6px 12px', gap: '5px' }}
                  title="Import video file directly"
                >
                  <FolderOpen size={13} />
                  <span>Import Video (.mp4, .avi, .mov)</span>
                </button>

                <button
                  onClick={triggerVideoPicker}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', gap: '5px' }}
                >
                  <UploadCloud size={13} />
                  <span>Upload Video</span>
                </button>

                <button
                  onClick={() => loadDemoData()}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 12px', gap: '5px' }}
                >
                  <Sparkles size={13} />
                  <span>Load Demo</span>
                </button>
              </div>
            </div>
          )}

          {/* Premiere Pro-style Media Offline Warning Overlay */}
          {isMediaLinked && mediaOffline && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              gap: '12px',
              zIndex: 25,
              color: '#F8FAFC'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444'
              }}>
                <AlertTriangle size={26} />
              </div>

              <div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#EF4444',
                  display: 'block',
                  marginBottom: '4px'
                }}>
                  Zero-Copy Media Offline
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#FFFFFF' }}>
                  Source Video File Not Found
                </h3>
                <p style={{
                  fontSize: '11px',
                  color: '#94A3B8',
                  marginTop: '6px',
                  maxWidth: '300px',
                  lineHeight: '1.4',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  background: 'rgba(0,0,0,0.35)',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  {linkedSourcePath || 'Original file location unavailable'}
                </p>
              </div>

              <button
                onClick={() => relinkProjectMedia(activeProjectId)}
                className="btn-primary"
                style={{
                  marginTop: '6px',
                  padding: '7px 16px',
                  fontSize: '11.5px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} />
                <span>Locate & Relink Media</span>
              </button>
            </div>
          )}

          {/* Canvas 2D Caption Overlay */}
          <canvas
            ref={canvasRef}
            width={canonical.exportW}
            height={canonical.exportH}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 15
            }}
          />

          {/* Caption Drag Position Handle */}
          {hasActiveSegment && (
            <CaptionDragHandle
              style={style}
              isDragging={isDraggingCaption}
              onMouseDown={handleCaptionMouseDown}
            />
          )}

          {/* Social Safe Zones Overlay (TikTok / Reels / Shorts) */}
          {showSafeZones && videoUrl && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 20
            }}>
              {/* Top Profile / Header Safe Zone */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '12%',
                borderBottom: '1px dashed rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500', letterSpacing: '0.04em' }}>
                  HEADER SAFE ZONE
                </span>
              </div>

              {/* Right Action Icons Safe Zone */}
              <div style={{
                position: 'absolute',
                top: '12%',
                bottom: '15%',
                right: 0,
                width: '15%',
                borderLeft: '1px dashed rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500', transform: 'rotate(90deg)', letterSpacing: '0.04em' }}>
                  ACTIONS
                </span>
              </div>

              {/* Bottom Caption Safe Zone */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '15%',
                borderTop: '1px dashed rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500', letterSpacing: '0.04em' }}>
                  UI / CAPTIONS
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Docked Floating Glass Transport Controls Overlay */}
      {videoUrl && (
        <div style={{
          position: 'absolute',
          bottom: '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 35,
          pointerEvents: 'auto',
          width: 'calc(100% - 28px)',
          maxWidth: `${Math.max(340, Math.min(transform.displayW, 460))}px`,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <TransportControls
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            volume={volume}
            isMuted={isMuted}
            playbackRate={playbackRate}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSeekChange={handleSeekChange}
            onSetVolume={setVolume}
            onSetIsMuted={setIsMuted}
            onSetPlaybackRate={(rate) => {
              setPlaybackRate(rate);
              if (videoRef.current) videoRef.current.playbackRate = rate;
            }}
          />
        </div>
      )}
    </div>
  );
};
