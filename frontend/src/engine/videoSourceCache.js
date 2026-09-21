import { Input, ALL_FORMATS, BlobSource, UrlSource, CanvasSink } from 'mediabunny';

/**
 * Detects the native framerate (FPS) of a video file or stream URL using Mediabunny track packet stats.
 *
 * @param {File|Blob|string} fileOrUrl
 * @returns {Promise<number>} Detected FPS (default 30)
 */
export async function detectNativeVideoFps(fileOrUrl) {
  if (!fileOrUrl) return 30;
  try {
    const source = typeof fileOrUrl === 'string'
      ? new UrlSource(fileOrUrl)
      : new BlobSource(fileOrUrl);

    const input = new Input({
      source,
      formats: ALL_FORMATS
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (videoTrack) {
      const stats = await videoTrack.computePacketStats(30).catch(() => null);
      if (stats?.averagePacketRate && Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0) {
        return Math.round(stats.averagePacketRate * 100) / 100;
      }
    }
  } catch (err) {
    console.warn('Could not detect video framerate via Mediabunny:', err);
  }
  return 30;
}

/**
 * Video frame provider inspired by OpenCut's VideoCache.
 * Provides high-speed decoded video frames at discrete timestamps
 * using Mediabunny's WebCodecs/CanvasSink engine with HTML5 offscreen fallback.
 */
class VideoSourceCache {
  constructor() {
    this.sinks = new Map();
    this.videoElements = new Map();
  }

  /**
   * Initializes or gets the Mediabunny CanvasSink for a given video file/blob/url.
   */
  async ensureSink(fileOrUrl) {
    if (!fileOrUrl) return null;
    const key = typeof fileOrUrl === 'string' ? fileOrUrl : (fileOrUrl.name || 'blob-video');
    if (this.sinks.has(key)) {
      return this.sinks.get(key);
    }

    try {
      let source = null;
      if (typeof fileOrUrl === 'string') {
        let cleanUrl = fileOrUrl.trim();
        if (cleanUrl.startsWith('/') && typeof window !== 'undefined') {
          cleanUrl = window.location.origin + cleanUrl;
        }
        try {
          cleanUrl = encodeURI(cleanUrl);
        } catch (_) {}
        source = new UrlSource(cleanUrl);
      } else {
        source = new BlobSource(fileOrUrl);
      }

      const input = new Input({
        source,
        formats: ALL_FORMATS
      });

      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) {
        throw new Error('No video track found in file');
      }

      const canDecode = await videoTrack.canDecode();
      if (!canDecode) {
        throw new Error('Video codec not supported by browser WebCodecs');
      }

      const sink = new CanvasSink(videoTrack, {
        poolSize: 4
      });

      let fps = 30;
      try {
        const stats = await videoTrack.computePacketStats(30).catch(() => null);
        if (stats?.averagePacketRate && Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0) {
          fps = Math.round(stats.averagePacketRate * 100) / 100;
        }
      } catch (_) {}

      const data = {
        input,
        videoTrack,
        sink,
        fps,
        lastTime: -1,
        iterator: null
      };

      this.sinks.set(key, data);
      return data;
    } catch (err) {
      console.warn('Mediabunny CanvasSink initialization failed, using HTML5 video seeker fallback:', err);
      return null;
    }
  }

  /**
   * Extracts frame bitmap/canvas at target timestamp in seconds.
   *
   * @param {Object} params
   * @param {File|Blob} [params.file]
   * @param {string} [params.url]
   * @param {number} params.time - Timestamp in seconds
   * @returns {Promise<CanvasImageSource|null>}
   */
  async getFrameAt({ file, url, time }) {
    const source = file || url;
    if (source) {
      const sinkData = await this.ensureSink(source);
      if (sinkData && sinkData.sink) {
        try {
          if (!sinkData.iterator || Math.abs(time - sinkData.lastTime) > 1.5) {
            if (sinkData.iterator && sinkData.iterator.return) {
              await sinkData.iterator.return();
            }
            sinkData.iterator = sinkData.sink.canvases(time);
          }

          const { value: wrappedCanvas, done } = await sinkData.iterator.next();
          if (!done && wrappedCanvas && wrappedCanvas.canvas) {
            sinkData.lastTime = wrappedCanvas.timestamp;
            return wrappedCanvas.canvas;
          }

          // Fallback: If iterator ended or returned done, attempt exact getCanvas(time)
          const fallbackCanvas = await sinkData.sink.getCanvas(time).catch(() => null);
          if (fallbackCanvas && fallbackCanvas.canvas) {
            sinkData.lastTime = fallbackCanvas.timestamp;
            return fallbackCanvas.canvas;
          }
        } catch (sinkErr) {
          console.warn('CanvasSink frame extraction failed, trying getCanvas fallback:', sinkErr);
          try {
            const fallbackCanvas = await sinkData.sink.getCanvas(time).catch(() => null);
            if (fallbackCanvas && fallbackCanvas.canvas) {
              return fallbackCanvas.canvas;
            }
          } catch (_) {}
        }
      }
    }

    // 2. Fallback: Frame stepping via HTML5 Video element with precision seek
    return this.seekVideoElementFrame({ file, url, time });
  }

  /**
   * Fallback: Seeks an offscreen HTML5 video element to extract frame.
   */
  async seekVideoElementFrame({ file, url, time }) {
    const videoUrl = url || (file ? URL.createObjectURL(file) : null);
    if (!videoUrl) return null;

    let video = this.videoElements.get(videoUrl);
    if (!video) {
      video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      await new Promise(resolve => {
        video.onloadeddata = resolve;
        video.onerror = resolve;
      });
      this.videoElements.set(videoUrl, video);
    }

    const targetTime = Math.max(0, Math.min(video.duration || 9999, time));
    if (Math.abs(video.currentTime - targetTime) > 0.0001) {
      await new Promise(resolve => {
        let isDone = false;
        let timer = null;
        const done = () => {
          if (!isDone) {
            isDone = true;
            if (timer) clearTimeout(timer);
            video.removeEventListener('seeked', done);
            resolve();
          }
        };
        video.addEventListener('seeked', done, { once: true });
        timer = setTimeout(done, 2500); // 2500ms fail-safe timeout
        video.currentTime = targetTime;
      });
    }

    return video;
  }

  /**
   * Disposes all open video sinks and object URLs.
   */
  clear() {
    for (const [, data] of this.sinks) {
      try {
        if (data.input) data.input.dispose();
      } catch (_) {}
    }
    this.sinks.clear();

    for (const [, video] of this.videoElements) {
      try {
        video.src = '';
      } catch (_) {}
    }
    this.videoElements.clear();
  }
}

export const videoSourceCache = new VideoSourceCache();
