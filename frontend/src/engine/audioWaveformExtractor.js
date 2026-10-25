/**
 * Audio Waveform Extraction Engine
 * Extracts and downsamples audio amplitude peaks from video/audio files
 * for high-performance canvas timeline rendering.
 */

const waveformCache = new Map();

/**
 * Generate synthetic vocal waveform peaks based on caption segments
 * (Used as instantaneous fallback or when video has silent/no audio stream)
 */
export function generateSyntheticPeaks(duration = 10, segments = [], samplesPerSecond = 80) {
  const totalSamples = Math.max(10, Math.floor(duration * samplesPerSecond));
  const peaks = new Float32Array(totalSamples);

  // Background room tone base amplitude
  for (let i = 0; i < totalSamples; i++) {
    peaks[i] = 0.06 + Math.random() * 0.04;
  }

  // Inject speech bursts where segments and words exist
  if (segments && segments.length > 0) {
    for (const seg of segments) {
      const segStartSample = Math.floor(seg.start * samplesPerSecond);
      const segEndSample = Math.min(totalSamples - 1, Math.ceil(seg.end * samplesPerSecond));

      if (seg.words && seg.words.length > 0) {
        for (const w of seg.words) {
          const wStart = Math.floor(w.start * samplesPerSecond);
          const wEnd = Math.min(totalSamples - 1, Math.ceil(w.end * samplesPerSecond));
          const wLen = Math.max(1, wEnd - wStart);

          for (let s = wStart; s <= wEnd; s++) {
            if (s >= 0 && s < totalSamples) {
              const progress = (s - wStart) / wLen;
              // Bell-curve shape for vocal word envelope
              const envelope = Math.sin(progress * Math.PI);
              const jitter = 0.7 + Math.random() * 0.3;
              peaks[s] = Math.min(1.0, 0.25 + envelope * 0.65 * jitter);
            }
          }
        }
      } else {
        // Segment-level envelope
        for (let s = segStartSample; s <= segEndSample; s++) {
          if (s >= 0 && s < totalSamples) {
            peaks[s] = 0.35 + Math.random() * 0.45;
          }
        }
      }
    }
  }

  return peaks;
}

/**
 * Extracts true PCM audio peaks from a File or URL
 */
export async function extractAudioPeaks({
  file = null,
  url = '',
  duration = 10,
  segments = [],
  samplesPerSecond = 80
}) {
  const cacheKey = file ? `${file.name}_${file.size}_${file.lastModified}` : (url || 'default');

  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey);
  }

  try {
    let arrayBuffer = null;

    if (file && file instanceof Blob) {
      arrayBuffer = await file.arrayBuffer();
    } else if (url && (url.startsWith('http') || url.startsWith('blob:'))) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP fetch error: ${response.status}`);
      arrayBuffer = await response.arrayBuffer();
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('No valid audio array buffer available');
    }

    // Decode Audio Data using AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }

    const audioCtx = new AudioContextClass();
    let audioBuffer = null;

    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Decoded audio buffer is empty');
    }

    const audioDuration = audioBuffer.duration || duration || 10;
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const totalOutputSamples = Math.max(10, Math.floor(audioDuration * samplesPerSecond));
    const samplesPerBucket = Math.max(1, Math.floor(sampleRate / samplesPerSecond));
    const peaks = new Float32Array(totalOutputSamples);

    // Sum channel data into mono peak envelopes
    const channelData = [];
    for (let c = 0; c < numChannels; c++) {
      channelData.push(audioBuffer.getChannelData(c));
    }

    let maxGlobalAmp = 0.01;

    for (let i = 0; i < totalOutputSamples; i++) {
      const startSample = i * samplesPerBucket;
      const endSample = Math.min(audioBuffer.length, startSample + samplesPerBucket);
      let sumSquares = 0;
      let count = 0;

      for (let s = startSample; s < endSample; s += 2) { // 2x step for fast computation
        let monoSample = 0;
        for (let c = 0; c < numChannels; c++) {
          monoSample += channelData[c][s] || 0;
        }
        monoSample = monoSample / numChannels;
        sumSquares += monoSample * monoSample;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      peaks[i] = rms;
      if (rms > maxGlobalAmp) maxGlobalAmp = rms;
    }

    // Normalize amplitude with headroom
    const normFactor = 1.0 / Math.max(0.05, maxGlobalAmp);
    for (let i = 0; i < totalOutputSamples; i++) {
      peaks[i] = Math.min(1.0, Math.max(0.04, peaks[i] * normFactor));
    }

    const result = {
      peaks,
      duration: audioDuration,
      samplesPerSecond,
      sampleRate,
      channels: numChannels,
      isSynthetic: false
    };

    waveformCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[AudioWaveform] Could not extract raw audio PCM, generating vocal envelope fallback:', err.message);
    const synthetic = generateSyntheticPeaks(duration, segments, samplesPerSecond);
    const result = {
      peaks: synthetic,
      duration: duration || 10,
      samplesPerSecond,
      sampleRate: 44100,
      channels: 2,
      isSynthetic: true
    };
    waveformCache.set(cacheKey, result);
    return result;
  }
}
