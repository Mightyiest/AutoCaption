import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  Volume1, 
  VolumeX 
} from 'lucide-react';
import { formatTimecode } from '../engine/animator';

export const TransportControls = ({
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  volume = 1.0,
  isMuted = false,
  playbackRate = 1.0,
  onTogglePlay,
  onSeek,
  onSeekChange,
  onSetVolume,
  onSetIsMuted,
  onSetPlaybackRate
}) => {
  return (
    <div style={{
      width: '100%',
      maxWidth: '460px',
      padding: '8px 14px',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--playback-glass-bg)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: '1px solid var(--playback-glass-border)',
      boxShadow: 'var(--playback-glass-shadow)',
      flexShrink: 0,
      userSelect: 'none'
    }}>
      {/* Scrubber Line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', fontWeight: '600', color: 'var(--text-primary)', minWidth: '46px' }}>
          {formatTimecode(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration || 1)}
          step={0.02}
          value={currentTime}
          onChange={onSeekChange}
          style={{
            flex: 1,
            cursor: 'pointer'
          }}
        />
        <span style={{ fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', fontWeight: '500', color: 'var(--text-tertiary)', minWidth: '46px', textAlign: 'right' }}>
          {formatTimecode(duration)}
        </span>
      </div>

      {/* Buttons Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Playback step and play/pause */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 2))}
            className="btn-ghost"
            style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}
            title="Step Back 2s (Left Arrow)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={onTogglePlay}
            className="btn-primary"
            style={{ 
              width: '32px', 
              height: '32px', 
              padding: 0, 
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
            }}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />}
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 2))}
            className="btn-ghost"
            style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}
            title="Step Forward 2s (Right Arrow)"
          >
            <RotateCw size={13} />
          </button>
        </div>

        {/* Volume & Playback Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mute toggle button */}
          <button
            onClick={() => onSetIsMuted(!isMuted)}
            className="btn-ghost"
            style={{ padding: '4px 4px' }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={14} color="var(--system-error)" />
            ) : volume < 0.5 ? (
              <Volume1 size={14} color="var(--text-secondary)" />
            ) : (
              <Volume2 size={14} color="var(--text-primary)" />
            )}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onSetVolume(val);
              if (isMuted && val > 0) onSetIsMuted(false);
            }}
            style={{
              width: '46px',
              cursor: 'pointer'
            }}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onSetPlaybackRate(parseFloat(e.target.value))}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: '600',
              padding: '3px 6px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              outline: 'none',
              marginLeft: '4px'
            }}
          >
            <option value="0.5" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>0.5x</option>
            <option value="0.75" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>0.75x</option>
            <option value="1" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>1.0x</option>
            <option value="1.25" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>1.25x</option>
            <option value="1.5" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>1.5x</option>
            <option value="2.0" style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>2.0x</option>
          </select>
        </div>
      </div>
    </div>
  );
};
