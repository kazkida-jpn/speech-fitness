/**
 * Encodes mono float samples as 16-bit PCM WAV, normalizing the peak to -0.7 dBFS
 * (gain capped at 8x) so quiet recordings still score sensibly.
 */
export function encodeMonoPcmWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? Math.min(8, 0.92 / peak) : 1;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] * gain));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export const ASSESSMENT_SAMPLE_RATE = 16000;

/**
 * Decodes a recording (WebM/Opus on the web) and resamples it to 16 kHz mono WAV, the
 * format Azure pronunciation assessment expects. Requires the Web Audio API.
 */
export async function convertRecordingToAssessmentWav(uri: string) {
  if (typeof AudioContext === 'undefined' || typeof OfflineAudioContext === 'undefined') {
    throw new Error('明瞭さのクラウド評価は現在Web版で利用できます。');
  }
  const response = await fetch(uri);
  const sourceData = await response.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(sourceData.slice(0));
    const frameCount = Math.max(1, Math.ceil(decoded.duration * ASSESSMENT_SAMPLE_RATE));
    const offlineContext = new OfflineAudioContext(1, frameCount, ASSESSMENT_SAMPLE_RATE);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start();
    const rendered = await offlineContext.startRendering();
    return encodeMonoPcmWav(rendered.getChannelData(0), ASSESSMENT_SAMPLE_RATE);
  } finally {
    await audioContext.close();
  }
}
