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
        className="studio-panel apple-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
          maxWidth: '92vw',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-panel)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)'
            }}>
              <BookOpen size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Keyword & Apple Emoji Library
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Add custom words (e.g. CRACK, PAIN, SUDDEN) with Apple emojis & punch emphasis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setKeywordLibraryModalOpen(false)}
            className="btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close modal"
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
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '7px 12px',
                fontSize: '12.5px',
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
                gap: '6px',
                padding: '6px 10px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
              title="Pick Apple Emoji"
            >
              {newEmoji ? (
                <img
                  src={getAppleEmojiUrl(newEmoji)}
                  alt={newEmoji}
                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
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
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 11px',
              background: newEmphasize ? 'var(--accent-primary)' : 'var(--bg-panel)',
              border: newEmphasize ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: newEmphasize ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)'
            }}>
              <input
                type="checkbox"
                checked={newEmphasize}
                onChange={(e) => setNewEmphasize(e.target.checked)}
                style={{ display: 'none' }}
              />
              <Zap size={12} fill={newEmphasize ? 'currentColor' : 'none'} />
              <span>Emphasis</span>
            </label>

            {/* Add Button */}
            <button
              type="submit"
              disabled={!newWord.trim()}
              className="btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: '12px',
                borderRadius: 'var(--radius-md)',
                opacity: !newWord.trim() ? 0.5 : 1
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </form>

        {/* Search & Actions Bar */}
        <div style={{
          padding: '12px 20px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'var(--bg-panel)'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={`Search ${customKeywordRules.length} rules...`}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
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
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Scan and apply custom keywords across the active video"
          >
            <Sparkles size={13} /> Apply to Captions
          </button>
        </div>

        {/* Status Alert */}
        {statusMsg && (
          <div style={{
            margin: '0 20px 8px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hover)',
            color: 'var(--text-primary)',
            fontSize: '11.5px',
            fontWeight: '600'
          }}>
            {statusMsg}
          </div>
        )}

        {/* Rule List Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: 'var(--bg-panel)'
        }}>
          {filteredRules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
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
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast), border-color var(--transition-fast)'
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
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-panel)',
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
                          style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                          onError={(evt) => {
                            evt.currentTarget.style.display = 'none';
                            evt.currentTarget.parentNode.innerText = rule.emoji;
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>none</span>
                      )}
                    </button>

                    {/* Keyword Text - High Contrast Clean Label */}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      {rule.keyword}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Toggle Emphasis */}
                    <button
                      type="button"
                      onClick={() => toggleRuleEmphasis(rule.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: rule.isEmphasized ? 'var(--accent-primary)' : 'var(--bg-panel)',
                        border: rule.isEmphasized ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        color: rule.isEmphasized ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                        transition: 'all var(--transition-fast)'
                      }}
                      title="Toggle Power Word Punch"
                    >
                      <Zap size={11} fill={rule.isEmphasized ? 'currentColor' : 'none'} />
                      <span>{rule.isEmphasized ? 'Punch ON' : 'Punch OFF'}</span>
                    </button>

                    {/* Delete Rule */}
                    <button
                      type="button"
                      onClick={() => deleteKeywordRule(rule.id)}
                      className="btn-ghost"
                      style={{ padding: '6px', color: 'var(--system-error)', borderRadius: 'var(--radius-sm)' }}
                      title="Delete rule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {customKeywordRules.length} rules saved in project & browser.
            </span>
            {customKeywordRules.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset all custom keyword rules to empty?')) {
                    clearCustomKeywordRules();
                    setStatusMsg('Cleared all custom rules.');
                    setTimeout(() => setStatusMsg(''), 2500);
                  }
                }}
                className="btn-ghost"
                style={{ fontSize: '11px', color: 'var(--system-error)', padding: '2px 6px' }}
                title="Clear all rules"
              >
                Clear All
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setKeywordLibraryModalOpen(false)}
            className="btn-secondary"
            style={{ height: '32px', padding: '0 16px', fontSize: '12px', borderRadius: 'var(--radius-pill)' }}
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
