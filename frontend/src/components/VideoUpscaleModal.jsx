import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Download,
  ExternalLink,
  Film,
  Layers,
  Cpu,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const VideoUpscaleModal = () => {
  const {
    isUpscaleModalOpen,
    setUpscaleModalOpen,
    videoFilename,
    linkedSourcePath,
    videoWidth,
    videoHeight,
    videoFps,
    duration,
    aspectRatio,
    replaceProjectVideo,
    backendAvailable
  } = useEditorStore();

  const [scale, setScale] = useState(2); // 2 or 4
  const [modelName, setModelName] = useState('realesr-animevideov3');
  const [encoderMode, setEncoderMode] = useState('gpu_nvenc'); // 'gpu_nvenc' | 'cpu'
  const [resolutionMode, setResolutionMode] = useState('standard_tier'); // 'standard_tier' (1080p / 4K) | 'exact_multiplier' (2x / 4x)
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState({
    percent: 0,
    current_frame: 0,
    total_frames: 0,
    fps: 0,
    eta_seconds: 0,
    stage: 'idle',
    message: ''
  });
  const [upscaledResult, setUpscaledResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [installedModels, setInstalledModels] = useState([]);
  const [engineInstalled, setEngineInstalled] = useState(true);

  const activeJobIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Compute source dimensions and aspect ratio
  const srcW = videoWidth > 0 ? videoWidth : (aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 720 : aspectRatio === '4:3' ? 960 : 720);
  const srcH = videoHeight > 0 ? videoHeight : (aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 720 : aspectRatio === '4:3' ? 720 : 1280);
  const isVertical = srcH >= srcW;

  // Calculate target dimensions based on scale & aspect ratio
  const getTargetDimensions = (targetScale, mode) => {
    if (mode === 'exact_multiplier') {
      const w = srcW * targetScale;
      const h = srcH * targetScale;
      return { width: w % 2 === 0 ? w : w + 1, height: h % 2 === 0 ? h : h + 1, label: `${targetScale}x Native (${w} × ${h})` };
    }

    // Standard Industry Tiers (Full HD 1080p or 4K Ultra HD) adapted to aspect ratio
    if (targetScale === 2) {
      if (aspectRatio === '16:9' || (!isVertical && Math.abs(srcW / srcH - 16 / 9) < 0.15)) {
        return { width: 1920, height: 1080, label: '1080p Full HD (1920 × 1080)' };
      } else if (aspectRatio === '1:1' || Math.abs(srcW / srcH - 1.0) < 0.1) {
        return { width: 1080, height: 1080, label: '1080p Square (1080 × 1080)' };
      } else if (aspectRatio === '4:3' || Math.abs(srcW / srcH - 4 / 3) < 0.15) {
        return { width: 1440, height: 1080, label: '1080p Classic 4:3 (1440 × 1080)' };
      } else if (aspectRatio === '4:5' || Math.abs(srcW / srcH - 4 / 5) < 0.15) {
        return { width: 1080, height: 1350, label: '1080p Portrait 4:5 (1080 × 1350)' };
      } else {
        return { width: 1080, height: 1920, label: '1080p Vertical HD (1080 × 1920)' };
      }
    } else {
      // 4K Ultra HD
      if (aspectRatio === '16:9' || (!isVertical && Math.abs(srcW / srcH - 16 / 9) < 0.15)) {
        return { width: 3840, height: 2160, label: '4K Ultra HD (3840 × 2160)' };
      } else if (aspectRatio === '1:1' || Math.abs(srcW / srcH - 1.0) < 0.1) {
        return { width: 2160, height: 2160, label: '4K Square (2160 × 2160)' };
      } else if (aspectRatio === '4:3' || Math.abs(srcW / srcH - 4 / 3) < 0.15) {
        return { width: 2880, height: 2160, label: '4K Classic 4:3 (2880 × 2160)' };
      } else if (aspectRatio === '4:5' || Math.abs(srcW / srcH - 4 / 5) < 0.15) {
        return { width: 2160, height: 2700, label: '4K Portrait 4:5 (2160 × 2700)' };
      } else {
        return { width: 2160, height: 3840, label: '4K Ultra HD Vertical (2160 × 3840)' };
      }
    }
  };

  const targetDim = getTargetDimensions(scale, resolutionMode);

  // Fetch models on mount / open
  useEffect(() => {
    if (isUpscaleModalOpen && backendAvailable) {
      fetch(`${BACKEND_URL}/api/upscale-models`)
        .then((res) => res.json())
        .then((data) => {
          if (data.models) setInstalledModels(data.models);
          if (typeof data.installed === 'boolean') setEngineInstalled(data.installed);
        })
        .catch((e) => console.warn('Could not query upscale models:', e));
    }
  }, [isUpscaleModalOpen, backendAvailable]);

  // Clean up poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  if (!isUpscaleModalOpen) return null;

  const handleCancel = async () => {
    const jobId = activeJobIdRef.current;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (jobId && backendAvailable) {
      try {
        await fetch(`${BACKEND_URL}/api/upscale-cancel/${jobId}`, { method: 'POST' });
      } catch (err) {
        console.warn('Cancel upscale error:', err);
      }
    }
    activeJobIdRef.current = null;
    setIsProcessing(false);
    setProgressData((prev) => ({ ...prev, stage: 'cancelled', message: 'Upscaling cancelled.' }));
  };

  const handleClose = () => {
    if (isProcessing) {
      handleCancel();
    }
    setUpscaleModalOpen(false);
  };

  const handleStartUpscale = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setUpscaledResult(null);
    setProgressData({
      percent: 2,
      current_frame: 0,
      total_frames: 0,
      fps: 0,
      eta_seconds: 0,
      stage: 'preparing',
      message: 'Initializing Real-ESRGAN Vulkan AI pipeline...'
    });

    try {
      const payload = {
        video_filename: videoFilename,
        linked_path: linkedSourcePath,
        scale: scale,
        model_name: modelName,
        target_width: targetDim.width,
        target_height: targetDim.height,
        encoder_mode: encoderMode
      };

      const res = await fetch(`${BACKEND_URL}/api/upscale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to start upscale job.');
      }

      const data = await res.json();
      const jobId = data.job_id;
      activeJobIdRef.current = jobId;

      pollIntervalRef.current = setInterval(async () => {
        try {
          const pRes = await fetch(`${BACKEND_URL}/api/upscale-progress/${jobId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setProgressData(pData);

            if (pData.status === 'done') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsProcessing(false);
              setUpscaledResult({
                download_url: `${BACKEND_URL}${pData.download_url}`,
                output_filename: pData.output_filename,
                output_path: pData.output_path,
                width: pData.width,
                height: pData.height,
                fps: pData.fps,
                duration: pData.duration
              });
            } else if (pData.status === 'error') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsProcessing(false);
              setErrorMessage(pData.error || 'Upscale failed.');
            } else if (pData.status === 'cancelled') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setIsProcessing(false);
            }
          }
        } catch (_) {}
      }, 350);
    } catch (err) {
      console.error('Upscale error:', err);
      setErrorMessage(err.message || 'Upscaling failed.');
      setIsProcessing(false);
    }
  };

  const handleApplyToProject = async () => {
    if (!upscaledResult) return;
    let upscaledFile = null;
    try {
      const res = await fetch(upscaledResult.download_url);
      if (res.ok) {
        const blob = await res.blob();
        upscaledFile = new File([blob], upscaledResult.output_filename, { type: 'video/mp4' });
      }
    } catch (_) {}

    replaceProjectVideo({
      videoFile: upscaledFile,
      videoFilename: upscaledResult.output_filename,
      videoUrl: upscaledResult.download_url,
      linkedSourcePath: null,
      width: upscaledResult.width,
      height: upscaledResult.height,
      fps: upscaledResult.fps
    });
    setUpscaleModalOpen(false);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.35)'
              }}
            >
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  AI Video Super-Resolution
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-bright-blue)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  Real-ESRGAN Vulkan
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Enhance Kling 720p / HD footage to silky-smooth 1080p & 4K Ultra HD
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn-ghost"
            style={{ padding: '6px' }}
            title={isProcessing ? 'Cancel & Close' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* Video Status Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Film size={18} color="var(--accent-bright-blue)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {videoFilename || (linkedSourcePath ? linkedSourcePath.split(/[/\\]/).pop() : 'Active Project Media')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Native: <strong style={{ color: 'var(--text-secondary)' }}>{srcW} × {srcH}</strong> ({videoFps || 30} FPS, {duration ? `${duration.toFixed(1)}s` : 'Unknown'})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <ArrowRight size={14} color="var(--text-tertiary)" />
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--accent-bright-blue)'
                }}
              >
                {targetDim.width} × {targetDim.height}
              </div>
            </div>
          </div>

          {/* Upscale Scale Selector (2x Full HD vs 4x 4K) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Super-Resolution Target Tier
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => !isProcessing && setScale(2)}
                disabled={isProcessing}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  border: scale === 2 ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: scale === 2 ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: scale === 2 ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                    2x Full HD (1080p)
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      padding: '2px 5px',
                      borderRadius: '4px'
                    }}
                  >
                    Recommended
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Target: <strong>{getTargetDimensions(2, resolutionMode).width} × {getTargetDimensions(2, resolutionMode).height}</strong>
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Optimal speed & sharpness for social feeds (TikTok, Reels, Shorts).
                </span>
              </button>

              <button
                type="button"
                onClick={() => !isProcessing && setScale(4)}
                disabled={isProcessing}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  border: scale === 4 ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: scale === 4 ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: scale === 4 ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                    4x 4K Ultra HD
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#a855f7',
                      padding: '2px 5px',
                      borderRadius: '4px'
                    }}
                  >
                    Max Fidelity
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Target: <strong>{getTargetDimensions(4, resolutionMode).width} × {getTargetDimensions(4, resolutionMode).height}</strong>
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Pristine pixel density for high-end displays & YouTube 4K.
                </span>
              </button>
            </div>
          </div>

          {/* Model & Dimension Mode Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                AI Model Engine
              </label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '7px 8px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="realesr-animevideov3" style={{ background: 'var(--bg-panel)' }}>
                  Video V3 (Smooth 30/60 FPS, No Flicker)
                </option>
                <option value="realesrgan-x4plus" style={{ background: 'var(--bg-panel)' }}>
                  Real-ESRGAN+ (Photorealistic Detail)
                </option>
                <option value="realesrnet-x4plus" style={{ background: 'var(--bg-panel)' }}>
                  Real-ESRNet+ (Natural Balanced)
                </option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Resolution Framing
              </label>
              <select
                value={resolutionMode}
                onChange={(e) => setResolutionMode(e.target.value)}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '7px 8px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="standard_tier" style={{ background: 'var(--bg-panel)' }}>
                  Standard Tier (1080p / 4K)
                </option>
                <option value="exact_multiplier" style={{ background: 'var(--bg-panel)' }}>
                  Exact Multiplier ({scale}x Native)
                </option>
              </select>
            </div>
          </div>

          {/* Hardware & Safety Guarantee Banner */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <Zap size={15} color="var(--accent-bright-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              <strong style={{ color: 'var(--text-primary)' }}>1:1 Caption Positioning Invariant:</strong> Caption alignment, word wrapping, and font scales automatically adjust in exact mathematical proportion without vertical drift or re-wrapping.
            </div>
          </div>

          {/* Live Progress Card */}
          {isProcessing && (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent-primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="spinner" color="var(--accent-bright-blue)" />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {progressData.message || 'Processing AI super-resolution...'}
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-bright-blue)' }}>
                  {progressData.percent || 0}%
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${progressData.percent || 0}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              {/* Metric Chips */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                <span>
                  Frames: <strong style={{ color: 'var(--text-secondary)' }}>{progressData.current_frame || 0} / {progressData.total_frames || '...'}</strong>
                </span>
                {progressData.fps > 0 && (
                  <span>
                    Speed: <strong style={{ color: 'var(--text-secondary)' }}>{progressData.fps} FPS</strong>
                  </span>
                )}
                {progressData.eta_seconds > 0 && (
                  <span>
                    ETA: <strong style={{ color: 'var(--text-secondary)' }}>{Math.floor(progressData.eta_seconds / 60)}m {progressData.eta_seconds % 60}s</strong>
                  </span>
                )}
                <span>
                  Engine: <strong style={{ color: '#22c55e' }}>Vulkan GPU</strong>
                </span>
              </div>
            </div>
          )}

          {/* Success Card */}
          {upscaledResult && !isProcessing && (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#22c55e" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Super-Resolution Complete!
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginLeft: 'auto'
                  }}
                >
                  {upscaledResult.width} × {upscaledResult.height}
                </span>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Generated pristine <strong>{upscaledResult.output_filename}</strong> at native {upscaledResult.fps} FPS. You can replace the project video right now to edit directly in high resolution.
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleApplyToProject}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles size={14} />
                  Apply to Project Video
                </button>

                <a
                  href={upscaledResult.download_url}
                  download={upscaledResult.output_filename}
                  className="btn-ghost"
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    color: 'var(--text-primary)'
                  }}
                >
                  <Download size={13} />
                  Download
                </a>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 69, 58, 0.12)',
                border: '1px solid rgba(255, 69, 58, 0.3)',
                color: 'var(--accent-red)',
                fontSize: '11px'
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
            <Cpu size={12} />
            <span>NCNN Vulkan GPU Acceleration</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing ? (
              <button
                type="button"
                onClick={handleCancel}
                className="btn-ghost"
                style={{
                  padding: '7px 14px',
                  fontSize: '11px',
                  color: 'var(--accent-red)',
                  fontWeight: '600'
                }}
              >
                Cancel Super-Resolution
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-ghost"
                  style={{
                    padding: '7px 14px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleStartUpscale}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                  }}
                >
                  <Sparkles size={14} />
                  Start {scale}x AI Super-Resolution
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
