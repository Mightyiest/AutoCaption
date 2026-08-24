import React, { useState } from 'react';
import { 
  UploadCloud, 
  X, 
  Sparkles, 
  FileVideo, 
  Play, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const UploadModal = () => {
  const {
    isUploadModalOpen,
    setUploadModalOpen,
    setVideo,
    setSegments,
    setIsTranscribing,
    isTranscribing,
    transcribeProgress,
    backendAvailable,
    videoFilename
  } = useEditorStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [modelSize, setModelSize] = useState('base');
  const [language, setLanguage] = useState('auto');
  const [wordsPerChunk, setWordsPerChunk] = useState(3);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isUploadingPreview, setIsUploadingPreview] = useState(false);

  if (!isUploadModalOpen) return null;

  const handleFileDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
        setErrorMsg('Please select a valid video file (.mp4, .mov, .webm, .mkv)');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);

      // Instant local preview
      const localBlobUrl = URL.createObjectURL(file);
      setVideo(file, localBlobUrl, file.name);

      // Upload to server for backend access
      if (backendAvailable) {
        setIsUploadingPreview(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${BACKEND_URL}/api/upload-preview`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            setVideo(file, `${BACKEND_URL}${data.video_url}`, data.video_filename);
          }
        } catch (err) {
          console.error('Preview upload error:', err);
        } finally {
          setIsUploadingPreview(false);
        }
      }
    }
  };

  const handleTranscribeNow = async () => {
    if (!selectedFile && !videoFilename) return;
    setErrorMsg(null);
    setIsTranscribing(true, 'Extracting audio and initializing Whisper AI...');

    try {
      if (backendAvailable && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('model_name', modelSize);
        if (language !== 'auto') formData.append('language', language);
        formData.append('max_words_per_segment', wordsPerChunk);

        setIsTranscribing(true, 'Running Whisper speech alignment on GPU/CPU...');
        const response = await fetch(`${BACKEND_URL}/api/transcribe`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Transcription failed on server');
        }

        const data = await response.json();
        setVideo(selectedFile, `${BACKEND_URL}${data.video_url}`, data.video_filename, data.duration);
        setSegments(data.segments);
      }

      setIsTranscribing(false, '');
      setUploadModalOpen(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during transcription.');
      setIsTranscribing(false, '');
    }
  };

  const handlePreviewOnly = () => {
    setUploadModalOpen(false);
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
        maxWidth: '540px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.12)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: '15px', fontWeight: '800' }}>Import Video</span>
          </div>
          <button
            onClick={() => setUploadModalOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dropzone */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            style={{
              border: selectedFile ? '2px solid var(--accent-primary)' : '2px dashed rgba(255,255,255,0.2)',
              borderRadius: '14px',
              padding: '26px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: selectedFile ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 200ms ease'
            }}
          >
            <input
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileDrop}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <>
                <FileVideo size={36} color="var(--accent-primary)" />
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • {isUploadingPreview ? 'Loading to editor...' : 'Ready in Video Player'}
                </span>
              </>
            ) : (
              <>
                <UploadCloud size={36} color="var(--text-muted)" />
                <span style={{ fontSize: '14px', fontWeight: '700' }}>
                  Drag & drop video here, or <span style={{ color: 'var(--accent-primary)' }}>browse</span>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Instant playback preview in 9:16 editor player
                </span>
              </>
            )}
          </label>

          {/* Model Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Whisper Model Size */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Whisper AI Model
              </label>
              <select
                value={modelSize}
                onChange={(e) => setModelSize(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="base">Base (Recommended - Fast & Accurate)</option>
                <option value="tiny">Tiny (Ultra-Fast)</option>
                <option value="small">Small (High Accuracy)</option>
                <option value="medium">Medium (Studio Quality)</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="auto">Auto-Detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </div>

          {/* Words per chunk */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                Words per Caption Line
              </label>
              <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '700' }}>
                {wordsPerChunk} Words (Viral Short-Form Pace)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWordsPerChunk(w)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    background: wordsPerChunk === w ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                    color: wordsPerChunk === w ? '#000000' : 'var(--text-main)',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              fontSize: '12px'
            }}>
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {isTranscribing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: 'var(--accent-primary)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <Loader2 size={18} className="animate-spin" />
              <span>{transcribeProgress || 'Processing audio with Whisper AI...'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 22px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)'
        }}>
          {/* Preview Button */}
          <button
            onClick={handlePreviewOnly}
            className="btn-secondary"
            disabled={!selectedFile || isTranscribing}
            style={{ fontSize: '13px' }}
          >
            <Play size={14} />
            <span>Preview in Editor First</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setUploadModalOpen(false)}
              className="btn-secondary"
              disabled={isTranscribing}
            >
              Cancel
            </button>

            <button
              onClick={handleTranscribeNow}
              className="btn-viral"
              disabled={!selectedFile || isTranscribing}
              style={{ opacity: !selectedFile || isTranscribing ? 0.6 : 1 }}
            >
              <Sparkles size={16} />
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
