import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  X, 
  CheckCircle2, 
  Smartphone, 
  Square, 
  Tv, 
  Loader2, 
  AlertCircle,
  FileCheck,
  ExternalLink,
  Zap,
  Cpu,
  Ban,
  Sparkles,
  Film
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { ClientSceneExporter } from '../engine/sceneExporter';
import { sanitizeStyle } from '../engine/presets';
import { measureAllSegmentsLayout } from '../engine/layoutMeasurer';
import { videoSourceCache } from '../engine/videoSourceCache';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ExportModal = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    videoFile,
    videoUrl,
    videoFilename,
    videoFps,
    videoWidth,
    videoHeight,
    duration,
    segments,
    style,
    backendAvailable,
    aspectRatio,
    linkedSourcePath,
    isMediaLinked,
    activeProjectTitle,
    replaceProjectVideo,
    setUpscaleModalOpen
  } = useEditorStore();

  const [selectedAspect, setSelectedAspect] = useState(aspectRatio || '9:16');
  const [aiUpscale, setAiUpscale] = useState(true);
  const [aiModel, setAiModel] = useState('realesr-animevideov3');
  const [cleanResultUrl, setCleanResultUrl] = useState(null);
  const [exportStageMessage, setExportStageMessage] = useState('');

  const getCleanProjectBase = () => {
    const raw = (activeProjectTitle || videoFilename || 'Untitled Project').trim();
    return raw
      .replace(/\.[^/.]+$/, '')
      .replace(/[/\\?%*:|"<>]/g, '')
      .trim() || 'Untitled Project';
  };

  const [customFilename, setCustomFilename] = useState(getCleanProjectBase());
  
  // Compute native video dimensions
  const nativeW = videoWidth > 0 ? videoWidth : (aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 720 : aspectRatio === '4:3' ? 960 : 720);
  const nativeH = videoHeight > 0 ? videoHeight : (aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 720 : aspectRatio === '4:3' ? 720 : 1280);

  const getResolutionTiers = (aspect, srcW, srcH) => {
    switch (aspect) {
      case '16:9':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1920x1080', label: 'Full HD 1080p', sub: '1920 × 1080', tier: '1080p' },
          { id: '3840x2160', label: '4K Ultra HD', sub: '3840 × 2160', tier: '4k' }
        ];
      case '4:3':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1440x1080', label: 'Full HD 1080p', sub: '1440 × 1080', tier: '1080p' },
          { id: '2880x2160', label: '4K Ultra HD', sub: '2880 × 2160', tier: '4k' }
        ];
      case '1:1':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1080x1080', label: 'Full HD 1080p', sub: '1080 × 1080', tier: '1080p' },
          { id: '2160x2160', label: '4K Ultra HD', sub: '2160 × 2160', tier: '4k' }
        ];
      case '4:5':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1080x1350', label: 'Full HD 1080p', sub: '1080 × 1350', tier: '1080p' },
          { id: '2160x2700', label: '4K Ultra HD', sub: '2160 × 2700', tier: '4k' }
        ];
      case '9:16':
      default:
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1080x1920', label: 'Full HD 1080p', sub: '1080 × 1920', tier: '1080p' },
          { id: '2160x3840', label: '4K Ultra HD', sub: '2160 × 3840', tier: '4k' }
        ];
    }
  };

  const resolutionTiers = getResolutionTiers(selectedAspect, nativeW, nativeH);
  const [resolution, setResolution] = useState(
    aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '1:1' ? '1080x1080' : aspectRatio === '4:3' ? '1440x1080' : '1920x1080'
  );
  const [quality, setQuality] = useState('high'); // 'high' | 'very_high' | 'medium'
  const [encoderMode] = useState('gpu_nvenc'); // 'gpu_nvenc' | 'cpu'

  const [isExporting, setIsExporting] = useState(false);
  const [exportStats, setExportStats] = useState({ percent: 0, currentFrame: 0, totalFrames: 0, fps: 0, etaSeconds: 0, stage: 'idle', message: '' });
  const [exportResultUrl, setExportResultUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const clientExporterRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  const finalBaseName = (customFilename || getCleanProjectBase()).replace(/\.[^/.]+$/, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Untitled Project';
  const finalFilename = `${finalBaseName}.mp4`;

  const handleDownloadFile = async (url, filename) => {
    if (!url) return;
    try {
      if (url.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const cleanFname = (filename || url.split('/').pop() || 'captioned_video.mp4').replace(/[/\\?%*:|"<>]/g, '');
      const downloadUrl = `${BACKEND_URL}/api/download/${encodeURIComponent(cleanFname)}`;

      try {
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = cleanFname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
          return;
        }
      } catch (fetchErr) {
        console.warn('Direct blob download error, falling back to hidden iframe:', fetchErr);
      }

      // Hidden iframe fallback never navigates away from the project
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (_) {}
      }, 15000);
    } catch (err) {
      console.error('Download trigger error:', err);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (clientExporterRef.current) {
        clientExporterRef.current.cancel();
      }
      videoSourceCache.clear();
    };
  }, []);

  useEffect(() => {
    if (isExportModalOpen) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      activeJobIdRef.current = null;
      setIsExporting(false);
      setExportStats({ percent: 0, currentFrame: 0, totalFrames: 0, fps: 0, etaSeconds: 0, stage: 'idle', message: '' });
      setExportResultUrl(null);
      setCleanResultUrl(null);
      setErrorMessage(null);
      setExportStageMessage('');
      setCustomFilename(getCleanProjectBase());
    }
  }, [isExportModalOpen, activeProjectTitle, videoFilename]);

  if (!isExportModalOpen) return null;

  const handleCancelExport = async () => {
    if (clientExporterRef.current) {
      clientExporterRef.current.cancel();
      clientExporterRef.current = null;
    }
    videoSourceCache.clear();

    const currentJobId = activeJobIdRef.current;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (currentJobId && backendAvailable) {
      try {
        await fetch(`${BACKEND_URL}/api/upscale-cancel/${currentJobId}`, {
          method: 'POST'
        });
      } catch (err) {
        console.warn('Cancel upscale request error:', err);
      }
      try {
        await fetch(`${BACKEND_URL}/api/render-cancel/${currentJobId}`, {
          method: 'POST'
        });
      } catch (err) {
        console.warn('Cancel render request error:', err);
      }
    }

    activeJobIdRef.current = null;
    setIsExporting(false);
    setExportStats({ percent: 0, currentFrame: 0, totalFrames: 0, etaSeconds: 0 });
    setErrorMessage('Export cancelled by user.');
  };

  const handleClose = () => {
    if (isExporting) {
      handleCancelExport();
    }
    setExportModalOpen(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportStats({
      percent: 2,
      currentFrame: 0,
      totalFrames: 0,
      fps: 0,
      etaSeconds: 0,
      stage: 'starting',
      message: 'Preparing export pipeline...'
    });
    setErrorMessage(null);
    setExportResultUrl(null);
    setCleanResultUrl(null);

    const [w, h] = resolution.split('x').map(Number);
    let effectiveVideoUrl = videoUrl || (linkedSourcePath ? `${BACKEND_URL}/api/media/stream?path=${encodeURIComponent(linkedSourcePath)}` : '');
    let effectiveVideoFile = videoFile;

    try {
      let upscaledData = null;

      // ---------------------------------------------------------------------
      // PHASE 1: AI Super-Resolution (Real-ESRGAN Vulkan) if enabled
      // ---------------------------------------------------------------------
      if (aiUpscale && backendAvailable) {
        setExportStats((prev) => ({
          ...prev,
          percent: 5,
          stage: 'upscaling',
          message: 'Phase 1/2: Preparing source video for AI Super-Resolution...'
        }));

        let effectiveFilename = videoFilename || (linkedSourcePath ? linkedSourcePath.split(/[/\\]/).pop() : (videoFile ? videoFile.name : ''));

        // If user loaded a file in memory and it is not on backend disk, auto-upload first
        if (videoFile instanceof File && !linkedSourcePath) {
          try {
            setExportStats((prev) => ({
              ...prev,
              percent: 6,
              stage: 'uploading',
              message: 'Uploading source video to AI engine...'
            }));
            const formData = new FormData();
            formData.append('file', videoFile);
            const uploadRes = await fetch(`${BACKEND_URL}/api/upload-video`, {
              method: 'POST',
              body: formData
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.video_filename) {
                effectiveFilename = uploadData.video_filename;
              }
            }
          } catch (upErr) {
            console.warn('Source auto-upload fallback error:', upErr);
          }
        }

        const upscaleScale = (w <= nativeW * 2.2 && h <= nativeH * 2.2) ? 2 : 4;
        const upscalePayload = {
          video_filename: effectiveFilename,
          linked_path: linkedSourcePath || null,
          scale: upscaleScale,
          model_name: aiModel || 'realesr-animevideov3',
          target_width: w,
          target_height: h,
          encoder_mode: encoderMode || 'gpu_nvenc'
        };

        const res = await fetch(`${BACKEND_URL}/api/upscale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(upscalePayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to start AI upscaling job');
        }

        const data = await res.json();
        const jobId = data.job_id;
        activeJobIdRef.current = jobId;

        // Poll AI upscaling progress until complete
        upscaledData = await new Promise((resolve, reject) => {
          pollIntervalRef.current = setInterval(async () => {
            try {
              const pRes = await fetch(`${BACKEND_URL}/api/upscale-progress/${jobId}`);
              if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.status === 'cancelled') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error('AI Upscaling cancelled'));
                  return;
                }
                if (pData.status === 'error') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error(pData.error || 'AI Upscaling failed'));
                  return;
                }

                const rawPct = Math.max(0, Math.min(100, typeof pData.percent === 'number' ? pData.percent : 0));
                // Scale from 5% to 70% of total export progress
                const combinedPct = 5 + Math.round((rawPct / 100) * 65);

                setExportStats({
                  percent: combinedPct,
                  currentFrame: pData.current_frame || 0,
                  totalFrames: pData.total_frames || 0,
                  fps: pData.fps || 0,
                  etaSeconds: pData.eta_seconds || 0,
                  stage: 'upscaling',
                  message: `Phase 1/2 [AI Upscaling]: Frame ${pData.current_frame || 0}/${pData.total_frames || 0} ${pData.fps > 0 ? `(${pData.fps} FPS)` : ''}`
                });

                if (pData.status === 'done') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  resolve(pData);
                }
              }
            } catch (pollErr) {
              console.warn('Upscale progress polling error:', pollErr);
            }
          }, 350);
        });

        activeJobIdRef.current = null;

        // Buffer upscaled video directly into high-speed in-memory Blob
        setExportStats((prev) => ({
          ...prev,
          percent: 71,
          stage: 'preparing',
          message: 'Phase 1/2: Buffering high-resolution video into memory...'
        }));

        const cleanDownloadPath = upscaledData.download_url?.startsWith('/')
          ? upscaledData.download_url
          : `/static/exports/${encodeURIComponent(upscaledData.output_filename)}`;
        const upscaledCleanUrl = `${BACKEND_URL}${cleanDownloadPath}`;

        let upscaledBlob = null;
        try {
          const fetchRes = await fetch(upscaledCleanUrl);
          if (fetchRes.ok) {
            upscaledBlob = await fetchRes.blob();
          }
        } catch (fetchErr) {
          console.warn('Could not fetch upscaled video into blob buffer:', fetchErr);
        }

        let upscaledFile = null;
        let upscaledBlobUrl = upscaledCleanUrl;
        if (upscaledBlob) {
          upscaledBlobUrl = URL.createObjectURL(upscaledBlob);
          upscaledFile = new File([upscaledBlob], upscaledData.output_filename, { type: 'video/mp4' });
        }

        setCleanResultUrl(upscaledCleanUrl);

        if (typeof replaceProjectVideo === 'function') {
          replaceProjectVideo({
            videoFile: upscaledFile,
            videoFilename: upscaledData.output_filename,
            videoUrl: upscaledCleanUrl,
            linkedSourcePath: null,
            width: upscaledData.width || w,
            height: upscaledData.height || h,
            fps: upscaledData.fps || videoFps || 30
          });
        }

        // Clear frame cache to force decoding from newly upscaled video
        videoSourceCache.clear();
        effectiveVideoUrl = upscaledBlobUrl;
        effectiveVideoFile = upscaledFile;
      }

      // ---------------------------------------------------------------------
      // PHASE 2: Client Canvas Video Export (100% Visual Parity)
      // ---------------------------------------------------------------------
      setExportStats({
        percent: aiUpscale ? 72 : 5,
        currentFrame: 0,
        totalFrames: 0,
        fps: 0,
        etaSeconds: 0,
        stage: 'rendering',
        message: aiUpscale
          ? 'Phase 2/2: Burning in styled captions with 100% parity...'
          : 'Encoding video frames with styled captions...'
      });

      const targetFps = (upscaledData && upscaledData.fps) ? upscaledData.fps : (videoFps || 30);
      const targetDuration = (upscaledData && upscaledData.duration) ? upscaledData.duration : (duration || 10);

      const exporter = new ClientSceneExporter({
        width: w,
        height: h,
        fps: targetFps,
        format: 'mp4',
        quality
      });
      clientExporterRef.current = exporter;

      const blob = await exporter.exportVideo({
        videoFile: effectiveVideoFile,
        videoUrl: effectiveVideoUrl,
        duration: targetDuration,
        segments,
        style: sanitizeStyle(style),
        onProgress: (stats) => {
          const basePct = aiUpscale ? 72 : 5;
          const pctRange = aiUpscale ? 27 : 94;
          const combinedPercent = Math.min(99, Math.round(basePct + ((stats.percent || 0) / 100) * pctRange));

          setExportStats({
            percent: combinedPercent,
            currentFrame: stats.currentFrame,
            totalFrames: stats.totalFrames,
            fps: stats.fps || 0,
            etaSeconds: stats.etaSeconds,
            stage: 'rendering',
            message: aiUpscale
              ? `Phase 2/2: Frame ${stats.currentFrame}/${stats.totalFrames} (100% Canvas Parity)`
              : `Encoding frame ${stats.currentFrame}/${stats.totalFrames}`
          });
        }
      });

      const blobUrl = URL.createObjectURL(blob);
      setExportResultUrl(blobUrl);
      setExportStats({
        percent: 100,
        currentFrame: 0,
        totalFrames: 0,
        fps: 0,
        etaSeconds: 0,
        stage: 'completed',
        message: 'Export Complete!'
      });
      setIsExporting(false);
    } catch (err) {
      if (!err.message?.toLowerCase().includes('cancel')) {
        console.error('Export Error:', err);
        setErrorMessage(err.message || 'Export failed.');
      }
      setIsExporting(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (exportResultUrl) {
      window.open(exportResultUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="modal-backdrop">
      <div 
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} color="var(--accent-bright-blue)" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Export Video</span>
          </div>
          <button
            onClick={handleClose}
            className="btn-ghost"
            style={{ padding: '4px' }}
            title={isExporting ? 'Cancel & Close' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* File Name Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                File Name
              </label>
              <span style={{ fontSize: '10px', color: 'var(--accent-bright-blue)', fontWeight: '500' }}>
                Project Name
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0 10px'
            }}>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                disabled={isExporting}
                placeholder="Project Name"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '7px 0',
                  outline: 'none',
                  fontWeight: '500'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                .mp4
              </span>
            </div>
          </div>

          {/* Aspect Ratio Selector Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Framing & Aspect Ratio
              </label>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                Native: {nativeW} × {nativeH}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
              {[
                { id: '9:16', label: '9:16', sub: 'Reels/TikTok' },
                { id: '16:9', label: '16:9', sub: 'YouTube' },
                { id: '4:3', label: '4:3', sub: 'Classic' },
                { id: '1:1', label: '1:1', sub: 'Square' },
                { id: '4:5', label: '4:5', sub: 'Portrait' }
              ].map((asp) => {
                const isSelected = selectedAspect === asp.id;
                return (
                  <button
                    key={asp.id}
                    type="button"
                    onClick={() => {
                      if (!isExporting) {
                        setSelectedAspect(asp.id);
                        const tiers = getResolutionTiers(asp.id, nativeW, nativeH);
                        // Default to 1080p tier for that aspect
                        const defaultTier = tiers.find(t => t.tier === '1080p') || tiers[1] || tiers[0];
                        setResolution(defaultTier.id);
                      }
                    }}
                    style={{
                      padding: '6px 2px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: isSelected ? '700' : '600', color: isSelected ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      {asp.label}
                    </span>
                    <span style={{ fontSize: '8px', color: 'var(--text-tertiary)', letterSpacing: '-0.2px' }}>
                      {asp.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Tiers (Original 1x, Full HD 1080p, 4K Ultra HD) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Export Resolution Tier
              </label>
              <span style={{ fontSize: '10px', color: 'var(--accent-bright-blue)', fontWeight: '600' }}>
                1:1 Invariant Captions
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {resolutionTiers.map((res) => {
                const isSelected = resolution === res.id;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => !isExporting && setResolution(res.id)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 'var(--radius-md)',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: isSelected ? '700' : '600', color: isSelected ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      {res.label}
                    </span>
                    <span style={{ fontSize: '9px', color: isSelected ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: '500' }}>
                      {res.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Super-Resolution All-in-One Card (Real-ESRGAN Vulkan) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: aiUpscale ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface)',
              border: aiUpscale ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color={aiUpscale ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      ⚡ AI Upscale & Export (All-in-One)
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        background: 'rgba(56, 189, 248, 0.18)',
                        color: 'var(--accent-bright-blue)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      Vulkan GPU
                    </span>
                  </div>
                </div>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', margin: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={aiUpscale}
                  onChange={(e) => setAiUpscale(e.target.checked)}
                  disabled={isExporting}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: aiUpscale ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.18)',
                    transition: '0.2s',
                    borderRadius: '20px'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '',
                      height: '16px',
                      width: '16px',
                      left: aiUpscale ? '18px' : '2px',
                      bottom: '2px',
                      backgroundColor: 'white',
                      transition: '0.2s',
                      borderRadius: '50%'
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              {aiUpscale 
                ? 'Super-resolves 720p/HD source frames with local Real-ESRGAN Vulkan AI before burning in styled captions for pristine 1080p or 4K sharpness.' 
                : 'Standard fast export: renders directly at the selected resolution without neural frame reconstruction.'}
            </div>

            {aiUpscale && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '10.5px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    AI Enhancement Model
                  </label>
                  <span style={{ fontSize: '9.5px', color: 'var(--system-success)', fontWeight: '600' }}>
                    Dual Output Included
                  </span>
                </div>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  disabled={isExporting}
                  style={{
                    width: '100%',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="realesr-animevideov3">Real-ESRGAN Video V3 (Fast & Smooth 30/60 FPS) [Recommended]</option>
                  <option value="realesrgan-x4plus">Real-ESRGAN+ (Photorealistic Detail & Textures)</option>
                </select>
                <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
                  💡 Both your <b>captioned video</b> and a <b>clean uncaptioned upscaled master</b> will be generated in this single run.
                </div>
              </div>
            )}
          </div>

          {/* Quality & Native Framerate Display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Video Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={isExporting}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="high" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>High (Recommended)</option>
                <option value="very_high" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Very High (Crisp / 4K)</option>
                <option value="medium" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Medium (Compact)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Framerate
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                height: '31px',
                boxSizing: 'border-box'
              }}>
                <Film size={13} color="var(--accent-bright-blue)" />
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                  {videoFps ? `${videoFps} FPS (Native)` : 'Native Source FPS'}
                </span>
              </div>
            </div>
          </div>


          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 69, 58, 0.12)',
              border: '1px solid rgba(255, 69, 58, 0.3)',
              color: 'var(--system-error)',
              fontSize: '11px'
            }}>
              <AlertCircle size={13} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Live Progress Bar */}
          {isExporting && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {aiUpscale && (exportStats.stage === 'upscaling' || exportStats.percent < 70) ? (
                    <Sparkles size={14} color="var(--accent-bright-blue)" className="animate-spin" />
                  ) : (
                    <Loader2 size={14} color="var(--accent-bright-blue)" className="animate-spin" />
                  )}
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {aiUpscale
                      ? (exportStats.stage === 'upscaling' || exportStats.percent < 70
                          ? 'Phase 1/2: AI Super-Resolution (Real-ESRGAN Vulkan)'
                          : 'Phase 2/2: Burning in 1:1 Styled Captions')
                      : 'Encoding video frames...'}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-bright-blue)', fontFamily: 'SF Mono, monospace' }}>
                  {exportStats.percent}%
                </span>
              </div>

              <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div style={{
                  width: `${exportStats.percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-primary), #38bdf8)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 200ms ease'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                <span>
                  {exportStats.totalFrames > 0
                    ? `Frame ${exportStats.currentFrame} / ${exportStats.totalFrames} ${exportStats.fps > 0 ? `(${exportStats.fps} FPS)` : ''}`
                    : (exportStats.message || 'Processing...')}
                </span>
                {exportStats.etaSeconds > 0 && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    ~{exportStats.etaSeconds}s remaining
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Export Complete Result */}
          {exportResultUrl && (
            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(52, 199, 89, 0.08)',
              border: '1.5px solid rgba(52, 199, 89, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              color: 'var(--system-success)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '700' }}>
                  <FileCheck size={18} />
                  <span>{aiUpscale ? '🎉 AI Upscale & Export Complete!' : '🎉 Export Complete!'}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '25px', wordBreak: 'break-all', fontWeight: '500' }}>
                  {finalFilename}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(exportResultUrl, finalFilename)}
                    className="btn-primary"
                    style={{
                      justifyContent: 'center',
                      fontSize: '11px',
                      padding: '8px 10px',
                      fontWeight: '700',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                    title={`Download ${finalFilename}`}
                  >
                    <Download size={13} />
                    <span>Download Captioned Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="btn-secondary"
                    style={{ justifyContent: 'center', fontSize: '11px', padding: '8px 10px', gap: '6px', cursor: 'pointer' }}
                  >
                    <ExternalLink size={13} />
                    <span>Preview ↗</span>
                  </button>
                </div>

                {cleanResultUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(cleanResultUrl, `clean_${finalFilename}`)}
                    className="btn-secondary"
                    style={{
                      justifyContent: 'center',
                      fontSize: '10.5px',
                      padding: '6px 10px',
                      borderColor: 'rgba(56, 189, 248, 0.4)',
                      color: 'var(--accent-bright-blue)',
                      background: 'rgba(56, 189, 248, 0.08)',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                    title="Download pristine upscaled video without burned-in captions"
                  >
                    <Film size={12} />
                    <span>Download Clean Upscaled Master (Without Captions)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px',
          background: 'var(--bg-surface)'
        }}>
          {isExporting ? (
            <button
              onClick={handleCancelExport}
              className="btn-secondary"
              style={{ color: 'var(--system-error)', borderColor: 'rgba(255, 69, 58, 0.3)' }}
            >
              <Ban size={12} />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              onClick={() => setExportModalOpen(false)}
              className="btn-secondary"
            >
              {exportResultUrl ? 'Done' : 'Cancel'}
            </button>
          )}

          {!exportResultUrl && !isExporting && (
            <button
              onClick={handleExport}
              className="btn-primary"
              style={{
                gap: '6px',
                padding: '7px 14px',
                fontWeight: '700'
              }}
            >
              {aiUpscale ? (
                <>
                  <Sparkles size={14} />
                  <span>⚡ AI Upscale & Export ({resolutionTiers.find(t => t.id === resolution)?.tier === '4k' ? '4K' : '1080p'})</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Export Video ({resolutionTiers.find(t => t.id === resolution)?.tier === '4k' ? '4K' : '1080p'})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
