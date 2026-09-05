import { RecordingPresets, type AudioRecorder, type RecordingInput } from 'expo-audio';
import { Platform } from 'react-native';

export const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 48000,
  numberOfChannels: 1,
  bitRate: 192000,
  isMeteringEnabled: true,
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 192000,
  },
};

export const DEFAULT_INPUT_LABEL = 'ブラウザ・端末の既定マイク';

export function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function inputDisplayName(input: { name: string; type: string }) {
  return input.name || input.type || '既定のマイク';
}

const ALIAS_PREFIX = /^(既定|通信|default|communications?)\s*[-–—:]/i;

function normalizeInputName(name: string) {
  return name
    .replace(/^(既定|通信|default|communications?)\s*[-–—:]\s*/i, '')
    .trim()
    .toLocaleLowerCase();
}

function isInputAlias(input: RecordingInput) {
  return input.type.toLocaleLowerCase() === 'default' || ALIAS_PREFIX.test(input.name);
}

/**
 * Browsers list the same physical microphone several times ("既定 - X", "通信 - X", "X").
 * Keep one entry per device, preferring the concrete one over the alias.
 */
export function deduplicateInputs(inputs: RecordingInput[]) {
  const uniqueInputs = new Map<string, RecordingInput>();
  for (const input of inputs) {
    const key = normalizeInputName(input.name);
    const existing = uniqueInputs.get(key);
    if (!existing || (isInputAlias(existing) && !isInputAlias(input))) {
      uniqueInputs.set(key, input);
    }
  }
  return Array.from(uniqueInputs.values());
}

/** `record()` returns before capture actually starts; poll until it does. */
export async function waitForRecorderStart(recorder: AudioRecorder, attempts = 20, interval = 50) {
  for (let attempt = 0; attempt < attempts && !recorder.getStatus().isRecording; attempt += 1) {
    await wait(interval);
  }
  return recorder.getStatus().isRecording;
}

type PatchedMediaDevices = MediaDevices & {
  __speechFitnessOriginalGetUserMedia?: MediaDevices['getUserMedia'];
};

/**
 * Turn off browser voice processing (echo cancellation, noise suppression, auto gain) so the
 * recording reflects the speaker's actual articulation. Safe to call repeatedly.
 */
export function installHighFidelityWebMicrophoneConstraints() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return;
  }
  const mediaDevices = navigator.mediaDevices as PatchedMediaDevices;
  if (mediaDevices.__speechFitnessOriginalGetUserMedia) return;

  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  mediaDevices.__speechFitnessOriginalGetUserMedia = originalGetUserMedia;
  mediaDevices.getUserMedia = (constraints: MediaStreamConstraints) => {
    if (!constraints.audio) return originalGetUserMedia(constraints);
    const requestedAudio = typeof constraints.audio === 'object' ? constraints.audio : {};
    return originalGetUserMedia({
      ...constraints,
      audio: {
        ...requestedAudio,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
      },
    });
  };
}
