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
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Combine,
  Search,
  Zap,
  Smile,
  Flame,
  Star,
  Wand2
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTimecode } from '../engine/animator';
import { isPowerKeyword } from '../engine/emphasisEngine';
import { FullEmojiPicker } from './FullEmojiPicker';
import { getAppleEmojiUrl } from '../engine/appleEmojiHelper';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const CaptionListEditor = () => {
  const {
    segments,
    currentTime,
    seekTo,
    selectedSegmentId,
    setSelectedSegmentId,
    updateSegmentText,
    deleteSegment,
    mergeSegmentWithNext,
    duplicateSegment,
    splitSegmentAtPlayhead,
    setSegments,
    isTranscribing,
    setIsTranscribing,
    videoFile,
    videoFilename,
    style,
    pushHistoryState,
    selectedModel,
    ensureModelDownloaded,
    backendAvailable,
    triggerVideoPicker,
    setTranscribeModalOpen,
    clearAllSegments,
    autoEnhanceWithAI,
    toggleWordEmphasis,
    setWordEmoji
  } = useEditorStore();

  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [expandedWordSegmentIds, setExpandedWordSegmentIds] = useState(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null); // { segId, wordId }

  const handleStartEdit = (seg) => {
    setEditingSegmentId(seg.id);
    setDraftText(seg.text);
    setSelectedSegmentId(seg.id);
  };

  const handleSaveEdit = (segmentId) => {
    if (draftText.trim()) {
      pushHistoryState();
      updateSegmentText(segmentId, draftText.trim());
    }
    setEditingSegmentId(null);
  };

  const handleCancelEdit = () => {
    setEditingSegmentId(null);
    setDraftText('');
  };

  const toggleWordsExpanded = (segmentId) => {
    setExpandedWordSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const handleAddNewSegment = () => {
    pushHistoryState();
    const newStart = Math.round(Math.max(0, currentTime) * 100) / 100;
    const newEnd = Math.round((newStart + 1.5) * 100) / 100;
    const newSeg = {
      id: `seg-${Math.random().toString(36).substring(2, 9)}`,
      start: newStart,
      end: newEnd,
      text: 'NEW CAPTION LINE',
      words: [
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'NEW', start: newStart, end: newStart + 0.4, confidence: 1.0 },
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'CAPTION', start: newStart + 0.45, end: newStart + 0.95, confidence: 1.0 },
        { id: `w-${Math.random().toString(36).substring(2, 7)}`, word: 'LINE', start: newStart + 1.0, end: newEnd, confidence: 1.0 }
      ]
    };
    setSegments([...segments, newSeg].sort((a, b) => a.start - b.start));
    setSelectedSegmentId(newSeg.id);
  };

  const handleTranscribeCurrent = () => {
    if (!videoFile && !videoFilename) {
      triggerVideoPicker();
      return;
    }
    setTranscribeModalOpen(true);
  };

  const handleClearAll = () => {
    if (showClearConfirm) {
      clearAllSegments();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => {
        setShowClearConfirm(false);
      }, 4000);
    }
  };

  const filteredSegments = segments.filter((seg) => 
    !searchFilter || seg.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <aside className="studio-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <FileText size={14} color="var(--accent-bright-blue)" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Captions</span>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '600',
            background: 'var(--border-subtle)', 
            padding: '1px 6px', 
            borderRadius: 'var(--radius-pill)', 
            color: 'var(--text-tertiary)' 
          }}>
            {segments.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {segments.length > 0 && (
            <button
              onClick={() => autoEnhanceWithAI()}
              className="btn-ghost"
              style={{
                padding: '4px 7px',
                fontSize: '10.5px',
                fontWeight: '600',
                color: '#00FF66',
                backgroundColor: 'rgba(0, 255, 102, 0.08)',
                border: '1px solid rgba(0, 255, 102, 0.25)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="AI Auto-Enhance captions with viral emojis & hook highlights"
            >
              <Sparkles size={11} color="#00FF66" />
              <span>Enhance</span>
            </button>
          )}

          {segments.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn-ghost"
              style={{
                padding: '4px 7px',
                fontSize: '10px',
                fontWeight: '600',
                color: showClearConfirm ? '#FFFFFF' : 'var(--system-error)',
                backgroundColor: showClearConfirm ? 'var(--system-error)' : 'rgba(255, 69, 58, 0.1)',
                borderColor: showClearConfirm ? 'var(--system-error)' : 'rgba(255, 69, 58, 0.25)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 120ms ease'
              }}
              title={showClearConfirm ? 'Click again to confirm delete all' : 'Delete all generated captions (Ctrl+Z to undo)'}
            >
              <Trash2 size={11} />
              <span>{showClearConfirm ? 'Confirm?' : 'Clear'}</span>
            </button>
          )}

          <button
            onClick={handleAddNewSegment}
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Add caption line at playhead"
          >
            <Plus size={11} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Apple-Style Search Field */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          border: '1px solid var(--border-subtle)'
        }}>
          <Search size={12} color="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="Filter transcript..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontFamily: 'inherit'
            }}
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Caption Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {segments.length === 0 ? (
          <div style={{
            margin: '16px 4px',
            padding: '24px 16px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-active)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={18} color="var(--text-primary)" />
            </div>

            <div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                No Captions Yet
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                {!videoFile && !videoFilename
                  ? 'Import a video to begin transcribing and styling captions.'
                  : 'Transcribe spoken audio into word-timed caption blocks.'}
              </p>
            </div>

            <button
              onClick={handleTranscribeCurrent}
              className="btn-primary"
              disabled={isTranscribing}
              style={{
                marginTop: '4px',
                padding: '7px 16px',
                fontSize: '11.5px',
                width: '100%',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
              }}
            >
              {isTranscribing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Transcribing...</span>
                </>
              ) : !videoFile && !videoFilename ? (
                <>
                  <Sparkles size={13} />
                  <span>Import Video to Caption</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Auto-Caption ({selectedModel})</span>
                </>
              )}
            </button>
          </div>
        ) : (
          filteredSegments.map((seg, sIdx) => {
            const isCurrentlyPlaying = currentTime >= seg.start && currentTime <= seg.end;
            const isSelected = selectedSegmentId === seg.id;
            const isEditing = editingSegmentId === seg.id;
            const isWordsExpanded = expandedWordSegmentIds.has(seg.id);

            return (
              <div
                key={seg.id || sIdx}
                onClick={() => setSelectedSegmentId(seg.id)}
                style={{
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  border: isSelected 
                    ? '1px solid var(--accent-primary)' 
                    : isCurrentlyPlaying 
                    ? '1px solid var(--accent-primary)' 
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected 
                    ? 'var(--accent-blue-subtle)' 
                    : isCurrentlyPlaying 
                    ? 'var(--accent-blue-subtle)' 
                    : 'var(--bg-surface)',
                  boxShadow: isSelected ? '0 1px 4px var(--accent-blue-subtle)' : 'none',
                  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  cursor: 'pointer'
                }}
              >
                {/* Line Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {/* Timecode & Seek Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        seekTo(seg.start);
                      }}
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        padding: '2px 5px',
                        color: isCurrentlyPlaying ? 'var(--accent-bright-blue)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontFamily: 'SF Mono, Menlo, monospace',
                        fontWeight: '500'
                      }}
                      title="Jump playhead to start"
                    >
                      <Play size={8} fill={isCurrentlyPlaying ? 'currentColor' : 'none'} />
                      {formatTimecode(seg.start)} ➔ {formatTimecode(seg.end)}
                    </button>

                    {/* Segment Emoji Sticker Badge */}
                    {seg.emoji && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          background: 'var(--bg-active)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '11px',
                          lineHeight: 1
                        }}
                        title={`Viral Sticker: ${seg.emoji}`}
                      >
                        <img
                          src={getAppleEmojiUrl(seg.emoji)}
                          alt={seg.emoji}
                          style={{ width: '12px', height: '12px', objectFit: 'contain' }}
                          onError={(evt) => {
                            evt.currentTarget.style.display = 'none';
                            if (evt.currentTarget.nextSibling) evt.currentTarget.nextSibling.style.display = 'inline';
                          }}
                        />
                        <span style={{ display: 'none' }}>{seg.emoji}</span>
                      </span>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {/* Merge with Next */}
                    {sIdx < segments.length - 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pushHistoryState();
                          mergeSegmentWithNext(seg.id);
                        }}
                        className="btn-ghost"
                        style={{ padding: '2px 4px', height: '18px' }}
                        title="Merge with next line"
                      >
                        <Combine size={10} />
                      </button>
                    )}

                    {/* Duplicate Line */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistoryState();
                        duplicateSegment(seg.id);
                      }}
                      className="btn-ghost"
                      style={{ padding: '2px 4px', height: '18px' }}
                      title="Duplicate line"
                    >
                      <Copy size={10} />
                    </button>

                    {/* Split Line at Playhead */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistoryState();
                        splitSegmentAtPlayhead(seg.id);
                      }}
                      className="btn-ghost"
                      style={{ padding: '2px 4px', height: '18px' }}
                      title="Split line at playhead"
                    >
                      <Scissors size={10} />
                    </button>

                    {/* Delete Line */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistoryState();
                        deleteSegment(seg.id);
                      }}
                      className="btn-ghost"
                      style={{ padding: '2px 4px', height: '18px', color: 'var(--system-error)' }}
                      title="Delete line"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>

                {/* Main Line Text */}
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                    <textarea
                      value={draftText}
                      autoFocus
                      rows={2}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          handleSaveEdit(seg.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      style={{
                        width: '100%',
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        fontWeight: '500',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        resize: 'vertical',
                        outline: 'none'
                      }}
                      placeholder="Type caption line text..."
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                        Ctrl+Enter to save
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={handleCancelEdit}
                          className="btn-ghost"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                        >
                          Cancel
                        </button>

                        <button
                          onClick={() => handleSaveEdit(seg.id)}
                          className="btn-primary"
                          style={{ padding: '2px 8px', fontSize: '10px' }}
                        >
                          <Check size={10} /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleStartEdit(seg)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '500',
                      lineHeight: '1.4',
                      cursor: 'text',
                      minHeight: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    title="Click to edit text"
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                      {seg.words && seg.words.length > 0 ? (
                        seg.words.map((w, wIdx) => {
                          const isEmph = Boolean(w.isEmphasized);
                          return (
                            <span
                              key={w.id || wIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                color: isEmph ? '#00FF66' : 'var(--text-primary)',
                                fontWeight: isEmph ? '700' : '500',
                                backgroundColor: isEmph ? 'rgba(0, 255, 102, 0.12)' : 'transparent',
                                padding: isEmph ? '0 3px' : '0',
                                borderRadius: '3px'
                              }}
                            >
                              <span>{w.word || w.text}</span>
                              {w.emoji && (
                                <img
                                  src={getAppleEmojiUrl(w.emoji)}
                                  alt={w.emoji}
                                  style={{ width: '11px', height: '11px', objectFit: 'contain', verticalAlign: 'middle' }}
                                  onError={(evt) => {
                                    evt.currentTarget.style.display = 'none';
                                    if (evt.currentTarget.nextSibling) evt.currentTarget.nextSibling.style.display = 'inline';
                                  }}
                                />
                              )}
                              {w.emoji && <span style={{ display: 'none', fontSize: '9px' }}>{w.emoji}</span>}
                            </span>
                          );
                        })
                      ) : (
                        <span>{seg.text}</span>
                      )}
                    </div>
                    <Edit3 size={10} style={{ opacity: 0.35, flexShrink: 0, marginLeft: '4px' }} />
                  </div>
                )}

                {/* Expandable Words Sub-Section */}
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWordsExpanded(seg.id);
                    }}
                    className="btn-ghost"
                    style={{
                      padding: '1px 3px',
                      fontSize: '9px',
                      fontWeight: '500',
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    {isWordsExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    <span>Words ({seg.words?.length || 0})</span>
                  </button>

                  {isWordsExpanded && (
                    <div style={{
                      marginTop: '4px',
                      padding: '5px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      position: 'relative'
                    }}>
                      {(seg.words || []).map((w, wIdx) => {
                        const isWordActive = currentTime >= w.start && currentTime <= w.end;
                        const isEmphasized = w.isEmphasized !== undefined ? Boolean(w.isEmphasized) : isPowerKeyword(w.word);
                        const isPickerOpen = activeEmojiPicker?.segId === seg.id && activeEmojiPicker?.wordId === w.id;

                        return (
                          <div
                            key={w.id || wIdx}
                            style={{ position: 'relative', display: 'inline-flex' }}
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                seekTo(w.start);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                background: isWordActive 
                                  ? 'var(--accent-primary)' 
                                  : isEmphasized 
                                  ? 'rgba(0, 255, 102, 0.12)' 
                                  : 'var(--bg-panel)',
                                border: isEmphasized ? '1px solid rgba(0, 255, 102, 0.35)' : '1px solid var(--border-subtle)',
                                color: isWordActive ? '#FFFFFF' : isEmphasized ? '#00FF66' : 'var(--text-secondary)',
                                fontSize: '10px',
                                fontWeight: isEmphasized ? '700' : '500',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)'
                              }}
                              title={`Jump to ${formatTimecode(w.start)}`}
                            >
                              <span>{w.word}</span>

                              {/* Emoji Badge / Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEmojiPicker({ segId: seg.id, wordId: w.id, currentEmoji: w.emoji });
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  opacity: w.emoji ? 1 : 0.4
                                }}
                                title={w.emoji ? `Emoji: ${w.emoji}` : 'Add Apple emoji'}
                              >
                                {w.emoji ? (
                                  <img
                                    src={getAppleEmojiUrl(w.emoji)}
                                    alt={w.emoji}
                                    style={{ width: '13px', height: '13px', objectFit: 'contain' }}
                                    onError={(evt) => {
                                      evt.currentTarget.style.display = 'none';
                                      if (evt.currentTarget.nextSibling) {
                                        evt.currentTarget.nextSibling.style.display = 'inline';
                                      }
                                    }}
                                  />
                                ) : (
                                  <Smile size={10} />
                                )}
                                {w.emoji && (
                                  <span style={{ display: 'none', fontSize: '11px', lineHeight: 1 }}>{w.emoji}</span>
                                )}
                              </button>

                              {/* Emphasis 1-Click Toggle */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWordEmphasis(seg.id, w.id);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: isEmphasized ? '#00FF66' : 'var(--text-tertiary)',
                                  opacity: isEmphasized ? 1 : 0.4
                                }}
                                title={isEmphasized ? 'Remove emphasis' : 'Add keyword punch emphasis'}
                              >
                                <Zap size={9} fill={isEmphasized ? '#00FF66' : 'none'} />
                              </button>

                              <span style={{ fontSize: '8px', opacity: 0.5, fontFamily: 'SF Mono, monospace' }}>
                                {w.start.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full 1,000+ Apple Emoji Picker Modal */}
      {activeEmojiPicker && (
        <FullEmojiPicker
          title="Select Apple Emoji for Word"
          selectedEmoji={activeEmojiPicker.currentEmoji}
          onSelect={(emoji) => {
            setWordEmoji(activeEmojiPicker.segId, activeEmojiPicker.wordId, emoji);
            setActiveEmojiPicker(null);
          }}
          onClear={() => {
            setWordEmoji(activeEmojiPicker.segId, activeEmojiPicker.wordId, null);
            setActiveEmojiPicker(null);
          }}
          onClose={() => setActiveEmojiPicker(null)}
        />
      )}
    </aside>
  );
};
