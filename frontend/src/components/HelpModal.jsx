import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  Keyboard, 
  BookOpen, 
  Lightbulb, 
  Sparkles, 
  Play, 
  Scissors, 
  Layers, 
  Download, 
  Volume2, 
  CheckCircle2 
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const HelpModal = () => {
  const { isHelpModalOpen, setHelpModalOpen } = useEditorStore();
  const [activeTab, setActiveTab] = useState('shortcuts'); // 'shortcuts' | 'guide' | 'tips'

  if (!isHelpModalOpen) return null;

  const shortcutsList = [
    {
      category: 'Playback & Transport',
      items: [
        { keys: ['Space'], altKeys: ['K'], description: 'Play / Pause video playback' },
        { keys: ['←'], altKeys: ['J'], description: 'Step backward 0.1s (Hold Shift for 2.0s)' },
        { keys: ['→'], altKeys: ['L'], description: 'Step forward 0.1s (Hold Shift for 2.0s)' },
        { keys: ['↑'], description: 'Select previous caption segment' },
        { keys: ['↓'], description: 'Select next caption segment' }
      ]
    },
    {
      category: 'Timeline Editing',
      items: [
        { keys: ['Ctrl', 'Z'], macKeys: ['⌘', 'Z'], description: 'Undo last action (moves, edits, splits, deletions)' },
        { keys: ['Ctrl', 'Shift', 'Z'], macKeys: ['⌘', 'Shift', 'Z'], altKeys: ['Ctrl', 'Y'], description: 'Redo previously undone action' },
        { keys: ['S'], description: 'Split active caption block at playhead position' },
        { keys: ['Delete'], altKeys: ['Backspace'], description: 'Delete selected caption block' },
        { keys: ['Ctrl', 'D'], macKeys: ['⌘', 'D'], description: 'Duplicate selected caption block' },
        { keys: ['M'], description: 'Toggle magnetic snap alignment on/off' },
        { keys: ['N'], description: 'Toggle auto-follow playhead during playback' }
      ]
    },
    {
      category: 'View & Navigation',
      items: [
        { keys: ['F'], altKeys: ['Ctrl', '0'], description: 'Zoom to fit entire timeline duration' },
        { keys: ['Ctrl', '+'], description: 'Zoom in horizontally on timeline' },
        { keys: ['Ctrl', '-'], description: 'Zoom out horizontally on timeline' },
        { keys: ['Ctrl', 'Wheel'], description: 'Smooth interactive timeline zoom' },
        { keys: ['?'], altKeys: ['F1'], description: 'Open this Help & Shortcuts cheat sheet' },
        { keys: ['Esc'], description: 'Deselect block / close active modal / blur inputs' }
      ]
    }
  ];

  return (
    <div className="modal-backdrop">
      <div 
        className="studio-panel apple-modal-content"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={16} color="var(--accent-bright-blue)" />
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Studio Guide & Keyboard Shortcuts
            </span>
          </div>

          <button
            onClick={() => setHelpModalOpen(false)}
            className="btn-ghost"
            style={{ padding: '4px' }}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Strip */}
        <div style={{
          padding: '8px 20px 0 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className="segmented-control-item"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'shortcuts' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'shortcuts' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none'
            }}
          >
            <Keyboard size={13} />
            <span>Keyboard Shortcuts</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className="segmented-control-item"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'guide' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'guide' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none'
            }}
          >
            <BookOpen size={13} />
            <span>Workflow Guide</span>
          </button>

          <button
            onClick={() => setActiveTab('tips')}
            className="segmented-control-item"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px 6px 0 0',
              borderBottom: activeTab === 'tips' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'tips' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none'
            }}
          >
            <Lightbulb size={13} />
            <span>Pro Tips</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* TAB 1: Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {shortcutsList.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {cat.category}
                  </span>

                  <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    overflow: 'hidden'
                  }}>
                    {cat.items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 12px',
                          borderBottom: i < cat.items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          fontSize: '11px'
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)', fontWeight: '400' }}>
                          {item.description}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: 'var(--text-primary)',
                                fontSize: '10px',
                                fontWeight: '600',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontFamily: 'SF Mono, Menlo, monospace',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                              }}
                            >
                              {k}
                            </kbd>
                          ))}
                          {item.altKeys && (
                            <>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>or</span>
                              {item.altKeys.map((ak, akIdx) => (
                                <kbd
                                  key={akIdx}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    fontFamily: 'SF Mono, Menlo, monospace'
                                  }}
                                >
                                  {ak}
                                </kbd>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Guide */}
          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  step: '1',
                  title: 'Import or Load Media',
                  desc: 'Click "Upload" to select an MP4/MOV video, or click "Load Demo" to test with bundled sample footage and real audio.'
                },
                {
                  step: '2',
                  title: 'AI Speech Alignment',
                  desc: 'Click "Auto-Transcribe" in the top bar. Faster-Whisper runs offline on your GPU or CPU with VAD word-level timestamping.'
                },
                {
                  step: '3',
                  title: 'Apply Viral Presets & Styling',
                  desc: 'Use the right-hand Inspector to apply preset templates (Hormozi, MrBeast, Neon, Comic) or customize font size, stroke, shadows, and animations.'
                },
                {
                  step: '4',
                  title: 'Multi-Track Timeline Editing',
                  desc: 'Trim, drag, split (S), or delete (Del) subtitle blocks. Align words with vocal spikes on the real-time audio waveform.'
                },
                {
                  step: '5',
                  title: 'High-Fidelity Export',
                  desc: 'Click "Export" to render crisp 9:16, 1:1, or 16:9 MP4 video with 1:1 visual match to the preview screen.'
                }
              ].map((g) => (
                <div
                  key={g.step}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--accent-primary)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {g.step}
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                      {g.title}
                    </span>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                      {g.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Pro Tips */}
          {activeTab === 'tips' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(0, 113, 227, 0.08)', border: '1px solid rgba(0, 113, 227, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-bright-blue)' }}>
                  🎯 Vocal Peak Alignment
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Use the audio waveform track to line up the start of a caption segment with the exact audio transient where the speaker begins speaking.
                </p>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  📱 TikTok & Reels Safe Zones
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Enable safe zones to make sure your subtitles are not covered by the TikTok username, like buttons, or bottom sound marquee.
                </p>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  ⚡ Quick Word-by-Word Timing
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Set "Max Words per Line" to 2 or 3 in the Inspector to create punchy, high-retention rapid-fire captions popular on Shorts and Reels.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            onClick={() => setHelpModalOpen(false)}
            className="btn-primary"
            style={{ padding: '5px 16px', fontSize: '12px' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
