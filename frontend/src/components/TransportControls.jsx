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
      maxWidth: '440px',
      padding: '7px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'rgba(18, 18, 20, 0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55)',
      flexShrink: 0,
      userSelect: 'none'
    }}>
      {/* Scrubber Line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--text-primary)', minWidth: '46px' }}>
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
            accentColor: 'var(--accent-primary)',
            cursor: 'pointer',
            height: '4px'
          }}
        />
        <span style={{ fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--text-tertiary)', minWidth: '46px', textAlign: 'right' }}>
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
            style={{ padding: '4px 6px' }}
            title="Step Back 2s (Left Arrow)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={onTogglePlay}
            className="btn-primary"
            style={{ 
              width: '28px', 
              height: '28px', 
              padding: 0, 
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" style={{ marginLeft: '1px' }} />}
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 2))}
            className="btn-ghost"
            style={{ padding: '4px 6px' }}
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
              height: '3px',
              accentColor: 'var(--accent-primary)',
              cursor: 'pointer'
            }}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onSetPlaybackRate(parseFloat(e.target.value))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              fontWeight: '500',
              padding: '2px 4px',
              borderRadius: '4px',
              cursor: 'pointer',
              outline: 'none',
              marginLeft: '4px'
            }}
          >
            <option value="0.5" style={{ background: '#1c1c1e' }}>0.5x</option>
            <option value="0.75" style={{ background: '#1c1c1e' }}>0.75x</option>
            <option value="1" style={{ background: '#1c1c1e' }}>1.0x</option>
            <option value="1.25" style={{ background: '#1c1c1e' }}>1.25x</option>
            <option value="1.5" style={{ background: '#1c1c1e' }}>1.5x</option>
            <option value="2.0" style={{ background: '#1c1c1e' }}>2.0x</option>
          </select>
        </div>
      </div>
    </div>
  );
};
