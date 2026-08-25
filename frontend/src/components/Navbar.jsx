import React from 'react';
import { 
  Sparkles, 
  Upload, 
  Download, 
  Server, 
  Smartphone, 
  Square, 
  Tv, 
  Eye, 
  EyeOff, 
  RotateCcw,
  Film,
  Loader2,
  Settings
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const Navbar = () => {
  const {
    backendAvailable,
    aspectRatio,
    setAspectRatio,
    showSafeZones,
    toggleSafeZones,
    setUploadModalOpen,
    setExportModalOpen,
    setSettingsModalOpen,
    loadDemoData,
    isTranscribing,
    setIsTranscribing,
    videoFile,
    videoFilename,
    setSegments,
    style
  } = useEditorStore();

  const handleQuickTranscribe = async () => {
    if (isTranscribing) return;
    if (!videoFile && !videoFilename) {
      setUploadModalOpen(true);
      return;
    }

    setIsTranscribing(true, 'Extracting audio and generating word timestamps...');
    try {
      if (backendAvailable && videoFile) {
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('model_name', 'base');
        formData.append('max_words_per_segment', style.maxWordsPerSegment || 3);

        const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Transcription failed');
        }
        const data = await res.json();
        setSegments(data.segments);
      } else if (backendAvailable && videoFilename) {
        const res = await fetch(`${BACKEND_URL}/api/transcribe-saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_filename: videoFilename,
            model_name: 'base',
            max_words_per_segment: style.maxWordsPerSegment || 3
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Transcription failed');
        }
        const data = await res.json();
        setSegments(data.segments);
      }
    } catch (err) {
      console.error(err);
      alert(`Transcription error: ${err.message}`);
    } finally {
      setIsTranscribing(false, '');
    }
  };

  return (
    <header className="glass-panel" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ 
          width: '34px', 
          height: '34px', 
          borderRadius: '10px', 
          background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)'
        }}>
          <Film size={20} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              Auto<span style={{ color: 'var(--accent-primary)' }}>Caption</span>
            </span>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '700', 
              padding: '1px 6px', 
              borderRadius: '999px', 
              background: 'rgba(56, 189, 248, 0.15)', 
              color: 'var(--accent-primary)',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              STUDIO
            </span>
          </div>
        </div>
      </div>

      {/* Center Controls: Aspect Ratio & Safe Zones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Aspect Ratio Picker */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(0,0,0,0.35)', 
          padding: '3px', 
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setAspectRatio('9:16')}
            title="9:16 TikTok / Reels / Shorts"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: aspectRatio === '9:16' ? 'var(--accent-primary)' : 'transparent',
              color: aspectRatio === '9:16' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Smartphone size={13} /> 9:16
          </button>
          <button
            onClick={() => setAspectRatio('1:1')}
            title="1:1 Square Feed"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: aspectRatio === '1:1' ? 'var(--accent-primary)' : 'transparent',
              color: aspectRatio === '1:1' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Square size={13} /> 1:1
          </button>
          <button
            onClick={() => setAspectRatio('16:9')}
            title="16:9 Standard Wide"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: aspectRatio === '16:9' ? 'var(--accent-primary)' : 'transparent',
              color: aspectRatio === '16:9' ? '#000000' : 'var(--text-muted)'
            }}
          >
            <Tv size={13} /> 16:9
          </button>
        </div>

        {/* Safe Zones Toggle */}
        <button
          onClick={toggleSafeZones}
          className="btn-secondary"
          style={{ padding: '6px 10px', fontSize: '11px' }}
          title="Toggle TikTok / Shorts UI Safe Zone Overlays"
        >
          {showSafeZones ? <Eye size={13} color="var(--accent-primary)" /> : <EyeOff size={13} />}
          <span>Safe Zones</span>
        </button>

        {/* Quick Transcribe CTA Button in Header */}
        <button
          onClick={handleQuickTranscribe}
          className="btn-primary"
          disabled={isTranscribing}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
            boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)'
          }}
          title="Run Whisper word-level transcription on current video"
        >
          {isTranscribing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Transcribing...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Auto-Caption (Whisper)</span>
            </>
          )}
        </button>
      </div>

      {/* Right Action CTAs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="btn-secondary"
          title="Studio Settings & AI Model Manager"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>

        <button
          onClick={loadDemoData}
          className="btn-secondary"
          title="Reset or Load Demo Sample"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RotateCcw size={14} />
          <span>Demo</span>
        </button>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <Upload size={14} />
          <span>Upload</span>
        </button>

        <button
          onClick={() => setExportModalOpen(true)}
          className="btn-viral"
          style={{ fontSize: '12px', padding: '7px 16px' }}
        >
          <Download size={15} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
