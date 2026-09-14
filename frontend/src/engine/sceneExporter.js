import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  AudioSampleSource,
  AudioSampleSink,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  BlobSource,
  UrlSource,
  ALL_FORMATS,
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
    this._audioInput = null;
  }

  cancel() {
    this.isCancelled = true;
    if (this._audioInput) {
      try {
        this._audioInput.dispose();
      } catch (_) {}
    }
  }

  /**
   * Extracts an AudioBuffer from an audio/video File, Blob, or URL using Web Audio.
   */
  async extractAudioBuffer(fileOrUrl) {
    try {
      let arrayBuffer = null;
      if (fileOrUrl instanceof Blob) {
        arrayBuffer = await fileOrUrl.arrayBuffer();
      } else if (typeof fileOrUrl === 'string' && fileOrUrl.trim()) {
        let fetchUrl = fileOrUrl.trim();
        if (fetchUrl.startsWith('/') && typeof window !== 'undefined') {
          fetchUrl = window.location.origin + fetchUrl;
        }
        const res = await fetch(fetchUrl);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
        }
      }

      if (!arrayBuffer) return null;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;

      const audioCtx = new AudioCtx();
      try {
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        return audioBuffer;
      } finally {
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Could not extract AudioBuffer via Web Audio fallback:', err);
      return null;
    }
  }

  /**
   * Runs the full client-side rendering and export pipeline.
   *
   * @param {Object} params
   * @param {File|Blob} [params.videoFile] - Original uploaded video file
   * @param {string} [params.videoUrl] - Video preview URL / stream endpoint
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

    // Extract & Attach Audio Track using Multi-Tier Pipeline
    let audioInput = null;
    let audioTrack = null;
    let audioSource = null;
    let audioMode = null; // 'transmux' | 'transcode' | 'buffer'
    let audioBuffer = null;

    try {
      // Resolve media source for Mediabunny Input
      let mediaSource = null;
      if (videoFile instanceof Blob) {
        mediaSource = new BlobSource(videoFile);
      } else if (typeof videoUrl === 'string' && videoUrl.trim()) {
        let fullUrl = videoUrl.trim();
        if (fullUrl.startsWith('/') && typeof window !== 'undefined') {
          fullUrl = window.location.origin + fullUrl;
        }
        mediaSource = new UrlSource(fullUrl);
      }

      if (mediaSource) {
        try {
          audioInput = new Input({
            source: mediaSource,
            formats: ALL_FORMATS
          });
          this._audioInput = audioInput;
          const tracks = await audioInput.getAudioTracks();
          if (tracks && tracks.length > 0) {
            audioTrack = tracks[0];
          }
        } catch (inputErr) {
          console.warn('Could not initialize audio input via Mediabunny:', inputErr);
        }
      }

      const supportedCodecs = outputFormat.getSupportedAudioCodecs();

      // Tier 1: Fast Direct Packet Transmuxing (Lossless, Instant)
      if (audioTrack && supportedCodecs.includes(audioTrack.codec)) {
        audioSource = new EncodedAudioPacketSource(audioTrack.codec);
        output.addAudioTrack(audioSource);
        audioMode = 'transmux';
      }
      // Tier 2: WebCodecs Re-encoding (AudioSampleSource)
      else if (audioTrack && typeof AudioDecoder !== 'undefined' && typeof AudioEncoder !== 'undefined') {
        try {
          const canDecode = await audioTrack.canDecode();
          if (canDecode) {
            const targetCodec = this.format === 'webm' ? 'opus' : 'aac';
            audioSource = new AudioSampleSource({
              codec: targetCodec,
              quality: QUALITY_HIGH
            });
            output.addAudioTrack(audioSource);
            audioMode = 'transcode';
          }
        } catch (sampleErr) {
          console.warn('WebCodecs audio sample track setup failed:', sampleErr);
        }
      }

      // Tier 3: Web Audio Buffer Fallback
      if (!audioMode) {
        audioBuffer = await this.extractAudioBuffer(videoFile || videoUrl);
        if (audioBuffer) {
          let audioCodec = this.format === 'webm' ? 'opus' : 'aac';
          if (audioCodec === 'aac' && typeof AudioEncoder !== 'undefined') {
            const { supported } = await AudioEncoder.isConfigSupported({
              codec: 'mp4a.40.2',
              sampleRate: audioBuffer.sampleRate,
              numberOfChannels: audioBuffer.numberOfChannels,
              bitrate: 192000
            }).catch(() => ({ supported: false }));
            if (!supported) audioCodec = 'opus';
          }

          audioSource = new AudioBufferSource({
            codec: audioCodec,
            bitrate: QUALITY_HIGH
          });
          output.addAudioTrack(audioSource);
          audioMode = 'buffer';
        }
      }
    } catch (audioSetupErr) {
      console.warn('Failed to configure audio track, continuing video-only:', audioSetupErr);
      audioSource = null;
      audioMode = null;
    }

    // Start encoder
    await output.start();

    // Start Audio Pump concurrently with video frame rendering
    let audioPumpPromise = null;
    if (audioSource && audioMode) {
      audioPumpPromise = (async () => {
        try {
          if (audioMode === 'transmux' && audioTrack) {
            const sink = new EncodedPacketSink(audioTrack);
            const decoderConfig = await audioTrack.getDecoderConfig();
            const meta = { decoderConfig: decoderConfig ?? undefined };
            for await (const packet of sink.packets()) {
              if (this.isCancelled) break;
              if (packet.timestamp >= duration) break;
              await audioSource.add(packet, meta);
            }
            audioSource.close();
          } else if (audioMode === 'transcode' && audioTrack) {
            const sink = new AudioSampleSink(audioTrack);
            for await (const sample of sink.samples(0, duration)) {
              if (this.isCancelled) break;
              await audioSource.add(sample);
            }
            audioSource.close();
          } else if (audioMode === 'buffer' && audioBuffer) {
            await audioSource.add(audioBuffer);
            audioSource.close();
          }
        } catch (pumpErr) {
          console.warn('Audio pump error:', pumpErr);
          try {
            audioSource.close();
          } catch (_) {}
        }
      })();
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
      if (audioInput) {
        try { await audioInput.dispose(); } catch (_) {}
      }
      throw new Error('Export cancelled by user');
    }

    // Finalize video and audio tracks
    videoSource.close();
    if (audioPumpPromise) {
      await audioPumpPromise.catch(err => console.warn('Audio pump error on finalize:', err));
    }
    await output.finalize();

    if (audioInput) {
      try { await audioInput.dispose(); } catch (_) {}
    }

    const buffer = target.buffer;
    if (!buffer) {
      throw new Error('Failed to generate export video buffer');
    }

    const mimeType = this.format === 'webm' ? 'video/webm' : 'video/mp4';
    return new Blob([buffer], { type: mimeType });
  }
}

