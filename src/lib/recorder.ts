import { RecordingPresets, type AudioRecorder } from 'expo-audio';
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

export function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
