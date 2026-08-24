import { create } from 'zustand';
import { PRESETS } from '../engine/presets';

const DEFAULT_PRESET = PRESETS[0];

export const DEMO_SEGMENTS = [
  {
    id: 'seg-1',
    start: 0.1,
    end: 1.45,
    text: 'STOP SCROLLING RIGHT NOW',
    words: [
      { id: 'w-1', word: 'STOP', start: 0.1, end: 0.42, confidence: 0.98 },
      { id: 'w-2', word: 'SCROLLING', start: 0.43, end: 0.92, confidence: 0.99 },
      { id: 'w-3', word: 'RIGHT', start: 0.93, end: 1.18, confidence: 0.97 },
      { id: 'w-4', word: 'NOW', start: 1.19, end: 1.45, confidence: 0.99 }
    ]
  },
  {
    id: 'seg-2',
    start: 1.5,
    end: 2.85,
    text: 'THIS AI TOOL',
    words: [
      { id: 'w-5', word: 'THIS', start: 1.5, end: 1.82, confidence: 0.96 },
      { id: 'w-6', word: 'AI', start: 1.83, end: 2.22, confidence: 0.99 },
      { id: 'w-7', word: 'TOOL', start: 2.23, end: 2.85, confidence: 0.98 }
    ]
  },
  {
    id: 'seg-3',
    start: 2.9,
    end: 4.4,
    text: 'CREATES VIRAL CAPTIONS',
    words: [
      { id: 'w-8', word: 'CREATES', start: 2.9, end: 3.38, confidence: 0.97 },
      { id: 'w-9', word: 'VIRAL', start: 3.39, end: 3.88, confidence: 0.99 },
      { id: 'w-10', word: 'CAPTIONS', start: 3.89, end: 4.4, confidence: 0.99 }
    ]
  },
  {
    id: 'seg-4',
    start: 4.45,
    end: 6.2,
    text: 'IN UNDER 5 SECONDS',
    words: [
      { id: 'w-11', word: 'IN', start: 4.45, end: 4.7, confidence: 0.98 },
      { id: 'w-12', word: 'UNDER', start: 4.71, end: 5.2, confidence: 0.99 },
      { id: 'w-13', word: '5', start: 5.21, end: 5.65, confidence: 0.99 },
      { id: 'w-14', word: 'SECONDS', start: 5.66, end: 6.2, confidence: 0.98 }
    ]
  }
];

export const useEditorStore = create((set, get) => ({
  // Video Media State
  videoFile: null,
  videoUrl: '',
  videoFilename: null,
  duration: 0.0,
  currentTime: 0.0,
  seekRequestTime: null,
  isPlaying: false,
  playbackRate: 1.0,
  volume: 1.0,
  isMuted: false,
  aspectRatio: '9:16',
  showSafeZones: true,

  // Captions & Words
  segments: [],
  selectedSegmentId: null,
  selectedWordId: null,

  // Caption Styling
  style: { ...DEFAULT_PRESET.style },
  activePresetId: DEFAULT_PRESET.id,

  // UI State
  isTranscribing: false,
  transcribeProgress: '',
  isRendering: false,
  exportProgress: 0,
  exportResult: null,
  backendAvailable: false,
  isUploadModalOpen: false,
  isExportModalOpen: false,

  // Actions
  setBackendAvailable: (available) => set({ backendAvailable: available }),
  
  setVideo: (file, url, filename, duration = 0) =>
    set({
      videoFile: file,
      videoUrl: url,
      videoFilename: filename || (file ? file.name : null),
      duration: duration || get().duration || 0,
      currentTime: 0.0,
      isPlaying: false,
      segments: []
    }),

  setDuration: (duration) => set({ duration: Math.max(0.1, duration) }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  
  seekTo: (time) => {
    const safeTime = Math.max(0, Math.min(get().duration || 1000, time));
    set({ currentTime: safeTime, seekRequestTime: safeTime });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  toggleSafeZones: () => set((state) => ({ showSafeZones: !state.showSafeZones })),

  setSegments: (segments) => set({ segments: segments || [] }),
  setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),
  setSelectedWordId: (id) => set({ selectedWordId: id }),

  // Move entire segment block by deltaSeconds
  moveSegment: (segmentId, deltaSeconds) => {
    set((state) => {
      const maxDur = state.duration || 1000;
      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const segDur = seg.end - seg.start;
        let newStart = Math.max(0, seg.start + deltaSeconds);
        let newEnd = newStart + segDur;
        if (newEnd > maxDur) {
          newEnd = maxDur;
          newStart = Math.max(0, newEnd - segDur);
        }

        const shift = newStart - seg.start;
        const updatedWords = seg.words.map((w) => ({
          ...w,
          start: Math.round((w.start + shift) * 100) / 100,
          end: Math.round((w.end + shift) * 100) / 100
        }));

        return {
          ...seg,
          start: Math.round(newStart * 100) / 100,
          end: Math.round(newEnd * 100) / 100,
          words: updatedWords
        };
      });

      return { segments: updatedSegments.sort((a, b) => a.start - b.start) };
    });
  },

  // Trim segment start edge
  trimSegmentStart: (segmentId, newStart) => {
    set((state) => {
      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        if (newStart >= seg.end - 0.2) return seg; // Keep min 0.2s
        const safeStart = Math.max(0, newStart);
        const updatedWords = [...seg.words];
        if (updatedWords.length > 0) {
          updatedWords[0] = { ...updatedWords[0], start: safeStart };
        }
        return {
          ...seg,
          start: Math.round(safeStart * 100) / 100,
          words: updatedWords
        };
      });
      return { segments: updatedSegments };
    });
  },

  // Trim segment end edge
  trimSegmentEnd: (segmentId, newEnd) => {
    set((state) => {
      const maxDur = state.duration || 1000;
      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        if (newEnd <= seg.start + 0.2) return seg;
        const safeEnd = Math.min(maxDur, newEnd);
        const updatedWords = [...seg.words];
        if (updatedWords.length > 0) {
          updatedWords[updatedWords.length - 1] = { ...updatedWords[updatedWords.length - 1], end: safeEnd };
        }
        return {
          ...seg,
          end: Math.round(safeEnd * 100) / 100,
          words: updatedWords
        };
      });
      return { segments: updatedSegments };
    });
  },

  // Split selected segment at playhead time
  splitSegmentAtPlayhead: (segmentId) => {
    set((state) => {
      const t = state.currentTime;
      const segIndex = state.segments.findIndex((s) => s.id === segmentId);
      if (segIndex === -1) return state;

      const seg = state.segments[segIndex];
      if (t <= seg.start + 0.1 || t >= seg.end - 0.1) return state;

      // Find closest word split point
      let splitWordIdx = seg.words.findIndex((w) => w.end >= t);
      if (splitWordIdx <= 0) splitWordIdx = 1;
      if (splitWordIdx >= seg.words.length) splitWordIdx = seg.words.length - 1;

      const words1 = seg.words.slice(0, splitWordIdx);
      const words2 = seg.words.slice(splitWordIdx);
      if (words1.length === 0 || words2.length === 0) return state;

      const seg1 = {
        id: `seg-${Math.random().toString(36).substring(2, 9)}`,
        start: words1[0].start,
        end: t,
        text: words1.map((w) => w.word.trim()).join(' '),
        words: words1
      };

      const seg2 = {
        id: `seg-${Math.random().toString(36).substring(2, 9)}`,
        start: t,
        end: words2[words2.length - 1].end,
        text: words2.map((w) => w.word.trim()).join(' '),
        words: words2
      };

      const newSegments = [...state.segments];
      newSegments.splice(segIndex, 1, seg1, seg2);
      return { segments: newSegments, selectedSegmentId: seg2.id };
    });
  },

  updateWordText: (segmentId, wordId, newText) => {
    set((state) => {
      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const updatedWords = seg.words.map((w) => {
          if (w.id !== wordId) return w;
          return { ...w, word: newText };
        });
        const segText = updatedWords.map((w) => w.word.trim()).join(' ');
        return { ...seg, text: segText, words: updatedWords };
      });
      return { segments: updatedSegments };
    });
  },

  deleteWord: (segmentId, wordId) => {
    set((state) => {
      const updatedSegments = state.segments
        .map((seg) => {
          if (seg.id !== segmentId) return seg;
          const filteredWords = seg.words.filter((w) => w.id !== wordId);
          if (filteredWords.length === 0) return null;
          const segText = filteredWords.map((w) => w.word.trim()).join(' ');
          return {
            ...seg,
            start: filteredWords[0].start,
            end: filteredWords[filteredWords.length - 1].end,
            text: segText,
            words: filteredWords
          };
        })
        .filter(Boolean);
      return { segments: updatedSegments };
    });
  },

  deleteSegment: (segmentId) => {
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== segmentId),
      selectedSegmentId: state.selectedSegmentId === segmentId ? null : state.selectedSegmentId
    }));
  },

  applyPreset: (presetId) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    set({
      activePresetId: presetId,
      style: { ...preset.style }
    });
  },

  updateStyle: (partialStyle) => {
    set((state) => ({
      activePresetId: 'custom',
      style: { ...state.style, ...partialStyle }
    }));
  },

  setIsTranscribing: (isTranscribing, progress = '') =>
    set({ isTranscribing, transcribeProgress: progress }),

  setIsRendering: (isRendering, progress = 0) =>
    set({ isRendering, exportProgress: progress }),

  setExportResult: (result) => set({ exportResult: result }),
  setUploadModalOpen: (isOpen) => set({ isUploadModalOpen: isOpen }),
  setExportModalOpen: (isOpen) => set({ isExportModalOpen: isOpen }),

  loadDemoData: () => {
    set({
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      videoFilename: 'ForBiggerBlazes.mp4',
      duration: 15.0,
      currentTime: 0.0,
      segments: DEMO_SEGMENTS,
      activePresetId: 'hormozi',
      style: { ...PRESETS[0].style }
    });
  }
}));
