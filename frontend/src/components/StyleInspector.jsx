import React, { useState } from 'react';
import { 
  Palette, 
  Type, 
  Sparkles, 
  Sliders, 
  Layers, 
  Check,
  Zap,
  AlignVerticalJustifyCenter
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { PRESETS } from '../engine/presets';

const FONTS = [
  { name: 'Montserrat (Viral Bold)', value: 'Montserrat' },
  { name: 'Russo One (Punchy)', value: 'Russo One' },
  { name: 'Outfit (Modern Clean)', value: 'Outfit' },
  { name: 'Bebas Neue (Tall Impact)', value: 'Bebas Neue' },
  { name: 'Bangers (Comic Marker)', value: 'Bangers' },
  { name: 'Plus Jakarta Sans (Sleek)', value: 'Plus Jakarta Sans' },
  { name: 'Inter (Standard)', value: 'Inter' }
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
          <Type size={14} /> Fonts
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
          <Palette size={14} /> Colors
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
                    backgroundColor: '#0F172A',
                    textAlign: 'center',
                    fontFamily: preset.style.fontFamily,
                    fontSize: '18px',
                    fontWeight: preset.style.fontWeight,
                    textTransform: preset.style.textTransform,
                    overflow: 'hidden'
                  }}>
                    <span style={{
                      color: preset.style.primaryColor,
                      WebkitTextStroke: preset.style.strokeWidth ? `1.5px ${preset.style.strokeColor}` : 'none',
                      paintOrder: 'stroke fill',
                      strokeLinejoin: 'round',
                      WebkitTextStrokeLinejoin: 'round',
                      display: 'inline-block',
                      margin: '0 2px'
                    }}>
                      STOP
                    </span>
                    {' '}
                    <span style={{
                      color: preset.style.activeColor,
                      WebkitTextStroke: preset.style.strokeWidth ? `1.5px ${preset.style.strokeColor}` : 'none',
                      paintOrder: 'stroke fill',
                      strokeLinejoin: 'round',
                      WebkitTextStrokeLinejoin: 'round',
                      textShadow: preset.style.shadowBlur ? `0 0 6px ${preset.style.shadowColor}` : 'none',
                      display: 'inline-block',
                      margin: '0 2px'
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

        {/* TYPOGRAPHY & LAYOUT TAB */}
        {activeTab === 'typography' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Font Family */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Font Family
              </label>
              <select
                value={style.fontFamily}
                onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {FONTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Font Size Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Font Size</label>
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

            {/* Text Transform */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
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
                      background: style.textTransform === caseType ? 'var(--accent-primary)' : 'rgba(255,255,255,0.07)',
                      color: style.textTransform === caseType ? '#000000' : 'var(--text-main)',
                      textTransform: caseType
                    }}
                  >
                    {caseType === 'none' ? 'Normal' : caseType}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Position Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Vertical Position</label>
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

            {/* Quick Position Presets */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Quick Safe Placements
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  onClick={() => updateStyle({ positionY: 25 })}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}
                >
                  Top (25%)
                </button>
                <button
                  onClick={() => updateStyle({ positionY: 50 })}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}
                >
                  Center (50%)
                </button>
                <button
                  onClick={() => updateStyle({ positionY: 74 })}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}
                >
                  Viral Sweetspot (74%)
                </button>
                <button
                  onClick={() => updateStyle({ positionY: 84 })}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 8px', justifyContent: 'center' }}
                >
                  Subtitle (84%)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COLORS & EFFECTS TAB */}
        {activeTab === 'colors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Active Word Color */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Active Word Highlight Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={style.activeColor}
                  onChange={(e) => updateStyle({ activeColor: e.target.value })}
                  style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  value={style.activeColor}
                  onChange={(e) => updateStyle({ activeColor: e.target.value })}
                  style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Inactive Word Color */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Inactive Text Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={style.primaryColor}
                  onChange={(e) => updateStyle({ primaryColor: e.target.value })}
                  style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  value={style.primaryColor}
                  onChange={(e) => updateStyle({ primaryColor: e.target.value })}
                  style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: '#FFF', padding: '8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Stroke / Outline */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Stroke Outline Width</label>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                value={style.strokeWidth}
                onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={style.strokeColor}
                  onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                  style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stroke Color</span>
              </div>
            </div>

            {/* Shadow Glow */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Shadow / Glow Intensity</label>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{style.shadowBlur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={style.shadowBlur}
                onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
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
