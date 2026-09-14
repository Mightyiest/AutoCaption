import { create } from 'zustand';
import { PRESETS, sanitizeStyle } from '../engine/presets';
import { extractAudioPeaks } from '../engine/audioWaveformExtractor';
import { extractAllWords, chunkWordsIntoSegments, stripPunctuationFromSegments } from '../engine/wordChunker';
import { autoAssignEmojis, detectEmojiForWord } from '../engine/emojiEngine';
import { autoApplyEmphasis, isPowerKeyword } from '../engine/emphasisEngine';
import { detectNativeVideoFps } from '../engine/videoSourceCache';
import { browseLocalFile, linkLocalPath, getStreamUrl, checkMediaStatus } from '../engine/mediaLinker';
import { getAllProjects, getProjectById, saveProject, deleteProject as dbDeleteProject, INITIAL_SHOWCASE_PROJECTS } from '../engine/projectStorage';

const STORAGE_KEY_KEYWORD_RULES = 'autocaption_custom_keyword_rules';
const STORAGE_KEY_THEME = 'autocaption_theme';

const initialTheme = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY_THEME)) || 'light';
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

const DEFAULT_KEYWORD_RULES = [
  { id: 'rule-pain', keyword: 'pain', emoji: '🤕', isEmphasized: true },
  { id: 'rule-crack', keyword: 'crack', emoji: '⚡', isEmphasized: true },
  { id: 'rule-sudden', keyword: 'sudden', emoji: '🚨', isEmphasized: true },
  { id: 'rule-boom', keyword: 'boom', emoji: '💥', isEmphasized: true },
  { id: 'rule-insane', keyword: 'insane', emoji: '🤯', isEmphasized: true },
  { id: 'rule-secret', keyword: 'secret', emoji: '🔒', isEmphasized: true },
  { id: 'rule-money', keyword: 'money', emoji: '💰', isEmphasized: true },
  { id: 'rule-fire', keyword: 'fire', emoji: '🔥', isEmphasized: true }
];

function loadCustomKeywordRulesFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_KEYWORD_RULES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load custom keyword rules from localStorage:', e);
  }
  return DEFAULT_KEYWORD_RULES;
}

function saveCustomKeywordRulesToStorage(rules) {
  try {
    localStorage.setItem(STORAGE_KEY_KEYWORD_RULES, JSON.stringify(rules));
  } catch (e) {
    console.warn('Failed to save custom keyword rules to localStorage:', e);
  }
}

const DEFAULT_PRESET = PRESETS[0];

export function captureVideoSnapshot(mediaEl, maxWidth = 480) {
  try {
    const media = mediaEl || (typeof document !== 'undefined' ? document.querySelector('video') : null);
    if (!media || !(media instanceof HTMLVideoElement)) return null;
    if (media.readyState < 2 || !media.videoWidth || !media.videoHeight) return null;

    const canvas = document.createElement('canvas');
    const aspect = media.videoHeight / media.videoWidth;
    const w = Math.min(maxWidth, media.videoWidth);
    const h = Math.round(w * aspect);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(media, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (err) {
    return null;
  }
}

export const DEMO_SEGMENTS = [
  {
    id: 'seg-1',
    start: 0.0,
    end: 1.88,
    text: 'Meet AutoCaption Studio,',
    emoji: '🚀',
    words: [
      { id: 'w-1', word: 'Meet', start: 0.0, end: 0.62, confidence: 0.95 },
      { id: 'w-2', word: 'AutoCaption', start: 0.62, end: 1.44, confidence: 0.92, isEmphasized: true, emoji: '🚀' },
      { id: 'w-3', word: 'Studio,', start: 1.44, end: 1.88, confidence: 0.96 }
    ]
  },
  {
    id: 'seg-2',
    start: 2.26,
    end: 3.16,
    text: 'the fastest offline',
    emoji: '⚡',
    words: [
      { id: 'w-4', word: 'the', start: 2.26, end: 2.38, confidence: 0.98 },
      { id: 'w-5', word: 'fastest', start: 2.38, end: 2.76, confidence: 0.96, isEmphasized: true, emoji: '⚡' },
      { id: 'w-6', word: 'offline', start: 2.76, end: 3.16, confidence: 0.97 }
    ]
  },
  {
    id: 'seg-3',
    start: 3.16,
    end: 4.32,
    text: 'AI captioning system',
    emoji: '🤖',
    words: [
      { id: 'w-7', word: 'AI', start: 3.16, end: 3.58, confidence: 0.96, isEmphasized: true, emoji: '🤖' },
      { id: 'w-8', word: 'captioning', start: 3.58, end: 4.06, confidence: 0.98 },
      { id: 'w-9', word: 'system', start: 4.06, end: 4.32, confidence: 0.99 }
    ]
  },
  {
    id: 'seg-4',
    start: 4.32,
    end: 5.2,
    text: 'for video editors.',
    emoji: '🎥',
    words: [
      { id: 'w-10', word: 'for', start: 4.32, end: 4.54, confidence: 1.0 },
      { id: 'w-11', word: 'video', start: 4.54, end: 4.78, confidence: 0.95, emoji: '🎥' },
      { id: 'w-12', word: 'editors.', start: 4.78, end: 5.2, confidence: 0.99 }
    ]
  },
  {
    id: 'seg-5',
    start: 6.22,
    end: 7.04,
    text: 'Powered by Faster',
    emoji: '🔥',
    words: [
      { id: 'w-13', word: 'Powered', start: 6.22, end: 6.54, confidence: 0.94, isEmphasized: true, emoji: '🔥' },
      { id: 'w-14', word: 'by', start: 6.54, end: 6.66, confidence: 0.99 },
      { id: 'w-15', word: 'Faster', start: 6.66, end: 7.04, confidence: 0.92 }
    ]
  },
  {
    id: 'seg-6',
    start: 7.04,
    end: 7.48,
    text: 'Whisper,',
    emoji: '🎙️',
    words: [
      { id: 'w-16', word: 'Whisper,', start: 7.04, end: 7.48, confidence: 0.93, isEmphasized: true, emoji: '🎙️' }
    ]
  },
  {
    id: 'seg-7',
    start: 7.68,
    end: 8.34,
    text: 'it aligns speech',
    words: [
      { id: 'w-17', word: 'it', start: 7.68, end: 7.78, confidence: 0.95 },
      { id: 'w-18', word: 'aligns', start: 7.78, end: 8.12, confidence: 0.94 },
      { id: 'w-19', word: 'speech', start: 8.12, end: 8.34, confidence: 0.92 }
    ]
  },
  {
    id: 'seg-8',
    start: 8.34,
    end: 9.9,
    text: 'millisecond by millisecond,',
    emoji: '⏱️',
    words: [
      { id: 'w-20', word: 'millisecond', start: 8.34, end: 9.12, confidence: 0.96, isEmphasized: true, emoji: '⏱️' },
      { id: 'w-21', word: 'by', start: 9.12, end: 9.34, confidence: 0.99 },
      { id: 'w-22', word: 'millisecond,', start: 9.34, end: 9.9, confidence: 0.95 }
    ]
  },
  {
    id: 'seg-9',
    start: 10.0,
    end: 10.72,
    text: 'with real-time',
    emoji: '✨',
    words: [
      { id: 'w-23', word: 'with', start: 10.0, end: 10.22, confidence: 0.99 },
      { id: 'w-24', word: 'real', start: 10.22, end: 10.44, confidence: 0.98, emoji: '✨' },
      { id: 'w-25', word: '-time', start: 10.44, end: 10.72, confidence: 0.94 }
    ]
  },
  {
    id: 'seg-10',
    start: 10.72,
    end: 11.76,
    text: 'waveform scrubbing and',
    words: [
      { id: 'w-26', word: 'waveform', start: 10.72, end: 11.04, confidence: 0.98 },
      { id: 'w-27', word: 'scrubbing', start: 11.04, end: 11.5, confidence: 0.96 },
      { id: 'w-28', word: 'and', start: 11.5, end: 11.76, confidence: 0.92 }
    ]
  },
  {
    id: 'seg-11',
    start: 11.76,
    end: 13.1,
    text: 'instant 1080p hardware',
    emoji: '💎',
    words: [
      { id: 'w-29', word: 'instant', start: 11.76, end: 12.1, confidence: 0.97, isEmphasized: true },
      { id: 'w-30', word: '1080p', start: 12.1, end: 12.82, confidence: 0.95, isEmphasized: true, emoji: '💎' },
      { id: 'w-31', word: 'hardware', start: 12.82, end: 13.1, confidence: 0.93 }
    ]
  },
  {
    id: 'seg-12',
    start: 13.1,
    end: 14.08,
    text: 'accelerated exports.',
    emoji: '🚀',
    words: [
      { id: 'w-32', word: 'accelerated', start: 13.1, end: 13.64, confidence: 0.94 },
      { id: 'w-33', word: 'exports.', start: 13.64, end: 14.08, confidence: 0.96, isEmphasized: true, emoji: '🚀' }
    ]
  }
];

export const useEditorStore = create((set, get) => ({
  // Video Media State
  videoFile: null,
  videoUrl: '',
  videoFilename: null,
  videoFps: 30,
  duration: 0.0,
  currentTime: 0.0,
  seekRequestTime: null,
  isPlaying: false,
  playbackRate: 1.0,
  volume: 1.0,
  isMuted: false,
  aspectRatio: '9:16',
  showSafeZones: false,

  // Audio Waveform State
  audioPeaks: null,
  isExtractingAudio: false,

  // Timeline Navigation & Zoom State
  timelineZoom: 1.0,
  timelineSnapEnabled: true,
  followPlayhead: false,
  historyPast: [],
  historyFuture: [],

  // Captions & Words
  segments: [],
  selectedSegmentId: null,
  selectedWordId: null,

  // Caption Styling
  style: { ...DEFAULT_PRESET.style },
  activePresetId: DEFAULT_PRESET.id,

  // Project Management & Media Linking State
  currentView: (typeof window !== 'undefined' && window.location.hash === '#editor') ? 'editor' : 'hub', // 'hub' | 'editor'
  activeProjectId: null,
  activeProjectTitle: 'Untitled Project',
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved'
  lastSavedTime: null,
  autoSaveTimer: null,
  projectsList: INITIAL_SHOWCASE_PROJECTS,
  isMediaLinked: false,
  linkedSourcePath: null,
  mediaOffline: false,
  videoSnapshotUrl: null,
  setVideoSnapshotUrl: (videoSnapshotUrl) => set({ videoSnapshotUrl }),

  triggerAutoSave: () => {
    const { activeProjectId, autoSaveTimer } = get();
    if (!activeProjectId) return;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    set({ saveStatus: 'unsaved' });
    const timer = setTimeout(() => {
      get().saveCurrentProject();
    }, 1500);
    set({ autoSaveTimer: timer });
  },

  // UI State
  canvasLayout: 'center', // 'right' | 'center' | 'left'
  backendAvailable: false,
  isUploadModalOpen: false,
  isTranscribeModalOpen: false,
  isExportModalOpen: false,
  isSettingsModalOpen: false,
  isHelpModalOpen: false,
  isVocalExtractorOpen: false,
  pendingImportFile: null,
  videoPickerTrigger: null,
  theme: initialTheme,
  removePunctuation: false,

  setCurrentView: (currentView) => {
    set({ currentView });
    if (typeof window !== 'undefined') {
      window.location.hash = currentView === 'hub' ? 'projects' : 'editor';
    }
  },

  fetchProjectsList: async () => {
    try {
      const list = await getAllProjects();
      set({ projectsList: list });
    } catch (e) {
      console.warn('Failed to fetch projects list:', e);
    }
  },

  loadProject: async (projectId) => {
    try {
      const proj = await getProjectById(projectId);
      if (!proj) return;
      
      const preset = PRESETS.find(p => p.id === proj.activePresetId) || PRESETS[0];
      const projectStyle = proj.style ? sanitizeStyle(proj.style) : { ...preset.style };

      let streamUrl = proj.videoUrl || '';
      if (proj.isMediaLinked && proj.linkedSourcePath) {
        streamUrl = getStreamUrl(proj.linkedSourcePath);
      }

      const loadedRules = (proj.customKeywordRules && Array.isArray(proj.customKeywordRules) && proj.customKeywordRules.length > 0)
        ? proj.customKeywordRules
        : get().customKeywordRules;
      if (proj.customKeywordRules && Array.isArray(proj.customKeywordRules) && proj.customKeywordRules.length > 0) {
        saveCustomKeywordRulesToStorage(loadedRules);
      }

      set({
        activeProjectId: proj.id,
        activeProjectTitle: proj.title || 'Untitled Project',
        currentView: 'editor',
        videoUrl: streamUrl,
        videoFilename: proj.videoFilename || (proj.linkedSourcePath ? proj.linkedSourcePath.split(/[/\\]/).pop() : null),
        linkedSourcePath: proj.linkedSourcePath || null,
        isMediaLinked: Boolean(proj.isMediaLinked),
        mediaOffline: Boolean(proj.mediaOffline),
        aspectRatio: proj.aspectRatio || '9:16',
        duration: proj.duration || 0,
        segments: proj.segments || [],
        style: projectStyle,
        activePresetId: proj.activePresetId || preset.id,
        customKeywordRules: loadedRules,
        currentTime: 0,
        isPlaying: false,
        saveStatus: 'saved',
        lastSavedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      if (typeof window !== 'undefined') {
        window.location.hash = 'editor';
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  },

  saveCurrentProject: async () => {
    const { activeProjectId, activeProjectTitle, aspectRatio, duration, segments, style, activePresetId, videoFilename, videoUrl, linkedSourcePath, isMediaLinked, customKeywordRules, autoSaveTimer, mediaElement, videoSnapshotUrl } = get();
    if (!activeProjectId) return;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      set({ autoSaveTimer: null });
    }

    set({ saveStatus: 'saving' });
    try {
      const BACKEND_URL = 'http://127.0.0.1:8000';
      let calculatedThumb = captureVideoSnapshot(mediaElement);
      if (!calculatedThumb && videoSnapshotUrl && !videoSnapshotUrl.includes('unsplash.com')) {
        calculatedThumb = videoSnapshotUrl;
      }
      if (!calculatedThumb && (linkedSourcePath || videoFilename)) {
        calculatedThumb = `${BACKEND_URL}/api/media/thumbnail?path=${encodeURIComponent(linkedSourcePath || '')}&filename=${encodeURIComponent(videoFilename || '')}`;
      }

      await saveProject({
        id: activeProjectId,
        title: activeProjectTitle,
        aspectRatio,
        duration,
        linesCount: segments.length,
        wordsCount: segments.reduce((sum, s) => sum + (s.words?.length || 0), 0),
        segments,
        style,
        activePresetId,
        customKeywordRules: customKeywordRules || [],
        videoFilename,
        videoUrl,
        linkedSourcePath,
        isMediaLinked,
        captionSnippet: segments[0]?.text || '',
        thumbnailUrl: calculatedThumb || null
      });
      set({ saveStatus: 'saved', lastSavedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      get().fetchProjectsList();
    } catch (e) {
      console.warn('Project save failed:', e);
      set({ saveStatus: 'unsaved' });
    }
  },

  createNewProject: async ({ aspect = '9:16', title = '', linkedPath = null, videoFile = null, videoFilename = null, videoUrl = null, presetId = 'mrbeast' } = {}) => {
    const newId = 'proj-' + Date.now();
    let streamUrl = videoUrl || '';
    let filename = videoFilename || null;
    let isLinked = Boolean(linkedPath);

    if (linkedPath) {
      streamUrl = getStreamUrl(linkedPath);
      filename = linkedPath.split(/[/\\]/).pop();
      isLinked = true;
    } else if (videoFile) {
      if (!filename) filename = videoFile.name;
      if (!streamUrl) streamUrl = URL.createObjectURL(videoFile);
      // Ensure file is in backend uploads cache for Whisper and FFmpeg
      const BACKEND_URL = 'http://127.0.0.1:8000';
      if (get().backendAvailable) {
        try {
          const formData = new FormData();
          formData.append('file', videoFile);
          const res = await fetch(`${BACKEND_URL}/api/upload-preview`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            filename = data.video_filename;
            streamUrl = `${BACKEND_URL}${data.video_url}`;
          }
        } catch (err) {
          console.warn('Backend upload-preview failed during create project:', err);
        }
      }
    }

    const BACKEND_URL = 'http://127.0.0.1:8000';
    let newThumb = null;
    if (linkedPath || filename) {
      newThumb = `${BACKEND_URL}/api/media/thumbnail?path=${encodeURIComponent(linkedPath || '')}&filename=${encodeURIComponent(filename || '')}`;
    }

    const selectedPreset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    const defaultStyle = { ...selectedPreset.style };
    const projectTitle = title || `New ${aspect} Project`;
    const newProj = {
      id: newId,
      title: projectTitle,
      aspectRatio: aspect,
      duration: 0,
      linesCount: 0,
      wordsCount: 0,
      segments: [],
      style: defaultStyle,
      activePresetId: selectedPreset.id,
      videoFilename: filename,
      videoUrl: streamUrl,
      linkedSourcePath: linkedPath,
      isMediaLinked: isLinked,
      captionSnippet: '',
      thumbnailUrl: newThumb,
      isActive: true
    };

    await saveProject(newProj);

    set({
      activeProjectId: newId,
      activeProjectTitle: projectTitle,
      currentView: 'editor',
      aspectRatio: aspect,
      duration: 0,
      currentTime: 0,
      isPlaying: false,
      videoFile: videoFile,
      videoUrl: streamUrl,
      videoFilename: filename,
      linkedSourcePath: linkedPath,
      isMediaLinked: isLinked,
      mediaOffline: false,
      segments: [],
      style: defaultStyle,
      activePresetId: PRESETS[0].id,
      saveStatus: 'saved'
    });

    get().fetchProjectsList();
    if (typeof window !== 'undefined') {
      window.location.hash = 'editor';
    }
  },

  linkLocalVideoFile: async () => {
    try {
      const res = await browseLocalFile();
      if (res.cancelled || !res.filePath) return;

      const title = res.filename.replace(/\.[^/.]+$/, "");
      await get().createNewProject({
        aspect: res.width > res.height ? '16:9' : '9:16',
        title: title,
        linkedPath: res.filePath
      });

      if (get().backendAvailable) {
        get().setTranscribeModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to link local video file:', e);
    }
  },

  relinkProjectMedia: async (projectId) => {
    try {
      const res = await browseLocalFile();
      if (res.cancelled || !res.filePath) return;

      const proj = await getProjectById(projectId);
      if (!proj) return;

      proj.linkedSourcePath = res.filePath;
      proj.videoFilename = res.filename;
      proj.mediaOffline = false;
      proj.isMediaLinked = true;
      const BACKEND_URL = 'http://127.0.0.1:8000';
      proj.thumbnailUrl = `${BACKEND_URL}/api/media/thumbnail?path=${encodeURIComponent(res.filePath)}&filename=${encodeURIComponent(res.filename)}`;
      await saveProject(proj);

      if (get().activeProjectId === projectId) {
        set({
          linkedSourcePath: res.filePath,
          videoFilename: res.filename,
          videoUrl: getStreamUrl(res.filePath),
          mediaOffline: false,
          isMediaLinked: true
        });
      }
      get().fetchProjectsList();
    } catch (e) {
      console.error('Failed to relink media:', e);
    }
  },

  renameCurrentProject: (newTitle) => {
    set({ activeProjectTitle: newTitle, saveStatus: 'unsaved' });
    get().saveCurrentProject();
  },

  deleteCurrentProject: async (projectId) => {
    const idToDelete = projectId || get().activeProjectId;
    if (!idToDelete) return;
    await dbDeleteProject(idToDelete);
    if (get().activeProjectId === idToDelete) {
      set({
        activeProjectId: null,
        activeProjectTitle: 'Untitled Project',
        currentView: 'hub',
        videoUrl: '',
        videoFile: null,
        videoFilename: null,
        segments: []
      });
    }
    get().fetchProjectsList();
  },

  setCanvasLayout: (canvasLayout) => set({ canvasLayout }),
  setRemovePunctuation: (removePunctuation) => set({ removePunctuation }),
  setTranscribeModalOpen: (isTranscribeModalOpen) => set({ isTranscribeModalOpen }),
  setVocalExtractorOpen: (isVocalExtractorOpen) => set({ isVocalExtractorOpen }),
  setPendingImportFile: (pendingImportFile) => set({ pendingImportFile }),
  registerVideoPickerTrigger: (videoPickerTrigger) => set({ videoPickerTrigger }),
  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY_THEME, theme);
      } catch (e) {}
    }
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
  triggerVideoPicker: () => {
    const trigger = get().videoPickerTrigger;
    if (typeof trigger === 'function') {
      trigger();
    }
  },

  // Studio Toast State & Action
  studioToast: null,
  showStudioToast: (message, options = {}) => {
    const toast = {
      id: Date.now() + Math.random(),
      message,
      type: options.type || 'info',
      icon: options.icon || null
    };
    set({ studioToast: toast });
    if (options.duration !== 0) {
      const dur = options.duration || 3200;
      setTimeout(() => {
        const cur = get().studioToast;
        if (cur && cur.id === toast.id) {
          set({ studioToast: null });
        }
      }, dur);
    }
  },
  hideStudioToast: () => set({ studioToast: null }),

  // Transcription State
  isTranscribing: false,
  transcribeProgress: '',
  setIsTranscribing: (isTranscribing, progressMsg = '') =>
    set({ isTranscribing, transcribeProgress: progressMsg }),

  // AI Model Manager State
  selectedModel: 'base',
  modelsData: { cache_dir: '', models: [] },
  modelsLoading: false,
  modelDownloadStates: {},
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  // Dependencies & Acceleration State
  dependenciesData: null,
  dependenciesLoading: false,
  vocalModelsData: [],
  vocalModelsLoading: false,
  activeInstallTask: null,

  // Actions
  setTimelineZoom: (timelineZoom) => set({ timelineZoom: Math.max(0.5, Math.min(20.0, timelineZoom)) }),
  toggleTimelineSnap: () => set((state) => ({ timelineSnapEnabled: !state.timelineSnapEnabled })),
  toggleFollowPlayhead: () => set((state) => ({ followPlayhead: !state.followPlayhead })),

  pushHistoryState: () => {
    set((state) => ({
      historyPast: [...state.historyPast.slice(-30), JSON.parse(JSON.stringify(state.segments))],
      historyFuture: []
    }));
  },

  undo: () => {
    const { historyPast, historyFuture, segments } = get();
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    set({
      segments: previous,
      historyPast: newPast,
      historyFuture: [JSON.parse(JSON.stringify(segments)), ...historyFuture]
    });
  },

  redo: () => {
    const { historyPast, historyFuture, segments } = get();
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    set({
      segments: next,
      historyPast: [...historyPast, JSON.parse(JSON.stringify(segments))],
      historyFuture: newFuture
    });
  },

  setBackendAvailable: (available) => set({ backendAvailable: available }),
  setSettingsModalOpen: (isOpen) => {
    set({ isSettingsModalOpen: isOpen });
    if (isOpen) {
      get().fetchModelsStatus();
      get().fetchDependenciesStatus();
      get().fetchVocalModelsStatus();
    }
  },
  
  extractAudioWaveform: async () => {
    const { videoFile, videoUrl, duration, segments, isExtractingAudio } = get();
    if (isExtractingAudio || (!videoFile && !videoUrl)) return;

    set({ isExtractingAudio: true });
    try {
      const res = await extractAudioPeaks({
        file: videoFile,
        url: videoUrl,
        duration: duration || 10,
        segments: segments || [],
        samplesPerSecond: 80
      });
      set({ audioPeaks: res.peaks, isExtractingAudio: false });
    } catch (err) {
      console.warn('Audio waveform extraction failed:', err);
      set({ isExtractingAudio: false });
    }
  },

  setVideoFps: (videoFps) => set({ videoFps: Number(videoFps) || 30 }),

  setVideo: (file, url, filename, duration = 0, keepCaptions = false) => {
    const media = get().mediaElement;
    if (media) {
      try {
        media.pause();
        media.currentTime = 0;
      } catch (e) {}
    }
    if (!keepCaptions && (get().segments || []).length > 0) {
      get().pushHistoryState();
    }
    set((state) => ({
      videoFile: file,
      videoUrl: url,
      videoFilename: filename || (file ? file.name : null),
      duration: duration || state.duration || 0,
      currentTime: 0.0,
      isPlaying: false,
      isMediaLinked: file ? false : state.isMediaLinked,
      linkedSourcePath: file ? null : state.linkedSourcePath,
      mediaOffline: false,
      segments: keepCaptions ? state.segments : [],
      audioPeaks: null
    }));
    if (file) {
      detectNativeVideoFps(file).then((fps) => {
        if (fps && Number.isFinite(fps) && fps > 0) {
          set({ videoFps: fps });
        }
      });
    }
    get().extractAudioWaveform();
  },

  handleFileSelected: (file) => {
    if (!file) return;
    const isVideoOrAudio = (file.type && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) ||
      Boolean(file.name && file.name.match(/\.(mp4|mov|webm|mkv|avi|wav|mp3|m4a|aac|flac)$/i));
    if (!isVideoOrAudio) {
      console.warn('Selected file is not a supported video or audio format:', file.name);
      return;
    }
    const currentSegments = get().segments || [];
    if (currentSegments.length > 0) {
      set({ pendingImportFile: file });
    } else {
      get().importVideoFile(file, false);
    }
  },

  importVideoFile: async (file, keepCaptions = false) => {
    if (!file) return;
    const localBlobUrl = URL.createObjectURL(file);
    get().setVideo(file, localBlobUrl, file.name, 0, keepCaptions);

    // Upload to backend preview cache if backend is online
    const BACKEND_URL = 'http://127.0.0.1:8000';
    if (get().backendAvailable) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${BACKEND_URL}/api/upload-preview`, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          // Update store with persistent backend URL and filename
          set(() => ({
            videoUrl: `${BACKEND_URL}${data.video_url}`,
            videoFilename: data.video_filename,
            isMediaLinked: false,
            linkedSourcePath: null,
            mediaOffline: false
          }));
          get().saveCurrentProject();
        }
      } catch (err) {
        console.warn('Background upload-preview error:', err);
      }
    }
  },

  setDuration: (duration) => {
    set({ duration: Math.max(0.1, duration) });
    if (!get().audioPeaks) {
      get().extractAudioWaveform();
    }
  },

  setCurrentTime: (currentTime) => set({ currentTime }),
  
  seekTo: (time) => {
    const safeTime = Math.max(0, Math.min(get().duration || 1000, time));
    let media = get().mediaElement;
    if (!media && typeof document !== 'undefined') {
      media = document.querySelector('video, audio');
      if (media) {
        set({ mediaElement: media });
      }
    }
    if (media) {
      try {
        media.currentTime = safeTime;
      } catch (err) {
        console.warn('Direct media seek error:', err);
      }
    }
    set({ currentTime: safeTime, seekRequestTime: safeTime });
  },

  mediaElement: null,
  setMediaElement: (mediaElement) => set({ mediaElement }),

  togglePlay: () => {
    const state = get();
    let media = state.mediaElement;
    if (!media && typeof document !== 'undefined') {
      media = document.querySelector('video, audio');
      if (media) {
        set({ mediaElement: media });
      }
    }
    const { videoUrl, duration, isPlaying, currentTime } = state;

    if (media && videoUrl) {
      if (media.paused) {
        // Guarantee media element is aligned with timeline playhead before starting
        if (Math.abs(media.currentTime - currentTime) > 0.05) {
          try {
            media.currentTime = currentTime;
          } catch (err) {
            console.warn('Sync media currentTime before play error:', err);
          }
        }
        if (media.currentTime >= (media.duration || duration || 0) - 0.05) {
          media.currentTime = 0;
          set({ currentTime: 0 });
        }
        const playPromise = media.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              set({ isPlaying: true });
            })
            .catch((err) => {
              console.warn('Direct media playback play() error:', err);
              if (err.name === 'NotAllowedError') {
                media.muted = true;
                set({ isMuted: true, isPlaying: true });
                media.play().catch(() => {});
              }
            });
        }
        set({ isPlaying: true });
      } else {
        media.pause();
        set({ isPlaying: false });
      }
    } else {
      // Software playback mode (no videoUrl loaded, previews timings)
      set({ isPlaying: !isPlaying });
    }
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setAspectRatio: (aspectRatio) => {
    set({ aspectRatio });
    get().triggerAutoSave();
  },
  toggleSafeZones: () => set((state) => ({ showSafeZones: !state.showSafeZones })),
  setUploadModalOpen: (isUploadModalOpen) => set({ isUploadModalOpen }),
  setExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
  setHelpModalOpen: (isHelpModalOpen) => set({ isHelpModalOpen }),

  // Caption Segment Manipulations
  setSegments: (segments, autoEnhance = true) => {
    let finalSegments = Array.isArray(segments) ? segments : [];
    const { style, getCustomDictionary, getCustomEmphasisKeywords } = get();

    if (autoEnhance && finalSegments.length > 0) {
      const customDict = typeof getCustomDictionary === 'function' ? getCustomDictionary() : {};
      const customKeywords = typeof getCustomEmphasisKeywords === 'function' ? getCustomEmphasisKeywords() : [];

      if (style?.autoEmojiEnabled) {
        finalSegments = autoAssignEmojis(finalSegments, { customDictionary: customDict });
      }
      if (style?.autoEmphasisEnabled) {
        finalSegments = autoApplyEmphasis(finalSegments, { customKeywords });
      }
    }

    set({ segments: finalSegments });
    get().triggerAutoSave();
    if (!get().audioPeaks) {
      get().extractAudioWaveform();
    }
  },
  
  setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),
  setSelectedWordId: (selectedWordId) => set({ selectedWordId }),

  deleteSegment: (segmentId) => {
    get().pushHistoryState();
    set((state) => {
      const filtered = state.segments.filter((s) => s.id !== segmentId);
      return {
        segments: filtered,
        selectedSegmentId: state.selectedSegmentId === segmentId ? null : state.selectedSegmentId
      };
    });
    get().triggerAutoSave();
  },

  clearAllSegments: () => {
    const { segments } = get();
    if (!segments || segments.length === 0) return;
    get().pushHistoryState();
    set({
      segments: [],
      selectedSegmentId: null,
      selectedWordId: null
    });
  },

  setSegmentPosition: (segmentId, newStart) => {
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const dur = seg.end - seg.start;
        const delta = newStart - seg.start;
        const shiftedWords = (seg.words || []).map((w) => ({
          ...w,
          start: Math.round((w.start + delta) * 1000) / 1000,
          end: Math.round((w.end + delta) * 1000) / 1000
        }));
        return {
          ...seg,
          start: Math.round(newStart * 1000) / 1000,
          end: Math.round((newStart + dur) * 1000) / 1000,
          words: shiftedWords
        };
      });
      return { segments: updated.sort((a, b) => a.start - b.start) };
    });
  },

  moveSegment: (segmentId, deltaSeconds) => {
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const newStart = Math.max(0, seg.start + deltaSeconds);
        const dur = seg.end - seg.start;
        const actualDelta = newStart - seg.start;
        const shiftedWords = (seg.words || []).map((w) => ({
          ...w,
          start: Math.round((w.start + actualDelta) * 1000) / 1000,
          end: Math.round((w.end + actualDelta) * 1000) / 1000
        }));
        return {
          ...seg,
          start: Math.round(newStart * 1000) / 1000,
          end: Math.round((newStart + dur) * 1000) / 1000,
          words: shiftedWords
        };
      });
      return { segments: updated.sort((a, b) => a.start - b.start) };
    });
  },

  trimSegmentStart: (segmentId, newStart) => {
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const safeStart = Math.min(seg.end - 0.2, Math.max(0, newStart));
        const updatedWords = (seg.words || []).map((w) => ({
          ...w,
          start: Math.max(safeStart, Math.min(seg.end, w.start)),
          end: Math.max(safeStart, Math.min(seg.end, w.end))
        })).filter(w => (w.end - w.start) > 0.01);

        return {
          ...seg,
          start: Math.round(safeStart * 1000) / 1000,
          words: updatedWords
        };
      });
      return { segments: updated };
    });
  },

  trimSegmentEnd: (segmentId, newEnd) => {
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const safeEnd = Math.max(seg.start + 0.2, newEnd);
        const updatedWords = (seg.words || []).map((w) => ({
          ...w,
          start: Math.max(seg.start, Math.min(safeEnd, w.start)),
          end: Math.max(seg.start, Math.min(safeEnd, w.end))
        })).filter(w => (w.end - w.start) > 0.01);

        return {
          ...seg,
          end: Math.round(safeEnd * 1000) / 1000,
          words: updatedWords
        };
      });
      return { segments: updated };
    });
  },

  splitSegmentAtPlayhead: (segmentId) => {
    set((state) => {
      const segIndex = state.segments.findIndex((s) => s.id === segmentId);
      if (segIndex === -1) return state;

      const seg = state.segments[segIndex];
      const t = state.currentTime;
      if (t <= seg.start + 0.1 || t >= seg.end - 0.1) return state;

      const words1 = [];
      const words2 = [];

      for (const w of seg.words || []) {
        if (w.end <= t) {
          words1.push(w);
        } else if (w.start >= t) {
          words2.push(w);
        } else {
          // Playhead splits across an active word
          words1.push({ ...w, end: t });
          words2.push({ ...w, id: `w-${Math.random().toString(36).substring(2, 7)}`, start: t });
        }
      }

      if (words1.length === 0 || words2.length === 0) return state;

      const seg1 = {
        id: seg.id,
        start: seg.start,
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
    get().pushHistoryState();
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
    get().triggerAutoSave();
  },

  deleteWord: (segmentId, wordId) => {
    get().pushHistoryState();
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
    get().triggerAutoSave();
  },

  updateSegmentText: (segmentId, newText) => {
    const cleanText = String(newText || '').trim();
    if (!cleanText) return;
    get().pushHistoryState();
    set((state) => {

      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;

        const newTokens = cleanText.split(/\s+/).filter(Boolean);
        const segDuration = Math.max(0.1, seg.end - seg.start);

        let reflowedWords = [];
        if (Array.isArray(seg.words) && seg.words.length === newTokens.length) {
          reflowedWords = newTokens.map((token, idx) => ({
            ...seg.words[idx],
            word: token
          }));
        } else {
          const totalChars = newTokens.reduce((sum, t) => sum + Math.max(1, t.length), 0);
          let curStart = seg.start;
          reflowedWords = newTokens.map((token, idx) => {
            const weight = Math.max(1, token.length) / totalChars;
            let dur = Math.max(0.05, segDuration * weight);
            let wEnd = curStart + dur;
            if (idx === newTokens.length - 1 || wEnd > seg.end) {
              wEnd = seg.end;
            }
            const wObj = {
              id: `w-${Math.random().toString(36).substring(2, 8)}`,
              word: token,
              start: Math.round(curStart * 1000) / 1000,
              end: Math.round(wEnd * 1000) / 1000,
              confidence: 1.0
            };
            curStart = wEnd;
            return wObj;
          });
        }

        return {
          ...seg,
          text: cleanText,
          words: reflowedWords
        };
      });

      return { segments: updatedSegments };
    });
    get().triggerAutoSave();
  },

  // AI Effects & Auto-Enhancement Actions
  autoEnhanceWithAI: () => {
    const { segments, getCustomDictionary, getCustomEmphasisKeywords, style, seekTo, showStudioToast } = get();
    if (!segments || segments.length === 0) {
      if (typeof showStudioToast === 'function') {
        showStudioToast('No captions loaded yet! Import a video or add captions first.', { type: 'warning' });
      }
      return { success: false, reason: 'no_captions' };
    }
    get().pushHistoryState();

    const customDict = getCustomDictionary();
    const customEmphasis = getCustomEmphasisKeywords();

    let enhanced = autoAssignEmojis(segments, { overwrite: true, customDictionary: customDict });
    enhanced = autoApplyEmphasis(enhanced, { overwrite: true, customKeywords: customEmphasis });

    // Calculate exact enhancement statistics
    let emojiCount = 0;
    let emphasisCount = 0;
    let firstEnhancedSeg = null;

    enhanced.forEach((seg) => {
      if (seg.emoji) emojiCount++;
      (seg.words || []).forEach((w) => {
        if (w.emoji) emojiCount++;
        if (w.isEmphasized) {
          emphasisCount++;
          if (!firstEnhancedSeg) firstEnhancedSeg = seg;
        }
      });
      if (!firstEnhancedSeg && seg.emoji) firstEnhancedSeg = seg;
    });

    set({
      segments: enhanced,
      style: {
        ...style,
        autoEmojiEnabled: true,
        autoEmphasisEnabled: true,
        emphasisMode: 'always', // Guarantees highlighted words stay illuminated during paused viewing and playback
        emphasisColor: style.emphasisColor || '#00FF66'
      }
    });

    // Jump playhead to the first enhanced segment so the user immediately sees the visual change!
    if (firstEnhancedSeg && typeof seekTo === 'function') {
      seekTo(firstEnhancedSeg.start);
    }

    const toastMsg = `✨ Auto-Enhanced ${enhanced.length} captions with ${emojiCount} viral emojis & ${emphasisCount} hook words!`;
    if (typeof showStudioToast === 'function') {
      showStudioToast(toastMsg, { type: 'success' });
    }

    return {
      success: true,
      segmentCount: enhanced.length,
      emojiCount,
      emphasisCount
    };
  },

  // Keyword & Apple Emoji Library State
  isKeywordLibraryModalOpen: false,
  customKeywordRules: loadCustomKeywordRulesFromStorage(),

  setKeywordLibraryModalOpen: (isOpen) => set({ isKeywordLibraryModalOpen: isOpen }),

  getCustomDictionary: () => {
    const rules = get().customKeywordRules || [];
    const dict = {};
    for (const r of rules) {
      if (r.keyword && r.emoji) {
        const clean = String(r.keyword).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean) dict[clean] = r.emoji;
      }
    }
    return dict;
  },

  getCustomEmphasisKeywords: () => {
    const rules = get().customKeywordRules || [];
    return rules
      .filter(r => r.isEmphasized)
      .map(r => String(r.keyword).toLowerCase().replace(/[^a-z0-9$%]/g, ''))
      .filter(Boolean);
  },

  addKeywordRule: ({ keyword, emoji, isEmphasized = true }) => {
    if (!keyword || !keyword.trim()) return;
    const cleanKw = keyword.trim();
    const newRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      keyword: cleanKw,
      emoji: emoji || null,
      isEmphasized: Boolean(isEmphasized)
    };

    set((state) => {
      const existingIdx = state.customKeywordRules.findIndex(
        r => r.keyword.toLowerCase() === cleanKw.toLowerCase()
      );
      let updated;
      if (existingIdx !== -1) {
        updated = [...state.customKeywordRules];
        updated[existingIdx] = { ...updated[existingIdx], ...newRule };
      } else {
        updated = [newRule, ...state.customKeywordRules];
      }
      saveCustomKeywordRulesToStorage(updated);
      return { customKeywordRules: updated };
    });
    get().triggerAutoSave();
  },

  deleteKeywordRule: (ruleId) => {
    set((state) => {
      const updated = state.customKeywordRules.filter(r => r.id !== ruleId);
      saveCustomKeywordRulesToStorage(updated);
      return { customKeywordRules: updated };
    });
    get().triggerAutoSave();
  },

  toggleRuleEmphasis: (ruleId) => {
    set((state) => {
      const updated = state.customKeywordRules.map(r => {
        if (r.id !== ruleId) return r;
        return { ...r, isEmphasized: !r.isEmphasized };
      });
      saveCustomKeywordRulesToStorage(updated);
      return { customKeywordRules: updated };
    });
    get().triggerAutoSave();
  },

  setRuleEmoji: (ruleId, emoji) => {
    set((state) => {
      const updated = state.customKeywordRules.map(r => {
        if (r.id !== ruleId) return r;
        return { ...r, emoji: emoji || null };
      });
      saveCustomKeywordRulesToStorage(updated);
      return { customKeywordRules: updated };
    });
    get().triggerAutoSave();
  },

  applyKeywordRulesToCaptions: () => {
    const { segments, getCustomDictionary, getCustomEmphasisKeywords, style, showStudioToast } = get();
    if (!segments || segments.length === 0) return;
    get().pushHistoryState();

    const customDict = getCustomDictionary();
    const customEmphasis = getCustomEmphasisKeywords();

    let enhanced = autoAssignEmojis(segments, { overwrite: true, customDictionary: customDict, onlyCustom: true });
    enhanced = autoApplyEmphasis(enhanced, { overwrite: true, customKeywords: customEmphasis, onlyCustom: true });

    let emojiCount = 0;
    let emphasisCount = 0;
    enhanced.forEach((seg) => {
      (seg.words || []).forEach((w) => {
        if (w.emoji) emojiCount++;
        if (w.isEmphasized) emphasisCount++;
      });
    });

    set({
      segments: enhanced,
      style: {
        ...style,
        autoEmojiEnabled: true,
        autoEmphasisEnabled: true
      }
    });
    get().triggerAutoSave();

    if (typeof showStudioToast === 'function') {
      if (emojiCount > 0 || emphasisCount > 0) {
        showStudioToast(`✨ Applied Keyword Library: ${emojiCount} custom emojis & ${emphasisCount} punch words!`, { type: 'success' });
      } else {
        showStudioToast('Keyword rules updated (no matching words found in current video transcript).', { type: 'info' });
      }
    }
  },

  clearCustomKeywordRules: () => {
    set({ customKeywordRules: [] });
    saveCustomKeywordRulesToStorage([]);
    get().triggerAutoSave();
  },

  toggleWordEmphasis: (segmentId, wordId) => {
    get().pushHistoryState();
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const updatedWords = (seg.words || []).map((w) => {
          if (w.id !== wordId) return w;
          const currentEmphasis = w.isEmphasized !== undefined ? Boolean(w.isEmphasized) : isPowerKeyword(w.word, get().getCustomEmphasisKeywords());
          return { ...w, isEmphasized: !currentEmphasis };
        });
        return { ...seg, words: updatedWords };
      });
      return { segments: updated };
    });
    get().triggerAutoSave();
  },

  setWordEmoji: (segmentId, wordId, emoji) => {
    get().pushHistoryState();
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        let segEmoji = seg.emoji;
        const updatedWords = (seg.words || []).map((w) => {
          if (w.id !== wordId) return w;
          if (emoji && !segEmoji) segEmoji = emoji;
          return { ...w, emoji: emoji || null };
        });
        return { ...seg, emoji: segEmoji, words: updatedWords };
      });
      return { segments: updated };
    });
    get().triggerAutoSave();
  },

  setSegmentEmoji: (segmentId, emoji) => {
    get().pushHistoryState();
    set((state) => {
      const updated = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        return { ...seg, emoji: emoji || null };
      });
      return { segments: updated };
    });
  },

  mergeSegmentWithNext: (segmentId) => {
    get().pushHistoryState();
    set((state) => {
      const index = state.segments.findIndex(s => s.id === segmentId);
      if (index === -1 || index >= state.segments.length - 1) return state;

      const seg1 = state.segments[index];
      const seg2 = state.segments[index + 1];

      const combinedWords = [...(seg1.words || []), ...(seg2.words || [])]
        .sort((a, b) => a.start - b.start);
      const text = combinedWords.map(w => (w.word || '').trim()).join(' ');

      const merged = {
        id: seg1.id,
        start: seg1.start,
        end: seg2.end,
        text,
        words: combinedWords
      };

      const newSegments = [...state.segments];
      newSegments.splice(index, 2, merged);
      return { segments: newSegments, selectedSegmentId: merged.id };
    });
  },

  duplicateSegment: (segmentId) => {
    get().pushHistoryState();
    set((state) => {
      const index = state.segments.findIndex(s => s.id === segmentId);
      if (index === -1) return state;

      const seg = state.segments[index];
      const dur = seg.end - seg.start;
      const newStart = seg.end + 0.1;
      const newEnd = newStart + dur;

      const shiftedWords = (seg.words || []).map(w => {
        const delta = newStart - seg.start;
        return {
          ...w,
          id: `w-${Math.random().toString(36).substring(2, 8)}`,
          start: Math.round((w.start + delta) * 1000) / 1000,
          end: Math.round((w.end + delta) * 1000) / 1000
        };
      });

      const newSeg = {
        id: `seg-${Math.random().toString(36).substring(2, 9)}`,
        start: Math.round(newStart * 1000) / 1000,
        end: Math.round(newEnd * 1000) / 1000,
        text: seg.text,
        words: shiftedWords
      };

      const newSegments = [...state.segments, newSeg].sort((a, b) => a.start - b.start);
      return { segments: newSegments, selectedSegmentId: newSeg.id };
    });
  },

  updateWordTimestamp: (segmentId, wordId, newStart, newEnd) => {
    set((state) => {
      const updatedSegments = state.segments.map((seg) => {
        if (seg.id !== segmentId) return seg;

        const updatedWords = seg.words.map((w) => {
          if (w.id !== wordId) return w;
          return {
            ...w,
            start: Math.round(newStart * 1000) / 1000,
            end: Math.round(newEnd * 1000) / 1000
          };
        }).sort((a, b) => a.start - b.start);

        const segStart = updatedWords.length > 0 ? updatedWords[0].start : seg.start;
        const segEnd = updatedWords.length > 0 ? updatedWords[updatedWords.length - 1].end : seg.end;

        return {
          ...seg,
          start: segStart,
          end: segEnd,
          words: updatedWords
        };
      });

      return { segments: updatedSegments.sort((a, b) => a.start - b.start) };
    });
  },

  applyPreset: (presetId) => {
    const found = PRESETS.find((p) => p.id === presetId);
    if (found) {
      const newStyle = sanitizeStyle(found.style);
      const prevMax = get().style.maxWordsPerSegment || 3;
      set({
        activePresetId: presetId,
        style: newStyle
      });
      get().triggerAutoSave();
      if (newStyle.maxWordsPerSegment && newStyle.maxWordsPerSegment !== prevMax) {
        get().rechunkSegments(newStyle.maxWordsPerSegment);
      }
    }
  },

  updateStyle: (partialStyle) => {
    const prevMax = get().style.maxWordsPerSegment || 3;
    set((state) => ({
      style: sanitizeStyle({ ...state.style, ...partialStyle })
    }));
    get().triggerAutoSave();

    if (partialStyle.maxWordsPerSegment !== undefined && Number(partialStyle.maxWordsPerSegment) !== prevMax) {
      get().rechunkSegments(Number(partialStyle.maxWordsPerSegment));
    }
  },

  rechunkSegments: (maxWords = 3) => {
    const { segments, removePunctuation } = get();
    if (!segments || segments.length === 0) return;

    get().pushHistoryState();
    const allWords = extractAllWords(segments, removePunctuation);
    if (allWords.length === 0) return;

    const newSegments = chunkWordsIntoSegments(allWords, maxWords, 1.0, removePunctuation);
    set({
      segments: newSegments,
      selectedSegmentId: newSegments.length > 0 ? newSegments[0].id : null,
      selectedWordId: null
    });
  },

  stripAllPunctuation: () => {
    const { segments } = get();
    if (!segments || segments.length === 0) return;
    get().pushHistoryState();
    const cleaned = stripPunctuationFromSegments(segments);
    set({
      segments: cleaned,
      removePunctuation: true
    });
  },

  fetchModelsStatus: async () => {
    try {
      set({ modelsLoading: true });
      const res = await fetch('http://127.0.0.1:8000/api/models');
      if (res.ok) {
        const data = await res.json();
        set({
          modelsData: {
            cache_dir: data.cache_dir,
            models: data.models || []
          }
        });
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      set({ modelsLoading: false });
    }
    return null;
  },

  downloadModel: async (modelName) => {
    try {
      set((state) => ({
        modelDownloadStates: {
          ...state.modelDownloadStates,
          [modelName]: { status: 'downloading', percent: 1, downloaded_mb: '0 MB' }
        }
      }));

      const res = await fetch('http://127.0.0.1:8000/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
      });

      if (!res.ok) {
        throw new Error('Download request failed');
      }

      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`http://127.0.0.1:8000/api/models/download-progress/${modelName}`);
          if (pollRes.ok) {
            const statusData = await pollRes.json();
            set((state) => ({
              modelDownloadStates: {
                ...state.modelDownloadStates,
                [modelName]: statusData
              }
            }));

            if (statusData.status === 'completed' || statusData.status === 'error') {
              clearInterval(pollInterval);
              get().fetchModelsStatus();
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 500);
    } catch (err) {
      set((state) => ({
        modelDownloadStates: {
          ...state.modelDownloadStates,
          [modelName]: { status: 'error', percent: 0, error: err.message }
        }
      }));
    }
  },

  ensureModelDownloaded: async (modelName, onProgress) => {
    const statusData = await get().fetchModelsStatus();
    const currentModels = statusData?.models || get().modelsData?.models || [];
    const modelInfo = currentModels.find((m) => m.id === modelName);
    if (modelInfo && modelInfo.is_downloaded) {
      return true;
    }

    await get().downloadModel(modelName);

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const stateObj = get().modelDownloadStates[modelName];
        if (stateObj) {
          if (onProgress) {
            onProgress(stateObj);
          }
          if (stateObj.status === 'completed') {
            clearInterval(checkInterval);
            await get().fetchModelsStatus();
            resolve(true);
          } else if (stateObj.status === 'error') {
            clearInterval(checkInterval);
            reject(new Error(stateObj.error || `Download failed for model ${modelName}`));
          }
        }
      }, 500);
    });
  },

  deleteModel: async (modelName) => {
    try {
      set({ modelsLoading: true });
      const res = await fetch(`http://127.0.0.1:8000/api/models/${modelName}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        set({
          modelsData: {
            cache_dir: data.cache_dir,
            models: data.models
          },
          modelDownloadStates: {
            ...get().modelDownloadStates,
            [modelName]: { status: 'idle', error: null }
          }
        });
      }
    } catch (err) {
      console.error('Failed to delete model:', err);
    } finally {
      set({ modelsLoading: false });
    }
  },

  fetchDependenciesStatus: async (checkPypi = false) => {
    try {
      set({ dependenciesLoading: true });
      const url = checkPypi 
        ? 'http://127.0.0.1:8000/api/dependencies/check-updates' 
        : 'http://127.0.0.1:8000/api/dependencies/status';
      const method = checkPypi ? 'POST' : 'GET';
      const res = await fetch(url, { method });
      if (res.ok) {
        const data = await res.json();

        // Preserve previously known latest_version and recompute update_available
        const prevPackages = get().dependenciesData?.packages || [];
        const prevMap = new Map(prevPackages.map(p => [p.id, p]));

        const mergedPackages = (data.packages || []).map(pkg => {
          const prev = prevMap.get(pkg.id);
          const latest_version = pkg.latest_version || prev?.latest_version || null;
          let update_available = pkg.update_available;

          if (latest_version && pkg.installed_version && pkg.is_installed) {
            const cleanInstalled = pkg.installed_version.split('+')[0].replace('v', '').trim();
            const cleanLatest = latest_version.split('+')[0].replace('v', '').trim();
            if (cleanInstalled === cleanLatest) {
              update_available = false;
            } else {
              update_available = prev?.update_available || pkg.update_available || (cleanLatest > cleanInstalled);
            }
          }

          return {
            ...pkg,
            latest_version,
            update_available
          };
        });

        const mergedData = {
          ...data,
          packages: mergedPackages
        };

        set({ dependenciesData: mergedData, vocalModelsData: data.vocal_models || [] });
        return mergedData;
      }
    } catch (err) {
      console.error('Failed to fetch dependencies:', err);
    } finally {
      set({ dependenciesLoading: false });
    }
    return null;
  },

  installDependency: async (packageId) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dependencies/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId })
      });
      if (res.ok) {
        const { task_id } = await res.json();
        get().trackDependencyTask(task_id);
        return task_id;
      }
    } catch (err) {
      console.error('Install request failed:', err);
    }
  },

  uninstallDependency: async (packageId) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dependencies/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId })
      });
      if (res.ok) {
        const { task_id } = await res.json();
        get().trackDependencyTask(task_id);
        return task_id;
      }
    } catch (err) {
      console.error('Uninstall request failed:', err);
    }
  },

  trackDependencyTask: (taskId) => {
    set({ activeInstallTask: { id: taskId, status: 'running', percent: 10, logs: ['Starting background task...'] } });
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/dependencies/task/${taskId}`);
        if (res.ok) {
          const task = await res.json();
          set({ activeInstallTask: task });
          if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            clearInterval(pollInterval);
            get().fetchDependenciesStatus(false);
            get().fetchVocalModelsStatus();
          }
        } else {
          clearInterval(pollInterval);
        }
      } catch {
        // ignore intermittent connection issues
      }
    }, 750);
  },

  cancelDependencyTask: async (taskId) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/dependencies/task/${taskId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  },

  fetchCacheInfo: async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dependencies/cache-info');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Failed to fetch cache info:', err);
    }
    return null;
  },

  cleanDependenciesCache: async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dependencies/clean-cache', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.error('Failed to clean cache:', err);
    }
    return { success: false, message: 'Failed to clean cache' };
  },

  dismissDependencyTask: () => set({ activeInstallTask: null }),

  fetchVocalModelsStatus: async () => {
    try {
      set({ vocalModelsLoading: true });
      const res = await fetch('http://127.0.0.1:8000/api/vocal-models/status');
      if (res.ok) {
        const data = await res.json();
        set({ vocalModelsData: data.models || [] });
        return data.models;
      }
    } catch (err) {
      console.error('Failed to fetch vocal models:', err);
    } finally {
      set({ vocalModelsLoading: false });
    }
    return [];
  },

  downloadVocalModel: async (modelId) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/vocal-models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId })
      });
      if (res.ok) {
        const { task_id } = await res.json();
        get().trackDependencyTask(task_id);
      }
    } catch (err) {
      console.error('Failed to trigger vocal model download:', err);
    }
  },

  deleteVocalModel: async (modelId) => {
    try {
      set({ vocalModelsLoading: true });
      const res = await fetch(`http://127.0.0.1:8000/api/vocal-models/${modelId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        set({ vocalModelsData: data.models || [] });
      }
    } catch (err) {
      console.error('Failed to delete vocal model:', err);
    } finally {
      set({ vocalModelsLoading: false });
    }
  },

  loadDemoData: async () => {
    const localDemoAudioUrl = 'http://127.0.0.1:8000/static/demo/demo_audio.wav';
    const fallbackAudioUrl = 'http://127.0.0.1:8000/static/demo/demo_audio.wav';
    
    let chosenUrl = localDemoAudioUrl;
    try {
      const check = await fetch(localDemoAudioUrl, { method: 'HEAD' });
      if (!check.ok) chosenUrl = fallbackAudioUrl;
    } catch (_) {
      chosenUrl = fallbackAudioUrl;
    }

    set({
      videoFile: null,
      videoUrl: chosenUrl,
      videoFilename: 'demo_audio.wav',
      duration: 14.52,
      currentTime: 0.0,
      isPlaying: false,
      isMuted: false,
      volume: 1.0,
      segments: DEMO_SEGMENTS,
      activePresetId: 'hormozi',
      style: sanitizeStyle(PRESETS[0].style),
      audioPeaks: null
    });
    get().extractAudioWaveform();
  }
}));
