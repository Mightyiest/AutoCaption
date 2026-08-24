import React, { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Scissors, 
  Plus, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  Clock,
  Loader2
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTimecode } from '../engine/animator';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const TimelineEditor = () => {
  const {
    segments,
    currentTime,
    setCurrentTime,
    updateWordText,
    deleteWord,
    deleteSegment,
    splitSegmentAtWord,
    setSegments,
    isTranscribing,
    setIsTranscribing,
    videoFile,
    videoFilename,
    backendAvailable,
    style
  } = useEditorStore();

  const [editingWordId, setEditingWordId] = useState(null);
  const [editText, setEditText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const handleStartEdit = (word) => {
    setEditingWordId(word.id);
    setEditText(word.word);
  };

  const handleSaveEdit = (segmentId, wordId) => {
    if (editText.trim()) {
      updateWordText(segmentId, wordId, editText.trim());
    }
    setEditingWordId(null);
  };

  const handleAddNewSegment = () => {
    const newStart = Math.max(0, currentTime);
    const newEnd = newStart + 1.5;
    const newSeg = {
      id: `seg-${Math.random().toString(36).substring(2, 9)}`,
      start: round(newStart, 2),
      end: round(newEnd, 2),
      text: 'NEW CAPTION BLOCK',
      words: [
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'NEW', start: round(newStart, 2), end: round(newStart + 0.4, 2), confidence: 1.0 },
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'CAPTION', start: round(newStart + 0.45, 2), end: round(newStart + 0.95, 2), confidence: 1.0 },
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'BLOCK', start: round(newStart + 1.0, 2), end: round(newEnd, 2), confidence: 1.0 }
      ]
    };
    setSegments([...segments, newSeg].sort((a, b) => a.start - b.start));
  };

  const handleTranscribeCurrent = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true, 'Extracting audio & transcribing with Whisper...');

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
        if (!res.ok) throw new Error('Transcription failed');
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
        if (!res.ok) throw new Error('Transcription failed');
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

  const round = (val, dec = 2) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);

  const filteredSegments = segments.filter((seg) => 
    !searchFilter || seg.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="glass-panel" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header & Controls */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={15} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: '800' }}>Timeline & Word Editor</span>
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '1px 8px', borderRadius: '999px', color: 'var(--text-muted)' }}>
            {segments.length} segments
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search text..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '11px',
              padding: '5px 8px',
              borderRadius: '6px',
              width: '120px'
            }}
          />

          <button
            onClick={handleAddNewSegment}
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '11px' }}
          >
            <Plus size={13} /> Add Block
          </button>
        </div>
      </div>

      {/* Segment Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {segments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '30px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No captions loaded for this video yet.</p>
            <button
              onClick={handleTranscribeCurrent}
              className="btn-viral"
              disabled={isTranscribing}
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              {isTranscribing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Transcribing with Whisper AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Auto-Captions (Whisper)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          filteredSegments.map((seg, sIdx) => {
            const isCurrentlyPlaying = currentTime >= seg.start && currentTime <= seg.end;

            return (
              <div
                key={seg.id || sIdx}
                className="glass-card"
                style={{
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: isCurrentlyPlaying 
                    ? '1px solid var(--accent-primary)' 
                    : '1px solid var(--border-color)',
                  background: isCurrentlyPlaying 
                    ? 'rgba(56, 189, 248, 0.08)' 
                    : 'rgba(31, 41, 55, 0.5)',
                  transition: 'all 150ms ease'
                }}
              >
                {/* Segment Meta Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <button
                    onClick={() => setCurrentTime(seg.start)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: '700'
                    }}
                  >
                    <Play size={10} fill="currentColor" />
                    {formatTimecode(seg.start)} ➔ {formatTimecode(seg.end)}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => deleteSegment(seg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Delete Segment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Word Tokens Grid */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {seg.words.map((w, wIdx) => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    const isEditing = editingWordId === w.id;

                    return (
                      <div
                        key={w.id || wIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: isWordActive 
                            ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' 
                            : 'rgba(0,0,0,0.35)',
                          color: isWordActive ? '#FFFFFF' : 'var(--text-main)',
                          border: isWordActive 
                            ? '1px solid rgba(255,255,255,0.4)' 
                            : '1px solid var(--border-color)',
                          boxShadow: isWordActive ? '0 2px 8px rgba(56, 189, 248, 0.4)' : 'none',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="text"
                              value={editText}
                              autoFocus
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(seg.id, w.id);
                                if (e.key === 'Escape') setEditingWordId(null);
                              }}
                              style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid var(--accent-primary)',
                                color: '#FFFFFF',
                                fontSize: '11px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                width: '70px'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(seg.id, w.id)}
                              style={{ background: 'none', border: 'none', color: '#4ADE80', cursor: 'pointer' }}
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={() => setEditingWordId(null)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              onClick={() => setCurrentTime(w.start)}
                              style={{ cursor: 'pointer' }}
                              title="Jump to word timestamp"
                            >
                              {w.word}
                            </span>

                            <button
                              onClick={() => handleStartEdit(w)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0 2px' }}
                              title="Edit spelling"
                            >
                              <Edit3 size={10} />
                            </button>

                            {wIdx > 0 && (
                              <button
                                onClick={() => splitSegmentAtWord(seg.id, w.id)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0 2px' }}
                                title="Split segment here"
                              >
                                <Scissors size={10} />
                              </button>
                            )}

                            <button
                              onClick={() => deleteWord(seg.id, w.id)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0 2px' }}
                              title="Delete word"
                            >
                              <X size={10} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
