import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingInput,
} from 'expo-audio';
import { useEffect, useState } from 'react';

import {
  getMicrophonePreference,
  resolveMicrophonePreference,
  saveMicrophonePreference,
  type MicrophonePreference,
} from '@/lib/microphone-preference';
import {
  DEFAULT_INPUT_LABEL,
  deduplicateInputs,
  inputDisplayName,
  installHighFidelityWebMicrophoneConstraints,
  wait,
  waitForRecorderStart,
} from '@/lib/recording-inputs';

export type MicrophoneSelection = ReturnType<typeof useMicrophoneSelection>;

/**
 * Microphone list, current choice, and the stored preference for one recorder.
 * The recorder must already be created by the screen; this hook only configures its input.
 */
export function useMicrophoneSelection(recorder: AudioRecorder) {
  const [preference, setPreference] = useState<MicrophonePreference | null>(null);
  const [currentInputName, setCurrentInputName] = useState(DEFAULT_INPUT_LABEL);
  const [availableInputs, setAvailableInputs] = useState<RecordingInput[]>([]);
  const [hasProbedInputs, setHasProbedInputs] = useState(false);
  const [selectedInputUid, setSelectedInputUid] = useState<string | null>(null);
  const [isLoadingInputs, setIsLoadingInputs] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installHighFidelityWebMicrophoneConstraints();
    let active = true;
    getMicrophonePreference().then((stored) => {
      if (!active || !stored) return;
      setPreference(stored);
      setSelectedInputUid(stored.uid);
      setCurrentInputName(inputDisplayName(stored));
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Call after `recorder.prepareToRecordAsync()`. Applies the stored preference or the
   * user's in-session choice to the recorder and reports what is actually in use.
   */
  const applyPreferredInput = async () => {
    const inputs = deduplicateInputs(recorder.getAvailableInputs());
    const preferred =
      resolveMicrophonePreference(inputs, preference) ??
      inputs.find((input) => input.uid === selectedInputUid) ??
      null;
    if (preferred) recorder.setInput(preferred.uid);
    const current = preferred ?? (await recorder.getCurrentInput());
    setAvailableInputs(inputs);
    setHasProbedInputs(true);
    setSelectedInputUid(current.uid);
    setCurrentInputName(inputDisplayName(current));
    return current;
  };

  const loadInputs = async () => {
    setError(null);
    setIsLoadingInputs(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('マイク一覧を表示するには、マイクの利用許可が必要です。');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      await applyPreferredInput();
      setIsListOpen(true);
      // Browsers only reveal real device names once capture has started, so run a brief
      // silent capture and discard it.
      recorder.record();
      if (await waitForRecorderStart(recorder)) {
        await wait(120);
        await recorder.stop();
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      if (recorder.getStatus().isRecording) {
        await recorder.stop().catch(() => undefined);
      }
      setError('マイク一覧を取得できませんでした。接続状態を確認してください。');
    } finally {
      setIsLoadingInputs(false);
    }
  };

  const selectInput = async (input: RecordingInput) => {
    try {
      recorder.setInput(input.uid);
      setSelectedInputUid(input.uid);
      setCurrentInputName(inputDisplayName(input));
      setPreference(await saveMicrophonePreference(input));
      setError(null);
    } catch {
      setError('このマイクを選択できませんでした。もう一度一覧を読み込んでください。');
    }
  };

  return {
    currentInputName,
    availableInputs,
    hasProbedInputs,
    selectedInputUid,
    isLoadingInputs,
    isListOpen,
    error,
    openList: () => setIsListOpen(true),
    closeList: () => setIsListOpen(false),
    loadInputs,
    selectInput,
    applyPreferredInput,
  };
}
