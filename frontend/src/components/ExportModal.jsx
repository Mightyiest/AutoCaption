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
  Film,
  RefreshCw
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { ClientSceneExporter, exportTransparentCaptionTrack } from '../engine/sceneExporter';
import { sanitizeStyle } from '../engine/presets';
import { measureAllSegmentsLayout } from '../engine/layoutMeasurer';
import { videoSourceCache } from '../engine/videoSourceCache';
import { isTempOrGeneratedName } from '../engine/mediaLinker';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ExportModal = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    videoFile,
    videoUrl,
    videoFilename,
    originalFilename,
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
    activeProjectId,
    activeProjectTitle,
    replaceProjectVideo,
    setUpscaleModalOpen,
    lastExportResult,
    setLastExportResult,
    videoBrightness,
    videoContrast
  } = useEditorStore();

  const getCleanProjectBase = () => {
    let raw = originalFilename || (videoFile && videoFile.name) || (linkedSourcePath && linkedSourcePath.split(/[/\\]/).pop());
    if (!raw || isTempOrGeneratedName(raw)) {
      raw = (!isTempOrGeneratedName(activeProjectTitle) && activeProjectTitle) ? activeProjectTitle : (!isTempOrGeneratedName(videoFilename) ? videoFilename : 'Untitled Project');
    }
    const clean = raw
      .replace(/\.[^/.]+$/, '')
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/_captioned$/i, '')
      .trim();
    return clean || 'Untitled Project';
  };

  // Compute native video dimensions
  const nativeW = videoWidth > 0 ? videoWidth : (aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 720 : aspectRatio === '3:4' ? 1080 : aspectRatio === '4:3' ? 960 : 720);
  const nativeH = videoHeight > 0 ? videoHeight : (aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 720 : aspectRatio === '3:4' ? 1440 : aspectRatio === '4:3' ? 720 : 1280);

  // Automatically detect if current video is already high-resolution or upscaled
  const isAlreadyUpscaled = Boolean(
    (videoFilename && /_upscaled_/i.test(videoFilename)) ||
    (videoUrl && /_upscaled_/i.test(videoUrl)) ||
    (nativeW >= 1080 && nativeH >= 1080) ||
    (nativeW >= 1920 || nativeH >= 1920)
  );

  const [selectedAspect, setSelectedAspect] = useState(aspectRatio || 'source');
  const [aiUpscale, setAiUpscale] = useState(!isAlreadyUpscaled);
  const [aiModel, setAiModel] = useState('realesr-animevideov3');
  const [cleanResultUrl, setCleanResultUrl] = useState(null);
  const [exportStageMessage, setExportStageMessage] = useState('');
  const [customFilename, setCustomFilename] = useState(getCleanProjectBase());

  const getResolutionTiers = (aspect, srcW, srcH) => {
    switch (aspect) {
      case '16:9':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1920x1080', label: 'Full HD 1080p', sub: '1920 × 1080', tier: '1080p' },
          { id: '3840x2160', label: '4K Ultra HD', sub: '3840 × 2160', tier: '4k' }
        ];
      case '3:4':
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1080x1440', label: 'Full HD 1080p', sub: '1080 × 1440', tier: '1080p' },
          { id: '2160x2880', label: '4K Ultra HD', sub: '2160 × 2880', tier: '4k' }
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
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: '1080x1920', label: 'Full HD 1080p', sub: '1080 × 1920', tier: '1080p' },
          { id: '2160x3840', label: '4K Ultra HD', sub: '2160 × 3840', tier: '4k' }
        ];
      default:
        return [
          { id: `${srcW}x${srcH}`, label: 'Original Size (1x)', sub: `${srcW} × ${srcH} Native`, tier: 'original' },
          { id: `${srcW >= 1080 ? srcW : Math.round(srcW * (1080 / Math.max(1, srcH)))}x${srcH >= 1080 ? srcH : 1080}`, label: 'Full HD 1080p', sub: 'Proportional 1080p', tier: '1080p' },
          { id: `${srcW * 2}x${srcH * 2}`, label: '4K Ultra HD', sub: `${srcW * 2} × ${srcH * 2}`, tier: '4k' }
        ];
    }
  };

  const resolutionTiers = getResolutionTiers(selectedAspect, nativeW, nativeH);
  const [resolution, setResolution] = useState(`${nativeW}x${nativeH}`);
  const [quality, setQuality] = useState('high'); // 'high' | 'very_high' | 'medium'
  const [targetFps, setTargetFps] = useState('source'); // 'source' | '30' | '60'
  const [encoderMode] = useState('gpu_nvenc'); // 'gpu_nvenc' | 'cpu'
  const [renderEngine, setRenderEngine] = useState('hybrid'); // 'hybrid' (100% Colors & Fluidity + 100% Preview Text) | 'backend' | 'client_canvas'

  const [isExporting, setIsExporting] = useState(false);
  const [exportStats, setExportStats] = useState({ percent: 0, currentFrame: 0, totalFrames: 0, fps: 0, etaSeconds: 0, stage: 'idle', message: '' });
  const [exportResultUrl, setExportResultUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const clientExporterRef = useRef(null);
  const overlayCancelledRef = useRef(false);
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
      setErrorMessage(null);
      setExportStageMessage('');
      setCustomFilename(getCleanProjectBase());

      // If this project has an in-memory export result, restore it so user doesn't lose download links
      if (lastExportResult && lastExportResult.projectId === activeProjectId && lastExportResult.exportResultUrl) {
        setExportResultUrl(lastExportResult.exportResultUrl);
        setCleanResultUrl(lastExportResult.cleanResultUrl || null);
      } else {
        setExportResultUrl(null);
        setCleanResultUrl(null);
      }

      // If video is already upscaled, default aiUpscale to false to prevent redundant 2-minute re-runs
      setAiUpscale(!isAlreadyUpscaled);

      // Default aspect ratio and resolution tier to match source video
      const initialAspect = aspectRatio || 'source';
      setSelectedAspect(initialAspect);
      const initialTiers = getResolutionTiers(initialAspect, nativeW, nativeH);
      const originalTier = initialTiers.find(t => t.tier === 'original') || initialTiers[0];
      setResolution(originalTier ? originalTier.id : `${nativeW}x${nativeH}`);
    }
  }, [isExportModalOpen, activeProjectId, activeProjectTitle, videoFilename, isAlreadyUpscaled, nativeW, nativeH, aspectRatio]);

  if (!isExportModalOpen) return null;

  const handleCancelExport = async () => {
    overlayCancelledRef.current = true;
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
      let upscaledCleanUrl = null;

      let effectiveFilename = videoFilename || (linkedSourcePath ? linkedSourcePath.split(/[/\\]/).pop() : (videoFile ? videoFile.name : ''));

      // If user loaded a file in memory and it is not on backend disk, auto-upload first
      if (backendAvailable && videoFile instanceof File && !linkedSourcePath) {
        try {
          setExportStats((prev) => ({
            ...prev,
            percent: 4,
            stage: 'uploading',
            message: 'Uploading source video to server...'
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
        upscaledCleanUrl = `${BACKEND_URL}${cleanDownloadPath}`;

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
        if (upscaledData.output_filename) {
          effectiveFilename = upscaledData.output_filename;
        }
      }

      // ---------------------------------------------------------------------
      // PHASE 2: Video Caption Rendering & Encoding (100% Color & Gamma Parity)
      // ---------------------------------------------------------------------
      setExportStats({
        percent: aiUpscale ? 72 : 5,
        currentFrame: 0,
        totalFrames: 0,
        fps: 0,
        etaSeconds: 0,
        stage: 'rendering',
        message: aiUpscale
          ? 'Phase 2/2: Burning in styled captions with 100% color parity...'
          : 'Encoding video frames with 100% color parity...'
      });

      let calculatedFps = 30;
      if (targetFps === '60') {
        calculatedFps = 60;
      } else if (targetFps === '30') {
        calculatedFps = 30;
      } else {
        calculatedFps = (upscaledData && upscaledData.fps) ? upscaledData.fps : (videoFps || 30);
      }

      const targetDuration = (upscaledData && upscaledData.duration) ? upscaledData.duration : (duration || 10);

      if (renderEngine === 'hybrid' && backendAvailable && effectiveFilename) {
        // Hybrid Studio Overlay Pipeline (100% Original Video Color + 100% Previewer Caption Animation & Emojis)
        overlayCancelledRef.current = false;
        setExportStats({
          percent: aiUpscale ? 73 : 6,
          currentFrame: 0,
          totalFrames: 0,
          fps: calculatedFps,
          etaSeconds: 0,
          stage: 'rendering',
          message: 'Step 1/2: Generating previewer caption track (WebM alpha)...'
        });

        // 1. Render transparent caption track (WebM with alpha) in browser
        const overlayBlob = await exportTransparentCaptionTrack({
          width: w,
          height: h,
          fps: calculatedFps,
          duration: targetDuration,
          segments,
          style: sanitizeStyle(style),
          onProgress: (stats) => {
            const basePct = aiUpscale ? 73 : 6;
            const pctRange = aiUpscale ? 12 : 36;
            const combinedPercent = Math.min(99, Math.round(basePct + ((stats.percent || 0) / 100) * pctRange));
            setExportStats({
              percent: combinedPercent,
              currentFrame: stats.currentFrame,
              totalFrames: stats.totalFrames,
              fps: stats.fps || 0,
              etaSeconds: stats.etaSeconds,
              stage: 'rendering',
              message: `Step 1/2 [Preview Engine]: Captions ${stats.currentFrame}/${stats.totalFrames} (${Math.round((stats.percent || 0))}%)`
            });
          },
          isCancelledRef: overlayCancelledRef
        });

        if (overlayCancelledRef.current) {
          throw new Error('Export cancelled by user');
        }

        // 2. Upload transparent caption track and run hardware NVENC composite on backend
        setExportStats((prev) => ({
          ...prev,
          percent: aiUpscale ? 86 : 43,
          stage: 'rendering',
          message: 'Step 2/2: Burning captions onto native video bitstream (Hardware NVENC)...'
        }));

        const formData = new FormData();
        formData.append('file', overlayBlob, 'captions_overlay.webm');
        formData.append('video_filename', effectiveFilename);
        if (linkedSourcePath && !upscaledData) {
          formData.append('linked_path', linkedSourcePath);
        }
        formData.append('output_filename', finalFilename);
        formData.append('width', String(w));
        formData.append('height', String(h));
        formData.append('fps', String(calculatedFps));
        formData.append('encoder_mode', encoderMode || 'gpu_nvenc');
        formData.append('video_quality', quality === 'very_high' ? 'crf18' : quality === 'medium' ? 'crf26' : 'crf20');
        formData.append('brightness', String((videoBrightness || 100) / 100));
        formData.append('contrast', String((videoContrast || 100) / 100));
        formData.append('video_duration', String(targetDuration));

        const renderRes = await fetch(`${BACKEND_URL}/api/render-hybrid`, {
          method: 'POST',
          body: formData
        });

        if (!renderRes.ok) {
          const errData = await renderRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to start Hybrid Studio rendering job');
        }

        const renderData = await renderRes.json();
        const jobId = renderData.job_id;
        activeJobIdRef.current = jobId;

        // Poll render progress until completion
        const renderResult = await new Promise((resolve, reject) => {
          pollIntervalRef.current = setInterval(async () => {
            try {
              const pRes = await fetch(`${BACKEND_URL}/api/render-progress/${jobId}`);
              if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.status === 'cancelled') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error('Export cancelled'));
                  return;
                }
                if (pData.status === 'error') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error(pData.error || 'Video rendering failed'));
                  return;
                }

                const rawPercent = Math.max(0, Math.min(100, typeof pData.percent === 'number' ? pData.percent : 0));
                const basePct = aiUpscale ? 86 : 43;
                const pctRange = aiUpscale ? 13 : 56;
                const combinedPercent = Math.min(99, Math.round(basePct + (rawPercent / 100) * pctRange));

                setExportStats({
                  percent: combinedPercent,
                  currentFrame: pData.current_frame || 0,
                  totalFrames: pData.total_frames || 0,
                  fps: pData.fps || 0,
                  etaSeconds: pData.eta_seconds || 0,
                  stage: 'rendering',
                  message: pData.message || `Step 2/2 [Hardware NVENC]: Frame ${pData.current_frame || 0}/${pData.total_frames || 0}`
                });

                if (pData.status === 'done') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  resolve(pData);
                }
              }
            } catch (pollErr) {
              console.warn('Hybrid render progress polling error:', pollErr);
            }
          }, 350);
        });

        activeJobIdRef.current = null;

        const downloadPath = renderResult.download_url || renderData.download_url;
        const cleanExportUrl = downloadPath?.startsWith('http')
          ? downloadPath
          : `${BACKEND_URL}${downloadPath}`;

        setExportResultUrl(cleanExportUrl);
        if (renderResult.clean_download_url) {
          setCleanResultUrl(`${BACKEND_URL}${renderResult.clean_download_url}`);
        }

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

        if (typeof setLastExportResult === 'function') {
          setLastExportResult({
            projectId: activeProjectId,
            exportResultUrl: cleanExportUrl,
            cleanResultUrl: renderResult.clean_download_url ? `${BACKEND_URL}${renderResult.clean_download_url}` : (upscaledCleanUrl || cleanResultUrl || null),
            finalFilename,
            timestamp: Date.now()
          });
        }
      } else if (renderEngine === 'backend' && backendAvailable && effectiveFilename) {
        // High-Fidelity Backend FFmpeg / ASS Rendering (Server Hardware NVENC)
        const measured = await measureAllSegmentsLayout(segments, sanitizeStyle(style), w, h);
        const renderPayload = {
          video_filename: effectiveFilename,
          linked_path: (upscaledData ? null : (linkedSourcePath || null)),
          segments: (measured && (measured.segments || measured.measuredSegments)) ? (measured.segments || measured.measuredSegments) : segments,
          style: sanitizeStyle(style),
          width: w,
          height: h,
          video_duration: targetDuration,
          encoder_mode: encoderMode || 'gpu_nvenc',
          engine_type: 'ass',
          preview_metrics: (measured && (measured.preview_metrics || measured.previewMetrics)) ? (measured.preview_metrics || measured.previewMetrics) : null,
          output_filename: finalFilename,
          fps: calculatedFps,
          video_quality: quality === 'very_high' ? 'crf18' : quality === 'medium' ? 'crf26' : 'crf20',
          brightness: (videoBrightness || 100) / 100,
          contrast: (videoContrast || 100) / 100
        };

        const renderRes = await fetch(`${BACKEND_URL}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(renderPayload)
        });

        if (!renderRes.ok) {
          const errData = await renderRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to start video rendering job');
        }

        const renderData = await renderRes.json();
        const jobId = renderData.job_id;
        activeJobIdRef.current = jobId;

        // Poll render progress until completion
        const renderResult = await new Promise((resolve, reject) => {
          pollIntervalRef.current = setInterval(async () => {
            try {
              const pRes = await fetch(`${BACKEND_URL}/api/render-progress/${jobId}`);
              if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.status === 'cancelled') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error('Export cancelled'));
                  return;
                }
                if (pData.status === 'error') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  reject(new Error(pData.error || 'Video rendering failed'));
                  return;
                }

                const rawPercent = Math.max(0, Math.min(100, typeof pData.percent === 'number' ? pData.percent : 0));
                const basePct = aiUpscale ? 72 : 5;
                const pctRange = aiUpscale ? 27 : 94;
                const combinedPercent = Math.min(99, Math.round(basePct + (rawPercent / 100) * pctRange));

                setExportStats({
                  percent: combinedPercent,
                  currentFrame: pData.current_frame || 0,
                  totalFrames: pData.total_frames || 0,
                  fps: pData.fps || 0,
                  etaSeconds: pData.eta_seconds || 0,
                  stage: 'rendering',
                  message: aiUpscale
                    ? `Phase 2/2: Burning captions (Frame ${pData.current_frame || 0}/${pData.total_frames || 0})`
                    : `Encoding frame ${pData.current_frame || 0}/${pData.total_frames || 0} ${pData.fps > 0 ? `(${pData.fps} FPS)` : ''}`
                });

                if (pData.status === 'done') {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  resolve(pData);
                }
              }
            } catch (pollErr) {
              console.warn('Render progress polling error:', pollErr);
            }
          }, 350);
        });

        activeJobIdRef.current = null;

        const downloadPath = renderResult.download_url || renderData.download_url;
        const cleanExportUrl = downloadPath?.startsWith('http')
          ? downloadPath
          : `${BACKEND_URL}${downloadPath}`;

        setExportResultUrl(cleanExportUrl);
        if (renderResult.clean_download_url) {
          setCleanResultUrl(`${BACKEND_URL}${renderResult.clean_download_url}`);
        }

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

        if (typeof setLastExportResult === 'function') {
          setLastExportResult({
            projectId: activeProjectId,
            exportResultUrl: cleanExportUrl,
            cleanResultUrl: renderResult.clean_download_url ? `${BACKEND_URL}${renderResult.clean_download_url}` : (upscaledCleanUrl || cleanResultUrl || null),
            finalFilename,
            timestamp: Date.now()
          });
        }
      } else {
        // Client Canvas DOM Ultra Exporter (100% Preview & Old Videos Parity)
        const exporter = new ClientSceneExporter({
          width: w,
          height: h,
          fps: calculatedFps,
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
          brightness: videoBrightness || 100,
          contrast: videoContrast || 100,
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
                ? `Phase 2/2: Frame ${stats.currentFrame}/${stats.totalFrames} (Canvas DOM Ultra)`
                : `Rendering frame ${stats.currentFrame}/${stats.totalFrames} (100% Preview Parity)`
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

        if (typeof setLastExportResult === 'function') {
          setLastExportResult({
            projectId: activeProjectId,
            exportResultUrl: blobUrl,
            cleanResultUrl: upscaledCleanUrl || cleanResultUrl || null,
            finalFilename,
            timestamp: Date.now()
          });
        }
      }
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
    <div 
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) {
          handleClose();
        }
      }}
    >
      <div 
        className="studio-panel apple-modal-content"
        onClick={(e) => e.stopPropagation()}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
              {[
                { id: 'source', label: 'Source', sub: 'Match' },
                { id: '3:4', label: '3:4', sub: 'Portrait' },
                { id: '9:16', label: '9:16', sub: 'Reels/TikTok' },
                { id: '16:9', label: '16:9', sub: 'YouTube' },
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
                        // Default to original tier if source, otherwise 1080p
                        const defaultTier = asp.id === 'source'
                          ? (tiers.find(t => t.tier === 'original') || tiers[0])
                          : (tiers.find(t => t.tier === '1080p') || tiers[1] || tiers[0]);
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
                    {isAlreadyUpscaled && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          background: 'rgba(52, 199, 89, 0.18)',
                          color: 'var(--system-success)',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        ✓ 1080p+ Master
                      </span>
                    )}
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

            {isAlreadyUpscaled && !aiUpscale && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(52, 199, 89, 0.10)',
                border: '1px solid rgba(52, 199, 89, 0.28)',
                fontSize: '10.5px',
                color: 'var(--system-success)'
              }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Video is already high-resolution ({nativeW} × {nativeH}).</strong> Neural upscaling is bypassed so your export burns in captions directly in seconds (~3–5s).
                </span>
              </div>
            )}

            {isAlreadyUpscaled && aiUpscale && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 179, 0, 0.10)',
                border: '1px solid rgba(255, 179, 0, 0.3)',
                fontSize: '10.5px',
                color: '#ffb300'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>
                  Video is already {nativeW} × {nativeH}. Re-enabling this will re-run full Real-ESRGAN neural super-resolution (~1–2 mins).
                </span>
              </div>
            )}

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

          {/* Render Engine Selector (Hybrid Studio vs Backend Studio vs Canvas DOM) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Render Engine
              </label>
              <span style={{ fontSize: '10px', color: 'var(--accent-bright-blue)', fontWeight: '600' }}>
                {renderEngine === 'hybrid' 
                  ? '★ 100% Original Colors + 100% Preview Animations' 
                  : renderEngine === 'backend' 
                    ? 'FFmpeg ASS Burn-in' 
                    : 'Client Canvas Recording'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => !isExporting && setRenderEngine('hybrid')}
                style={{
                  padding: '10px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  border: renderEngine === 'hybrid' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: renderEngine === 'hybrid' ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={13} color={renderEngine === 'hybrid' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: renderEngine === 'hybrid' ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      Hybrid Studio
                    </span>
                  </div>
                  <span style={{
                    fontSize: '8px',
                    fontWeight: '700',
                    background: renderEngine === 'hybrid' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: renderEngine === 'hybrid' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>
                    Recommended
                  </span>
                </div>
                <span style={{ fontSize: '9px', color: renderEngine === 'hybrid' ? 'var(--text-secondary)' : 'var(--text-tertiary)', lineHeight: '1.3' }}>
                  100% untouched video color + 100% previewer text animations & emojis.
                </span>
              </button>

              <button
                type="button"
                onClick={() => !isExporting && setRenderEngine('backend')}
                style={{
                  padding: '10px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  border: renderEngine === 'backend' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: renderEngine === 'backend' ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Cpu size={13} color={renderEngine === 'backend' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: renderEngine === 'backend' ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      Backend (ASS)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '8px',
                    fontWeight: '700',
                    background: renderEngine === 'backend' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: renderEngine === 'backend' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>
                    FFmpeg Native
                  </span>
                </div>
                <span style={{ fontSize: '9px', color: renderEngine === 'backend' ? 'var(--text-secondary)' : 'var(--text-tertiary)', lineHeight: '1.3' }}>
                  Direct ASS subtitle burn-in script.
                </span>
              </button>

              <button
                type="button"
                onClick={() => !isExporting && setRenderEngine('client_canvas')}
                style={{
                  padding: '10px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  border: renderEngine === 'client_canvas' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: renderEngine === 'client_canvas' ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Film size={13} color={renderEngine === 'client_canvas' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: renderEngine === 'client_canvas' ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      Canvas DOM
                    </span>
                  </div>
                  <span style={{
                    fontSize: '8px',
                    fontWeight: '700',
                    background: renderEngine === 'client_canvas' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: renderEngine === 'client_canvas' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>
                    Browser
                  </span>
                </div>
                <span style={{ fontSize: '9px', color: renderEngine === 'client_canvas' ? 'var(--text-secondary)' : 'var(--text-tertiary)', lineHeight: '1.3' }}>
                  Client-side WebCodecs canvas recording.
                </span>
              </button>
            </div>
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
                Framerate (FPS)
              </label>
              <select
                value={targetFps}
                onChange={(e) => setTargetFps(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="source" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                  Match Source ({videoFps ? `${videoFps} FPS` : 'Native Auto'}) [Recommended]
                </option>
                <option value="30" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                  30 FPS (Standard Social)
                </option>
                <option value="60" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                  60 FPS (Ultra Smooth 60Hz)
                </option>
              </select>
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

                <button
                  type="button"
                  onClick={() => {
                    setExportResultUrl(null);
                    if (typeof setLastExportResult === 'function') {
                      setLastExportResult(null);
                    }
                  }}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    padding: '7px 10px',
                    gap: '6px',
                    cursor: 'pointer',
                    marginTop: '2px',
                    borderStyle: 'dashed'
                  }}
                  title="Configure export options and render a new version"
                >
                  <RefreshCw size={12} />
                  <span>Export a New Version / Change Settings</span>
                </button>
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
