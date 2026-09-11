import React from 'react';
import { 
  RefreshCw, 
  X, 
  FileText, 
  Trash2, 
  AlertTriangle,
  Film
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const ReplaceVideoModal = () => {
  const {
    pendingImportFile,
    setPendingImportFile,
    importVideoFile,
    segments,
    videoFilename,
    videoFile
  } = useEditorStore();

  if (!pendingImportFile) return null;

  const currentVideoName = videoFilename || (videoFile ? videoFile.name : 'Current Video');
  const newVideoName = pendingImportFile.name;
  const newFileSizeMB = (pendingImportFile.size / (1024 * 1024)).toFixed(1);

  const handleKeepCaptions = () => {
    importVideoFile(pendingImportFile, true);
    setPendingImportFile(null);
  };

  const handleClearCaptions = () => {
    importVideoFile(pendingImportFile, false);
    setPendingImportFile(null);
  };

  const handleCancel = () => {
    setPendingImportFile(null);
  };

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div 
        className="studio-panel apple-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          backgroundColor: 'var(--bg-panel)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-blue-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RefreshCw size={15} color="var(--accent-bright-blue)" />
            </div>
            <div>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Replace Video
              </span>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="btn-ghost"
            style={{ padding: '4px' }}
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* File Comparison Card */}
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <Film size={14} color="var(--text-tertiary)" />
              <span style={{ color: 'var(--text-tertiary)', width: '60px' }}>Current:</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentVideoName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <Film size={14} color="var(--accent-primary)" />
              <span style={{ color: 'var(--text-tertiary)', width: '60px' }}>New:</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {newVideoName} ({newFileSizeMB} MB)
              </span>
            </div>
          </div>

          {/* Timeline Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'var(--bg-active)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px'
          }}>
            <AlertTriangle size={16} color="var(--text-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', lineHeight: '1.4', color: 'var(--text-primary)' }}>
              You have <strong>{segments.length} caption segment{segments.length === 1 ? '' : 's'}</strong> on the timeline. 
              Would you like to keep your existing captions for this updated video cut or start fresh?
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          gap: '8px'
        }}>
          <button
            onClick={handleCancel}
            className="btn-ghost"
            style={{ fontSize: '12px' }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClearCaptions}
              className="btn-secondary"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Replace the video and wipe existing captions"
            >
              <Trash2 size={13} color="var(--system-error)" />
              <span>Start Fresh</span>
            </button>

            <button
              onClick={handleKeepCaptions}
              className="btn-primary"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Replace video while retaining all current captions and timings"
            >
              <FileText size={13} />
              <span>Replace Video (Keep Captions)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
