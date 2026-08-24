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
  Loader2,
  FileText
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTimecode } from '../engine/animator';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const CaptionListEditor = () => {
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
    setIsTranscribing(true, 'Transcribing with Whisper AI...');

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
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: '800' }}>Captions & Words</span>
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '999px', color: 'var(--text-muted)' }}>
            {segments.length}
          </span>
        </div>

        <button
          onClick={handleAddNewSegment}
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          title="Add empty caption segment"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
        <input
          type="text"
          placeholder="Filter words..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontSize: '11px',
            padding: '5px 8px',
            borderRadius: '6px'
          }}
        />
      </div>

      {/* Segment Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '30px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No captions generated yet.</p>
            <button
              onClick={handleTranscribeCurrent}
              className="btn-viral"
              disabled={isTranscribing}
              style={{ padding: '8px 14px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
            >
              {isTranscribing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Transcribing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Auto-Caption (Whisper)</span>
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
                  borderRadius: '8px',
                  padding: '8px 10px',
                  border: isCurrentlyPlaying 
                    ? '1px solid var(--accent-primary)' 
                    : '1px solid var(--border-color)',
                  background: isCurrentlyPlaying 
                    ? 'rgba(56, 189, 248, 0.08)' 
                    : 'rgba(31, 41, 55, 0.5)',
                  transition: 'all 150ms ease'
                }}
              >
                {/* Segment Header */}
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
                      gap: '4px',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      fontWeight: '700'
                    }}
                  >
                    <Play size={9} fill="currentColor" />
                    {formatTimecode(seg.start)} ➔ {formatTimecode(seg.end)}
                  </button>

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
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Word Tokens */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {seg.words.map((w, wIdx) => {
                    const isWordActive = currentTime >= w.start && currentTime <= w.end;
                    const isEditing = editingWordId === w.id;

                    return (
                      <div
                        key={w.id || wIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: isWordActive 
                            ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' 
                            : 'rgba(0,0,0,0.35)',
                          color: isWordActive ? '#FFFFFF' : 'var(--text-main)',
                          border: isWordActive 
                            ? '1px solid rgba(255,255,255,0.4)' 
                            : '1px solid var(--border-color)',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
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
                                fontSize: '10px',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                width: '60px'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(seg.id, w.id)}
                              style={{ background: 'none', border: 'none', color: '#4ADE80', cursor: 'pointer' }}
                            >
                              <Check size={10} />
                            </button>
                            <button
                              onClick={() => setEditingWordId(null)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              onClick={() => setCurrentTime(w.start)}
                              style={{ cursor: 'pointer' }}
                              title="Jump to word"
                            >
                              {w.word}
                            </span>

                            <button
                              onClick={() => handleStartEdit(w)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0 1px' }}
                              title="Edit spelling"
                            >
                              <Edit3 size={9} />
                            </button>

                            {wIdx > 0 && (
                              <button
                                onClick={() => splitSegmentAtWord(seg.id, w.id)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0 1px' }}
                                title="Split segment"
                              >
                                <Scissors size={9} />
                              </button>
                            )}

                            <button
                              onClick={() => deleteWord(seg.id, w.id)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0 1px' }}
                              title="Delete word"
                            >
                              <X size={9} />
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
