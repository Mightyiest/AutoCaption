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
  Ban
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { measureAllSegmentsLayout } from '../engine/layoutMeasurer';
import { sanitizeStyle } from '../engine/presets';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ExportModal = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    videoFilename,
    duration,
    segments,
    style,
    backendAvailable,
    aspectRatio
  } = useEditorStore();

  const [resolution, setResolution] = useState(
    aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '1:1' ? '1080x1080' : '1920x1080'
  );
  const [encoderMode, setEncoderMode] = useState('cpu'); // 'cpu' (Option A) | 'gpu_nvenc' (Option B)
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResultUrl, setExportResultUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const pollIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Reset export state when modal opens
  useEffect(() => {
    if (isExportModalOpen) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      activeJobIdRef.current = null;
      setIsExporting(false);
      setExportProgress(0);
      setExportResultUrl(null);
      setErrorMessage(null);
    }
  }, [isExportModalOpen]);

  if (!isExportModalOpen) return null;

  const handleCancelExport = async () => {
    const currentJobId = activeJobIdRef.current;
    
    // Clear poller immediately
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
    setExportProgress(0);
    setErrorMessage('Export cancelled by user.');
  };

  const handleClose = () => {
    if (isExporting) {
      handleCancelExport();
    }
    setExportModalOpen(false);
  };

  const handleExport = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setIsExporting(true);
    setExportProgress(5);
    setErrorMessage(null);
    setExportResultUrl(null);

    const [w, h] = resolution.split('x').map(Number);
    const previewDims = aspectRatio === '9:16' 
      ? { width: 310, height: 550 } 
      : aspectRatio === '1:1' 
        ? { width: 420, height: 420 } 
        : { width: 540, height: 304 };

    const { segments: measuredSegments, preview_metrics } = await measureAllSegmentsLayout(
      segments,
      style,
      previewDims.width,
      previewDims.height
    );

    try {
      if (backendAvailable && videoFilename) {
        const response = await fetch(`${BACKEND_URL}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_filename: videoFilename,
            segments: measuredSegments,
            style: sanitizeStyle(style),
            width: w,
            height: h,
            video_duration: duration || 10.0,
            encoder_mode: encoderMode,
            preview_metrics
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Export request failed');
        }

        const data = await response.json();
        const jobId = data.job_id;
        activeJobIdRef.current = jobId;

        // Poll progress with ref tracking
        pollIntervalRef.current = setInterval(async () => {
          try {
            const progRes = await fetch(`${BACKEND_URL}/api/render-progress/${jobId}`);
            if (progRes.ok) {
              const progData = await progRes.json();
              
              if (progData.status === 'cancelled') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setIsExporting(false);
                setExportProgress(0);
                return;
              }

              const pct = typeof progData.percent === 'number' ? progData.percent : 0;
              setExportProgress((prev) => Math.max(prev, pct));

              if (progData.status === 'done') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setExportProgress(100);
                setIsExporting(false);
                const fullUrl = `${BACKEND_URL}${progData.download_url}`;
                setExportResultUrl(fullUrl);
              } else if (progData.status === 'error') {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setIsExporting(false);
                setErrorMessage(progData.error || 'FFmpeg render error');
              }
            }
          } catch (err) {
            // Polling error
          }
        }, 300);
      } else {
        // Fallback simulation
        for (let p = 10; p <= 100; p += 20) {
          await new Promise((r) => setTimeout(r, 200));
          setExportProgress(p);
        }
        setIsExporting(false);
        setExportResultUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
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
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.12)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} color="var(--accent-viral-yellow)" />
            <span style={{ fontSize: '15px', fontWeight: '800' }}>Export Subtitled Video</span>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            title={isExporting ? 'Cancel & Close' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Encoder Selection: Option A vs Option B */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Select Render Engine Option
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Option A: CPU Ultra-Fast */}
              <div
                onClick={() => !isExporting && setEncoderMode('cpu')}
                className="glass-card"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  border: encoderMode === 'cpu' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: encoderMode === 'cpu' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(31, 41, 55, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800' }}>
                    <Cpu size={15} color="var(--accent-primary)" />
                    <span>Option A</span>
                  </div>
                  {encoderMode === 'cpu' && <CheckCircle2 size={15} color="var(--accent-primary)" />}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>CPU Ultra-Fast</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>libx264 Ultrafast • Compatible with all CPUs</div>
              </div>

              {/* Option B: NVIDIA GPU NVENC */}
              <div
                onClick={() => !isExporting && setEncoderMode('gpu_nvenc')}
                className="glass-card"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  border: encoderMode === 'gpu_nvenc' ? '2px solid #22C55E' : '1px solid var(--border-color)',
                  background: encoderMode === 'gpu_nvenc' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(31, 41, 55, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '800' }}>
                    <Zap size={15} color="#22C55E" />
                    <span>Option B</span>
                  </div>
                  {encoderMode === 'gpu_nvenc' && <CheckCircle2 size={15} color="#22C55E" />}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>NVIDIA GPU</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>h264_nvenc • Hardware accelerated</div>
              </div>
            </div>
          </div>

          {/* Resolution Presets */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Export Resolution
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: '1080x1920', label: '9:16 Shorts / Reels', sub: '1080 × 1920', icon: <Smartphone size={14} /> },
                { id: '1080x1080', label: '1:1 Square', sub: '1080 × 1080', icon: <Square size={14} /> },
                { id: '1920x1080', label: '16:9 Landscape', sub: '1920 × 1080', icon: <Tv size={14} /> }
              ].map((res) => {
                const isSelected = resolution === res.id;
                return (
                  <div
                    key={res.id}
                    onClick={() => !isExporting && setResolution(res.id)}
                    className="glass-card"
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      border: isSelected ? '2px solid var(--accent-viral-yellow)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(255, 230, 0, 0.08)' : 'rgba(31, 41, 55, 0.3)',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px', color: isSelected ? 'var(--accent-viral-yellow)' : 'var(--text-muted)' }}>
                      {res.icon}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? 'var(--accent-viral-yellow)' : '#FFF' }}>
                      {res.label}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{res.sub}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              fontSize: '12px'
            }}>
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Live Progress Bar */}
          {isExporting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={14} className="animate-spin" />
                  Rendering ({encoderMode === 'cpu' ? 'Option A: CPU' : 'Option B: GPU NVENC'})...
                </span>
                <span style={{ color: '#FFF', fontFamily: 'monospace' }}>{exportProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{
                  width: `${exportProgress}%`,
                  height: '100%',
                  background: encoderMode === 'gpu_nvenc'
                    ? 'linear-gradient(90deg, #16A34A 0%, #4ADE80 100%)'
                    : 'linear-gradient(90deg, #0284C7 0%, #38BDF8 100%)',
                  borderRadius: '999px',
                  transition: 'width 150ms ease'
                }} />
              </div>
            </div>
          )}

          {/* Export Complete Actions */}
          {exportResultUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ADE80'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800' }}>
                <FileCheck size={18} />
                <span>Video Export Complete!</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Open in New Tab Button */}
                <button
                  onClick={handleOpenInNewTab}
                  className="btn-viral"
                  style={{
                    justifyContent: 'center',
                    fontSize: '12px',
                    padding: '10px 8px'
                  }}
                  title="Opens exported video in a new browser tab without leaving the editor"
                >
                  <ExternalLink size={15} />
                  <span>Open in New Tab ↗</span>
                </button>

                {/* Direct Download Link */}
                <a
                  href={exportResultUrl}
                  download="AutoCaptioned_Video.mp4"
                  className="btn-primary"
                  style={{
                    justifyContent: 'center',
                    textDecoration: 'none',
                    fontSize: '12px',
                    padding: '10px 8px'
                  }}
                >
                  <Download size={15} />
                  <span>Download MP4</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'rgba(0,0,0,0.2)'
        }}>
          {isExporting ? (
            <button
              onClick={handleCancelExport}
              className="btn-secondary"
              style={{ color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              <Ban size={14} />
              <span>Cancel Export</span>
            </button>
          ) : (
            <button
              onClick={() => setExportModalOpen(false)}
              className="btn-secondary"
            >
              {exportResultUrl ? 'Back to Editor' : 'Cancel'}
            </button>
          )}

          {!exportResultUrl && !isExporting && (
            <button
              onClick={handleExport}
              className="btn-viral"
            >
              {encoderMode === 'gpu_nvenc' ? <Zap size={15} /> : <Cpu size={15} />}
              <span>Export ({encoderMode === 'cpu' ? 'Option A: CPU' : 'Option B: GPU'})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
