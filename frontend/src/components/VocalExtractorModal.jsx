import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Mic,
  Music,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Upload,
  AlertCircle,
  Loader2,
  FileAudio,
  CheckCircle2,
  Send,
  Zap,
  Radio,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const VocalExtractorModal = () => {
  const {
    isVocalExtractorOpen,
    setVocalExtractorOpen,
    videoFile,
    videoFilename,
    setVideo,
    setUploadModalOpen
  } = useEditorStore();

  const [selectedFile, setSelectedFile] = useState(null);
  const [engine, setEngine] = useState('demucs'); // 'demucs' | 'deepfilter'
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);

  // Separation Results
  const [separationResult, setSeparationResult] = useState(null);

  // Audio Playback & Dual Stems State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stem Controls: Vocals vs Instrumental
  const [vocalsVolume, setVocalsVolume] = useState(1.0);
  const [vocalsMuted, setVocalsMuted] = useState(false);
  const [vocalsSolo, setVocalsSolo] = useState(false);

  const [instVolume, setInstVolume] = useState(1.0);
  const [instMuted, setInstMuted] = useState(false);
  const [instSolo, setInstSolo] = useState(false);

  const vocalsAudioRef = useRef(null);
  const instAudioRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const animFrameRef = useRef(null);

  // Reset when modal opens
  useEffect(() => {
    if (isVocalExtractorOpen) {
      if (!selectedFile && videoFile) {
        setSelectedFile(videoFile);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      pauseAllAudio();
    }
  }, [isVocalExtractorOpen, videoFile]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const pauseAllAudio = () => {
    if (vocalsAudioRef.current) vocalsAudioRef.current.pause();
    if (instAudioRef.current) instAudioRef.current.pause();
    setIsPlaying(false);
  };

  const syncPlaybackTime = useCallback(() => {
    const vAudio = vocalsAudioRef.current;
    if (vAudio && !vAudio.paused) {
      setCurrentTime(vAudio.currentTime);
      animFrameRef.current = requestAnimationFrame(syncPlaybackTime);
    }
  }, []);

  // Update volume & solo states on audio elements
  useEffect(() => {
    if (vocalsAudioRef.current) {
      const isAudible = !vocalsMuted && (!instSolo || vocalsSolo);
      vocalsAudioRef.current.volume = isAudible ? vocalsVolume : 0;
    }
    if (instAudioRef.current) {
      const isAudible = !instMuted && (!vocalsSolo || instSolo);
      instAudioRef.current.volume = isAudible ? instVolume : 0;
    }
  }, [vocalsVolume, vocalsMuted, vocalsSolo, instVolume, instMuted, instSolo]);

  const handleTogglePlay = () => {
    const vAudio = vocalsAudioRef.current;
    const iAudio = instAudioRef.current;
    if (!vAudio || !iAudio) return;

    if (isPlaying) {
      vAudio.pause();
      iAudio.pause();
      setIsPlaying(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      // Align start times
      iAudio.currentTime = vAudio.currentTime;
      Promise.all([vAudio.play(), iAudio.play()])
        .then(() => {
          setIsPlaying(true);
          animFrameRef.current = requestAnimationFrame(syncPlaybackTime);
        })
        .catch((err) => console.warn('Audio playback error:', err));
    }
  };

  const handleSeek = (newTime) => {
    const time = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(time);
    if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = time;
    if (instAudioRef.current) instAudioRef.current.currentTime = time;
  };

  const handleAudioEnded = () => {
    pauseAllAudio();
    setCurrentTime(0);
    if (vocalsAudioRef.current) vocalsAudioRef.current.currentTime = 0;
    if (instAudioRef.current) instAudioRef.current.currentTime = 0;
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setErrorMsg(null);
      setSeparationResult(null);
      pauseAllAudio();
    }
    if (e.target && e.target.type === 'file') {
      e.target.value = '';
    }
  };

  const handleStartSeparation = async () => {
    if (!selectedFile) return;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setIsProcessing(true);
    setProgress(5);
    setProgressMsg('Uploading media to separation server...');
    setErrorMsg(null);
    setSeparationResult(null);
    pauseAllAudio();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('engine', engine);

      const res = await fetch(`${BACKEND_URL}/api/separate-audio`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to initialize audio separation on server.');
      }

      const { job_id } = await res.json();
      setActiveJobId(job_id);

      // Start progress polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const progRes = await fetch(`${BACKEND_URL}/api/separate-progress/${job_id}`);
          if (progRes.ok) {
            const progData = await progRes.json();
            setProgress(progData.percent || 0);
            setProgressMsg(progData.message || 'Processing stems...');

            if (progData.status === 'done' && progData.result) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setSeparationResult(progData.result);
              setDuration(progData.result.duration || 0);
              setIsProcessing(false);
            } else if (progData.status === 'error') {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setIsProcessing(false);
              setErrorMsg(progData.error || 'Separation failed on server.');
            }
          }
        } catch (_) {}
      }, 500);
    } catch (err) {
      console.error('Separation error:', err);
      setIsProcessing(false);
      setErrorMsg(err.message || 'Separation request failed.');
    }
  };

  const handleCancel = async () => {
    if (activeJobId) {
      try {
        await fetch(`${BACKEND_URL}/api/separate-cancel/${activeJobId}`, { method: 'POST' });
      } catch (_) {}
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
    setErrorMsg('Separation cancelled.');
  };

  const handleSendToCaptionStudio = () => {
    if (!separationResult?.stems?.vocals?.wav_url) return;
    const vocalUrl = `${BACKEND_URL}${separationResult.stems.vocals.wav_url}`;
    
    // Set video/audio source to clean vocals and open transcription modal
    setVideo(selectedFile, vocalUrl, `[Clean Vocals] ${selectedFile?.name || 'vocals.wav'}`, separationResult.duration);
    setVocalExtractorOpen(false);
    setUploadModalOpen(true);
  };

  if (!isVocalExtractorOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '680px',
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
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.2), rgba(88, 86, 214, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 45, 85, 0.3)'
            }}>
              <Mic size={15} color="#FF2D55" />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                AI Vocal Extractor Studio
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                Separate voices & dialogue from background music, instruments, and noise
              </span>
            </div>
          </div>

          <button
            onClick={() => { pauseAllAudio(); setVocalExtractorOpen(false); }}
            className="btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Engine Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Separation Engine
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => !isProcessing && setEngine('demucs')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  border: engine === 'demucs' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: engine === 'demucs' ? 'rgba(0, 113, 227, 0.14)' : 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  textAlign: 'left'
                }}
              >
                <Music size={16} color={engine === 'demucs' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: engine === 'demucs' ? '600' : '500', color: engine === 'demucs' ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                    Meta Demucs Neural Stems
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Full 2-stem music separation. Isolates singing & instruments with studio clarity.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => !isProcessing && setEngine('deepfilter')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  border: engine === 'deepfilter' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: engine === 'deepfilter' ? 'rgba(0, 113, 227, 0.14)' : 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  textAlign: 'left'
                }}
              >
                <Zap size={16} color={engine === 'deepfilter' ? 'var(--accent-bright-blue)' : 'var(--text-tertiary)'} style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: engine === 'deepfilter' ? '600' : '500', color: engine === 'deepfilter' ? 'var(--accent-bright-blue)' : 'var(--text-primary)' }}>
                    Fast Speech Denoising
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Ultra-fast dialogue cleanup. Strips background songs, ambient hum, and room noise.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Upload Drop Zone */}
          {!separationResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 16px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                position: 'relative'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(0, 113, 227, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Upload size={18} color="var(--accent-bright-blue)" />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready to extract stems
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    Drop audio or video file here, or browse
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    MP4, MOV, MKV, MP3, WAV, M4A, FLAC supported
                  </div>
                </div>
              )}

              <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileDrop}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 113, 227, 0.08)',
              border: '1px solid rgba(0, 113, 227, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
                <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={13} className="animate-spin" color="var(--accent-bright-blue)" />
                  {progressMsg || 'Processing stems with AI...'}
                </span>
                <span style={{ color: 'var(--accent-bright-blue)', fontFamily: 'SF Mono, monospace' }}>
                  {progress}%
                </span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 250ms ease'
                }} />
              </div>
            </div>
          )}

          {/* Error Banner */}
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

          {/* Results: Dual Waveform Stem Player */}
          {separationResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Hidden HTML5 Audio Elements for Stems */}
              <audio
                ref={vocalsAudioRef}
                src={`${BACKEND_URL}${separationResult.stems.vocals.mp3_url}`}
                preload="auto"
                onEnded={handleAudioEnded}
              />
              <audio
                ref={instAudioRef}
                src={`${BACKEND_URL}${separationResult.stems.instrumental.mp3_url}`}
                preload="auto"
                onEnded={handleAudioEnded}
              />

              {/* Master Playback Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleTogglePlay}
                    className="btn-primary"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      padding: 0,
                      justifyContent: 'center'
                    }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
                  </button>

                  <div style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-secondary)' }}>
                    <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-tertiary)' }}>/</span>
                    <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => {
                      setVocalsSolo(false);
                      setInstSolo(false);
                      setVocalsMuted(false);
                      setInstMuted(false);
                    }}
                    className="btn-ghost"
                    style={{ fontSize: '10px', padding: '4px 8px' }}
                    title="Reset Track States"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Solo/Mute</span>
                  </button>
                </div>
              </div>

              {/* Stem 1: Vocals */}
              <div style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: vocalsSolo ? 'rgba(255, 45, 85, 0.1)' : 'var(--bg-surface)',
                border: vocalsSolo ? '1px solid rgba(255, 45, 85, 0.4)' : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mic size={14} color="#FF2D55" />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Isolated Vocals
                    </span>
                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', background: 'rgba(255, 45, 85, 0.15)', color: '#FF2D55', fontWeight: '600' }}>
                      STEM 1
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Solo Button */}
                    <button
                      onClick={() => { setVocalsSolo(!vocalsSolo); if (!vocalsSolo) setInstSolo(false); }}
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: vocalsSolo ? '#FF2D55' : 'var(--border-subtle)',
                        background: vocalsSolo ? '#FF2D55' : 'transparent',
                        color: vocalsSolo ? '#FFFFFF' : 'var(--text-secondary)'
                      }}
                    >
                      SOLO
                    </button>

                    {/* Mute Button */}
                    <button
                      onClick={() => setVocalsMuted(!vocalsMuted)}
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: vocalsMuted ? 'var(--system-error)' : 'var(--border-subtle)',
                        background: vocalsMuted ? 'rgba(255, 69, 58, 0.2)' : 'transparent',
                        color: vocalsMuted ? 'var(--system-error)' : 'var(--text-secondary)'
                      }}
                    >
                      MUTE
                    </button>

                    {/* Download Dropdown */}
                    <a
                      href={`${BACKEND_URL}${separationResult.stems.vocals.wav_url}`}
                      download="vocals_lossless.wav"
                      className="btn-secondary"
                      style={{ fontSize: '10px', padding: '3px 8px', textDecoration: 'none' }}
                      title="Download Lossless WAV"
                    >
                      <Download size={11} />
                      <span>WAV</span>
                    </a>

                    <a
                      href={`${BACKEND_URL}${separationResult.stems.vocals.mp3_url}`}
                      download="vocals_320k.mp3"
                      className="btn-secondary"
                      style={{ fontSize: '10px', padding: '3px 8px', textDecoration: 'none' }}
                      title="Download 320k MP3"
                    >
                      <Download size={11} />
                      <span>MP3</span>
                    </a>
                  </div>
                </div>

                {/* Waveform Bars Visualizer with Click-to-Seek */}
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    handleSeek(ratio * duration);
                  }}
                  style={{
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    position: 'relative'
                  }}
                >
                  {(separationResult.stems.vocals.peaks || []).map((peak, idx) => {
                    const barRatio = idx / (separationResult.stems.vocals.peaks.length || 1);
                    const isPassed = barRatio <= (currentTime / (duration || 1));
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${Math.max(12, peak * 100)}%`,
                          background: isPassed ? '#FF2D55' : 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '1px',
                          transition: 'background 100ms ease'
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Stem 2: Instrumental / Background */}
              <div style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: instSolo ? 'rgba(0, 113, 227, 0.1)' : 'var(--bg-surface)',
                border: instSolo ? '1px solid rgba(0, 113, 227, 0.4)' : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Music size={14} color="var(--accent-bright-blue)" />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Instrumental / Background
                    </span>
                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', background: 'rgba(0, 113, 227, 0.15)', color: 'var(--accent-bright-blue)', fontWeight: '600' }}>
                      STEM 2
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Solo Button */}
                    <button
                      onClick={() => { setInstSolo(!instSolo); if (!instSolo) setVocalsSolo(false); }}
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: instSolo ? 'var(--accent-bright-blue)' : 'var(--border-subtle)',
                        background: instSolo ? 'var(--accent-bright-blue)' : 'transparent',
                        color: instSolo ? '#FFFFFF' : 'var(--text-secondary)'
                      }}
                    >
                      SOLO
                    </button>

                    {/* Mute Button */}
                    <button
                      onClick={() => setInstMuted(!instMuted)}
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid',
                        cursor: 'pointer',
                        borderColor: instMuted ? 'var(--system-error)' : 'var(--border-subtle)',
                        background: instMuted ? 'rgba(255, 69, 58, 0.2)' : 'transparent',
                        color: instMuted ? 'var(--system-error)' : 'var(--text-secondary)'
                      }}
                    >
                      MUTE
                    </button>

                    {/* Download Dropdown */}
                    <a
                      href={`${BACKEND_URL}${separationResult.stems.instrumental.wav_url}`}
                      download="instrumental_lossless.wav"
                      className="btn-secondary"
                      style={{ fontSize: '10px', padding: '3px 8px', textDecoration: 'none' }}
                      title="Download Lossless WAV"
                    >
                      <Download size={11} />
                      <span>WAV</span>
                    </a>

                    <a
                      href={`${BACKEND_URL}${separationResult.stems.instrumental.mp3_url}`}
                      download="instrumental_320k.mp3"
                      className="btn-secondary"
                      style={{ fontSize: '10px', padding: '3px 8px', textDecoration: 'none' }}
                      title="Download 320k MP3"
                    >
                      <Download size={11} />
                      <span>MP3</span>
                    </a>
                  </div>
                </div>

                {/* Waveform Bars Visualizer with Click-to-Seek */}
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    handleSeek(ratio * duration);
                  }}
                  style={{
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    position: 'relative'
                  }}
                >
                  {(separationResult.stems.instrumental.peaks || []).map((peak, idx) => {
                    const barRatio = idx / (separationResult.stems.instrumental.peaks.length || 1);
                    const isPassed = barRatio <= (currentTime / (duration || 1));
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${Math.max(12, peak * 100)}%`,
                          background: isPassed ? 'var(--accent-bright-blue)' : 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '1px',
                          transition: 'background 100ms ease'
                        }}
                      />
                    );
                  })}
                </div>
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
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div>
            {separationResult && (
              <button
                onClick={() => { setSeparationResult(null); pauseAllAudio(); }}
                className="btn-ghost"
                style={{ fontSize: '11px' }}
              >
                Extract Another File
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing ? (
              <button
                onClick={handleCancel}
                className="btn-secondary"
                style={{ color: 'var(--system-error)', borderColor: 'rgba(255, 69, 58, 0.3)' }}
              >
                <span>Cancel</span>
              </button>
            ) : separationResult ? (
              <>
                <button
                  onClick={() => { pauseAllAudio(); setVocalExtractorOpen(false); }}
                  className="btn-secondary"
                >
                  Done
                </button>

                <button
                  onClick={handleSendToCaptionStudio}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0071E3 0%, #5856D6 100%)',
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <Send size={13} />
                  <span>Send to Caption Studio</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setVocalExtractorOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>

                <button
                  onClick={handleStartSeparation}
                  disabled={!selectedFile}
                  className="btn-primary"
                  style={{
                    opacity: !selectedFile ? 0.5 : 1,
                    cursor: !selectedFile ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={13} />
                  <span>Extract Stems</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
