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
  ChevronDown,
  ChevronUp,
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
    duration,
    segments,
    style,
    backendAvailable,
    aspectRatio,
    linkedSourcePath,
    isMediaLinked,
    activeProjectTitle
  } = useEditorStore();

  const getCleanProjectBase = () => {
    const raw = (activeProjectTitle || videoFilename || 'Untitled Project').trim();
    return raw
      .replace(/\.[^/.]+$/, '')
      .replace(/[/\\?%*:|"<>]/g, '')
      .trim() || 'Untitled Project';
  };

  const [customFilename, setCustomFilename] = useState(getCleanProjectBase());
  const [exportMode, setExportMode] = useState('client_canvas'); // 'client_canvas' | 'backend_ffmpeg'
  const [resolution, setResolution] = useState(
    aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '1:1' ? '1080x1080' : '1920x1080'
  );
  const [quality, setQuality] = useState('high'); // 'high' | 'very_high' | 'medium'
  const [engineType, setEngineType] = useState('dom'); // For backend fallback: 'dom' | 'ass'
  const [encoderMode, setEncoderMode] = useState('gpu_nvenc'); // For backend fallback: 'gpu_nvenc' | 'cpu'
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportStats, setExportStats] = useState({ percent: 0, currentFrame: 0, totalFrames: 0, etaSeconds: 0 });
  const [exportResultUrl, setExportResultUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const clientExporterRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  const finalBaseName = (customFilename || getCleanProjectBase()).replace(/\.[^/.]+$/, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Untitled Project';
  const finalFilename = `${finalBaseName}.mp4`;

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
      setExportStats({ percent: 0, currentFrame: 0, totalFrames: 0, etaSeconds: 0 });
      setExportResultUrl(null);
      setErrorMessage(null);
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
    setExportStats({ percent: 2, currentFrame: 0, totalFrames: 0, etaSeconds: 0 });
    setErrorMessage(null);
    setExportResultUrl(null);

    const [w, h] = resolution.split('x').map(Number);

    if (exportMode === 'client_canvas') {
      try {
        const exporter = new ClientSceneExporter({
          width: w,
          height: h,
          fps: videoFps || 30,
          format: 'mp4',
          quality
        });
        clientExporterRef.current = exporter;

        const effectiveVideoUrl = videoUrl || (linkedSourcePath ? `${BACKEND_URL}/api/media/stream?path=${encodeURIComponent(linkedSourcePath)}` : '');

        const blob = await exporter.exportVideo({
          videoFile,
          videoUrl: effectiveVideoUrl,
          duration: duration || 10,
          segments,
          style: sanitizeStyle(style),
          onProgress: (stats) => {
            setExportStats({
              percent: stats.percent,
              currentFrame: stats.currentFrame,
              totalFrames: stats.totalFrames,
              etaSeconds: stats.etaSeconds
            });
          }
        });

        const url = URL.createObjectURL(blob);
        setExportResultUrl(url);
        setIsExporting(false);
      } catch (err) {
        if (!err.message?.includes('cancelled')) {
          console.error('Client Canvas Export Error:', err);
          setErrorMessage(err.message || 'Client Canvas export failed.');
        }
        setIsExporting(false);
      }
      return;
    }

    try {
      if (backendAvailable && videoFilename) {
        let exportSegments = segments;
        let previewMetrics = null;

        try {
          // Compute exact word-wrapping line breaks & vertical baseline offsets matching DOM preview
          const previewBaseH = 640;
          const previewBaseW = Math.max(160, Math.round(previewBaseH * (w / (h || 1))));
          const layoutResult = await measureAllSegmentsLayout(segments, sanitizeStyle(style), previewBaseW, previewBaseH);
          if (layoutResult && layoutResult.segments) {
            exportSegments = layoutResult.segments;
            previewMetrics = layoutResult.previewMetrics;
          }
        } catch (layoutErr) {
          console.warn('Layout measurement fallback, using default segments:', layoutErr);
        }

        const effectiveFilename = videoFilename || (linkedSourcePath ? linkedSourcePath.split(/[/\\]/).pop() : '');
        const response = await fetch(`${BACKEND_URL}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_filename: effectiveFilename,
            output_filename: finalFilename,
            linked_path: linkedSourcePath || null,
            engine_type: engineType,
            segments: exportSegments,
            preview_metrics: previewMetrics,
            style: sanitizeStyle(style),
            width: w,
            height: h,
            video_duration: duration || 10.0,
            encoder_mode: encoderMode
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Backend export request failed');
        }

        const data = await response.json();
        const jobId = data.job_id;
        activeJobIdRef.current = jobId;

        pollIntervalRef.current = setInterval(async () => {
          try {
            const progRes = await fetch(`${BACKEND_URL}/api/render-progress/${jobId}`);
            if (progRes.ok) {
              const progData = await progRes.json();
              if (progData.status === 'cancelled') {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setIsExporting(false);
                return;
              }

              const pct = typeof progData.percent === 'number' ? progData.percent : 0;
              setExportStats((prev) => ({ ...prev, percent: Math.max(prev.percent, pct) }));

              if (progData.status === 'done') {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setExportStats((prev) => ({ ...prev, percent: 100 }));
                setIsExporting(false);
                setExportResultUrl(`${BACKEND_URL}${progData.download_url}`);
              } else if (progData.status === 'error') {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setIsExporting(false);
                setErrorMessage(progData.error || 'FFmpeg render error');
              }
            }
          } catch (_) {}
        }, 300);
      } else {
        throw new Error('Backend server is not reachable for legacy export.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Export failed.');
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

          {/* Resolution Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Aspect Ratio & Resolution
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { id: '1080x1920', label: '9:16 Vertical', sub: '1080 × 1920', icon: <Smartphone size={13} /> },
                { id: '1080x1080', label: '1:1 Square', sub: '1080 × 1080', icon: <Square size={13} /> },
                { id: '1920x1080', label: '16:9 Landscape', sub: '1920 × 1080', icon: <Tv size={13} /> }
              ].map((res) => {
                const isSelected = resolution === res.id;
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => !isExporting && setResolution(res.id)}
                    style={{
                      padding: '8px',
                      borderRadius: 'var(--radius-md)',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ color: isSelected ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)' }}>
                      {res.icon}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: isSelected ? '600' : '500', color: isSelected ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                      {res.label}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{res.sub}</span>
                  </button>
                );
              })}
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

          {/* Advanced Accordion */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="btn-ghost"
              style={{
                width: '100%',
                padding: '8px 10px',
                justifyContent: 'space-between',
                fontSize: '11px'
              }}
            >
              <span>Advanced Options</span>
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setExportMode('client_canvas'); }}
                    className="segmented-control-item"
                    style={{
                      padding: '6px',
                      fontSize: '10px',
                      background: exportMode === 'client_canvas' ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                      border: exportMode === 'client_canvas' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
                    }}
                  >
                    Client Canvas (100% Parity)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setExportMode('backend_ffmpeg'); setEngineType('dom'); }}
                    className="segmented-control-item"
                    style={{
                      padding: '6px',
                      fontSize: '10px',
                      background: exportMode === 'backend_ffmpeg' ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                      border: exportMode === 'backend_ffmpeg' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
                    }}
                  >
                    Backend FFmpeg
                  </button>
                </div>
              </div>
            )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
                <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={12} className="animate-spin" />
                  Encoding video frames...
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'SF Mono, monospace' }}>
                  {exportStats.percent}% {exportStats.totalFrames > 0 && `(${exportStats.currentFrame}/${exportStats.totalFrames})`}
                </span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div style={{
                  width: `${exportStats.percent}%`,
                  height: '100%',
                  background: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 150ms ease'
                }} />
              </div>
              {exportStats.etaSeconds > 0 && (
                <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                  ~{exportStats.etaSeconds}s remaining
                </div>
              )}
            </div>
          )}

          {/* Export Complete Result */}
          {exportResultUrl && (
            <div style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(52, 199, 89, 0.08)',
              border: '1px solid rgba(52, 199, 89, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              color: 'var(--system-success)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                  <FileCheck size={16} />
                  <span>Export Complete!</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '22px', wordBreak: 'break-all' }}>
                  {finalFilename}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={handleOpenInNewTab}
                  className="btn-secondary"
                  style={{ justifyContent: 'center', fontSize: '11px', padding: '6px' }}
                >
                  <ExternalLink size={12} />
                  <span>Preview ↗</span>
                </button>

                <a
                  href={exportResultUrl}
                  download={finalFilename}
                  className="btn-primary"
                  style={{
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '11px',
                    padding: '6px'
                  }}
                  title={`Download ${finalFilename}`}
                >
                  <Download size={12} />
                  <span>Download MP4</span>
                </a>
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
            >
              <Download size={13} />
              <span>Start Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
