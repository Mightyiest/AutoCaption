import React, { useState, useMemo } from 'react';
import { Search, X, Sparkles, Trash2 } from 'lucide-react';
import { 
  FULL_EMOJI_CATEGORIES, 
  searchEmojis, 
  getAppleEmojiUrl 
} from '../engine/appleEmojiHelper';

/**
 * Full-featured Apple Color Emoji Picker with 1,000+ categorized emojis,
 * live search, Apple glossy rendering, and 1-click selection.
 */
export const FullEmojiPicker = ({
  onSelect,
  onClear,
  onClose,
  selectedEmoji = null,
  title = 'Pick Apple Emoji'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('viral');

  const filteredEmojis = useMemo(() => {
    if (searchQuery.trim()) {
      return searchEmojis(searchQuery);
    }
    const cat = FULL_EMOJI_CATEGORIES.find(c => c.id === activeCategoryId);
    return cat ? cat.emojis : FULL_EMOJI_CATEGORIES[0].emojis;
  }, [searchQuery, activeCategoryId]);

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(2px)',
          cursor: 'default'
        }}
      />

      {/* Popover / Modal Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '380px',
          maxHeight: '490px',
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 113, 227, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 14px 8px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>🍎</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                {title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: '3px', borderRadius: '50%' }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Search Input */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 1,000+ Apple emojis (e.g. fire, pain, crack, money)..."
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px 6px 28px',
                fontSize: '11px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color var(--transition-fast)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Tabs (Hidden during search) */}
          {!searchQuery && (
            <div style={{
              display: 'flex',
              gap: '4px',
              overflowX: 'auto',
              paddingBottom: '2px'
            }}>
              {FULL_EMOJI_CATEGORIES.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'rgba(0, 113, 227, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      color: isActive ? 'var(--accent-bright-blue)' : 'var(--text-secondary)',
                      fontSize: '10px',
                      fontWeight: isActive ? '600' : '400',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Emoji Grid Area */}
        <div style={{
          padding: '10px 14px',
          overflowY: 'auto',
          maxHeight: '300px',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px'
        }}>
          {filteredEmojis.length === 0 ? (
            <div style={{ gridColumn: 'span 7', textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '11px' }}>
              No matching Apple emojis found for "{searchQuery}"
            </div>
          ) : (
            filteredEmojis.map((e, idx) => {
              const isSelected = selectedEmoji === e.char;
              const appleUrl = getAppleEmojiUrl(e.char);

              return (
                <button
                  key={`${e.char}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelect(e.char);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(0, 113, 227, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease, background 0.1s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(el) => {
                    el.currentTarget.style.transform = 'scale(1.15)';
                    el.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                  }}
                  onMouseLeave={(el) => {
                    el.currentTarget.style.transform = 'scale(1.0)';
                    el.currentTarget.style.background = isSelected ? 'rgba(0, 113, 227, 0.3)' : 'rgba(255, 255, 255, 0.04)';
                  }}
                  title={e.name}
                >
                  <img
                    src={appleUrl}
                    alt={e.char}
                    loading="lazy"
                    style={{
                      width: '26px',
                      height: '26px',
                      objectFit: 'contain',
                      pointerEvents: 'none'
                    }}
                    onError={(evt) => {
                      // Fallback to text glyph if image fails
                      evt.currentTarget.style.display = 'none';
                      evt.currentTarget.parentNode.innerText = e.char;
                    }}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            {filteredEmojis.length} Apple emojis available
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  onClose();
                }}
                className="btn-ghost"
                style={{ padding: '3px 8px', fontSize: '10.5px', color: 'var(--system-error)' }}
              >
                <Trash2 size={11} /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: '3px 8px', fontSize: '10.5px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
