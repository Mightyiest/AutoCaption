import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Layers, 
  Upload, 
  Download, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Film, 
  Play, 
  Pause, 
  Trash2, 
  RotateCcw, 
  FileArchive, 
  ExternalLink, 
  Check, 
  Sparkles, 
  Cpu, 
  Settings2, 
  ChevronRight, 
  FolderPlus, 
  Folder,
  Plus,
  Eye, 
  Zap,
  Clock,
  HardDrive,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Sliders,
  MonitorPlay,
  ListVideo,
  BookOpen,
  Search,
  CheckSquare,
  Square,
  Edit3
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { PRESETS, getPresetById, sanitizeStyle } from '../engine/presets';
import { extractAllWords, chunkWordsIntoSegments } from '../engine/wordChunker';
import { autoAssignEmojis } from '../engine/emojiEngine';
import { autoApplyEmphasis } from '../engine/emphasisEngine';
import { measureAllSegmentsLayout } from '../engine/layoutMeasurer';
import { browseLocalFile, getStreamUrl } from '../engine/mediaLinker';
import { ClientSceneExporter } from '../engine/sceneExporter';
import { renderPreviewOverlay } from '../engine/captionCanvasRenderer';
import { createCaptionScene } from '../engine/captionScene';

const BACKEND_URL = 'http://127.0.0.1:8000';

const RESOLUTION_OPTIONS = [
  { id: 'original', label: 'Match Source (Native)', sub: 'Keep source aspect & resolution' },
  { id: '1080x1920', label: '9:16 Vertical (1080×1920)', sub: 'Shorts, Reels, TikTok' },
  { id: '1920x1080', label: '16:9 Landscape (1920×1080)', sub: 'YouTube, Wide Screen' },
  { id: '1080x1080', label: '1:1 Square (1080×1080)', sub: 'Instagram Feed' },
  { id: '1080x1350', label: '4:5 Portrait (1080×1350)', sub: 'Instagram Portrait' }
];

const WHISPER_MODELS = [
  { id: 'tiny', name: 'Tiny', badge: 'Fastest (32x)', size: '~75 MB' },
  { id: 'base', name: 'Base (Recommended)', badge: 'Balanced (16x)', size: '~145 MB' },
  { id: 'small', name: 'Small', badge: 'High Quality (6x)', size: '~480 MB' },
  { id: 'medium', name: 'Medium', badge: 'Ultra Accurate (2x)', size: '~1.5 GB' },
  { id: 'large-v3', name: 'Large v3', badge: 'Studio Grade (1x)', size: '~3.1 GB' }
];

const LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Auto-Detect Spoken Language' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' }
];

const PREVIEW_SAMPLE_PHRASES = [
  { text: 'THIS IS INSANE', activeIdx: 2, emoji: '🤯' },
  { text: 'VIRAL HOOK DROP', activeIdx: 1, emoji: '🔥' },
  { text: 'MAKE MASSIVE MONEY', activeIdx: 2, emoji: '💰' },
  { text: 'UNSTOPPABLE SPEED', activeIdx: 0, emoji: '⚡' }
];

export const BatchExportModal = () => {
  const {
    isBatchModalOpen,
    setBatchModalOpen,
    backendAvailable,
    createNewProject,
    loadProject,
    setSegments,
    setStyle,
    batchQueue,
    setBatchQueue,
    batchGlobalSettings,
    setBatchGlobalSettings,
    autoCreateProjectForBatchItem,
    syncBatchItemToProject,
    addProjectsToBatchQueue,
    projectsList,
    fetchProjectsList,
    setCurrentView
  } = useEditorStore();

  // Local alias for queue & settings synced with Zustand store
  const queue = batchQueue || [];
  const setQueue = (updater) => {
    if (typeof updater === 'function') {
      setBatchQueue(updater(useEditorStore.getState().batchQueue || []));
    } else {
      setBatchQueue(updater);
    }
  };

  const globalSettings = batchGlobalSettings;
  const setGlobalSettings = setBatchGlobalSettings;

  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [activeTab, setActiveTab] = useState('preset'); // 'preset' | 'ai' | 'export'
  const [samplePhraseIdx, setSamplePhraseIdx] = useState(0);

  // Existing Projects Picker Modal State
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [selectedProjectPickerIds, setSelectedProjectPickerIds] = useState(new Set());

  // Live Video Previewer Player State
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(10);
  const [previewMuted, setPreviewMuted] = useState(true);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const clientExporterRef = useRef(null);
  const activeJobIdRef = useRef(null);

  // Preview Video & Canvas Refs
  const previewVideoRef = useRef(null);
  const previewCanvasRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Refresh projects list when modal opens
  useEffect(() => {
    if (isBatchModalOpen) {
      fetchProjectsList();
    }
  }, [isBatchModalOpen]);

  // Auto-sync batch queue items with any edits made in the main editor or projects database
  useEffect(() => {
    if (!isBatchModalOpen || queue.length === 0) return;

    const { activeProjectId, segments: currentEditorSegments, style: currentEditorStyle } = useEditorStore.getState();

    let hasChanges = false;
    const updatedQueue = queue.map((item) => {
      // 1. If item corresponds to currently active editor project, sync live store state
      if (item.projectId && item.projectId === activeProjectId && currentEditorSegments && currentEditorSegments.length > 0) {
        if (item.segments !== currentEditorSegments || item.style !== currentEditorStyle) {
          hasChanges = true;
          return {
            ...item,
            segments: currentEditorSegments,
            style: currentEditorStyle ? sanitizeStyle(currentEditorStyle) : item.style,
            stageText: `Project captions updated (${currentEditorSegments.length} blocks)`
          };
        }
      }
      // 2. Or sync with updated projectsList from database
      if (item.projectId && projectsList && projectsList.length > 0) {
        const p = projectsList.find((proj) => proj.id === item.projectId);
        if (p && p.segments && p.segments.length > 0 && p.segments !== item.segments) {
          hasChanges = true;
          return {
            ...item,
            projectTitle: p.title || item.projectTitle,
            segments: p.segments,
            style: p.style ? sanitizeStyle(p.style) : item.style,
            duration: p.duration || item.duration,
            thumbnail: p.thumbnailUrl || item.thumbnail,
            stageText: `Project captions updated (${p.segments.length} blocks)`
          };
        }
      }
      return item;
    });

    if (hasChanges) {
      setBatchQueue(updatedQueue);
    }
  }, [isBatchModalOpen, projectsList]);

  // Selected item object
  const selectedItem = queue.find((i) => i.id === selectedQueueId) || (queue.length > 0 ? queue[0] : null);

  // Auto-select first item when queue loads
  useEffect(() => {
    if (queue.length > 0 && !selectedQueueId) {
      setSelectedQueueId(queue[0].id);
    }
  }, [queue, selectedQueueId]);

  // Resolve effective subtitle style for an item (prefers custom project style if preserveProjectStyles is true)
  const getEffectiveStyleForItem = useCallback((item, settings = globalSettings) => {
    if (!item) {
      const preset = getPresetById(settings.presetId) || PRESETS[0];
      return sanitizeStyle({
        ...preset.style,
        positionY: settings.positionY,
        fontSize: Math.round(preset.style.fontSize * (settings.fontSizeMultiplier || 1.0)),
        autoEmojiEnabled: settings.autoEmojiEnabled,
        autoEmphasisEnabled: settings.autoEmphasisEnabled
      });
    }

    const shouldPreserve = settings.preserveProjectStyles !== false;
    // If the item has its own project style and preserveProjectStyles is ON
    if (shouldPreserve && item.style) {
      return sanitizeStyle(item.style);
    }

    // Otherwise compile from the item's preset or the global settings preset
    const presetId = (!shouldPreserve ? settings.presetId : (item.presetId || settings.presetId));
    const selectedPreset = getPresetById(presetId) || PRESETS[0];
    return sanitizeStyle({
      ...selectedPreset.style,
      positionY: settings.positionY,
      fontSize: Math.round(selectedPreset.style.fontSize * (settings.fontSizeMultiplier || 1.0)),
      autoEmojiEnabled: settings.autoEmojiEnabled,
      autoEmphasisEnabled: settings.autoEmphasisEnabled
    });
  }, [globalSettings]);

  // Live Subtitle Overlay Render Loop on Preview Canvas
  const updatePreviewCanvas = useCallback(() => {
    if (!previewCanvasRef.current || !selectedItem) return;
    const canvas = previewCanvasRef.current;
    const video = previewVideoRef.current;
    const curTime = video ? video.currentTime : previewTime;

    const finalStyle = getEffectiveStyleForItem(selectedItem, globalSettings);

    const w = canvas.width || 1080;
    const h = canvas.height || 1920;

    // Use transcribed segments if available, otherwise generate dynamic preview segments
    let segmentsToRender = selectedItem.segments;
    if (!segmentsToRender || segmentsToRender.length === 0) {
      const phrase = PREVIEW_SAMPLE_PHRASES[samplePhraseIdx];
      const wordsArr = phrase.text.split(' ');
      const dur = selectedItem.duration || 10;
      const segDur = 2.4;
      const segStart = Math.min(Math.max(0, curTime - (curTime % segDur)), Math.max(0, dur - segDur));
      const wordDur = segDur / wordsArr.length;

      segmentsToRender = [{
        id: 'preview-sample-seg',
        start: segStart,
        end: segStart + segDur,
        text: phrase.text,
        emoji: phrase.emoji,
        words: wordsArr.map((w, wIdx) => ({
          id: `w-${wIdx}`,
          word: w,
          start: segStart + wIdx * wordDur,
          end: segStart + (wIdx + 1) * wordDur,
          confidence: 0.99,
          emoji: wIdx === phrase.activeIdx ? phrase.emoji : null,
          isEmphasized: wIdx === phrase.activeIdx
        }))
      }];
    }

    const scene = createCaptionScene({
      style: finalStyle,
      segments: segmentsToRender,
      canvasWidth: w,
      canvasHeight: h,
      scaleFactor: w / 1080
    });

    renderPreviewOverlay({
      canvas,
      scene,
      currentTime: curTime,
      isPlaying: isPreviewPlaying
    });
  }, [selectedItem, previewTime, isPreviewPlaying, globalSettings, samplePhraseIdx]);

  // Run preview animation frame loop
  useEffect(() => {
    let animId;
    const loop = () => {
      updatePreviewCanvas();
      if (isPreviewPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };
    if (isPreviewPlaying) {
      animId = requestAnimationFrame(loop);
    } else {
      updatePreviewCanvas();
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPreviewPlaying, updatePreviewCanvas]);

  if (!isBatchModalOpen) return null;

  // Format Helpers
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Extract video duration, dimensions & thumbnail from File or URL
  const extractVideoMetadata = (fileOrUrl) => {
    return new Promise((resolve) => {
      try {
        const isFile = (typeof File !== 'undefined' && fileOrUrl instanceof File) || (typeof Blob !== 'undefined' && fileOrUrl instanceof Blob);
        const url = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'metadata';
        video.src = url;

        const cleanUp = () => {
          if (isFile) {
            try { URL.revokeObjectURL(url); } catch (_) {}
          }
        };

        const timeout = setTimeout(() => {
          cleanUp();
          resolve({ duration: 10, width: 1080, height: 1920, fps: 30, thumbnail: null, blobUrl: url });
        }, 6000);

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, video.duration / 2);
        };

        video.onseeked = () => {
          clearTimeout(timeout);
          let thumbnail = null;
          try {
            const canvas = document.createElement('canvas');
            const w = Math.min(320, video.videoWidth || 320);
            const aspect = (video.videoHeight || 568) / (video.videoWidth || 320);
            const h = Math.round(w * aspect);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            }
          } catch (e) {
            // Ignore canvas taint
          }
          const dur = video.duration || 10;
          const vw = video.videoWidth || 1080;
          const vh = video.videoHeight || 1920;
          cleanUp();
          resolve({
            duration: dur,
            width: vw,
            height: vh,
            fps: 30,
            thumbnail,
            blobUrl: isFile ? URL.createObjectURL(fileOrUrl) : url
          });
        };

        video.onerror = () => {
          clearTimeout(timeout);
          cleanUp();
          resolve({ duration: 10, width: 1080, height: 1920, fps: 30, thumbnail: null, blobUrl: url });
        };
      } catch (e) {
        resolve({ duration: 10, width: 1080, height: 1920, fps: 30, thumbnail: null, blobUrl: null });
      }
    });
  };

  // Add files to queue and auto-create individual projects for each video
  const handleAddFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const newItems = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|mkv|webm|avi|m4v)$/i)) {
        continue;
      }
      const meta = await extractVideoMetadata(file);
      
      // Auto-create persistent individual project record
      const newProj = await autoCreateProjectForBatchItem({
        file,
        filename: file.name,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        presetId: globalSettings.presetId,
        thumbnail: meta.thumbnail
      });

      newItems.push({
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId: newProj ? newProj.id : null,
        projectTitle: newProj ? newProj.title : file.name.replace(/\.[^/.]+$/, ''),
        file: file,
        linkedPath: null,
        videoUrl: meta.blobUrl,
        name: file.name,
        size: file.size,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        thumbnail: meta.thumbnail,
        status: 'pending',
        progress: 0,
        stageText: 'Project created (Queued)',
        error: null,
        segments: [],
        jobId: null,
        exportUrl: null,
        exportBlob: null,
        exportFilename: null
      });
    }

    setQueue((prev) => {
      const updated = [...prev, ...newItems];
      if (!selectedQueueId && updated.length > 0) {
        setSelectedQueueId(updated[0].id);
      }
      return updated;
    });
  };

  // Link local media file and auto-create project
  const handleLinkLocalFile = async () => {
    try {
      const res = await browseLocalFile();
      if (res.cancelled || !res.filePath) return;
      const meta = await extractVideoMetadata(res.filePath);

      const newProj = await autoCreateProjectForBatchItem({
        file: null,
        linkedPath: res.filePath,
        filename: res.filename,
        duration: meta.duration,
        width: meta.width || res.width || 1080,
        height: meta.height || res.height || 1920,
        presetId: globalSettings.presetId,
        thumbnail: meta.thumbnail
      });

      const newItem = {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId: newProj ? newProj.id : null,
        projectTitle: newProj ? newProj.title : res.filename.replace(/\.[^/.]+$/, ''),
        file: null,
        linkedPath: res.filePath,
        videoUrl: `${BACKEND_URL}/api/media/stream?path=${encodeURIComponent(res.filePath)}`,
        name: res.filename,
        size: 0,
        duration: meta.duration,
        width: meta.width || res.width || 1080,
        height: meta.height || res.height || 1920,
        fps: 30,
        thumbnail: meta.thumbnail,
        status: 'pending',
        progress: 0,
        stageText: 'Project created (Queued)',
        error: null,
        segments: [],
        jobId: null,
        exportUrl: null,
        exportBlob: null,
        exportFilename: null
      };
      setQueue((prev) => {
        const updated = [...prev, newItem];
        if (!selectedQueueId) setSelectedQueueId(newItem.id);
        return updated;
      });
    } catch (e) {
      console.error('Failed to link local file for batch:', e);
    }
  };

  // Handle Importing from Existing Projects Modal
  const handleImportSelectedProjects = () => {
    const projectsToQueue = projectsList.filter((p) => selectedProjectPickerIds.has(p.id));
    if (projectsToQueue.length > 0) {
      addProjectsToBatchQueue(projectsToQueue);
      setSelectedProjectPickerIds(new Set());
      setIsProjectPickerOpen(false);
    }
  };

  // Toggle selection in project picker
  const toggleProjectSelection = (projectId) => {
    setSelectedProjectPickerIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const selectAllProjects = () => {
    const available = projectsList
      .filter((p) => !queue.some((q) => q.projectId === p.id))
      .map((p) => p.id);
    setSelectedProjectPickerIds(new Set(available));
  };

  const deselectAllProjects = () => {
    setSelectedProjectPickerIds(new Set());
  };

  // Remove item from queue
  const handleRemoveItem = (id) => {
    if (isProcessing) {
      const active = queue.find((item) => item.id === id);
      if (active && ['uploading', 'transcribing', 'chunking', 'rendering'].includes(active.status)) {
        return;
      }
    }
    setQueue((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (selectedQueueId === id) {
        setSelectedQueueId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  // Clear completed items
  const handleClearCompleted = () => {
    setQueue((prev) => {
      const updated = prev.filter((item) => item.status !== 'completed');
      if (selectedQueueId && !updated.find((i) => i.id === selectedQueueId)) {
        setSelectedQueueId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  // Clear all
  const handleClearAll = () => {
    if (isProcessing) return;
    setQueue([]);
    setSelectedQueueId(null);
  };

  // Retry item
  const handleRetryItem = (id) => {
    setQueue((prev) => prev.map((item) => {
      if (item.id === id) {
        return { ...item, status: 'pending', progress: 0, stageText: 'Pending', error: null };
      }
      return item;
    }));
  };

  // Robust Stop / Cancel Batch
  const handleCancelBatch = () => {
    isCancelledRef.current = true;
    
    // 1. Cancel active client canvas exporter if running
    if (clientExporterRef.current) {
      try {
        clientExporterRef.current.cancel();
      } catch (e) {
        console.warn('Client exporter cancel error:', e);
      }
      clientExporterRef.current = null;
    }

    // 2. Clear render progress polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // 3. Cancel active backend render process if any
    const activeItem = queue.find((i) => i.jobId && ['uploading', 'transcribing', 'chunking', 'rendering'].includes(i.status));
    const activeJobId = activeItem?.jobId || activeJobIdRef.current;
    if (activeJobId) {
      fetch(`${BACKEND_URL}/api/render-cancel/${activeJobId}`, { method: 'POST' }).catch(() => {});
      activeJobIdRef.current = null;
    }

    // 4. Immediately reset all active & processing items back to clean status with zero freeze
    setQueue((prev) => prev.map((it) => {
      if (['uploading', 'transcribing', 'chunking', 'rendering'].includes(it.status)) {
        return { ...it, status: 'pending', stageText: 'Cancelled', progress: 0 };
      }
      return it;
    }));

    setIsProcessing(false);
    setIsPaused(false);
  };

  // Start Batch Execution Pipeline
  const startBatchProcessing = async () => {
    if (queue.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setIsPaused(false);
    isCancelledRef.current = false;
    isPausedRef.current = false;

    const selectedPreset = getPresetById(globalSettings.presetId) || PRESETS[0];

    for (let i = 0; i < queue.length; i++) {
      if (isCancelledRef.current) break;

      // Handle pause
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }
      if (isCancelledRef.current) break;

      const item = queue[i];
      if (item.status === 'completed') continue;

      const itemId = item.id;
      setSelectedQueueId(itemId);

      const updateItemState = (patch) => {
        setQueue((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
      };

      try {
        let styledSegments = item.segments && item.segments.length > 0 ? item.segments : null;
        let transDuration = item.duration || 10;
        let backendFilename = item.name;

        // -------------------------------------------------------------
        // STEP 1 & 2: Transcribe only if not already captioned from project
        // -------------------------------------------------------------
        if (!styledSegments || styledSegments.length === 0) {
          updateItemState({
            status: 'uploading',
            progress: 8,
            stageText: 'Uploading video to speech AI engine...'
          });

          if (item.file instanceof File && !item.linkedPath) {
            const formData = new FormData();
            formData.append('file', item.file);
            const uploadRes = await fetch(`${BACKEND_URL}/api/upload-video`, {
              method: 'POST',
              body: formData
            });
            if (!uploadRes.ok) {
              const errData = await uploadRes.json().catch(() => ({}));
              throw new Error(errData.detail || 'Failed to upload video file for transcription');
            }
            const upData = await uploadRes.json();
            backendFilename = upData.video_filename;
          }

          if (isCancelledRef.current) break;

          updateItemState({
            status: 'transcribing',
            progress: 20,
            stageText: `Transcribing audio (${globalSettings.whisperModel})...`
          });

          const transcribePayload = {
            video_filename: backendFilename,
            model_name: globalSettings.whisperModel || 'base',
            language: globalSettings.language === 'auto' ? null : globalSettings.language,
            max_words_per_segment: globalSettings.maxWordsPerLine || 3,
            remove_punctuation: globalSettings.removePunctuation,
            linked_path: item.linkedPath || null
          };

          const transRes = await fetch(`${BACKEND_URL}/api/transcribe-saved`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transcribePayload)
          });

          if (!transRes.ok) {
            const errData = await transRes.json().catch(() => ({}));
            throw new Error(errData.detail || 'Whisper speech transcription failed');
          }

          const transData = await transRes.json();
          let rawSegments = transData.segments || [];
          transDuration = transData.duration || item.duration || 10;

          if (isCancelledRef.current) break;

          // STEP 3: Auto-Chunking & AI Semantic Polish
          updateItemState({
            status: 'chunking',
            progress: 40,
            stageText: 'Chunking words & applying preset styles...'
          });

          const allWords = extractAllWords(rawSegments, globalSettings.removePunctuation);
          styledSegments = chunkWordsIntoSegments(
            allWords,
            globalSettings.maxWordsPerLine || 3,
            1.0,
            globalSettings.removePunctuation
          );

          if (globalSettings.autoEmojiEnabled) {
            styledSegments = autoAssignEmojis(styledSegments);
          }
          if (globalSettings.autoEmphasisEnabled) {
            styledSegments = autoApplyEmphasis(styledSegments);
          }
        }

        const finalStyle = getEffectiveStyleForItem(item, globalSettings);

        // Sync generated styled segments & metadata directly to the saved project record
        if (item.projectId) {
          syncBatchItemToProject(item.projectId, {
            segments: styledSegments,
            style: finalStyle,
            duration: transDuration,
            thumbnailUrl: item.thumbnail,
            captionSnippet: styledSegments[0]?.text || ''
          });
        }

        // STEP 4: Determine Dimensions & Target Format
        let exportW = item.width || 1080;
        let exportH = item.height || 1920;

        if (globalSettings.resolution !== 'original') {
          const parts = globalSettings.resolution.split('x').map(Number);
          if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            exportW = parts[0];
            exportH = parts[1];
          }
        }

        const cleanBase = item.name.replace(/\.[^/.]+$/, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'video';
        const finalOutputFilename = `${cleanBase}_captioned.mp4`;

        // STEP 5: Render Video (Client Canvas DOM Ultra vs Backend)
        updateItemState({
          status: 'rendering',
          progress: 50,
          stageText: 'Encoding frames with 100% Canvas DOM Parity...'
        });

        let exportBlobUrl = null;
        let exportDownloadUrl = null;

        if (globalSettings.engineType === 'client_canvas') {
          const targetFps = item.fps || 30;
          const targetDuration = transDuration;
          const exporter = new ClientSceneExporter({
            width: exportW,
            height: exportH,
            fps: targetFps,
            format: 'mp4',
            quality: 'high'
          });
          clientExporterRef.current = exporter;

          const effectiveUrl = item.videoUrl || (item.file ? URL.createObjectURL(item.file) : `${BACKEND_URL}/static/uploads/${encodeURIComponent(backendFilename)}`);

          const renderedBlob = await exporter.exportVideo({
            videoFile: item.file || null,
            videoUrl: effectiveUrl,
            duration: targetDuration,
            segments: styledSegments,
            style: finalStyle,
            onProgress: (stats) => {
              if (isCancelledRef.current) return;
              const rawPct = stats.percent || 0;
              const scaledPct = 50 + Math.round((rawPct / 100) * 48);
              updateItemState({
                progress: Math.min(99, scaledPct),
                stageText: `Encoding frame ${stats.currentFrame}/${stats.totalFrames} (${stats.fps || 0} FPS)`
              });
            }
          });

          clientExporterRef.current = null;
          if (isCancelledRef.current) break;

          exportBlobUrl = URL.createObjectURL(renderedBlob);
          exportDownloadUrl = exportBlobUrl;

          // Save rendered MP4 to backend storage for batch ZIP archive capability
          try {
            const formData = new FormData();
            formData.append('file', renderedBlob, finalOutputFilename);
            fetch(`${BACKEND_URL}/api/upload-video`, { method: 'POST', body: formData }).catch(() => {});
          } catch (_) {}

        } else {
          // Backend FFmpeg ASS / DOM fallback
          const measuredLines = measureAllSegmentsLayout(styledSegments, finalStyle, exportW, exportH);
          const renderPayload = {
            video_filename: backendFilename,
            linked_path: item.linkedPath || null,
            segments: styledSegments,
            style: finalStyle,
            width: exportW,
            height: exportH,
            video_duration: transDuration,
            encoder_mode: globalSettings.encoderMode || 'gpu_nvenc',
            engine_type: globalSettings.engineType === 'dom' ? 'dom' : 'ass',
            preview_metrics: measuredLines ? { measured_lines: measuredLines } : null,
            output_filename: finalOutputFilename
          };

          const renderRes = await fetch(`${BACKEND_URL}/api/render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renderPayload)
          });

          if (!renderRes.ok) {
            const errData = await renderRes.json().catch(() => ({}));
            throw new Error(errData.detail || 'Failed to start video rendering job');
          }

          const renderData = await renderRes.json();
          const jobId = renderData.job_id;
          activeJobIdRef.current = jobId;
          updateItemState({ jobId });

          // Poll render progress until completion
          await new Promise((resolve, reject) => {
            pollIntervalRef.current = setInterval(async () => {
              try {
                if (isCancelledRef.current) {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  fetch(`${BACKEND_URL}/api/render-cancel/${jobId}`, { method: 'POST' }).catch(() => {});
                  reject(new Error('Batch cancelled by user'));
                  return;
                }

                const pRes = await fetch(`${BACKEND_URL}/api/render-progress/${jobId}`);
                if (pRes.ok) {
                  const pData = await pRes.json();
                  if (pData.status === 'cancelled') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    reject(new Error('Rendering cancelled'));
                    return;
                  }
                  if (pData.status === 'error') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    reject(new Error(pData.error || 'Video rendering failed'));
                    return;
                  }

                  const rawPercent = Math.max(0, Math.min(100, typeof pData.percent === 'number' ? pData.percent : 0));
                  const combinedPct = 50 + Math.round((rawPercent / 100) * 48);

                  updateItemState({
                    progress: Math.min(99, combinedPct),
                    stageText: `Rendering frame ${pData.current_frame || 0}/${pData.total_frames || 0} ${pData.fps > 0 ? `(${pData.fps} FPS)` : ''}`
                  });

                  if (pData.status === 'done') {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    resolve(pData);
                  }
                }
              } catch (pollErr) {
                console.warn('Batch render polling error:', pollErr);
              }
            }, 350);
          });

          activeJobIdRef.current = null;
          exportDownloadUrl = `${BACKEND_URL}/static/exports/${encodeURIComponent(finalOutputFilename)}`;
          exportBlobUrl = exportDownloadUrl;
        }

        if (isCancelledRef.current) break;

        // Mark item completed
        updateItemState({
          status: 'completed',
          progress: 100,
          stageText: 'Export Complete!',
          exportUrl: exportBlobUrl,
          exportFilename: finalOutputFilename,
          segments: styledSegments
        });

      } catch (err) {
        if (isCancelledRef.current || err.message?.toLowerCase().includes('cancel')) {
          updateItemState({
            status: 'pending',
            stageText: 'Cancelled',
            progress: 0
          });
        } else {
          console.error(`Error processing batch item ${item.name}:`, err);
          updateItemState({
            status: 'error',
            stageText: 'Failed',
            error: err.message || 'Unknown error during batch export'
          });
        }
      }
    }

    setIsProcessing(false);
    setIsPaused(false);
  };

  // Download Individual Video File
  const handleDownloadItem = async (item) => {
    if (!item) return;
    try {
      const cleanFname = (item.exportFilename || item.name.replace(/\.[^/.]+$/, '') + '_captioned.mp4').replace(/[/\\?%*:|"<>]/g, '');
      if (item.exportUrl && item.exportUrl.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = item.exportUrl;
        a.download = cleanFname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const downloadUrl = `${BACKEND_URL}/api/download/${encodeURIComponent(cleanFname)}`;
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Failed to download video file:', e);
    }
  };

  // Download All as ZIP Archive
  const handleDownloadAllZip = async () => {
    const completed = queue.filter((i) => i.status === 'completed');
    if (completed.length === 0) return;

    setIsZipping(true);
    try {
      const filenames = completed.map((i) => i.exportFilename || `${i.name.replace(/\.[^/.]+$/, "")}_captioned.mp4`);
      const res = await fetch(`${BACKEND_URL}/api/batch/zip-exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames,
          zip_name: `AutoCaption_Batch_${Date.now()}.zip`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to generate batch ZIP archive');
      }

      const data = await res.json();
      if (data.zip_filename) {
        const zipDownloadUrl = `${BACKEND_URL}/api/download/${encodeURIComponent(data.zip_filename)}`;
        const zipRes = await fetch(zipDownloadUrl);
        if (zipRes.ok) {
          const blob = await zipRes.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = data.zip_filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } catch (err) {
      console.error('Error generating batch ZIP:', err);
      alert('Could not download batch ZIP: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  // Open item in Main Editor Studio
  const handleOpenInEditor = async (item) => {
    try {
      if (item.projectId) {
        await loadProject(item.projectId);
      } else {
        await createNewProject({
          aspect: item.width > item.height ? '16:9' : '9:16',
          title: item.projectTitle || item.name.replace(/\.[^/.]+$/, ''),
          linkedPath: item.linkedPath || null,
          videoFile: item.file || null,
          videoFilename: item.name,
          videoUrl: item.exportUrl || item.videoUrl || null,
          presetId: globalSettings.presetId
        });
      }

      if (item.segments && item.segments.length > 0) {
        setSegments(item.segments, false);
      }
      if (item.style) {
        setStyle(item.style);
      }
      setBatchModalOpen(false);
      setCurrentView('editor');
    } catch (e) {
      console.error('Error opening batch item in main editor:', e);
    }
  };

  // Queue Statistics
  const totalCount = queue.length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const errorCount = queue.filter((i) => i.status === 'error').length;
  const activePreset = getPresetById(globalSettings.presetId) || PRESETS[0];

  const isSelectedProjectCustom = Boolean(
    selectedItem?.hasCustomStyle && 
    selectedItem?.style && 
    globalSettings.preserveProjectStyles !== false
  );
  const selectedItemPresetId = selectedItem?.presetId || globalSettings.presetId;
  const effectiveSelectedPreset = getPresetById(selectedItemPresetId) || PRESETS[0];
  const effectiveSelectedStyle = getEffectiveStyleForItem(selectedItem, globalSettings);

  // Filter existing projects for the picker modal
  const filteredPickerProjects = projectsList.filter((p) => {
    if (!projectSearchQuery.trim()) return true;
    const q = projectSearchQuery.toLowerCase();
    return (p.title && p.title.toLowerCase().includes(q)) || (p.videoFilename && p.videoFilename.toLowerCase().includes(q));
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '95vw',
          maxWidth: '1400px',
          height: '88vh',
          maxHeight: '920px',
          backgroundColor: 'var(--bg-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-hover)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 180ms ease'
        }}
      >
        {/* MODAL TOP HEADER */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.35)'
              }}
            >
              <Layers size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Batch Multi-Export Studio
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    color: '#A855F7',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}
                >
                  DOM Ultra 1:1 Parity
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                Upload multiple video clips or select saved projects, customize global styling once, preview live, and export all videos simultaneously.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                if (isProcessing) {
                  if (confirm('A batch export is currently in progress. Do you want to cancel and exit?')) {
                    handleCancelBatch();
                    setBatchModalOpen(false);
                  }
                } else {
                  setBatchModalOpen(false);
                }
              }}
              className="btn-ghost"
              style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-secondary)' }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL MAIN CONTENT: 3-PANE LAYOUT (QUEUE LIST | INTERACTIVE VIDEO PREVIEW | GLOBAL SETTINGS) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* PANE 1: VIDEO QUEUE LIST & DROPZONE */}
          <div
            style={{
              flex: '1 1 38%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border-subtle)',
              minWidth: '360px',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-canvas)'
            }}
          >
            {/* DROPZONE BAR & ACTIONS TRAY */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  border: '2px dashed var(--border-hover)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-panel)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    handleAddFiles(Array.from(e.dataTransfer.files));
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Upload size={16} color="#A855F7" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Drag & Drop Videos Here
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      Auto-creates individual projects for every video
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    title="Add videos from your computer"
                  >
                    <Plus size={12} />
                    <span>Add Videos</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Select an entire folder of videos"
                    onClick={(e) => {
                      e.stopPropagation();
                      folderInputRef.current?.click();
                    }}
                  >
                    <Folder size={12} color="#A855F7" />
                    <span>Add Folder</span>
                  </button>
                </div>
              </div>

              {/* QUICK ACTION ROW: ADD FROM PROJECTS + LINK LOCAL PATH */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsProjectPickerOpen(true)}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '6px 10px',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    backgroundColor: 'rgba(168, 85, 247, 0.08)',
                    color: '#A855F7',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  title="Import and queue saved projects from your Projects Hub"
                >
                  <BookOpen size={13} />
                  <span>Add From Projects ({projectsList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleLinkLocalFile}
                  className="btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Link a video file directly from disk without copying"
                >
                  <HardDrive size={12} />
                  <span>Link Path</span>
                </button>
              </div>

              {/* Hidden File & Folder Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.mkv,.webm,.avi"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) {
                    handleAddFiles(Array.from(e.target.files));
                  }
                  e.target.value = '';
                }}
              />

              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) {
                    handleAddFiles(Array.from(e.target.files));
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {/* QUEUE STATS & BULK ACTIONS HEADER */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Queue ({totalCount})
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-panel)' }}>
                    Pending: <strong>{pendingCount}</strong>
                  </span>
                  <span style={{ fontSize: '10px', color: '#10B981', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    Done: <strong>{completedCount}</strong>
                  </span>
                  {errorCount > 0 && (
                    <span style={{ fontSize: '10px', color: '#EF4444', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                      Failed: <strong>{errorCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {completedCount > 0 && (
                  <button
                    onClick={handleDownloadAllZip}
                    disabled={isZipping}
                    className="btn-secondary"
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10B981',
                      fontWeight: '700'
                    }}
                    title="Download all completed videos as a single ZIP file"
                  >
                    {isZipping ? <Loader2 size={11} className="spin" /> : <FileArchive size={11} />}
                    <span>ZIP All</span>
                  </button>
                )}

                {completedCount > 0 && !isProcessing && (
                  <button
                    onClick={handleClearCompleted}
                    className="btn-ghost"
                    style={{ fontSize: '10px', padding: '4px 6px', color: 'var(--text-tertiary)' }}
                  >
                    Clear Done
                  </button>
                )}

                {queue.length > 0 && !isProcessing && (
                  <button
                    onClick={handleClearAll}
                    className="btn-ghost"
                    style={{ fontSize: '10px', padding: '4px 6px', color: 'var(--text-tertiary)' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* QUEUE ITEMS SCROLL LIST */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queue.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    height: '100%'
                  }}
                >
                  <ListVideo size={36} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Queue is Empty
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', maxWidth: '280px' }}>
                    Click <strong>Add Videos</strong>, <strong>Add Folder</strong>, or <strong>Add From Projects</strong> above to queue clips.
                  </p>
                </div>
              ) : (
                queue.map((item, idx) => {
                  const isSelected = selectedQueueId === item.id;
                  const isItemActive = ['uploading', 'transcribing', 'chunking', 'rendering'].includes(item.status);
                  const isItemDone = item.status === 'completed';
                  const isItemError = item.status === 'error';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedQueueId(item.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-panel)',
                        border: isSelected
                          ? '2px solid #A855F7'
                          : isItemActive
                          ? '1px solid rgba(168, 85, 247, 0.4)'
                          : isItemDone
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : isItemError
                          ? '1px solid rgba(239, 68, 68, 0.3)'
                          : '1px solid var(--border-subtle)',
                        boxShadow: isSelected ? '0 4px 14px rgba(168, 85, 247, 0.15)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 120ms ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        {/* Thumbnail & Meta */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '6px',
                              backgroundColor: '#000000',
                              flexShrink: 0,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt="thumb"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <Film size={18} color="var(--text-tertiary)" />
                            )}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: isSelected ? '#A855F7' : 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={item.projectTitle || item.name}
                            >
                              {idx + 1}. {item.projectTitle || item.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                              <span>{formatDuration(item.duration)}</span>
                              <span>•</span>
                              <span>{item.width}×{item.height}</span>
                              {item.projectId && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#A855F7', fontWeight: '600' }}>Project Linked</span>
                                </>
                              )}
                              <span>•</span>
                              {item.style && (globalSettings.preserveProjectStyles !== false) ? (
                                <span style={{ color: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.12)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Sparkles size={9} />
                                  Project Style
                                </span>
                              ) : (
                                <span style={{ color: '#06B6D4', backgroundColor: 'rgba(6, 182, 212, 0.12)', padding: '1px 5px', borderRadius: '4px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Zap size={9} />
                                  Global Default
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {isItemDone ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: '700',
                                color: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              <CheckCircle2 size={11} />
                              <span>Ready</span>
                            </span>
                          ) : isItemActive ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '10px',
                                fontWeight: '700',
                                color: '#A855F7',
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                border: '1px solid rgba(168, 85, 247, 0.3)'
                              }}
                            >
                              <Loader2 size={11} className="spin" />
                              <span>{item.status === 'transcribing' ? 'Whisper AI' : 'Rendering'}</span>
                            </span>
                          ) : isItemError ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: '700',
                                color: '#EF4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <AlertCircle size={11} />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-tertiary)',
                                backgroundColor: 'var(--bg-surface)',
                                padding: '2px 6px',
                                borderRadius: '999px'
                              }}
                            >
                              Queued
                            </span>
                          )}

                          {isItemDone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadItem(item);
                              }}
                              className="btn-primary"
                              style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                              title="Download MP4"
                            >
                              <Download size={11} />
                              <span>Save</span>
                            </button>
                          )}

                          {isItemError && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryItem(item.id);
                              }}
                              className="btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '10px' }}
                              title="Retry processing"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}

                          {/* Jump to Studio button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInEditor(item);
                            }}
                            className="btn-ghost"
                            style={{ padding: '4px', borderRadius: '4px', color: '#A855F7' }}
                            title="Open in Timeline Studio to edit words & captions"
                          >
                            <Edit3 size={12} />
                          </button>

                          {!isItemActive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(item.id);
                              }}
                              className="btn-ghost"
                              style={{ padding: '4px', borderRadius: '4px', color: 'var(--text-tertiary)' }}
                              title="Remove item"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Active Progress Bar */}
                      {isItemActive && (
                        <div style={{ marginTop: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                            <span>{item.stageText}</span>
                            <span style={{ fontWeight: '700', color: '#A855F7' }}>{item.progress}%</span>
                          </div>
                          <div style={{ width: '100%', height: '3px', borderRadius: '999px', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${item.progress}%`,
                                height: '100%',
                                backgroundColor: '#A855F7',
                                borderRadius: '999px',
                                transition: 'width 200ms ease'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* BOTTOM BATCH PROCESS TRIGGER */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {isProcessing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#A855F7', fontWeight: '700' }}>
                    <Loader2 size={12} className="spin" />
                    Processing ({completedCount}/{totalCount})...
                  </span>
                ) : (
                  <span>Ready: <strong>{pendingCount}</strong> pending video{pendingCount === 1 ? '' : 's'}</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isProcessing ? (
                  <>
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      {isPaused ? <Play size={12} /> : <Pause size={12} />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      onClick={handleCancelBatch}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 12px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#EF4444' }}
                    >
                      <X size={12} />
                      <span>Stop</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startBatchProcessing}
                    disabled={queue.length === 0 || pendingCount === 0}
                    style={{
                      padding: '7px 18px',
                      fontSize: '12px',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-md)',
                      background: (queue.length === 0 || pendingCount === 0)
                        ? 'var(--bg-surface-active)'
                        : 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                      color: (queue.length === 0 || pendingCount === 0) ? 'var(--text-tertiary)' : '#FFFFFF',
                      border: 'none',
                      cursor: (queue.length === 0 || pendingCount === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: (queue.length === 0 || pendingCount === 0) ? 'none' : '0 4px 12px rgba(168, 85, 247, 0.35)',
                      transition: 'all 120ms ease'
                    }}
                  >
                    <Zap size={13} />
                    <span>Process & Export All ({pendingCount})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* PANE 2: INTERACTIVE LIVE VIDEO & CAPTION PREVIEWER */}
          <div
            style={{
              flex: '1 1 32%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border-subtle)',
              minWidth: '320px',
              backgroundColor: '#000000',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* PREVIEWER TOP HEADER */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(18, 20, 26, 0.95)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MonitorPlay size={15} color="#A855F7" />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#FFFFFF' }}>
                  Live Caption & Video Preview
                </span>
              </div>

              {selectedItem && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handleOpenInEditor(selectedItem)}
                    className="btn-secondary"
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#FFFFFF'
                    }}
                    title="Open this clip in the full timeline studio to edit words & timings"
                  >
                    <ExternalLink size={10} />
                    <span>Open in Studio</span>
                  </button>
                </div>
              )}
            </div>

            {/* VIDEO & CANVAS STAGE */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#08090C'
              }}
            >
              {selectedItem ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {/* HTML5 Video Element */}
                  <video
                    ref={previewVideoRef}
                    src={selectedItem.videoUrl || (selectedItem.file ? URL.createObjectURL(selectedItem.file) : '')}
                    muted={previewMuted}
                    playsInline
                    loop
                    onTimeUpdate={(e) => {
                      setPreviewTime(e.currentTarget.currentTime);
                      updatePreviewCanvas();
                    }}
                    onLoadedMetadata={(e) => {
                      setPreviewDuration(e.currentTarget.duration || selectedItem.duration || 10);
                      if (previewCanvasRef.current) {
                        previewCanvasRef.current.width = e.currentTarget.videoWidth || 1080;
                        previewCanvasRef.current.height = e.currentTarget.videoHeight || 1920;
                        updatePreviewCanvas();
                      }
                    }}
                    onPlay={() => setIsPreviewPlaying(true)}
                    onPause={() => setIsPreviewPlaying(false)}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />

                  {/* Realtime Canvas Subtitle Overlay */}
                  <canvas
                    ref={previewCanvasRef}
                    width={selectedItem.width || 1080}
                    height={selectedItem.height || 1920}
                    style={{
                      position: 'absolute',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                      zIndex: 5
                    }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', padding: '20px' }}>
                  <Film size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <div style={{ fontSize: '12px' }}>Select a video from the queue to preview</div>
                </div>
              )}
            </div>

            {/* PREVIEW CONTROLS BAR */}
            {selectedItem && (
              <div
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(18, 20, 26, 0.95)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  zIndex: 10
                }}
              >
                <button
                  onClick={() => {
                    const video = previewVideoRef.current;
                    if (video) {
                      if (video.paused) {
                        video.play();
                      } else {
                        video.pause();
                      }
                    }
                  }}
                  className="btn-ghost"
                  style={{ color: '#FFFFFF', padding: '4px' }}
                >
                  {isPreviewPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', minWidth: '60px' }}>
                  {formatDuration(previewTime)} / {formatDuration(previewDuration)}
                </div>

                <input
                  type="range"
                  min="0"
                  max={previewDuration || 10}
                  step="0.05"
                  value={previewTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setPreviewTime(val);
                    if (previewVideoRef.current) {
                      previewVideoRef.current.currentTime = val;
                    }
                    updatePreviewCanvas();
                  }}
                  style={{ flex: 1, accentColor: '#A855F7', cursor: 'pointer' }}
                />

                <button
                  onClick={() => setPreviewMuted(!previewMuted)}
                  className="btn-ghost"
                  style={{ color: '#FFFFFF', padding: '4px' }}
                  title={previewMuted ? 'Unmute' : 'Mute'}
                >
                  {previewMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* PANE 3: GLOBAL PRESET & AI SPEECH SETTINGS INSPECTOR */}
          <div
            style={{
              flex: '1 1 30%',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '320px',
              maxWidth: '400px',
              backgroundColor: 'var(--bg-panel)'
            }}
          >
            {/* TABS NAVIGATION */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <button
                onClick={() => setActiveTab('preset')}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: activeTab === 'preset' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: activeTab === 'preset' ? '2px solid #A855F7' : '2px solid transparent',
                  backgroundColor: activeTab === 'preset' ? 'var(--bg-panel)' : 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Sparkles size={12} color={activeTab === 'preset' ? '#A855F7' : 'inherit'} />
                <span>Style & Presets</span>
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: activeTab === 'ai' ? '2px solid #A855F7' : '2px solid transparent',
                  backgroundColor: activeTab === 'ai' ? 'var(--bg-panel)' : 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Cpu size={12} color={activeTab === 'ai' ? '#A855F7' : 'inherit'} />
                <span>AI Speech</span>
              </button>

              <button
                onClick={() => setActiveTab('export')}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: activeTab === 'export' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: activeTab === 'export' ? '2px solid #A855F7' : '2px solid transparent',
                  backgroundColor: activeTab === 'export' ? 'var(--bg-panel)' : 'transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Settings2 size={12} color={activeTab === 'export' ? '#A855F7' : 'inherit'} />
                <span>Export Engine</span>
              </button>
            </div>

            {/* TAB CONTENTS (SCROLLABLE) */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* TAB 1: PRESET & LIVE PREVIEW STAGE */}
              {activeTab === 'preset' && (
                <>
                  {/* STYLE BEHAVIOR & PRIORITY SELECTOR */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface)',
                      border: globalSettings.preserveProjectStyles !== false ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={13} color="#A855F7" />
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          Preserve Project Custom Styles
                        </span>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={globalSettings.preserveProjectStyles !== false}
                          onChange={(e) => setGlobalSettings({ preserveProjectStyles: e.target.checked })}
                          style={{ accentColor: '#A855F7', cursor: 'pointer', width: '14px', height: '14px' }}
                        />
                        <span style={{ fontSize: '10px', fontWeight: '700', color: globalSettings.preserveProjectStyles !== false ? '#A855F7' : 'var(--text-tertiary)' }}>
                          {globalSettings.preserveProjectStyles !== false ? 'ENABLED' : 'OVERRIDE ALL'}
                        </span>
                      </label>
                    </div>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {globalSettings.preserveProjectStyles !== false
                        ? '✓ Projects keep their customized subtitle styles & fonts. Fresh video uploads use the global preset below as their default.'
                        : '⚠️ Overriding all videos in queue to use the global preset below.'}
                    </p>
                  </div>

                  {/* LIVE PRESET STAGE BANNER */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: '#0F1117',
                      border: isSelectedProjectCustom ? '1px solid rgba(168, 85, 247, 0.6)' : '1px solid rgba(6, 182, 212, 0.4)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '10px' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '700', color: isSelectedProjectCustom ? '#A855F7' : '#06B6D4' }}>
                        {isSelectedProjectCustom 
                          ? `🎨 Project Style: ${effectiveSelectedPreset.name}`
                          : `⚡ Global Default Preset: ${activePreset.name}`}
                      </span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Font: {effectiveSelectedStyle?.fontFamily || activePreset.style?.fontFamily}
                      </span>
                    </div>

                    {/* Styled Caption Preview Box */}
                    <div
                      style={{
                        padding: '10px 16px',
                        borderRadius: effectiveSelectedStyle?.borderRadius ? `${effectiveSelectedStyle.borderRadius}px` : '4px',
                        backgroundColor: effectiveSelectedStyle?.backgroundColor !== 'transparent' ? effectiveSelectedStyle?.backgroundColor : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontFamily: effectiveSelectedStyle?.fontFamily || 'Montserrat',
                        fontWeight: effectiveSelectedStyle?.fontWeight || '900',
                        fontSize: '18px',
                        textTransform: effectiveSelectedStyle?.textTransform || 'uppercase',
                        letterSpacing: `${effectiveSelectedStyle?.letterSpacing || 0}px`,
                        textAlign: 'center',
                        textShadow: effectiveSelectedStyle?.strokeColor ? `-1.5px -1.5px 0 ${effectiveSelectedStyle.strokeColor}, 1.5px 1.5px 0 ${effectiveSelectedStyle.strokeColor}` : 'none'
                      }}
                    >
                      <span style={{ color: effectiveSelectedStyle?.primaryColor || '#FFFFFF' }}>
                        THIS IS
                      </span>
                      <span
                        style={{
                          color: effectiveSelectedStyle?.activeColor || '#FFE600',
                          transform: 'scale(1.12)',
                          display: 'inline-block'
                        }}
                      >
                        INSANE
                      </span>
                      <span style={{ fontSize: '20px' }}>🚀</span>
                    </div>

                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
                      {isSelectedProjectCustom
                        ? `Retaining custom settings from "${selectedItem?.projectTitle || selectedItem?.name}"`
                        : 'Applied as default to new video uploads without custom settings'}
                    </div>
                  </div>

                  {/* PRESET CARDS GRID */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
                        Choose Preset {isSelectedProjectCustom ? '(Click to change this clip)' : '(Default for new clips)'}
                      </label>
                      {isSelectedProjectCustom && (
                        <span style={{ fontSize: '10px', color: '#A855F7', fontWeight: '600' }}>
                          Current: {effectiveSelectedPreset.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {PRESETS.map((p) => {
                        const isGlobalDefault = globalSettings.presetId === p.id;
                        const isThisItemPreset = selectedItem?.presetId === p.id;
                        const isSelected = isSelectedProjectCustom ? isThisItemPreset : isGlobalDefault;

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setGlobalSettings((prev) => ({ ...prev, presetId: p.id }));
                              if (selectedItem) {
                                setQueue((prev) => prev.map(it => it.id === selectedItem.id ? { 
                                  ...it, 
                                  presetId: p.id, 
                                  style: sanitizeStyle({ ...p.style }),
                                  hasCustomStyle: true
                                } : it));
                              }
                              updatePreviewCanvas();
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: isSelected ? '2px solid #A855F7' : '1px solid var(--border-subtle)',
                              backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              transition: 'all 120ms ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? '#A855F7' : 'var(--text-primary)' }}>
                                {p.name}
                              </span>
                              {isSelected && <Check size={12} color="#A855F7" />}
                            </div>

                            {/* Preset Visual Card */}
                            <div
                              style={{
                                padding: '4px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#111827',
                                color: p.style?.activeColor || '#FFFFFF',
                                fontFamily: p.style?.fontFamily || 'Montserrat',
                                fontWeight: p.style?.fontWeight || '800',
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                textAlign: 'center',
                                textShadow: p.style?.strokeColor ? `-1px -1px 0 ${p.style.strokeColor}, 1px 1px 0 ${p.style.strokeColor}` : 'none'
                              }}
                            >
                              POP HOOK
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Font Scaling Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Font Size Scale
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {Math.round(globalSettings.fontSizeMultiplier * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="1.35"
                      step="0.05"
                      value={globalSettings.fontSizeMultiplier}
                      onChange={(e) => {
                        setGlobalSettings((prev) => ({ ...prev, fontSizeMultiplier: parseFloat(e.target.value) }));
                        updatePreviewCanvas();
                      }}
                      style={{ width: '100%', accentColor: '#A855F7' }}
                    />
                  </div>

                  {/* Position Y Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Vertical Placement (Y-Position)
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {globalSettings.positionY}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="90"
                      step="1"
                      value={globalSettings.positionY}
                      onChange={(e) => {
                        setGlobalSettings((prev) => ({ ...prev, positionY: parseInt(e.target.value, 10) }));
                        updatePreviewCanvas();
                      }}
                      style={{ width: '100%', accentColor: '#A855F7' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      <span>Top (30%)</span>
                      <span>Center-Low (74%)</span>
                      <span>Bottom (90%)</span>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: AI SPEECH & CHUNKING */}
              {activeTab === 'ai' && (
                <>
                  {/* Whisper AI Model */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
                      Whisper AI Speech Model
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {WHISPER_MODELS.map((m) => {
                        const isSelected = globalSettings.whisperModel === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setGlobalSettings((prev) => ({ ...prev, whisperModel: m.id }))}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected ? '1px solid #A855F7' : '1px solid var(--border-subtle)',
                              backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: isSelected ? '#A855F7' : 'var(--text-primary)' }}>
                                {m.name}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                                {m.badge} • {m.size}
                              </div>
                            </div>
                            {isSelected && <Check size={12} color="#A855F7" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Spoken Language */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                      Audio Language
                    </label>
                    <select
                      value={globalSettings.language}
                      onChange={(e) => setGlobalSettings((prev) => ({ ...prev, language: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '11px'
                      }}
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Words Per Line */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Words Per Caption Block
                      </label>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#A855F7' }}>
                        {globalSettings.maxWordsPerLine} {globalSettings.maxWordsPerLine === 1 ? 'Word (MrBeast)' : 'Words'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={globalSettings.maxWordsPerLine}
                      onChange={(e) => setGlobalSettings((prev) => ({ ...prev, maxWordsPerLine: parseInt(e.target.value, 10) }))}
                      style={{ width: '100%', accentColor: '#A855F7' }}
                    />
                  </div>

                  {/* AI Toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={globalSettings.autoEmojiEnabled}
                        onChange={(e) => {
                          setGlobalSettings((prev) => ({ ...prev, autoEmojiEnabled: e.target.checked }));
                          updatePreviewCanvas();
                        }}
                        style={{ accentColor: '#A855F7', width: '14px', height: '14px' }}
                      />
                      <span>Auto-Assign Animated Emojis (🔥, 💰, 🚀)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={globalSettings.autoEmphasisEnabled}
                        onChange={(e) => {
                          setGlobalSettings((prev) => ({ ...prev, autoEmphasisEnabled: e.target.checked }));
                          updatePreviewCanvas();
                        }}
                        style={{ accentColor: '#A855F7', width: '14px', height: '14px' }}
                      />
                      <span>Highlight Power Keywords with Accent Colors</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={globalSettings.removePunctuation}
                        onChange={(e) => setGlobalSettings((prev) => ({ ...prev, removePunctuation: e.target.checked }))}
                        style={{ accentColor: '#A855F7', width: '14px', height: '14px' }}
                      />
                      <span>Remove Punctuation Marks</span>
                    </label>
                  </div>
                </>
              )}

              {/* TAB 3: EXPORT FORMAT & ENGINE (DEFAULTING TO CLIENT CANVAS DOM ULTRA) */}
              {activeTab === 'export' && (
                <>
                  {/* Render Engine Selector */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
                      Render Engine
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        onClick={() => setGlobalSettings((prev) => ({ ...prev, engineType: 'client_canvas' }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: globalSettings.engineType === 'client_canvas' ? '2px solid #A855F7' : '1px solid var(--border-subtle)',
                          backgroundColor: globalSettings.engineType === 'client_canvas' ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: globalSettings.engineType === 'client_canvas' ? '#A855F7' : 'var(--text-primary)' }}>
                            🚀 Client Canvas (100% DOM Parity)
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                            RECOMMENDED
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Exact 1:1 Canvas 2D frame composition & audio sync in browser
                        </div>
                      </div>

                      <div
                        onClick={() => setGlobalSettings((prev) => ({ ...prev, engineType: 'ass' }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: globalSettings.engineType === 'ass' ? '2px solid #A855F7' : '1px solid var(--border-subtle)',
                          backgroundColor: globalSettings.engineType === 'ass' ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: '700', color: globalSettings.engineType === 'ass' ? '#A855F7' : 'var(--text-primary)' }}>
                          ⚡ ASS Fast Burn (FFmpeg)
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Hardware libass subtitle burn-in
                        </div>
                      </div>

                      <div
                        onClick={() => setGlobalSettings((prev) => ({ ...prev, engineType: 'dom' }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: globalSettings.engineType === 'dom' ? '2px solid #A855F7' : '1px solid var(--border-subtle)',
                          backgroundColor: globalSettings.engineType === 'dom' ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: '700', color: globalSettings.engineType === 'dom' ? '#A855F7' : 'var(--text-primary)' }}>
                          🌐 Backend Chrome DOM Engine
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Server-side headless Chrome frame renderer
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resolution Selector */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '6px' }}>
                      Target Export Resolution
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {RESOLUTION_OPTIONS.map((res) => {
                        const isSelected = globalSettings.resolution === res.id;
                        return (
                          <div
                            key={res.id}
                            onClick={() => setGlobalSettings((prev) => ({ ...prev, resolution: res.id }))}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: isSelected ? '1px solid #A855F7' : '1px solid var(--border-subtle)',
                              backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: isSelected ? '#A855F7' : 'var(--text-primary)' }}>
                                {res.label}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                                {res.sub}
                              </div>
                            </div>
                            {isSelected && <Check size={12} color="#A855F7" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXISTING PROJECTS PICKER MODAL / OVERLAY                                   */}
        {/* ========================================================================= */}
        {isProjectPickerOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div
              style={{
                width: '90%',
                maxWidth: '900px',
                height: '80%',
                maxHeight: '680px',
                backgroundColor: 'var(--bg-panel)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-hover)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BookOpen size={18} color="#A855F7" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Add From Existing Saved Projects
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Select projects to queue up for batch processing with their custom subtitles & styles preserved.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsProjectPickerOpen(false)}
                  className="btn-ghost"
                  style={{ padding: '6px', color: 'var(--text-tertiary)' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search & Bulk Selection Bar */}
              <div
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: 'var(--bg-canvas)'
                }}
              >
                <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search projects by title..."
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 32px',
                      fontSize: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={selectAllProjects}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllProjects}
                    className="btn-ghost"
                    style={{ fontSize: '11px', padding: '5px 10px', color: 'var(--text-tertiary)' }}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
                {filteredPickerProjects.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 20px' }}>
                    <BookOpen size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>No Projects Found</div>
                    <div style={{ fontSize: '11px' }}>Create projects in the Projects Hub first or upload videos above.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                    {filteredPickerProjects.map((proj) => {
                      const isSelected = selectedProjectPickerIds.has(proj.id);
                      const isAlreadyQueued = queue.some((q) => q.projectId === proj.id);
                      const hasCaptions = proj.segments && Array.isArray(proj.segments) && proj.segments.length > 0;
                      const aspect = proj.aspectRatio || '9:16';
                      const durText = typeof proj.duration === 'number' ? formatDuration(proj.duration) : (proj.duration || '00:30');

                      const thumbUrl = proj.thumbnailUrl || (proj.linkedSourcePath || proj.videoFilename
                        ? `${BACKEND_URL}/api/media/thumbnail?filename=${encodeURIComponent(proj.videoFilename || '')}&path=${encodeURIComponent(proj.linkedSourcePath || '')}&time_offset=0`
                        : null);

                      return (
                        <div
                          key={proj.id}
                          onClick={() => {
                            if (!isAlreadyQueued) toggleProjectSelection(proj.id);
                          }}
                          style={{
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-panel)',
                            border: isSelected ? '2px solid #A855F7' : '1px solid var(--border-subtle)',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            cursor: isAlreadyQueued ? 'not-allowed' : 'pointer',
                            opacity: isAlreadyQueued ? 0.5 : 1,
                            position: 'relative',
                            transition: 'all 120ms ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '6px',
                                backgroundColor: '#000000',
                                flexShrink: 0,
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {thumbUrl ? (
                                <img src={thumbUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Film size={18} color="var(--text-tertiary)" />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {proj.title || 'Untitled Project'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                <span style={{ backgroundColor: 'var(--bg-surface)', padding: '1px 5px', borderRadius: '3px' }}>{aspect}</span>
                                <span>•</span>
                                <span>{durText}</span>
                              </div>
                              <div style={{ fontSize: '9.5px', color: hasCaptions ? '#10B981' : 'var(--text-tertiary)', marginTop: '2px' }}>
                                {hasCaptions ? `✓ ${proj.segments.length} caption blocks` : '• No captions yet'}
                              </div>
                            </div>

                            <div style={{ flexShrink: 0 }}>
                              {isAlreadyQueued ? (
                                <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-surface)', padding: '2px 5px', borderRadius: '4px' }}>
                                  QUEUED
                                </span>
                              ) : isSelected ? (
                                <CheckSquare size={16} color="#A855F7" />
                              ) : (
                                <Square size={16} color="var(--text-tertiary)" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Selected: <strong>{selectedProjectPickerIds.size}</strong> project{selectedProjectPickerIds.size === 1 ? '' : 's'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setIsProjectPickerOpen(false)}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportSelectedProjects}
                    disabled={selectedProjectPickerIds.size === 0}
                    className="btn-primary"
                    style={{
                      fontSize: '11px',
                      padding: '6px 16px',
                      background: selectedProjectPickerIds.size === 0 ? 'var(--bg-surface-active)' : 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                      border: 'none',
                      color: selectedProjectPickerIds.size === 0 ? 'var(--text-tertiary)' : '#FFFFFF',
                      cursor: selectedProjectPickerIds.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Add Selected to Queue ({selectedProjectPickerIds.size})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
