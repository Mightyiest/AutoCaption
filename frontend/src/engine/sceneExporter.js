import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH
} from 'mediabunny';

import { createCaptionScene } from './captionScene';
import { renderCompositeFrame } from './captionCanvasRenderer';
import { videoSourceCache } from './videoSourceCache';

const QUALITY_MAP = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH
};

/**
 * Client-Side Video Exporter based on OpenCut's SceneExporter.
 * Encodes composite video frames and audio 100% inside the browser
 * using WebCodecs/Mediabunny for true 1:1 visual parity.
 */
export class ClientSceneExporter {
  constructor({
    width = 1080,
    height = 1920,
    fps = 30,
    format = 'mp4',
    quality = 'high'
  } = {}) {
    this.width = Number(width) || 1080;
    this.height = Number(height) || 1920;
    this.fps = Number(fps) || 30;
    this.format = format;
    this.quality = quality;
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
  }

  /**
   * Extracts an AudioBuffer from an audio/video File or Blob using Web Audio.
   */
  async extractAudioBuffer(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();
      return audioBuffer;
    } catch (err) {
      console.warn('Could not extract AudioBuffer from source video:', err);
      return null;
    }
  }

  /**
   * Runs the full client-side rendering and export pipeline.
   *
   * @param {Object} params
   * @param {File|Blob} params.videoFile - Original uploaded video file
   * @param {string} [params.videoUrl] - Video preview URL
   * @param {number} params.duration - Total video duration in seconds
   * @param {Array} params.segments - Caption segments
   * @param {Object} params.style - Caption style configuration
   * @param {Function} [params.onProgress] - Progress callback (stats) => void
   * @returns {Promise<Blob>} Exported MP4/WebM video Blob
   */
  async exportVideo({
    videoFile,
    videoUrl,
    duration = 10,
    segments = [],
    style = {},
    onProgress = () => {}
  }) {
    this.isCancelled = false;

    // Create Offscreen / Master Canvas
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;

    // Configure Output Format & Target
    const outputFormat = this.format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
    const target = new BufferTarget();
    const output = new Output({
      format: outputFormat,
      target
    });

    // Configure Video Source
    const videoCodec = this.format === 'webm' ? 'vp9' : 'avc';
    const bitrate = QUALITY_MAP[this.quality] || QUALITY_HIGH;
    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec,
      bitrate
    });

    output.addVideoTrack(videoSource, { frameRate: this.fps });

    // Extract & Attach Audio Track
    let audioBuffer = null;
    let audioSource = null;
    if (videoFile) {
      audioBuffer = await this.extractAudioBuffer(videoFile);
    }

    if (audioBuffer) {
      try {
        let audioCodec = this.format === 'webm' ? 'opus' : 'aac';
        if (audioCodec === 'aac' && typeof AudioEncoder !== 'undefined') {
          const { supported } = await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2',
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            bitrate: 192000
          });
          if (!supported) audioCodec = 'opus';
        }

        audioSource = new AudioBufferSource({
          codec: audioCodec,
          bitrate: QUALITY_HIGH
        });
        output.addAudioTrack(audioSource);
      } catch (audioErr) {
        console.warn('Audio track setup failed, continuing video-only export:', audioErr);
        audioSource = null;
      }
    }

    // Start encoder
    await output.start();

    // Write Audio
    if (audioSource && audioBuffer) {
      try {
        await audioSource.add(audioBuffer);
        audioSource.close();
      } catch (err) {
        console.warn('Audio buffer write error:', err);
      }
    }

    // Precise frame-time calculations (integer frame indices)
    const totalFrames = Math.max(1, Math.round(duration * this.fps));
    const frameInterval = 1 / this.fps;

    const startTime = performance.now();

    // Build base scene
    const scene = createCaptionScene({
      style,
      segments,
      canvasSize: { width: this.width, height: this.height, fps: this.fps },
      currentTime: 0,
      videoInfo: {
        file: videoFile,
        url: videoUrl,
        duration,
        fit: 'cover'
      }
    });

    // Frame encoding loop
    for (let i = 0; i < totalFrames; i++) {
      if (this.isCancelled) {
        await output.cancel();
        videoSourceCache.clear();
        throw new Error('Export cancelled by user');
      }

      const frameTime = i * frameInterval;

      // Extract background video frame
      let videoFrame = await videoSourceCache.getFrameAt({
        file: videoFile,
        url: videoUrl,
        time: frameTime
      });

      // Composite video + styled captions onto canvas
      await renderCompositeFrame({
        canvas,
        videoFrame,
        scene,
        currentTime: frameTime
      });

      // Pipe rendered canvas frame to video encoder with exact timestamp & duration
      await videoSource.add(frameTime, frameInterval);

      // Report progress
      const progress = (i + 1) / totalFrames;
      const elapsedMs = performance.now() - startTime;
      const avgFrameMs = elapsedMs / (i + 1);
      const remainingSec = Math.max(0, ((totalFrames - (i + 1)) * avgFrameMs) / 1000);

      onProgress({
        progress,
        currentFrame: i + 1,
        totalFrames,
        percent: Math.round(progress * 100),
        fps: this.fps,
        etaSeconds: Math.round(remainingSec)
      });
    }

    if (this.isCancelled) {
      await output.cancel();
      videoSourceCache.clear();
      throw new Error('Export cancelled by user');
    }

    // Finalize
    videoSource.close();
    await output.finalize();

    const buffer = target.buffer;
    if (!buffer) {
      throw new Error('Failed to generate export video buffer');
    }

    const mimeType = this.format === 'webm' ? 'video/webm' : 'video/mp4';
    return new Blob([buffer], { type: mimeType });
  }
}
