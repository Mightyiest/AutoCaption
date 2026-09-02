import { Input, ALL_FORMATS, BlobSource, CanvasSink } from 'mediabunny';

/**
 * Detects the native framerate (FPS) of a video file using Mediabunny track packet stats.
 *
 * @param {File|Blob} file
 * @returns {Promise<number>} Detected FPS (default 30)
 */
export async function detectNativeVideoFps(file) {
  if (!file) return 30;
  try {
    const input = new Input({
      source: new BlobSource(file),
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
   * Initializes or gets the Mediabunny CanvasSink for a given video file/blob.
   */
  async ensureSink(file) {
    const key = file.name || 'default-video';
    if (this.sinks.has(key)) {
      return this.sinks.get(key);
    }

    try {
      const input = new Input({
        source: new BlobSource(file),
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
   * @param {File|Blob} params.file
   * @param {string} [params.url]
   * @param {number} params.time - Timestamp in seconds
   * @returns {Promise<CanvasImageSource|null>}
   */
  async getFrameAt({ file, url, time }) {
    // 1. Try Mediabunny CanvasSink if file is present
    if (file) {
      const sinkData = await this.ensureSink(file);
      if (sinkData && sinkData.sink) {
        try {
          if (!sinkData.iterator || Math.abs(time - sinkData.lastTime) > 2.0) {
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
        } catch (sinkErr) {
          console.warn('CanvasSink frame extraction failed, falling back to video element:', sinkErr);
        }
      }
    }

    // 2. Fallback: Frame stepping via HTML5 Video element
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

    if (Math.abs(video.currentTime - time) > 0.03) {
      await new Promise(resolve => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = Math.max(0, Math.min(video.duration || 9999, time));
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
