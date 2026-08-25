import React, { useState } from 'react';
import { 
  Palette, 
  Type, 
  Sparkles, 
  Sliders, 
  Layers, 
  Check,
  Zap,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Italic,
  Maximize2,
  CheckSquare,
  Square,
  Sun,
  Shield,
  Eye,
  SlidersHorizontal,
  Box
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { PRESETS } from '../engine/presets';

const FONTS = [
  { 
    name: 'Montserrat', 
    badge: 'VIRAL HEAVY', 
    value: 'Montserrat', 
    sampleText: 'VIRAL HOOK 99%',
    desc: 'The gold-standard font for MrBeast, Alex Hormozi & Shorts creators' 
  },
  { 
    name: 'Russo One', 
    badge: 'PUNCHY IMPACT', 
    value: 'Russo One', 
    sampleText: 'EXPLOSIVE HOOK',
    desc: 'Heavy geometric weight with ultra-high contrast readability' 
  },
  { 
    name: 'Bebas Neue', 
    badge: 'TALL CONDENSED', 
    value: 'Bebas Neue', 
    sampleText: 'CINEMA SHORT 4K',
    desc: 'Clean, cinematic vertical letterforms that maximize screen real-estate' 
  },
  { 
    name: 'Outfit', 
    badge: 'MODERN TECH', 
    value: 'Outfit', 
    sampleText: 'CLEAN STUDIO AI',
    desc: 'Futuristic rounded neo-grotesque typography for sleek aesthetic videos' 
  },
  { 
    name: 'Bangers', 
    badge: 'COMIC POP', 
    value: 'Bangers', 
    sampleText: 'CRAZY STORY TIME!',
    desc: 'Expressive comic-book style with energetic hand-drawn impact' 
  },
  { 
    name: 'Plus Jakarta Sans', 
    badge: 'SLEEK LUXURY', 
    value: 'Plus Jakarta Sans', 
    sampleText: 'PRO LUXURY VIBE',
    desc: 'Contemporary geometric sans with elegant proportions' 
  },
  { 
    name: 'Inter', 
    badge: 'MINIMAL CLEAN', 
    value: 'Inter', 
    sampleText: 'NEUTRAL VOICE 100',
    desc: 'High-legibility interface typography for minimalist creator styles' 
  }
];

const FONT_WEIGHTS = [
  { label: '400', name: 'Regular', value: '400' },
  { label: '600', name: 'Semi', value: '600' },
  { label: '700', name: 'Bold', value: '700' },
  { label: '800', name: 'Extra', value: '800' },
  { label: '900', name: 'Black', value: '900' }
];

export const StyleInspector = () => {
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'typography' | 'colors' | 'animation'

  const {
    style,
    activePresetId,
    applyPreset,
    updateStyle
  } = useEditorStore();

  return (
    <div className="glass-panel" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.2)',
        padding: '6px'
      }}>
        <button
          onClick={() => setActiveTab('presets')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 4px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'presets' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'presets' ? '#000000' : 'var(--text-muted)',
            transition: 'all 150ms ease'
          }}
        >
          <Sparkles size={14} /> Presets
        </button>

        <button
          onClick={() => setActiveTab('typography')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 4px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'typography' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'typography' ? '#000000' : 'var(--text-muted)',
            transition: 'all 150ms ease'
          }}
        >
          <Type size={14} /> Typography
        </button>

        <button
          onClick={() => setActiveTab('colors')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 4px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'colors' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'colors' ? '#000000' : 'var(--text-muted)',
            transition: 'all 150ms ease'
          }}
        >
          <Palette size={14} /> Effects
        </button>

        <button
          onClick={() => setActiveTab('animation')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 4px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'animation' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'animation' ? '#000000' : 'var(--text-muted)',
            transition: 'all 150ms ease'
          }}
        >
          <Zap size={14} /> Motion
        </button>
      </div>

      {/* Tab Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* PRESETS TAB */}
        {activeTab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="glass-card"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'rgba(31, 41, 55, 0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800' }}>{preset.name}</span>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: preset.badge === 'VIRAL' ? 'var(--accent-viral-yellow)' : 'rgba(255,255,255,0.1)',
                      color: preset.badge === 'VIRAL' ? '#000000' : '#FFFFFF'
                    }}>
                      {preset.badge}
                    </span>
                  </div>

                  {/* Visual Style Mini Preview */}
                  <div style={{
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: preset.style.backgroundColor || '#0F172A',
                    textAlign: preset.style.textAlign || 'center',
                    fontFamily: preset.style.fontFamily,
                    fontSize: '18px',
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
                      paintOrder: 'stroke fill',
                      strokeLinejoin: 'round',
                      WebkitTextStrokeLinejoin: 'round',
                      display: 'inline-block',
                      margin: `0 ${(Number(preset.style.wordSpacing ?? 8) / 2)}px`
                    }}>
                      STOP
                    </span>
                    {' '}
                    <span style={{
                      color: preset.style.activeColor,
                      WebkitTextStroke: preset.style.strokeWidth ? `${(preset.style.strokeWidth / 2)}px ${preset.style.strokeColor}` : 'none',
                      paintOrder: 'stroke fill',
                      strokeLinejoin: 'round',
                      WebkitTextStrokeLinejoin: 'round',
                      textShadow: preset.style.shadowBlur ? `${preset.style.shadowOffsetX ?? 0}px ${preset.style.shadowOffsetY ?? 4}px ${preset.style.shadowBlur}px ${preset.style.shadowColor}` : 'none',
                      display: 'inline-block',
                      margin: `0 ${(Number(preset.style.wordSpacing ?? 8) / 2)}px`
                    }}>
                      SCROLLING
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{preset.description}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* TYPOGRAPHY & SPACING TAB */}
        {activeTab === 'typography' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Section 1: Font Family Visual Preview Cards */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Font Family Preview
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {FONTS.length} Fonts Available
                </span>
              </div>

              {/* Visual Font Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {FONTS.map((f) => {
                  const isSelected = style.fontFamily === f.value;

                  return (
                    <div
                      key={f.value}
                      onClick={() => updateStyle({ fontFamily: f.value })}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0,0,0,0.28)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 150ms ease',
                        boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: isSelected ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                            {f.name}
                          </span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                            color: isSelected ? '#000000' : 'var(--text-muted)'
                          }}>
                            {f.badge}
                          </span>
                        </div>
                        {isSelected && (
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '999px',
                            background: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Check size={10} color="#000000" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      {/* Actual Rendered Typography Preview Strip */}
                      <div style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        fontFamily: f.value,
                        fontSize: f.value === 'Bebas Neue' ? '18px' : '16px',
                        fontWeight: '900',
                        fontStyle: style.fontStyle || 'normal',
                        color: isSelected ? 'var(--accent-viral-yellow)' : '#FFFFFF',
                        letterSpacing: f.value === 'Bebas Neue' ? '1px' : '0px',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {f.sampleText}
                      </div>

                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {f.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Weight & Size */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Weight & Scale
              </span>

              {/* Font Weight & Italic Toggle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Weight & Style</label>
                  <button
                    onClick={() => updateStyle({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: style.fontStyle === 'italic' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                      color: style.fontStyle === 'italic' ? '#000000' : 'var(--text-main)'
                    }}
                    title="Toggle Italic"
                  >
                    <Italic size={12} /> Italic
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {FONT_WEIGHTS.map((fw) => {
                    const isSelected = String(style.fontWeight || '900') === fw.value;
                    return (
                      <button
                        key={fw.value}
                        onClick={() => updateStyle({ fontWeight: fw.value })}
                        style={{
                          flex: 1,
                          padding: '6px 2px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: isSelected ? '#000000' : 'var(--text-main)'
                        }}
                      >
                        {fw.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Font Size</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={64}
                  value={style.fontSize}
                  onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

            {/* Section 3: Spacing & Leading Controls */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spacing & Leading
              </span>

              {/* Word Spacing */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Word Spacing (Gap)</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.wordSpacing ?? 8}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={style.wordSpacing ?? 8}
                  onChange={(e) => updateStyle({ wordSpacing: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Letter Spacing (Tracking) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Letter Spacing (Tracking)</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.letterSpacing ?? 0}px</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={12}
                  step={0.5}
                  value={style.letterSpacing ?? 0}
                  onChange={(e) => updateStyle({ letterSpacing: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Line Height (Leading) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Line Height (Leading)</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{Number(style.lineHeight ?? 1.02).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.85}
                  max={2.0}
                  step={0.05}
                  value={style.lineHeight ?? 1.02}
                  onChange={(e) => updateStyle({ lineHeight: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

            {/* Section 4: Alignment & Casing */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Alignment & Casing
              </span>

              {/* Text Alignment */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Alignment
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'left', label: 'Left', icon: <AlignLeft size={13} /> },
                    { id: 'center', label: 'Center', icon: <AlignCenter size={13} /> },
                    { id: 'right', label: 'Right', icon: <AlignRight size={13} /> }
                  ].map((align) => {
                    const isSelected = (style.textAlign || 'center') === align.id;
                    return (
                      <button
                        key={align.id}
                        onClick={() => updateStyle({ textAlign: align.id })}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: isSelected ? '#000000' : 'var(--text-main)'
                        }}
                      >
                        {align.icon} {align.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Transform Casing */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Casing
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['uppercase', 'capitalize', 'none'].map((caseType) => (
                    <button
                      key={caseType}
                      onClick={() => updateStyle({ textTransform: caseType })}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: style.textTransform === caseType ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                        color: style.textTransform === caseType ? '#000000' : 'var(--text-main)',
                        textTransform: caseType
                      }}
                    >
                      {caseType === 'none' ? 'Normal' : caseType}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 5: Placement & Container Dimensions */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Position & Box Width
              </span>

              {/* Vertical Position */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Vertical Position</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.positionY}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={88}
                  value={style.positionY}
                  onChange={(e) => updateStyle({ positionY: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Container Width Percent */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Caption Box Max Width</label>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.containerWidthPercent ?? 90}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={style.containerWidthPercent ?? 90}
                  onChange={(e) => updateStyle({ containerWidthPercent: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              {/* Quick Placement Presets */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Safe Placement Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button onClick={() => updateStyle({ positionY: 25 })} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}>
                    Top (25%)
                  </button>
                  <button onClick={() => updateStyle({ positionY: 50 })} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}>
                    Center (50%)
                  </button>
                  <button onClick={() => updateStyle({ positionY: 74 })} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}>
                    Viral Sweetspot (74%)
                  </button>
                  <button onClick={() => updateStyle({ positionY: 84 })} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}>
                    Subtitle (84%)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COLORS & EFFECTS TAB */}
        {activeTab === 'colors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Word Colors */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Text Fill Colors
              </span>

              {/* Active Word Highlight Color */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Active Word Highlight
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={style.activeColor}
                    onChange={(e) => updateStyle({ activeColor: e.target.value })}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                  />
                  <input
                    type="text"
                    value={style.activeColor}
                    onChange={(e) => updateStyle({ activeColor: e.target.value })}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '7px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* Inactive Word Text Color */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Inactive Words Fill
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={style.primaryColor}
                    onChange={(e) => updateStyle({ primaryColor: e.target.value })}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                  />
                  <input
                    type="text"
                    value={style.primaryColor}
                    onChange={(e) => updateStyle({ primaryColor: e.target.value })}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '7px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Stroke Outline Section (With Checkbox Toggle) */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div 
                  onClick={() => updateStyle({ strokeEnabled: !(style.strokeEnabled ?? true) })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={style.strokeEnabled ?? true}
                    onChange={(e) => updateStyle({ strokeEnabled: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: (style.strokeEnabled ?? true) ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    Stroke Outline
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: (style.strokeEnabled ?? true) ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {(style.strokeEnabled ?? true) ? `${style.strokeWidth || 6}px` : 'Disabled'}
                </span>
              </div>

              {(style.strokeEnabled ?? true) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={style.strokeWidth || 6}
                    onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />

                  {/* Quick Width Chips */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { label: 'Thin (2px)', val: 2 },
                      { label: 'Bold (6px)', val: 6 },
                      { label: 'Heavy (10px)', val: 10 },
                      { label: 'Thick (14px)', val: 14 }
                    ].map((w) => (
                      <button
                        key={w.val}
                        type="button"
                        onClick={() => updateStyle({ strokeWidth: w.val })}
                        style={{
                          flex: 1,
                          padding: '4px 2px',
                          fontSize: '10px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: (style.strokeWidth || 6) === w.val ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: (style.strokeWidth || 6) === w.val ? '#000000' : 'var(--text-muted)'
                        }}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={style.strokeColor || '#000000'}
                      onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      type="text"
                      value={style.strokeColor || '#000000'}
                      onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Directional Drop Shadow Section (With Checkbox Toggle) */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div 
                  onClick={() => updateStyle({ shadowEnabled: !(style.shadowEnabled ?? true) })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={style.shadowEnabled ?? true}
                    onChange={(e) => updateStyle({ shadowEnabled: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: (style.shadowEnabled ?? true) ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    Drop Shadow
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: (style.shadowEnabled ?? true) ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {(style.shadowEnabled ?? true) ? `Blur ${style.shadowBlur || 8}px` : 'Disabled'}
                </span>
              </div>

              {(style.shadowEnabled ?? true) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  {/* Blur Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Shadow Softness (Blur)</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.shadowBlur || 8}px</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={style.shadowBlur || 8}
                      onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>

                  {/* Offset X and Y */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Offset X</span>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.shadowOffsetX ?? 0}px</span>
                      </div>
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        value={style.shadowOffsetX ?? 0}
                        onChange={(e) => updateStyle({ shadowOffsetX: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Offset Y</span>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.shadowOffsetY ?? 4}px</span>
                      </div>
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        value={style.shadowOffsetY ?? 4}
                        onChange={(e) => updateStyle({ shadowOffsetY: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                  </div>

                  {/* Quick Direction Presets */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {[
                      { label: 'Down (0,4)', x: 0, y: 4 },
                      { label: 'Deep (0,8)', x: 0, y: 8 },
                      { label: 'Angle (4,4)', x: 4, y: 4 },
                      { label: 'Halo (0,0)', x: 0, y: 0 }
                    ].map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => updateStyle({ shadowOffsetX: d.x, shadowOffsetY: d.y })}
                        style={{
                          padding: '4px 2px',
                          fontSize: '10px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: (style.shadowOffsetX === d.x && style.shadowOffsetY === d.y) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: (style.shadowOffsetX === d.x && style.shadowOffsetY === d.y) ? '#000000' : 'var(--text-muted)'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={style.shadowColor && style.shadowColor !== 'transparent' ? style.shadowColor : '#000000'}
                      onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      type="text"
                      value={style.shadowColor || '#000000'}
                      onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Outer Glow (Separated from Drop Shadow!) */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div 
                  onClick={() => updateStyle({ glowEnabled: !style.glowEnabled })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={style.glowEnabled ?? false}
                    onChange={(e) => updateStyle({ glowEnabled: e.target.checked })}
                    style={{ accentColor: '#38BDF8', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sun size={14} color={style.glowEnabled ? '#38BDF8' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: style.glowEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      Outer Neon Glow
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: style.glowEnabled ? '#38BDF8' : 'var(--text-muted)' }}>
                  {style.glowEnabled ? `${style.glowBlur || 14}px` : 'Disabled'}
                </span>
              </div>

              {style.glowEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Glow Radius & Intensity</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#38BDF8' }}>{style.glowBlur || 14}px</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={40}
                      value={style.glowBlur || 14}
                      onChange={(e) => updateStyle({ glowBlur: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#38BDF8' }}
                    />
                  </div>

                  {/* Neon Color Swatches */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={style.glowColor || '#38BDF8'}
                      onChange={(e) => updateStyle({ glowColor: e.target.value })}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                      {[
                        { name: 'Cyan', color: '#00FFFF' },
                        { name: 'Yellow', color: '#FFE600' },
                        { name: 'Green', color: '#00FF66' },
                        { name: 'Pink', color: '#FF007F' },
                        { name: 'White', color: '#FFFFFF' }
                      ].map((swatch) => (
                        <button
                          key={swatch.color}
                          type="button"
                          onClick={() => updateStyle({ glowColor: swatch.color })}
                          style={{
                            flex: 1,
                            height: '24px',
                            borderRadius: '4px',
                            border: style.glowColor === swatch.color ? '2px solid #FFFFFF' : '1px solid rgba(255,255,255,0.15)',
                            background: swatch.color,
                            cursor: 'pointer',
                            boxShadow: style.glowColor === swatch.color ? `0 0 8px ${swatch.color}` : 'none'
                          }}
                          title={swatch.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Background Frosted Pill / Box (With Full Customization) */}
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div 
                  onClick={() => updateStyle({ backgroundEnabled: !style.backgroundEnabled })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={style.backgroundEnabled ?? false}
                    onChange={(e) => updateStyle({ backgroundEnabled: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Box size={14} color={style.backgroundEnabled ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: style.backgroundEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      Background Pill / Box
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: style.backgroundEnabled ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {style.backgroundEnabled ? `${style.backgroundOpacity ?? 85}% Opacity` : 'Disabled'}
                </span>
              </div>

              {style.backgroundEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
                  {/* Background Color & Opacity */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fill Color & Opacity</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.backgroundOpacity ?? 85}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        value={style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : '#0F172A'}
                        onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                        style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={style.backgroundOpacity ?? 85}
                        onChange={(e) => updateStyle({ backgroundOpacity: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                  </div>

                  {/* Padding X & Padding Y */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Horizontal (X)</span>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.backgroundPaddingX ?? 16}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={style.backgroundPaddingX ?? 16}
                        onChange={(e) => updateStyle({ backgroundPaddingX: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vertical (Y)</span>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.backgroundPaddingY ?? 8}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={style.backgroundPaddingY ?? 8}
                        onChange={(e) => updateStyle({ backgroundPaddingY: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                  </div>

                  {/* Corner Radius & Pill Capsule Preset */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Corner Roundness</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                        {(style.borderRadius ?? 12) >= 50 ? 'Capsule Pill' : `${style.borderRadius ?? 12}px`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={Math.min(60, style.borderRadius ?? 12)}
                      onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                    
                    {/* Quick Shape Presets */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {[
                        { label: 'Sharp (0px)', r: 0 },
                        { label: 'Rounded (12px)', r: 12 },
                        { label: 'Heavy (24px)', r: 24 },
                        { label: 'Capsule Pill (999px)', r: 999 }
                      ].map((shape) => (
                        <button
                          key={shape.label}
                          type="button"
                          onClick={() => updateStyle({ borderRadius: shape.r })}
                          style={{
                            flex: 1,
                            padding: '4px 2px',
                            fontSize: '9px',
                            fontWeight: '700',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: style.borderRadius === shape.r ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                            color: style.borderRadius === shape.r ? '#000000' : 'var(--text-muted)'
                          }}
                        >
                          {shape.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Outline Toggle & Thickness */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div 
                        onClick={() => updateStyle({ backgroundBorderEnabled: !style.backgroundBorderEnabled })}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={style.backgroundBorderEnabled ?? false}
                          onChange={(e) => updateStyle({ backgroundBorderEnabled: e.target.checked })}
                          style={{ accentColor: 'var(--accent-primary)', width: '13px', height: '13px' }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          Pill Outline Border
                        </span>
                      </div>
                      {style.backgroundBorderEnabled && (
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                          {style.backgroundBorderWidth ?? 2}px
                        </span>
                      )}
                    </div>

                    {style.backgroundBorderEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <input
                          type="color"
                          value={style.backgroundBorderColor && style.backgroundBorderColor.startsWith('#') ? style.backgroundBorderColor : '#FFFFFF'}
                          onChange={(e) => updateStyle({ backgroundBorderColor: e.target.value })}
                          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'none' }}
                        />
                        <input
                          type="range"
                          min={1}
                          max={8}
                          value={style.backgroundBorderWidth ?? 2}
                          onChange={(e) => updateStyle({ backgroundBorderWidth: parseInt(e.target.value) })}
                          style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Frosted Glass Backdrop Blur */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Frosted Glass Blur</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.backgroundBlur ?? 12}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      value={style.backgroundBlur ?? 12}
                      onChange={(e) => updateStyle({ backgroundBlur: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* MOTION & PACING TAB */}
        {activeTab === 'animation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Animation Type */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Word Animation Style
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'pop', name: 'Spring Pop', desc: 'Punchy scale expansion' },
                  { id: 'bounce', name: 'Viral Bounce', desc: 'Dynamic energetic jump' },
                  { id: 'karaoke', name: 'Neon Glow', desc: 'Smooth radiant glow' },
                  { id: 'fade', name: 'Subtle Fade', desc: 'Smooth opacity shift' }
                ].map((anim) => {
                  const isSelected = style.animationType === anim.id;

                  return (
                    <button
                      key={anim.id}
                      onClick={() => updateStyle({ animationType: anim.id })}
                      className="glass-card"
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(31, 41, 55, 0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                        {anim.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{anim.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Max Words per Segment Setting */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Chunk Pacing (Words per Line)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => updateStyle({ maxWordsPerSegment: count })}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      fontSize: '12px',
                      fontWeight: '800',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: style.maxWordsPerSegment === count ? 'var(--accent-primary)' : 'rgba(255,255,255,0.07)',
                      color: style.maxWordsPerSegment === count ? '#000000' : 'var(--text-main)'
                    }}
                  >
                    {count} {count === 1 ? 'Word' : 'Words'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                1-2 words creates rapid high-retention hooks; 3-4 words provides standard readability.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
