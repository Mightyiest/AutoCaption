import React from 'react';
import { Move } from 'lucide-react';

export const CaptionDragHandle = ({
  style,
  isDragging = false,
  onMouseDown
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: `${style.positionY}%`,
        left: `${style.positionX}%`,
        transform: 'translate(-50%, -50%)',
        width: `${style.containerWidthPercent || 90}%`,
        height: '60px',
        zIndex: 25,
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pointerEvents: 'auto'
      }}
      title="Drag to reposition captions"
    >
      <div style={{
        background: 'rgba(28, 28, 30, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '9px',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        userSelect: 'none',
        opacity: isDragging ? 1 : 0.65,
        transform: 'translateY(-14px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
      }}>
        <Move size={9} />
        <span>Y: {Math.round(style.positionY)}%</span>
      </div>
    </div>
  );
};
