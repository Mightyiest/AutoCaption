import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Cpu, 
  Globe, 
  AlignLeft, 
  Scissors, 
  Loader2, 
  Check, 
  Settings, 
  FileVideo,
  FileAudio,
  AlertCircle
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

const MODEL_DETAILS = {
  'tiny': { name: 'Tiny', speed: '32x Ultra-Fast', size: '~75 MB' },
  'base': { name: 'Base (Default)', speed: '16x Fast', size: '~145 MB' },
  'small': { name: 'Small', speed: '6x Accurate', size: '~480 MB' },
  'medium': { name: 'Medium', speed: '2x Studio Quality', size: '~1.5 GB' },
  'large-v3-turbo': { name: 'Large v3 Turbo', speed: '8x High Accuracy', size: '~1.6 GB' },
  'large-v3': { name: 'Large v3', speed: '1x Maximum Accuracy', size: '~3.1 GB' }
};

export const TranscribeModal = () => {
  const {
    isTranscribeModalOpen,
    setTranscribeModalOpen,
    setSettingsModalOpen,
    videoFile,
    videoFilename,
    duration,
    selectedModel,
    setSelectedModel,
    modelsData,
    fetchModelsStatus,
    ensureModelDownloaded,
    setSegments,
    isTranscribing,
    setIsTranscribing,
    transcribeProgress,
    backendAvailable,
    style,
    updateStyle,
    removePunctuation,
    setRemovePunctuation,
    linkedSourcePath
  } = useEditorStore();

  const [language, setLanguage] = useState('auto');
  const [wordsPerChunk, setWordsPerChunk] = useState(style.maxWordsPerSegment || 3);
  const [stripPunct, setStripPunct] = useState(Boolean(removePunctuation));
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isTranscribeModalOpen) {
      fetchModelsStatus();
      setWordsPerChunk(style.maxWordsPerSegment || 3);
      setStripPunct(Boolean(removePunctuation));
      setErrorMsg(null);
    }
  }, [isTranscribeModalOpen, style.maxWordsPerSegment, removePunctuation]);

  if (!isTranscribeModalOpen) return null;

  const currentMediaName = videoFilename || (videoFile ? videoFile.name : 'Loaded Media');
  const isAudio = Boolean(currentMediaName.endsWith('.wav') || currentMediaName.endsWith('.mp3') || currentMediaName.endsWith('.m4a'));

  const handleStartTranscription = async () => {
    if (isTranscribing) return;
    if (!videoFile && !videoFilename) {
      setErrorMsg('No media file loaded. Please import a video or audio file first.');
      return;
    }

    setErrorMsg(null);
    setIsTranscribing(true, `Checking AI model '${selectedModel}'...`);

    try {
      // 1. Ensure target Faster-Whisper model is ready/cached
      await ensureModelDownloaded(selectedModel, (dlState) => {
        setIsTranscribing(
          true,
          `Downloading Whisper ${selectedModel} model (${dlState.percent}% - ${dlState.downloaded_mb || '0 MB'})...`
        );
      });

      setIsTranscribing(true, `Aligning speech with Whisper ${selectedModel.toUpperCase()}...`);
      updateStyle({ maxWordsPerSegment: wordsPerChunk });
      setRemovePunctuation(stripPunct);

      // 2. Perform transcription request to backend
      let resultData;
      if (backendAvailable && videoFile) {
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('model_name', selectedModel);
        if (language !== 'auto') formData.append('language', language);
        formData.append('max_words_per_segment', wordsPerChunk);
        formData.append('remove_punctuation', stripPunct);

        const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Transcription failed on server');
        }
        resultData = await res.json();
      } else if (backendAvailable && (videoFilename || linkedSourcePath)) {
        const effectiveFilename = videoFilename || (linkedSourcePath ? linkedSourcePath.split(/[/\\]/).pop() : '');
        const res = await fetch(`${BACKEND_URL}/api/transcribe-saved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_filename: effectiveFilename,
            linked_path: linkedSourcePath || null,
            model_name: selectedModel,
            language: language !== 'auto' ? language : null,
            max_words_per_segment: wordsPerChunk,
            remove_punctuation: stripPunct
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Transcription failed on server');
        }
        resultData = await res.json();
      } else {
        throw new Error('Backend server is offline. Please run the local FastAPI service.');
      }

      if (resultData && resultData.segments) {
        setSegments(resultData.segments);
        setTranscribeModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during transcription.');
    } finally {
      setIsTranscribing(false, '');
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
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--accent-bright-blue)" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Auto-Caption Speech Settings
            </span>
          </div>
          <button
            onClick={() => setTranscribeModalOpen(false)}
            disabled={isTranscribing}
            className="btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Target Media Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(0, 113, 227, 0.08)',
            border: '1px solid rgba(0, 113, 227, 0.25)'
          }}>
            {isAudio ? <FileAudio size={20} color="var(--accent-bright-blue)" /> : <FileVideo size={20} color="var(--accent-bright-blue)" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentMediaName}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                Duration: {duration ? `${duration.toFixed(2)}s` : 'Ready for AI alignment'}
              </div>
            </div>
            <span style={{
              fontSize: '9px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--accent-primary)',
              color: '#FFFFFF'
            }}>
              FASTER-WHISPER
            </span>
          </div>

          {/* Model & Language Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Speech Model */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Cpu size={11} color="var(--accent-bright-blue)" />
                  <span>AI Model</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTranscribeModalOpen(false);
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
                disabled={isTranscribing}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '7px 8px',
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Globe size={11} color="var(--accent-bright-blue)" />
                <span>Spoken Language</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isTranscribing}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '7px 8px',
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
                <option value="pt" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Portuguese</option>
                <option value="zh" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>Chinese</option>
              </select>
            </div>
          </div>

          {/* Words Per Line / Screen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlignLeft size={11} color="var(--accent-bright-blue)" />
                <span>Words Per Screen</span>
              </label>
              <span style={{ fontSize: '11px', color: 'var(--accent-bright-blue)', fontWeight: '600' }}>
                {wordsPerChunk} Words / Screen
              </span>
            </div>
            <div className="segmented-control" style={{ width: '100%' }}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  disabled={isTranscribing}
                  onClick={() => setWordsPerChunk(w)}
                  className={`segmented-control-item ${wordsPerChunk === w ? 'active' : ''}`}
                  style={{ flex: 1, padding: '6px 0', fontSize: '11px' }}
                >
                  {w} {w === 1 ? 'Word' : 'Words'}
                </button>
              ))}
            </div>
          </div>

          {/* Remove Punctuation Option */}
          <div 
            onClick={() => !isTranscribing && setStripPunct(!stripPunct)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: stripPunct ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-lg)',
              border: stripPunct ? '1px solid rgba(0, 113, 227, 0.45)' : '1px solid var(--border-subtle)',
              cursor: isTranscribing ? 'default' : 'pointer',
              userSelect: 'none',
              transition: 'all 140ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-md)',
                background: stripPunct ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <Scissors size={14} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: stripPunct ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                  Remove All Punctuation
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Strip periods, commas, and quotation marks for clean viral text
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={stripPunct}
              disabled={isTranscribing}
              onChange={(e) => setStripPunct(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
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

          {/* Transcription In-Flight Progress */}
          {isTranscribing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(0, 113, 227, 0.12)',
              border: '1px solid rgba(0, 113, 227, 0.35)',
              color: 'var(--accent-bright-blue)',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              <Loader2 size={16} className="animate-spin" />
              <span>{transcribeProgress || 'Whisper AI is aligning words millisecond by millisecond...'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          background: 'var(--bg-surface)'
        }}>
          <button
            onClick={() => setTranscribeModalOpen(false)}
            disabled={isTranscribing}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '6px 14px' }}
          >
            Cancel
          </button>

          <button
            onClick={handleStartTranscription}
            disabled={isTranscribing}
            className="btn-primary"
            style={{ fontSize: '11px', padding: '6px 18px' }}
          >
            {isTranscribing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Transcribing...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Captions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
