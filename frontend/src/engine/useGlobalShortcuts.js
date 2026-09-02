import { useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';

/**
 * Global Keyboard Shortcuts Manager
 * Enables professional NLE hotkeys (Undo/Redo, Split, Delete, Shuttle, Playback, Snapping)
 * Uses direct Zustand store state access to eliminate closure latency, 60fps re-attachment thrashing,
 * and ensure synchronous user gesture propagation for media playback.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      // Only true text entry should block global navigation shortcuts
      const isTextInput = (
        (target.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'color'].includes(target.type)) ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      const isAnyInput = (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      const store = useEditorStore.getState();

      // Escape always blurs active element or closes open modals
      if (e.key === 'Escape') {
        if (isAnyInput) {
          target.blur();
          return;
        }
        if (store.isHelpModalOpen) store.setHelpModalOpen(false);
        if (store.isUploadModalOpen) store.setUploadModalOpen(false);
        if (store.isExportModalOpen) store.setExportModalOpen(false);
        if (store.isSettingsModalOpen) store.setSettingsModalOpen(false);
        if (store.isKeywordLibraryModalOpen) store.setKeywordLibraryModalOpen(false);
        store.setSelectedSegmentId(null);
        return;
      }

      // Help Shortcut (? or F1)
      if (!isTextInput && (e.key === '?' || e.key === 'F1')) {
        e.preventDefault();
        store.setHelpModalOpen(!store.isHelpModalOpen);
        return;
      }

      // 1. Universal Undo / Redo (Works everywhere including inside inputs if not native)
      if ((e.ctrlKey || e.metaKey)) {
        if (!e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          store.undo();
          return;
        }
        if (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) {
          e.preventDefault();
          store.redo();
          return;
        }
      }

      // If user is actively typing in a text field, let standard typing through
      if (isTextInput) return;

      const isModifier = e.ctrlKey || e.metaKey || e.altKey;

      // 2. Play / Pause Toggle (Space or K)
      if (e.code === 'Space' || (!isModifier && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        e.stopPropagation();

        // Release focus from any focused element (button, slider, card) to prevent focus trapping
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }

        store.togglePlay();
        return;
      }

      // 3. Split at Playhead (S)
      if (!isModifier && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const activeSeg = store.segments.find(s => store.currentTime >= s.start && store.currentTime <= s.end);
        const targetId = store.selectedSegmentId || (activeSeg ? activeSeg.id : null);
        if (targetId) {
          store.pushHistoryState();
          store.splitSegmentAtPlayhead(targetId);
        }
        return;
      }

      // 4. Delete Selected Caption Block (Delete or Backspace)
      if (!isModifier && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (store.selectedSegmentId) {
          e.preventDefault();
          store.pushHistoryState();
          store.deleteSegment(store.selectedSegmentId);
        }
        return;
      }

      // 5. Duplicate Selected Caption Block (Ctrl + D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (store.selectedSegmentId) {
          e.preventDefault();
          store.pushHistoryState();
          store.duplicateSegment(store.selectedSegmentId);
        }
        return;
      }

      // 6. Toggle Timeline Snapping (M)
      if (!isModifier && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        store.toggleTimelineSnap();
        return;
      }

      // 7. Toggle Auto-Follow Playhead (N)
      if (!isModifier && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        store.toggleFollowPlayhead();
        return;
      }

      // 8. Zoom Controls: Zoom In (Ctrl + / +), Zoom Out (Ctrl -), Fit (F or Ctrl 0)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          store.setTimelineZoom(store.timelineZoom * 1.25);
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          store.setTimelineZoom(store.timelineZoom * 0.8);
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          store.setTimelineZoom(1.0);
          return;
        }
      }

      if (!isModifier && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        store.setTimelineZoom(1.0);
        return;
      }

      // 9. Frame Stepping / Jog Shuttle (Left & Right Arrows, J & L)
      if (e.key === 'ArrowLeft' || (!isModifier && e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        const step = e.shiftKey ? 2.0 : 0.1;
        store.seekTo(Math.max(0, store.currentTime - step));
        return;
      }

      if (e.key === 'ArrowRight' || (!isModifier && e.key.toLowerCase() === 'l')) {
        e.preventDefault();
        const step = e.shiftKey ? 2.0 : 0.1;
        store.seekTo(Math.min(store.duration || 1000, store.currentTime + step));
        return;
      }

      // 10. Navigate Between Caption Segments (Up / Down Arrows)
      if (!isModifier && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (!store.segments || store.segments.length === 0) return;

        const curIdx = store.segments.findIndex(s => s.id === store.selectedSegmentId);
        if (e.key === 'ArrowUp') {
          const prevIdx = curIdx > 0 ? curIdx - 1 : store.segments.length - 1;
          store.setSelectedSegmentId(store.segments[prevIdx].id);
          store.seekTo(store.segments[prevIdx].start);
        } else {
          const nextIdx = curIdx >= 0 && curIdx < store.segments.length - 1 ? curIdx + 1 : 0;
          store.setSelectedSegmentId(store.segments[nextIdx].id);
          store.seekTo(store.segments[nextIdx].start);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
