/**
 * AutoCaption - Premiere Pro-Style Zero-Copy Media Linking Utility
 * Streams and links local files directly from the user's hard drive without copying them.
 */

const BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * Trigger native Windows File Picker dialog via backend to select any video file on disk.
 * Returns file path, metadata, and direct streaming URL with zero file duplication.
 */
export async function browseLocalFile(signal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/media/browse-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Browse failed with status ${res.status}`);
    }
    const data = await res.json();
    if (data.cancelled) {
      return { cancelled: true };
    }
    return {
      cancelled: false,
      filePath: data.file_path,
      filename: data.filename,
      sizeMb: data.size_mb,
      duration: data.duration,
      width: data.width,
      height: data.height,
      fps: data.fps,
      streamUrl: `${BACKEND_URL}${data.stream_url}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { cancelled: true };
    }
    console.error('Failed to open native file browser:', err);
    throw err;
  }
}

/**
 * Link an existing known file path on disk.
 */
export async function linkLocalPath(filePath) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/media/link-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'File not found' }));
      throw new Error(err.detail || 'Failed to link file');
    }
    const data = await res.json();
    return {
      filePath: data.file_path,
      filename: data.filename,
      sizeMb: data.size_mb,
      duration: data.duration,
      width: data.width,
      height: data.height,
      fps: data.fps,
      streamUrl: `${BACKEND_URL}${data.stream_url}`
    };
  } catch (err) {
    console.error('Failed to link path:', err);
    throw err;
  }
}

/**
 * Constructs the HTTP 206 Partial Content video streaming URL for a local path.
 */
export function getStreamUrl(filePath) {
  if (!filePath) return '';
  return `${BACKEND_URL}/api/media/stream?path=${encodeURIComponent(filePath)}`;
}

/**
 * Premiere Pro-style media status check: verifies if linked media files still exist on disk.
 */
export async function checkMediaStatus(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return {};
  try {
    const res = await fetch(`${BACKEND_URL}/api/media/check-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paths)
    });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.warn('Media status check failed:', err);
    return {};
  }
}

/**
 * Transcribe linked video directly from disk using temporary ephemeral audio extraction.
 */
export async function transcribeLinkedMedia(filePath, options = {}) {
  const {
    modelName = 'base',
    language = null,
    maxWordsPerSegment = 3,
    removePunctuation = false
  } = options;

  const res = await fetch(`${BACKEND_URL}/api/transcribe-linked`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path: filePath,
      model_name: modelName,
      language: language,
      max_words_per_segment: maxWordsPerSegment,
      remove_punctuation: removePunctuation
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transcription failed' }));
    throw new Error(err.detail || 'Transcription failed');
  }

  return await res.json();
}

/**
 * Prune uploads folder to reclaim disk space.
 */
export async function pruneStorageUploads() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/media/prune-storage`, {
      method: 'POST'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Prune storage failed:', e);
  }
  return { freed_mb: 0 };
}
