import { setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { RECORDING_OPTIONS, wait, waitForRecorderStart } from '@/lib/recorder';

export type TakeRecorderStatus = 'idle' | 'warming' | 'recording';

export type TakeRecording = {
  uri: string;
  /** First detected voice to last detected voice, with a small margin. */
  durationMillis: number;
  /** Whole recording after the warm-up period. */
  recordingDurationMillis: number;
  voiceDetected: boolean;
};

/** Time spent sampling the room before speech is expected. */
const WARMUP_MILLIS = 600;
const METERING_INTERVAL_MILLIS = 100;
/** Fallback room level in dBFS when the recorder reports no metering during warm-up. */
const DEFAULT_AMBIENT_LEVEL = -55;
/** Speech must exceed the room level by this much. */
const VOICE_MARGIN_DB = 10;
const MIN_VOICE_THRESHOLD = -50;
const MAX_VOICE_THRESHOLD = -30;
/** Consecutive loud samples before voice is considered to have started. */
const VOICE_START_SAMPLES = 2;
/** Margin added around the detected speech so it is not clipped. */
const VOICE_EDGE_MARGIN_MILLIS = 100;

/**
 * Records one take: measures the room during a warm-up, then tracks where speech starts
 * and ends so the returned duration excludes leading and trailing silence.
 */
export function useTakeRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MILLIS);
  const [status, setStatus] = useState<TakeRecorderStatus>('idle');
  const [speechOffsetMillis, setSpeechOffsetMillis] = useState(0);
  const voiceThresholdRef = useRef(-45);
  const voiceStartMillisRef = useRef<number | null>(null);
  const lastVoiceMillisRef = useRef<number | null>(null);
  const consecutiveVoiceSamplesRef = useRef(0);

  const elapsedMillis =
    status === 'recording'
      ? Math.max(0, (recorderState.durationMillis ?? 0) - speechOffsetMillis)
      : 0;

  useEffect(() => {
    if (status !== 'recording' || recorderState.metering === undefined) return;

    const elapsed = Math.max(0, (recorderState.durationMillis ?? 0) - speechOffsetMillis);
    if (recorderState.metering >= voiceThresholdRef.current) {
      consecutiveVoiceSamplesRef.current += 1;
      if (
        voiceStartMillisRef.current === null &&
        consecutiveVoiceSamplesRef.current >= VOICE_START_SAMPLES
      ) {
        voiceStartMillisRef.current = Math.max(0, elapsed - VOICE_EDGE_MARGIN_MILLIS);
      }
      if (voiceStartMillisRef.current !== null) {
        lastVoiceMillisRef.current = elapsed;
      }
    } else {
      consecutiveVoiceSamplesRef.current = 0;
    }
  }, [status, recorderState.durationMillis, recorderState.metering, speechOffsetMillis]);

  const resetVoiceTracking = () => {
    voiceStartMillisRef.current = null;
    lastVoiceMillisRef.current = null;
    consecutiveVoiceSamplesRef.current = 0;
  };

  /**
   * Starts capture. `configureInput` runs after the recorder is prepared and before
   * capture begins, so the caller can select a microphone. Throws if capture fails.
   */
  const start = async (configureInput?: () => Promise<unknown>) => {
    setStatus('warming');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      await configureInput?.();
      recorder.record();
      if (!(await waitForRecorderStart(recorder))) {
        throw new Error('Recorder did not start');
      }

      const ambientLevels: number[] = [];
      const warmupStartedAt = Date.now();
      while (Date.now() - warmupStartedAt < WARMUP_MILLIS) {
        await wait(METERING_INTERVAL_MILLIS);
        const level = recorder.getStatus().metering;
        if (level !== undefined && Number.isFinite(level)) ambientLevels.push(level);
      }
      const ambientLevel =
        ambientLevels.length > 0
          ? ambientLevels.reduce((total, level) => total + level, 0) / ambientLevels.length
          : DEFAULT_AMBIENT_LEVEL;
      voiceThresholdRef.current = Math.max(
        MIN_VOICE_THRESHOLD,
        Math.min(MAX_VOICE_THRESHOLD, ambientLevel + VOICE_MARGIN_DB)
      );
      setSpeechOffsetMillis(recorder.getStatus().durationMillis ?? WARMUP_MILLIS);
      resetVoiceTracking();
      setStatus('recording');
    } catch (error) {
      if (recorder.getStatus().isRecording) {
        await recorder.stop().catch(() => undefined);
      }
      setStatus('idle');
      throw error;
    }
  };

  /** Stops capture. Returns null when no file was produced; throws if stopping fails. */
  const stop = async (): Promise<TakeRecording | null> => {
    const recordingDurationMillis = Math.max(
      0,
      (recorder.getStatus().durationMillis ?? 0) - speechOffsetMillis
    );
    const voiceStartMillis = voiceStartMillisRef.current;
    const lastVoiceMillis = lastVoiceMillisRef.current;
    const voiceDetected = voiceStartMillis !== null && lastVoiceMillis !== null;
    const durationMillis = voiceDetected
      ? Math.max(100, lastVoiceMillis - voiceStartMillis + VOICE_EDGE_MARGIN_MILLIS)
      : 0;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } finally {
      setStatus('idle');
    }
    if (!recorder.uri) return null;
    return { uri: recorder.uri, durationMillis, recordingDurationMillis, voiceDetected };
  };

  const reset = () => {
    setSpeechOffsetMillis(0);
    resetVoiceTracking();
  };

  return { recorder, status, elapsedMillis, start, stop, reset };
}
