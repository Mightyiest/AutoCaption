import React from 'react';
import { 
  Clock, 
  Music, 
  Volume2, 
  VolumeX, 
  MessageSquare 
} from 'lucide-react';

export const TimelineTrackHeaders = ({
  isMuted = false,
  segmentsCount = 0,
  onToggleMute
}) => {
  return (
    <div style={{
      width: '96px',
      borderRight: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--bg-panel)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      padding: '0 8px',
      zIndex: 35,
      userSelect: 'none',
      flexShrink: 0
    }}>
      {/* Header Row 1: Time Ruler Indicator */}
      <div style={{
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        color: 'var(--text-tertiary)',
        fontSize: '10px',
        fontWeight: '600',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <Clock size={11} color="var(--text-tertiary)" />
        <span>RULER</span>
      </div>

      {/* Header Row 2: Audio Track Header */}
      <div style={{
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Music size={11} color="var(--accent-bright-blue)" />
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Audio (A1)
          </span>
        </div>
        <button
          onClick={onToggleMute}
          className="btn-ghost"
          style={{ padding: '2px 4px' }}
          title={isMuted ? 'Unmute Audio Track' : 'Mute Audio Track'}
        >
          {isMuted ? <VolumeX size={11} color="var(--system-error)" /> : <Volume2 size={11} color="var(--text-secondary)" />}
        </button>
      </div>

      {/* Header Row 3: Captions Track Header */}
      <div style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MessageSquare size={11} color="#A78BFA" />
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Captions (C1)
          </span>
        </div>
        <span style={{
          fontSize: '9px',
          fontWeight: '600',
          padding: '1px 5px',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)'
        }}>
          {segmentsCount}
        </span>
      </div>
    </div>
  );
};
