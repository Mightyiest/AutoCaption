import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  X, 
  Sparkles, 
  FileVideo, 
  Play, 
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const UploadModal = () => {
  const {
    isUploadModalOpen,
    setUploadModalOpen,
    setSettingsModalOpen,
    modelsData,
    fetchModelsStatus,
    selectedModel,
    setSelectedModel,
    ensureModelDownloaded,
    setVideo,
    setSegments,
    setIsTranscribing,
    isTranscribing,
    transcribeProgress,
    backendAvailable,
    videoFilename,
    removePunctuation,
    setRemovePunctuation
  } = useEditorStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [wordsPerChunk, setWordsPerChunk] = useState(3);
  const [stripPunct, setStripPunct] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isUploadingPreview, setIsUploadingPreview] = useState(false);

  useEffect(() => {
    if (isUploadModalOpen) {
      fetchModelsStatus();
      setStripPunct(Boolean(removePunctuation));
    }
  }, [isUploadModalOpen, removePunctuation]);

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

      const localBlobUrl = URL.createObjectURL(file);
      setVideo(file, localBlobUrl, file.name);

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
    setIsTranscribing(true, `Checking AI model '${selectedModel}'...`);

    try {
      await ensureModelDownloaded(selectedModel, (dlState) => {
        setIsTranscribing(
          true,
          `Downloading Whisper ${selectedModel} model (${dlState.percent}% - ${dlState.downloaded_mb || '0 MB'})...`
        );
      });

      if (backendAvailable && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('model_name', selectedModel);
        if (language !== 'auto') formData.append('language', language);
        formData.append('max_words_per_segment', wordsPerChunk);
        formData.append('remove_punctuation', stripPunct);

        setIsTranscribing(true, `Running Whisper ${selectedModel.toUpperCase()} speech alignment...`);
        const response = await fetch(`${BACKEND_URL}/api/transcribe`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Transcription failed on server');
        }

        const data = await response.json();
        setRemovePunctuation(stripPunct);
        setVideo(selectedFile, `${BACKEND_URL}${data.video_url}`, data.video_filename, data.duration);
        setSegments(data.segments);
      } else if (backendAvailable && videoFilename) {
        setIsTranscribing(true, `Running Whisper ${selectedModel.toUpperCase()} speech alignment...`);
        const response = await fetch(`${BACKEND_URL}/api/transcribe-saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_filename: videoFilename,
            model_name: selectedModel,
            language: language !== 'auto' ? language : null,
            max_words_per_segment: wordsPerChunk,
            remove_punctuation: stripPunct
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Transcription failed on server');
        }

        const data = await response.json();
        setRemovePunctuation(stripPunct);
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
    <div className="modal-backdrop">
      <div 
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={16} color="var(--accent-bright-blue)" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Import Video</span>
          </div>
          <button
            onClick={() => setUploadModalOpen(false)}
            className="btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Dropzone */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            style={{
              border: selectedFile ? '1px solid var(--accent-primary)' : '1px dashed var(--border-hover)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: selectedFile ? 'rgba(0, 113, 227, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all var(--transition-fast)'
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
                <FileVideo size={32} color="var(--accent-bright-blue)" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • {isUploadingPreview ? 'Loading...' : 'Ready'}
                </span>
              </>
            ) : (
              <>
                <UploadCloud size={32} color="var(--text-tertiary)" />
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  Drag & drop video here, or <span style={{ color: 'var(--accent-bright-blue)' }}>browse</span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Supports MP4, MOV, WebM, MKV, WAV, MP3
                </span>
              </>
            )}
          </label>

          {/* Model Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Whisper Model Size */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  Speech Model
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUploadModalOpen(false);
                    setSettingsModalOpen(true);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: '10px', padding: '0', color: 'var(--accent-bright-blue)' }}
                >
                  <Settings size={10} />
                  <span>Manage</span>
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {modelsData?.models && modelsData.models.length > 0 ? (
                  modelsData.models.map((m) => (
                    <option key={m.id} value={m.id} style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
                      {m.name} {m.is_downloaded ? '✓' : `[${m.size_label}]`}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="base" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Base (Default)</option>
                    <option value="tiny" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Tiny (Fast)</option>
                    <option value="small" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Small (High Accuracy)</option>
                    <option value="medium" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Medium (Studio)</option>
                    <option value="large-v3-turbo" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Large v3 Turbo</option>
                    <option value="large-v3" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Large v3</option>
                  </>
                )}
              </select>
            </div>

            {/* Language */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="auto" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Auto-Detect</option>
                <option value="en" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>English</option>
                <option value="es" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Spanish</option>
                <option value="fr" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>French</option>
                <option value="de" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>German</option>
                <option value="ja" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Japanese</option>
              </select>
            </div>
          </div>

          {/* Words per chunk */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                Words per Line
              </label>
              <span style={{ fontSize: '11px', color: 'var(--accent-bright-blue)', fontWeight: '500' }}>
                {wordsPerChunk} Words
              </span>
            </div>
            <div className="segmented-control" style={{ width: '100%' }}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWordsPerChunk(w)}
                  className={`segmented-control-item ${wordsPerChunk === w ? 'active' : ''}`}
                  style={{ flex: 1, padding: '5px 0', fontSize: '11px' }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Remove Punctuation Option */}
          <div 
            onClick={() => setStripPunct(!stripPunct)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              background: stripPunct ? 'rgba(0, 113, 227, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: stripPunct ? '1px solid rgba(0, 113, 227, 0.4)' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 120ms ease'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: stripPunct ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                Remove Punctuation
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                Strip periods, commas, and symbols for clean viral captions
              </div>
            </div>
            <input
              type="checkbox"
              checked={stripPunct}
              onChange={(e) => setStripPunct(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
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
              <span>{errorMsg}</span>
            </div>
          )}

          {isTranscribing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 113, 227, 0.12)',
              border: '1px solid rgba(0, 113, 227, 0.3)',
              color: 'var(--accent-bright-blue)',
              fontSize: '12px'
            }}>
              <Loader2 size={15} className="animate-spin" />
              <span>{transcribeProgress || 'Processing audio with Whisper AI...'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <button
            onClick={handlePreviewOnly}
            className="btn-ghost"
            disabled={!selectedFile || isTranscribing}
            style={{ fontSize: '12px' }}
          >
            <Play size={12} />
            <span>Preview in Player</span>
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setUploadModalOpen(false)}
              className="btn-secondary"
              disabled={isTranscribing}
            >
              Cancel
            </button>

            <button
              onClick={handleTranscribeNow}
              className="btn-primary"
              disabled={!selectedFile || isTranscribing}
              style={{ opacity: !selectedFile || isTranscribing ? 0.5 : 1 }}
            >
              <Sparkles size={13} />
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
