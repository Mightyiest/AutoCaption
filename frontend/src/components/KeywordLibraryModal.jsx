import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Zap, 
  Search, 
  Wand2, 
  Download, 
  Upload, 
  Check, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { getAppleEmojiUrl } from '../engine/appleEmojiHelper';
import { FullEmojiPicker } from './FullEmojiPicker';

export const KeywordLibraryModal = () => {
  const {
    isKeywordLibraryModalOpen,
    setKeywordLibraryModalOpen,
    customKeywordRules,
    addKeywordRule,
    deleteKeywordRule,
    toggleRuleEmphasis,
    setRuleEmoji,
    applyKeywordRulesToCaptions,
    clearCustomKeywordRules
  } = useEditorStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newEmoji, setNewEmoji] = useState('🔥');
  const [newEmphasize, setNewEmphasize] = useState(true);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [editingRuleIdForEmoji, setEditingRuleIdForEmoji] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  if (!isKeywordLibraryModalOpen) return null;

  const handleAddRule = (e) => {
    e?.preventDefault();
    if (!newWord.trim()) return;

    addKeywordRule({
      keyword: newWord.trim(),
      emoji: newEmoji || null,
      isEmphasized: newEmphasize
    });

    setNewWord('');
    setStatusMsg(`Added rule for "${newWord.trim()}"!`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  const handleApply = () => {
    applyKeywordRulesToCaptions();
    setStatusMsg('✨ Applied custom rules to current video captions!');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const filteredRules = (customKeywordRules || []).filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return r.keyword.toLowerCase().includes(q) || (r.emoji && r.emoji.includes(q));
  });

  return (
    <div className="modal-backdrop" onClick={() => setKeywordLibraryModalOpen(false)}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0, 255, 102, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00FF66'
            }}>
              <BookOpen size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Keyword & Apple Emoji Library
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Add custom words (e.g. CRACK, PAIN, SUDDEN) with Apple emojis & punch emphasis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setKeywordLibraryModalOpen(false)}
            className="btn-ghost"
            style={{ padding: '4px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Add Bar */}
        <form 
          onSubmit={handleAddRule}
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(0, 113, 227, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Add New Keyword Rule
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Word Input */}
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Word (e.g. crack, pain, sudden)..."
              style={{
                flex: 1,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: '12px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />

            {/* Apple Emoji Selector Chip */}
            <button
              type="button"
              onClick={() => {
                setEditingRuleIdForEmoji('new');
                setIsEmojiPickerOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 8px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
              title="Pick Apple Emoji"
            >
              {newEmoji ? (
                <img
                  src={getAppleEmojiUrl(newEmoji)}
                  alt={newEmoji}
                  style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                  onError={(evt) => {
                    evt.currentTarget.style.display = 'none';
                    evt.currentTarget.parentNode.innerText = newEmoji;
                  }}
                />
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>No Emoji</span>
              )}
            </button>

            {/* Auto-Emphasis Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: newEmphasize ? '#00FF66' : 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
              background: newEmphasize ? 'rgba(0, 255, 102, 0.1)' : 'transparent',
              border: newEmphasize ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid transparent'
            }}>
              <input
                type="checkbox"
                checked={newEmphasize}
                onChange={(e) => setNewEmphasize(e.target.checked)}
                style={{ display: 'none' }}
              />
              <Zap size={12} fill={newEmphasize ? '#00FF66' : 'none'} />
              <span>Emphasis</span>
            </label>

            {/* Add Button */}
            <button
              type="submit"
              disabled={!newWord.trim()}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </form>

        {/* Search & Actions Bar */}
        <div style={{
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={`Search ${customKeywordRules.length} rules...`}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px 4px 26px',
                fontSize: '11px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleApply}
            className="btn-primary"
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              background: 'linear-gradient(135deg, #00FF66 0%, #009944 100%)',
              color: '#000000',
              fontWeight: '700',
              border: 'none'
            }}
            title="Scan and apply custom keywords across the active video"
          >
            <Sparkles size={12} /> Apply to Captions
          </button>
        </div>

        {/* Status Alert */}
        {statusMsg && (
          <div style={{
            margin: '0 20px 8px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0, 255, 102, 0.15)',
            border: '1px solid rgba(0, 255, 102, 0.35)',
            color: '#00FF66',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {statusMsg}
          </div>
        )}

        {/* Rule List Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {filteredRules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: '11.5px' }}>
              No custom keyword rules found. Add one above!
            </div>
          ) : (
            filteredRules.map((rule) => {
              const appleUrl = rule.emoji ? getAppleEmojiUrl(rule.emoji) : null;

              return (
                <div
                  key={rule.id || rule.keyword}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Apple Emoji Chip */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuleIdForEmoji(rule.id);
                        setIsEmojiPickerOpen(true);
                      }}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Change Apple Emoji"
                    >
                      {rule.emoji ? (
                        <img
                          src={appleUrl}
                          alt={rule.emoji}
                          style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                          onError={(evt) => {
                            evt.currentTarget.style.display = 'none';
                            evt.currentTarget.parentNode.innerText = rule.emoji;
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>none</span>
                      )}
                    </button>

                    {/* Keyword Text */}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: rule.isEmphasized ? '#00FF66' : 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      {rule.keyword}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Toggle Emphasis */}
                    <button
                      type="button"
                      onClick={() => toggleRuleEmphasis(rule.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 7px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        background: rule.isEmphasized ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: rule.isEmphasized ? '1px solid #00FF66' : '1px solid var(--border-subtle)',
                        color: rule.isEmphasized ? '#00FF66' : 'var(--text-tertiary)'
                      }}
                      title="Toggle Power Word Punch"
                    >
                      <Zap size={10} fill={rule.isEmphasized ? '#00FF66' : 'none'} />
                      <span>{rule.isEmphasized ? 'Punch ON' : 'Punch OFF'}</span>
                    </button>

                    {/* Delete Rule */}
                    <button
                      type="button"
                      onClick={() => deleteKeywordRule(rule.id)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--system-error)' }}
                      title="Delete rule"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
            Rules are saved automatically in your browser.
          </span>

          <button
            type="button"
            onClick={() => setKeywordLibraryModalOpen(false)}
            className="btn-ghost"
            style={{ padding: '4px 12px', fontSize: '11px' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Apple Emoji Picker Popover */}
      {isEmojiPickerOpen && (
        <FullEmojiPicker
          title="Select Apple Emoji for Rule"
          onSelect={(emoji) => {
            if (editingRuleIdForEmoji === 'new') {
              setNewEmoji(emoji);
            } else if (editingRuleIdForEmoji) {
              setRuleEmoji(editingRuleIdForEmoji, emoji);
            }
            setIsEmojiPickerOpen(false);
            setEditingRuleIdForEmoji(null);
          }}
          onClear={() => {
            if (editingRuleIdForEmoji === 'new') {
              setNewEmoji(null);
            } else if (editingRuleIdForEmoji) {
              setRuleEmoji(editingRuleIdForEmoji, null);
            }
            setIsEmojiPickerOpen(false);
            setEditingRuleIdForEmoji(null);
          }}
          onClose={() => {
            setIsEmojiPickerOpen(false);
            setEditingRuleIdForEmoji(null);
          }}
        />
      )}
    </div>
  );
};
