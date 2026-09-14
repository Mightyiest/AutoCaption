import React, { useState } from 'react';
import { 
  Palette, 
  Type, 
  Sparkles, 
  Sliders, 
  Check,
  Zap,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Italic,
  Box,
  Sun,
  Shield,
  Layers,
  Smile,
  Flame,
  Wand2,
  Star,
  BookOpen
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { PRESETS } from '../engine/presets';
import { getAppleEmojiUrl } from '../engine/appleEmojiHelper';

const FONTS = [
  { 
    name: 'Montserrat', 
    badge: 'BOLD SANS', 
    value: 'Montserrat', 
    sampleText: 'VIRAL HOOK',
    desc: 'Impactful geometric sans with strong readability' 
  },
  { 
    name: 'Russo One', 
    badge: 'HEAVY PUNCH', 
    value: 'Russo One', 
    sampleText: 'EXPLOSIVE HOOK',
    desc: 'Heavy geometric weight with ultra-high contrast' 
  },
  { 
    name: 'Bebas Neue', 
    badge: 'CONDENSED', 
    value: 'Bebas Neue', 
    sampleText: 'CINEMATIC SHORT',
    desc: 'Tall vertical letterforms that maximize screen area' 
  },
  { 
    name: 'Outfit', 
    badge: 'TECH SANS', 
    value: 'Outfit', 
    sampleText: 'STUDIO PRO',
    desc: 'Clean rounded neo-grotesque typography' 
  },
  { 
    name: 'Bangers', 
    badge: 'EXPRESSIVE', 
    value: 'Bangers', 
    sampleText: 'STORY POP!',
    desc: 'Dynamic hand-drawn comic style' 
  },
  { 
    name: 'Plus Jakarta Sans', 
    badge: 'GEOMETRIC', 
    value: 'Plus Jakarta Sans', 
    sampleText: 'PRO LUXURY',
    desc: 'Contemporary geometric sans with elegant proportions' 
  },
  { 
    name: 'Inter', 
    badge: 'CLEAN', 
    value: 'Inter', 
    sampleText: 'NEUTRAL VOICE',
    desc: 'High-legibility interface typography' 
  }
];

const FONT_WEIGHTS = [
  { label: 'Regular', value: '400' },
  { label: 'Semi', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra', value: '800' },
  { label: 'Black', value: '900' }
];

export const StyleInspector = () => {
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'typography' | 'colors' | 'animation' | 'ai_effects'
  const [enhancedResult, setEnhancedResult] = useState(null);

  const { 
    style, 
    activePresetId,
    updateStyle, 
    applyPreset, 
    pushHistoryState,
    stripAllPunctuation,
    rechunkSegments,
    removePunctuation,
    setRemovePunctuation,
    autoEnhanceWithAI,
    customKeywordRules,
    setKeywordLibraryModalOpen
  } = useEditorStore();

  const handleStyleChange = (key, value) => {
    updateStyle({ [key]: value });
  };

  const handleRunAIEnhance = (e) => {
    if (e && e.currentTarget) {
      e.currentTarget.blur();
    }
    const res = autoEnhanceWithAI();
    if (!res || !res.success) {
      return;
    }
    setEnhancedResult(res);
    setTimeout(() => setEnhancedResult(null), 3500);
  };

  return (
    <aside className="studio-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Segmented Tab Switcher */}
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        <div className="segmented-control" style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
          <button
            onClick={() => setActiveTab('presets')}
            className={`segmented-control-item ${activeTab === 'presets' ? 'active' : ''}`}
            title="Style Presets"
            style={{ padding: '6px 2px', fontSize: '10.5px' }}
          >
            <Sparkles size={11} />
            <span>Presets</span>
          </button>

          <button
            onClick={() => setActiveTab('typography')}
            className={`segmented-control-item ${activeTab === 'typography' ? 'active' : ''}`}
            title="Typography Settings"
            style={{ padding: '6px 2px', fontSize: '10.5px' }}
          >
            <Type size={11} />
            <span>Type</span>
          </button>

          <button
            onClick={() => setActiveTab('colors')}
            className={`segmented-control-item ${activeTab === 'colors' ? 'active' : ''}`}
            title="Colors & Effects"
            style={{ padding: '6px 2px', fontSize: '10.5px' }}
          >
            <Palette size={11} />
            <span>Styles</span>
          </button>

          <button
            onClick={() => setActiveTab('animation')}
            className={`segmented-control-item ${activeTab === 'animation' ? 'active' : ''}`}
            title="Motion & Layout"
            style={{ padding: '6px 2px', fontSize: '10.5px' }}
          >
            <Zap size={11} />
            <span>Motion</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_effects')}
            className={`segmented-control-item ${activeTab === 'ai_effects' ? 'active' : ''}`}
            title="AI Viral Emojis & Keyword Emphasis"
            style={{ padding: '6px 2px', fontSize: '10.5px' }}
          >
            <Wand2 size={11} />
            <span>AI Viral</span>
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* =========================================================================
            TAB 1: PRESETS
           ========================================================================= */}
        {activeTab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Built-in Styles
            </span>

            {PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--bg-active)' : 'var(--bg-panel)',
                    boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'var(--shadow-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: isSelected ? '700' : '600', color: 'var(--text-primary)' }}>
                      {preset.name}
                    </span>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: '600',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      border: isSelected ? 'none' : '1px solid var(--border-subtle)'
                    }}>
                      {preset.badge}
                    </span>
                  </div>

                  {/* Visual Style Mini Preview */}
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: preset.style.backgroundColor || '#000000',
                    textAlign: preset.style.textAlign || 'center',
                    fontFamily: preset.style.fontFamily,
                    fontSize: '16px',
                    fontWeight: preset.style.fontWeight,
                    fontStyle: preset.style.fontStyle || 'normal',
                    textTransform: preset.style.textTransform,
                    letterSpacing: `${preset.style.letterSpacing ?? 0}px`,
                    overflow: 'hidden',
                    lineHeight: preset.style.lineHeight || 1.15
                  }}>
                    <span style={{
                      color: preset.style.primaryColor,
                      WebkitTextStroke: preset.style.strokeWidth ? `${(preset.style.strokeWidth / 2)}px ${preset.style.strokeColor}` : 'none',
                      paintOrder: 'stroke fill'
                    }}>
                      CAPTION{' '}
                    </span>
                    <span style={{
                      color: preset.style.activeColor,
                      WebkitTextStroke: preset.style.strokeWidth ? `${(preset.style.strokeWidth / 2)}px ${preset.style.strokeColor}` : 'none',
                      paintOrder: 'stroke fill'
                    }}>
                      STYLE
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
                    {preset.description}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            TAB 2: TYPOGRAPHY
           ========================================================================= */}
        {activeTab === 'typography' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Font Family Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Font Family
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {FONTS.map((f) => {
                  const isSelected = style.fontFamily === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => handleStyleChange('fontFamily', f.value)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'var(--bg-active)' : 'var(--bg-panel)',
                        boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          fontFamily: f.value, 
                          fontSize: '13px', 
                          fontWeight: '700',
                          color: 'var(--text-primary)' 
                        }}>
                          {f.name}
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '8px', 
                        fontWeight: '600',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        background: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                        padding: '1px 4px',
                        borderRadius: '3px'
                      }}>{f.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Weight & Style Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Weight & Formatting
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {FONT_WEIGHTS.map((w) => {
                  const isWeightActive = style.fontWeight === w.value;
                  return (
                    <button
                      key={w.value}
                      onClick={() => handleStyleChange('fontWeight', w.value)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '11px',
                        fontWeight: isWeightActive ? '700' : '500',
                        borderRadius: 'var(--radius-sm)',
                        background: isWeightActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                        color: isWeightActive ? '#FFFFFF' : 'var(--text-secondary)',
                        border: isWeightActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        boxShadow: isWeightActive ? '0 1px 3px rgba(0, 0, 0, 0.15)' : 'none',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>

              {/* Text Alignment & Case */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                {/* Alignment */}
                <div className="segmented-control" style={{ flex: 1 }}>
                  <button
                    onClick={() => handleStyleChange('textAlign', 'left')}
                    className={`segmented-control-item ${style.textAlign === 'left' ? 'active' : ''}`}
                    style={{ flex: 1 }}
                    title="Align Left"
                  >
                    <AlignLeft size={12} />
                  </button>
                  <button
                    onClick={() => handleStyleChange('textAlign', 'center')}
                    className={`segmented-control-item ${style.textAlign === 'center' ? 'active' : ''}`}
                    style={{ flex: 1 }}
                    title="Align Center"
                  >
                    <AlignCenter size={12} />
                  </button>
                  <button
                    onClick={() => handleStyleChange('textAlign', 'right')}
                    className={`segmented-control-item ${style.textAlign === 'right' ? 'active' : ''}`}
                    style={{ flex: 1 }}
                    title="Align Right"
                  >
                    <AlignRight size={12} />
                  </button>
                </div>

                {/* Case */}
                <div className="segmented-control" style={{ flex: 1 }}>
                  <button
                    onClick={() => handleStyleChange('textTransform', 'uppercase')}
                    className={`segmented-control-item ${style.textTransform === 'uppercase' ? 'active' : ''}`}
                    style={{ flex: 1, fontSize: '10px', fontWeight: '700' }}
                    title="UPPERCASE"
                  >
                    AA
                  </button>
                  <button
                    onClick={() => handleStyleChange('textTransform', 'capitalize')}
                    className={`segmented-control-item ${style.textTransform === 'capitalize' ? 'active' : ''}`}
                    style={{ flex: 1, fontSize: '10px' }}
                    title="Capitalize Words"
                  >
                    Aa
                  </button>
                  <button
                    onClick={() => handleStyleChange('textTransform', 'none')}
                    className={`segmented-control-item ${style.textTransform === 'none' ? 'active' : ''}`}
                    style={{ flex: 1, fontSize: '10px' }}
                    title="As Typed"
                  >
                    aa
                  </button>
                </div>

                {/* Italic */}
                <button
                  onClick={() => handleStyleChange('fontStyle', style.fontStyle === 'italic' ? 'normal' : 'italic')}
                  className="btn-secondary"
                  style={{
                    padding: '4px 8px',
                    background: style.fontStyle === 'italic' ? 'var(--bg-active)' : 'var(--btn-secondary-bg)',
                    borderColor: style.fontStyle === 'italic' ? 'var(--border-hover)' : 'var(--border-subtle)',
                    color: style.fontStyle === 'italic' ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                  title="Italic Toggle"
                >
                  <Italic size={12} />
                </button>
              </div>
            </div>

            {/* Font Size Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Font Size</span>
                <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min={18}
                max={90}
                value={style.fontSize}
                onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
              />
            </div>

            {/* Word Spacing & Letter Spacing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Word Spacing</span>
                  <span style={{ fontSize: '10px', fontFamily: 'SF Mono, monospace', color: 'var(--text-tertiary)' }}>{style.wordSpacing ?? 8}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={36}
                  step={1}
                  value={style.wordSpacing ?? 8}
                  onChange={(e) => handleStyleChange('wordSpacing', parseInt(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Letter Spacing</span>
                  <span style={{ fontSize: '10px', fontFamily: 'SF Mono, monospace', color: 'var(--text-tertiary)' }}>{style.letterSpacing ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={12}
                  step={0.5}
                  value={style.letterSpacing ?? 0}
                  onChange={(e) => handleStyleChange('letterSpacing', parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* Line Height */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Line Height (Leading)</span>
                <span style={{ fontSize: '10px', fontFamily: 'SF Mono, monospace', color: 'var(--text-tertiary)' }}>{style.lineHeight ?? 1.05}x</span>
              </div>
              <input
                type="range"
                min={0.85}
                max={1.8}
                step={0.05}
                value={style.lineHeight ?? 1.05}
                onChange={(e) => handleStyleChange('lineHeight', parseFloat(e.target.value))}
              />
            </div>

            {/* Max Words Per Segment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Words Per Screen</span>
                <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{style.maxWordsPerSegment || 3}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={style.maxWordsPerSegment || 3}
                onChange={(e) => handleStyleChange('maxWordsPerSegment', parseInt(e.target.value))}
              />
            </div>

            {/* Quick Clean Action: Strip Punctuation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginTop: '4px'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Strip Punctuation
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                  Remove commas, periods, & quotes
                </div>
              </div>
              <button
                type="button"
                onClick={stripAllPunctuation}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '5px 10px', color: 'var(--accent-primary)', borderColor: 'var(--border-subtle)' }}
                title="Remove all punctuation marks from existing captions"
              >
                Clean Text
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: COLORS & EFFECTS
           ========================================================================= */}
        {activeTab === 'colors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Base Colors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Text Colors
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Primary Color */}
                <div style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Primary</span>
                    <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{style.primaryColor}</span>
                  </div>
                  <input
                    type="color"
                    value={style.primaryColor}
                    onChange={(e) => handleStyleChange('primaryColor', e.target.value)}
                    style={{ width: '26px', height: '26px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                  />
                </div>

                {/* Highlight Active Word Color */}
                <div style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Active Word</span>
                    <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{style.activeColor}</span>
                  </div>
                  <input
                    type="color"
                    value={style.activeColor}
                    onChange={(e) => handleStyleChange('activeColor', e.target.value)}
                    style={{ width: '26px', height: '26px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Stroke Outline */}
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>Stroke Outline</span>
                <input
                  type="color"
                  value={style.strokeColor || '#000000'}
                  onChange={(e) => handleStyleChange('strokeColor', e.target.value)}
                  style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={0}
                  max={16}
                  value={style.strokeWidth ?? 6}
                  onChange={(e) => handleStyleChange('strokeWidth', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '10px', fontFamily: 'SF Mono, monospace', color: 'var(--text-tertiary)', minWidth: '24px' }}>
                  {style.strokeWidth ?? 6}px
                </span>
              </div>
            </div>

            {/* Drop Shadow */}
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>Drop Shadow</span>
                <input
                  type="color"
                  value={style.shadowColor === 'transparent' ? '#000000' : (style.shadowColor || '#000000')}
                  onChange={(e) => handleStyleChange('shadowColor', e.target.value)}
                  style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={style.shadowBlur ?? 8}
                  onChange={(e) => handleStyleChange('shadowBlur', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '10px', fontFamily: 'SF Mono, monospace', color: 'var(--text-tertiary)', minWidth: '24px' }}>
                  {style.shadowBlur ?? 8}px
                </span>
              </div>
            </div>

            {/* Background Pill */}
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>Background Pill</span>
                <input
                  type="color"
                  value={style.backgroundColor === 'transparent' ? '#1c1c1e' : (style.backgroundColor || '#1c1c1e')}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => handleStyleChange('backgroundColor', style.backgroundColor === 'transparent' ? '#1c1c1e' : 'transparent')}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    padding: '3px 8px',
                    fontSize: '10px',
                    background: style.backgroundColor !== 'transparent' ? 'var(--accent-blue-subtle)' : 'transparent',
                    borderColor: style.backgroundColor !== 'transparent' ? 'var(--accent-primary)' : 'var(--border-subtle)'
                  }}
                >
                  {style.backgroundColor !== 'transparent' ? 'Pill Enabled' : 'Pill Disabled'}
                </button>
                {style.backgroundColor !== 'transparent' && (
                  <button
                    onClick={() => handleStyleChange('borderRadius', style.borderRadius > 0 ? 0 : 12)}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '10px' }}
                  >
                    {style.borderRadius > 0 ? 'Rounded' : 'Square'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: MOTION & POSITION
           ========================================================================= */}
        {activeTab === 'animation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Word Animation Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Word Animation
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {[
                  { id: 'pop', label: 'Pop Scale' },
                  { id: 'bounce', label: 'Bounce Up' },
                  { id: 'glow', label: 'Color Glow' },
                  { id: 'fade', label: 'Clean Fade' },
                  { id: 'none', label: 'Static' }
                ].map((anim) => {
                  const isSelected = style.animationType === anim.id;
                  return (
                    <button
                      key={anim.id}
                      onClick={() => handleStyleChange('animationType', anim.id)}
                      className="segmented-control-item"
                      style={{
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: isSelected ? '700' : '500',
                        background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {anim.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical Position (Y) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Vertical Position (Y)</span>
                <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{Math.round(style.positionY)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={style.positionY}
                onChange={(e) => handleStyleChange('positionY', parseInt(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)' }}>
                <span>Top (10%)</span>
                <span>Center (50%)</span>
                <span>Bottom (80%)</span>
              </div>
            </div>

            {/* Horizontal Position (X) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Horizontal Position (X)</span>
                <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{Math.round(style.positionX)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={style.positionX}
                onChange={(e) => handleStyleChange('positionX', parseInt(e.target.value))}
              />
            </div>

            {/* Container Max Width */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Container Width</span>
                <span style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>{style.containerWidthPercent || 90}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={style.containerWidthPercent || 90}
                onChange={(e) => handleStyleChange('containerWidthPercent', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: AI VIRAL EFFECTS (AUTO-EMOJI & KEYWORD EMPHASIS)
           ========================================================================= */}
        {activeTab === 'ai_effects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1-Click AI Auto-Enhance Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 255, 102, 0.12) 0%, rgba(0, 113, 227, 0.16) 100%)',
              border: '1px solid rgba(0, 255, 102, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="var(--accent-bright-blue)" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  AI Instant Viral Enhancer
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                Automatically scans transcript to attach matching kinetic emojis &amp; highlight high-retention hook words.
              </p>
              <button
                onClick={handleRunAIEnhance}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-subtle)',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {enhancedResult ? (
                  <>
                    <Check size={14} />
                    <span>Enhanced ({enhancedResult.emojiCount} Emojis, {enhancedResult.emphasisCount} Hooks)</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    <span>Auto-Enhance Captions (AI)</span>
                  </>
                )}
              </button>
            </div>

            {/* SECTION: Auto-Emoji & Kinetic Stickers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smile size={13} color="var(--accent-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Auto-Emoji Stickers
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={style.autoEmojiEnabled !== false}
                  onChange={(e) => handleStyleChange('autoEmojiEnabled', e.target.checked)}
                />
              </div>

              {style.autoEmojiEnabled !== false && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                  {/* Emoji Aesthetic (Apple iOS vs System) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Emoji Aesthetic</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      {[
                        { id: 'apple', label: '🍎 Apple (iOS Glossy)' },
                        { id: 'system', label: '🔤 System Font' }
                      ].map((aes) => {
                        const isSelected = (style.emojiStyle || 'apple') === aes.id;
                        return (
                          <button
                            key={aes.id}
                            type="button"
                            onClick={() => handleStyleChange('emojiStyle', aes.id)}
                            className="segmented-control-item"
                            style={{
                              padding: '5px 6px',
                              fontSize: '10.5px',
                              fontWeight: isSelected ? '700' : '500',
                              background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {aes.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Emoji Animation Physics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Emoji Motion Style</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      {[
                        { id: 'pop', label: '🚀 Pop Scale' },
                        { id: 'bounce', label: '⬆️ Bounce Jump' },
                        { id: 'float', label: '✨ Hover Float' },
                        { id: 'none', label: 'Static' }
                      ].map((anim) => {
                        const isSelected = (style.emojiAnimation || 'pop') === anim.id;
                        return (
                          <button
                            key={anim.id}
                            onClick={() => handleStyleChange('emojiAnimation', anim.id)}
                            className="segmented-control-item"
                            style={{
                              padding: '6px 8px',
                              fontSize: '11px',
                              fontWeight: isSelected ? '700' : '500',
                              background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {anim.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Emoji Position */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Positioning</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                      {[
                        { id: 'above_word', label: 'Above Word' },
                        { id: 'inline', label: 'Inline' },
                        { id: 'top_center', label: 'Top Center' }
                      ].map((pos) => {
                        const isSelected = (style.emojiPosition || 'above_word') === pos.id;
                        return (
                          <button
                            key={pos.id}
                            onClick={() => handleStyleChange('emojiPosition', pos.id)}
                            className="segmented-control-item"
                            style={{
                              padding: '5px 4px',
                              fontSize: '10.5px',
                              fontWeight: isSelected ? '700' : '500',
                              background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Emoji Size */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Sticker Size</span>
                      <span style={{ fontSize: '10.5px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>
                        {style.emojiSize || 42}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      value={style.emojiSize || 42}
                      onChange={(e) => handleStyleChange('emojiSize', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: AI Keyword Emphasis */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={13} color="var(--text-primary)" />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Smart Keyword Emphasis
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={style.autoEmphasisEnabled !== false}
                  onChange={(e) => handleStyleChange('autoEmphasisEnabled', e.target.checked)}
                />
              </div>

              {style.autoEmphasisEnabled !== false && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                  {/* Emphasis Highlight Accent Color */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Accent Punch Color</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { color: '#00FF66', label: 'Neon Green' },
                        { color: '#FFE600', label: 'Cyber Yellow' },
                        { color: '#FF3B30', label: 'Electric Red' },
                        { color: '#00FFFF', label: 'Cyan Glow' },
                        { color: '#FF9900', label: 'Hot Orange' },
                        { color: '#FF007F', label: 'Punch Pink' },
                        { color: '#FFFFFF', label: 'Crisp White' }
                      ].map((swatch) => (
                        <button
                          key={swatch.color}
                          onClick={() => handleStyleChange('emphasisColor', swatch.color)}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: swatch.color,
                            border: (style.emphasisColor || '#00FF66') === swatch.color ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                            boxShadow: (style.emphasisColor || '#00FF66') === swatch.color ? `0 0 8px ${swatch.color}` : 'none',
                            cursor: 'pointer'
                          }}
                          title={swatch.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={style.emphasisColor || '#00FF66'}
                        onChange={(e) => handleStyleChange('emphasisColor', e.target.value)}
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: 'transparent'
                        }}
                      />
                    </div>
                  </div>

                  {/* Emphasis Font Scale Multiplier */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Word Scale Boost</span>
                      <span style={{ fontSize: '10.5px', fontFamily: 'SF Mono, monospace', color: 'var(--text-primary)' }}>
                        {style.emphasisScale || 1.15}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={1.35}
                      step={0.05}
                      value={style.emphasisScale || 1.15}
                      onChange={(e) => handleStyleChange('emphasisScale', parseFloat(e.target.value))}
                    />
                  </div>

                  {/* Emphasis Timing Mode */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Emphasis Timing</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                      {[
                        { id: 'active_only', label: 'Spoken Punch' },
                        { id: 'always', label: 'Always Visible' }
                      ].map((mode) => {
                        const isSelected = (style.emphasisMode || 'active_only') === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => handleStyleChange('emphasisMode', mode.id)}
                            className="btn-ghost"
                            style={{
                              padding: '5px 8px',
                              fontSize: '10px',
                              fontWeight: isSelected ? '600' : '400',
                              background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              border: isSelected ? '1.5px solid var(--border-hover)' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Custom Keyword Library Manager */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={13} color="var(--accent-bright-blue)" />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Keyword & Emoji Library
                  </span>
                </div>
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'var(--accent-blue-subtle)',
                  color: 'var(--accent-bright-blue)'
                }}>
                  {customKeywordRules?.length || 0} Rules
                </span>
              </div>

              <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                Map custom words (e.g. CRACK, PAIN, SUDDEN) to specific Apple emojis & auto-emphasis highlights.
              </p>

              <button
                type="button"
                onClick={() => setKeywordLibraryModalOpen(true)}
                className="btn-primary"
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <BookOpen size={13} />
                <span>Open Keyword Library</span>
              </button>

              {/* Quick Tags Preview */}
              {customKeywordRules && customKeywordRules.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                  {customKeywordRules.slice(0, 6).map((r) => (
                    <span
                      key={r.id || r.keyword}
                      style={{
                        fontSize: '9.5px',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      {r.emoji && <span>{r.emoji}</span>}
                      <span>{r.keyword}</span>
                    </span>
                  ))}
                  {customKeywordRules.length > 6 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                      +{customKeywordRules.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
