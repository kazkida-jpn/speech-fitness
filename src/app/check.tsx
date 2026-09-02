import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { RecordingInput } from 'expo-audio';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { DRILLS, recommendDrills } from '@/lib/drills';
import {
  getMicrophonePreference,
  resolveMicrophonePreference,
  saveMicrophonePreference,
  type MicrophonePreference,
} from '@/lib/microphone-preference';
import { saveAssessmentHistory } from '@/lib/progress';

const TEST_TEXT_POOLS = [
  [
    '新しい施設では、少しずつ準備を進め、必要な資料を順番に整理しています。',
    '静かな図書室で資料を探し、必要な箇所に印をつけて順序よく整理しました。',
    '週末の朝は涼しい風を感じながら、川沿いの道を少しずつ進んでいきます。',
  ],
  [
    '公園の広場では、子どもたちがボールを投げたり、元気に走ったりして遊んでいます。',
    '料理をおいしく仕上げるため、材料を量ってから火加減と時間を丁寧に調整します。',
    '会議では結論を最初に伝え、理由と具体的な例を順番に説明してください。',
  ],
  [
    '出発の前に切符と案内を確認し、ゆっくり深呼吸して電車を待ちましょう。',
    '旅行の前日には荷物を一覧にして、切符や充電器を忘れていないか確認しましょう。',
    '庭に植えた小さな苗は、毎朝水を与えるうちに育ち、鮮やかな花を咲かせています。',
  ],
];

const TAKE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
const SOUND_FOCUS = [
  'サ行・ザ行・シ・ジ・チ・ツ',
  'カ行・ガ行・タ行・ダ行・パ行・バ行・ラ行',
  '長音・促音・撥音・母音の連続',
];

function createTestSet(previous?: string[]) {
  const next = TEST_TEXT_POOLS.map((pool, index) => {
    const candidates = previous ? pool.filter((text) => text !== previous[index]) : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
  });
  return next;
}

const RECORDING_OPTIONS = {
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

const RECORDER_WARMUP_MILLIS = 600;

type SpeechFitnessMediaDevices = MediaDevices & {
  __speechFitnessOriginalGetUserMedia?: MediaDevices['getUserMedia'];
};

function installHighFidelityWebMicrophoneConstraints() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return;
  }
  const mediaDevices = navigator.mediaDevices as SpeechFitnessMediaDevices;
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

installHighFidelityWebMicrophoneConstraints();

type Phase = 'ready' | 'warming' | 'recording' | 'recorded' | 'complete';

type RecordedTake = {
  uri: string;
  durationMillis: number;
  recordingDurationMillis: number;
  microphoneName: string;
  voiceDetected: boolean;
};

type ClarityWord = {
  word: string;
  accuracyScore: number;
  errorType: string;
  offsetSeconds: number;
  durationSeconds: number;
};

type ClarityAssessment = {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  recognizedText: string;
  words: ClarityWord[];
};

type AiDiagnosis = {
  headline: string;
  summary: string;
  strengths: string[];
  cautions: string[];
  soundTendencies: string[];
  stability: string;
  practice: string;
  recommendedDrillId: string;
  recommendedDrillReason: string;
};

type WordSpeedComparison = {
  word: string;
  naturalScore: number;
  fastScore: number;
  drop: number;
};

function encodeMonoPcmWav(samples: Float32Array, sampleRate: number) {
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

async function convertRecordingToAssessmentWav(uri: string) {
  if (Platform.OS !== 'web') {
    throw new Error('明瞭さのクラウド評価は現在Web版で利用できます。');
  }
  const response = await fetch(uri);
  const sourceData = await response.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(sourceData.slice(0));
    const sampleRate = 16000;
    const frameCount = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start();
    const rendered = await offlineContext.startRendering();
    return encodeMonoPcmWav(rendered.getChannelData(0), sampleRate);
  } finally {
    await audioContext.close();
  }
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatResultTime(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)}秒`;
}

function calculateSpeedChange(naturalTake?: RecordedTake, fastTake?: RecordedTake) {
  if (
    !naturalTake?.voiceDetected ||
    !fastTake?.voiceDetected ||
    naturalTake.durationMillis <= 0 ||
    fastTake.durationMillis <= 0
  ) {
    return null;
  }
  return Math.round((naturalTake.durationMillis / fastTake.durationMillis - 1) * 100);
}

function coefficientOfVariation(values: number[]) {
  if (values.length === 0) return null;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  if (average === 0) return null;
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.round((Math.sqrt(variance) / average) * 100);
}

function countLongPauses(result: ClarityAssessment) {
  const spokenWords = result.words
    .filter((word) => word.errorType !== 'Omission' && word.durationSeconds > 0)
    .sort((left, right) => left.offsetSeconds - right.offsetSeconds);
  let pauses = 0;
  for (let index = 1; index < spokenWords.length; index += 1) {
    const previousEnd = spokenWords[index - 1].offsetSeconds + spokenWords[index - 1].durationSeconds;
    if (spokenWords[index].offsetSeconds - previousEnd >= 0.6) pauses += 1;
  }
  return pauses;
}

function normalizeComparedWord(word: string) {
  return word.replace(/[\s、。！？!?「」『』（）()・]/g, '').trim();
}

function compareWordsBySpeed(results: Partial<Record<number, ClarityAssessment>>) {
  const comparisons: WordSpeedComparison[] = [];
  for (let sentenceIndex = 0; sentenceIndex < 3; sentenceIndex += 1) {
    const natural = results[sentenceIndex * 2 + 1];
    const fast = results[sentenceIndex * 2 + 2];
    if (!natural || !fast || natural.completenessScore < 70 || fast.completenessScore < 70) continue;

    const availableFastWords = fast.words.map((word, index) => ({ word, index, used: false }));
    natural.words.forEach((naturalWord) => {
      const normalized = normalizeComparedWord(naturalWord.word);
      if (!normalized || naturalWord.errorType === 'Omission') return;
      const matched = availableFastWords.find(
        (candidate) => !candidate.used && candidate.word.errorType !== 'Omission' && normalizeComparedWord(candidate.word.word) === normalized
      );
      if (!matched) return;
      matched.used = true;
      comparisons.push({
        word: naturalWord.word,
        naturalScore: Math.round(naturalWord.accuracyScore),
        fastScore: Math.round(matched.word.accuracyScore),
        drop: Math.round(naturalWord.accuracyScore - matched.word.accuracyScore),
      });
    });
  }

  const mostRelevantByWord = new Map<string, WordSpeedComparison>();
  comparisons.forEach((comparison) => {
    const key = normalizeComparedWord(comparison.word);
    const previous = mostRelevantByWord.get(key);
    if (!previous || comparison.drop > previous.drop) mostRelevantByWord.set(key, comparison);
  });
  const unique = Array.from(mostRelevantByWord.values());
  return {
    declined: unique.filter((item) => item.drop > 0).sort((left, right) => right.drop - left.drop).slice(0, 3),
    maintained: unique
      .filter((item) => item.naturalScore >= 80 && item.fastScore >= 80 && item.drop <= 5)
      .sort((left, right) => right.fastScore - left.fastScore || left.drop - right.drop)
      .slice(0, 3),
  };
}

function wordScoreColors(score: number) {
  if (score >= 80) return { backgroundColor: '#DDF4EA', color: '#0F5E4D' };
  if (score >= 70) return { backgroundColor: '#EAF4D8', color: '#456124' };
  if (score >= 60) return { backgroundColor: '#FFF1BE', color: '#805B12' };
  return { backgroundColor: '#FFE1DA', color: '#9A3A2A' };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeInputName(name: string) {
  return name
    .replace(/^(既定|通信|default|communications?)\s*[-–—:]\s*/i, '')
    .trim()
    .toLocaleLowerCase();
}

function isInputAlias(input: RecordingInput) {
  return (
    input.type.toLocaleLowerCase() === 'default' ||
    /^(既定|通信|default|communications?)\s*[-–—:]/i.test(input.name)
  );
}

function deduplicateInputs(inputs: RecordingInput[]) {
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

export default function HomeScreen() {
  const router = useRouter();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(null);
  const speechOffsetMillisRef = useRef(0);
  const voiceThresholdRef = useRef(-45);
  const voiceStartMillisRef = useRef<number | null>(null);
  const lastVoiceMillisRef = useRef<number | null>(null);
  const consecutiveVoiceSamplesRef = useRef(0);
  const assessmentSavedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentStep, setCurrentStep] = useState(0);
  const [takes, setTakes] = useState<Partial<Record<number, RecordedTake>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionTexts, setSessionTexts] = useState<string[]>(() => createTestSet());
  const [currentInputName, setCurrentInputName] = useState('ブラウザ・端末の既定マイク');
  const [availableInputCount, setAvailableInputCount] = useState<number | null>(null);
  const [availableInputs, setAvailableInputs] = useState<RecordingInput[]>([]);
  const [selectedInputUid, setSelectedInputUid] = useState<string | null>(null);
  const [isLoadingInputs, setIsLoadingInputs] = useState(false);
  const [isInputListOpen, setIsInputListOpen] = useState(false);
  const [clarityResults, setClarityResults] = useState<Partial<Record<number, ClarityAssessment>>>({});
  const [isAnalyzingClarity, setIsAnalyzingClarity] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosis | null>(null);
  const [isCreatingDiagnosis, setIsCreatingDiagnosis] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [microphonePreference, setMicrophonePreference] = useState<MicrophonePreference | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  useEffect(() => {
    getMicrophonePreference().then((preference) => {
      if (!preference) return;
      setMicrophonePreference(preference);
      setSelectedInputUid(preference.uid);
      setCurrentInputName(preference.name || preference.type || '既定のマイク');
    });
  }, []);

  useEffect(() => {
    if (phase !== 'recording' || recorderState.metering === undefined) {
      return;
    }

    const elapsedMillis = Math.max(
      0,
      (recorderState.durationMillis ?? 0) - speechOffsetMillisRef.current
    );
    if (recorderState.metering >= voiceThresholdRef.current) {
      consecutiveVoiceSamplesRef.current += 1;
      if (voiceStartMillisRef.current === null && consecutiveVoiceSamplesRef.current >= 2) {
        voiceStartMillisRef.current = Math.max(0, elapsedMillis - 100);
      }
      if (voiceStartMillisRef.current !== null) {
        lastVoiceMillisRef.current = elapsedMillis;
      }
    } else {
      consecutiveVoiceSamplesRef.current = 0;
    }
  }, [phase, recorderState.durationMillis, recorderState.metering]);

  const loadMicrophoneInputs = async () => {
    setErrorMessage(null);
    setIsLoadingInputs(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('マイク一覧を表示するには、マイクの利用許可が必要です。');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      const inputs = deduplicateInputs(recorder.getAvailableInputs());
      const currentInput = await recorder.getCurrentInput();
      const preferredInput = resolveMicrophonePreference(inputs, microphonePreference);
      if (preferredInput) recorder.setInput(preferredInput.uid);
      setAvailableInputs(inputs);
      setAvailableInputCount(inputs.length);
      setIsInputListOpen(true);
      const displayedInput = preferredInput ?? currentInput;
      setCurrentInputName(displayedInput.name || displayedInput.type || '既定のマイク');
      if (selectedInputUid === null || preferredInput) {
        setSelectedInputUid(displayedInput.uid);
      }

      recorder.record();
      for (let attempt = 0; attempt < 20 && !recorder.getStatus().isRecording; attempt += 1) {
        await wait(50);
      }
      if (recorder.getStatus().isRecording) {
        await wait(120);
        await recorder.stop();
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      if (recorder.getStatus().isRecording) {
        await recorder.stop().catch(() => undefined);
      }
      setErrorMessage('マイク一覧を取得できませんでした。接続状態を確認してください。');
    } finally {
      setIsLoadingInputs(false);
    }
  };

  const selectMicrophoneInput = async (input: RecordingInput) => {
    try {
      recorder.setInput(input.uid);
      setSelectedInputUid(input.uid);
      setCurrentInputName(input.name || input.type || '既定のマイク');
      const preference = await saveMicrophonePreference(input);
      setMicrophonePreference(preference);
      setErrorMessage(null);
    } catch {
      setErrorMessage('このマイクを選択できませんでした。もう一度一覧を読み込んでください。');
    }
  };

  const isFastStep = currentStep % 2 === 1;
  const currentSentenceIndex = Math.floor(currentStep / 2);
  const currentTakeNumber = currentStep + 1;
  const instruction = useMemo(
    () =>
      !isFastStep
        ? '普段どおりの、自然で楽な速さで読んでください。'
        : '明瞭さを保てる範囲で、できるだけ速く読んでください。',
    [isFastStep]
  );

  const startRecording = async () => {
    setErrorMessage(null);
    setPhase('warming');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('マイクを使用できません。ブラウザまたは端末の設定から許可してください。');
      setPhase('ready');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      const availableInputs = deduplicateInputs(recorder.getAvailableInputs());
      const preferredInput =
        resolveMicrophonePreference(availableInputs, microphonePreference) ??
        availableInputs.find((input) => input.uid === selectedInputUid) ??
        null;
      if (preferredInput) recorder.setInput(preferredInput.uid);
      const currentInput = preferredInput ?? (await recorder.getCurrentInput());
      setAvailableInputs(availableInputs);
      setAvailableInputCount(availableInputs.length);
      setSelectedInputUid(currentInput.uid);
      setCurrentInputName(currentInput.name || currentInput.type || '既定のマイク');
      recorder.record();

      for (let attempt = 0; attempt < 20 && !recorder.getStatus().isRecording; attempt += 1) {
        await wait(50);
      }
      if (!recorder.getStatus().isRecording) {
        throw new Error('Recorder did not start');
      }

      const ambientLevels: number[] = [];
      const warmupStartedAt = Date.now();
      while (Date.now() - warmupStartedAt < RECORDER_WARMUP_MILLIS) {
        await wait(100);
        const level = recorder.getStatus().metering;
        if (level !== undefined && Number.isFinite(level)) {
          ambientLevels.push(level);
        }
      }
      const ambientLevel =
        ambientLevels.length > 0
          ? ambientLevels.reduce((total, level) => total + level, 0) / ambientLevels.length
          : -55;
      voiceThresholdRef.current = Math.max(-50, Math.min(-30, ambientLevel + 10));
      speechOffsetMillisRef.current = recorder.getStatus().durationMillis ?? RECORDER_WARMUP_MILLIS;
      voiceStartMillisRef.current = null;
      lastVoiceMillisRef.current = null;
      consecutiveVoiceSamplesRef.current = 0;
      setPhase('recording');
    } catch {
      if (recorder.getStatus().isRecording) {
        await recorder.stop().catch(() => undefined);
      }
      setErrorMessage('録音を開始できませんでした。マイクの接続を確認して、もう一度お試しください。');
      setPhase('ready');
    }
  };

  const stopRecording = async () => {
    const recordingDurationMillis = Math.max(
      0,
      (recorder.getStatus().durationMillis ?? 0) - speechOffsetMillisRef.current
    );
    const voiceStartMillis = voiceStartMillisRef.current;
    const lastVoiceMillis = lastVoiceMillisRef.current;
    const voiceDetected = voiceStartMillis !== null && lastVoiceMillis !== null;
    const durationMillis = voiceDetected
      ? Math.max(100, lastVoiceMillis - voiceStartMillis + 100)
      : 0;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) {
        setErrorMessage('録音データを作成できませんでした。もう一度録音してください。');
        setPhase('ready');
        return;
      }
      setTakes((current) => ({
        ...current,
        [currentTakeNumber]: {
          uri: recorder.uri as string,
          durationMillis,
          recordingDurationMillis,
          microphoneName: currentInputName,
          voiceDetected,
        },
      }));
      setPhase('recorded');
    } catch {
      setErrorMessage('録音を終了できませんでした。もう一度お試しください。');
      setPhase('ready');
    }
  };

  const continueTest = () => {
    if (currentStep < TAKE_NUMBERS.length - 1) {
      setCurrentStep((step) => step + 1);
      setPhase('ready');
      return;
    }
    setPhase('complete');
  };

  const playTake = async (take: RecordedTake) => {
    setErrorMessage(null);
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.pause();
      player.replace(take.uri);
      await player.seekTo(0);
      player.play();
    } catch {
      setErrorMessage('録音を再生できませんでした。もう一度測定してください。');
    }
  };

  const restartTest = (changeText: boolean) => {
    player.pause();
    setTakes({});
    setCurrentStep(0);
    setPhase('ready');
    setErrorMessage(null);
    setClarityResults({});
    setAiDiagnosis(null);
    setDiagnosisError(null);
    assessmentSavedRef.current = false;
    speechOffsetMillisRef.current = 0;
    voiceStartMillisRef.current = null;
    lastVoiceMillisRef.current = null;
    consecutiveVoiceSamplesRef.current = 0;
    if (changeText) setSessionTexts((current) => createTestSet(current));
  };

  const analyzeClarity = async () => {
    if (TAKE_NUMBERS.some((takeNumber) => !takes[takeNumber])) return;
    setErrorMessage(null);
    setIsAnalyzingClarity(true);
    try {
      const results: Partial<Record<number, ClarityAssessment>> = {};
      for (const takeNumber of TAKE_NUMBERS) {
        const take = takes[takeNumber];
        if (!take) continue;
        const wav = await convertRecordingToAssessmentWav(take.uri);
        const form = new FormData();
        form.append('audio', wav, `take-${takeNumber}.wav`);
        form.append('referenceText', sessionTexts[Math.floor((takeNumber - 1) / 2)]);
        const response = await fetch('/assessment', { method: 'POST', body: form });
        const body = (await response.json()) as ClarityAssessment & { error?: string };
        if (!response.ok) throw new Error(body.error ?? '明瞭さを評価できませんでした。');
        results[takeNumber] = body;
      }
      setClarityResults(results);
      await createAiDiagnosis(results);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '明瞭さを評価できませんでした。');
    } finally {
      setIsAnalyzingClarity(false);
    }
  };

  const createAiDiagnosis = async (
    results: Partial<Record<number, ClarityAssessment>> = clarityResults
  ) => {
    if (TAKE_NUMBERS.some((takeNumber) => !takes[takeNumber] || !results[takeNumber])) return;
    setDiagnosisError(null);
    setIsCreatingDiagnosis(true);
    const summarize = (result: ClarityAssessment) => ({
      pronunciationScore: result.pronunciationScore,
      accuracyScore: result.accuracyScore,
      fluencyScore: result.fluencyScore,
      completenessScore: result.completenessScore,
      recognizedText: result.recognizedText,
      unclearWords: result.words
        .filter((word) => word.errorType !== 'Omission' && word.accuracyScore < 80)
        .sort((left, right) => left.accuracyScore - right.accuracyScore)
        .slice(0, 8)
        .map((word) => ({ word: word.word, accuracyScore: word.accuracyScore })),
    });
    try {
      const naturalTakeNumbers = [1, 3, 5];
      const fastTakeNumbers = [2, 4, 6];
      const speakingRates = (takeNumbers: number[]) =>
        takeNumbers.map((takeNumber) => {
          const sentenceIndex = Math.floor((takeNumber - 1) / 2);
          const take = takes[takeNumber] as RecordedTake;
          return sessionTexts[sentenceIndex].replace(/[、。！？\s]/g, '').length / (take.durationMillis / 1000);
        });
      const averageScore = (takeNumbers: number[], field: 'fluencyScore') =>
        Math.round(
          takeNumbers.reduce(
            (total, takeNumber) => total + (results[takeNumber] as ClarityAssessment)[field],
            0
          ) / takeNumbers.length
        );
      const response = await fetch('/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: sessionTexts.map((referenceText, sentenceIndex) => {
            const naturalTakeNumber = sentenceIndex * 2 + 1;
            const fastTakeNumber = naturalTakeNumber + 1;
            const naturalTake = takes[naturalTakeNumber] as RecordedTake;
            const fastTake = takes[fastTakeNumber] as RecordedTake;
            return {
              referenceText,
              focusSounds: SOUND_FOCUS[sentenceIndex],
              speedChangePercent: calculateSpeedChange(naturalTake, fastTake),
              naturalDurationSeconds: naturalTake.durationMillis / 1000,
              fastDurationSeconds: fastTake.durationMillis / 1000,
              natural: summarize(results[naturalTakeNumber] as ClarityAssessment),
              fast: summarize(results[fastTakeNumber] as ClarityAssessment),
            };
          }),
          stability: {
            naturalRateVariationPercent: coefficientOfVariation(speakingRates(naturalTakeNumbers)),
            fastRateVariationPercent: coefficientOfVariation(speakingRates(fastTakeNumbers)),
            naturalAverageFluency: averageScore(naturalTakeNumbers, 'fluencyScore'),
            fastAverageFluency: averageScore(fastTakeNumbers, 'fluencyScore'),
            naturalLongPauseCount: naturalTakeNumbers.reduce(
              (total, takeNumber) => total + countLongPauses(results[takeNumber] as ClarityAssessment),
              0
            ),
            fastLongPauseCount: fastTakeNumbers.reduce(
              (total, takeNumber) => total + countLongPauses(results[takeNumber] as ClarityAssessment),
              0
            ),
          },
        }),
      });
      const body = (await response.json()) as AiDiagnosis & { error?: string };
      if (!response.ok) throw new Error(body.error || 'AI診断を作成できませんでした。');
      setAiDiagnosis(body);
      if (!assessmentSavedRef.current) {
        const diagnosisText = [
          body.headline,
          body.summary,
          ...body.cautions,
          ...body.soundTendencies,
          body.stability,
          body.practice,
        ].join(' ');
        const recommendedIds = [body.recommendedDrillId, ...recommendDrills(diagnosisText)]
          .filter((id, index, values) => id && values.indexOf(id) === index)
          .slice(0, 3);
        await saveAssessmentHistory({
          headline: body.headline,
          recommendedDrillIds: recommendedIds,
        });
        assessmentSavedRef.current = true;
      }
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : 'AI診断を作成できませんでした。');
    } finally {
      setIsCreatingDiagnosis(false);
    }
  };

  const pairSpeedChanges = sessionTexts.map((_, sentenceIndex) =>
    calculateSpeedChange(takes[sentenceIndex * 2 + 1], takes[sentenceIndex * 2 + 2])
  );
  const validSpeedChanges = pairSpeedChanges.filter((value): value is number => value !== null);
  const averageSpeedChange = validSpeedChanges.length
    ? Math.round(validSpeedChanges.reduce((total, value) => total + value, 0) / validSpeedChanges.length)
    : null;
  const recommendedDrill = aiDiagnosis
    ? DRILLS.find((drill) => drill.id === aiDiagnosis.recommendedDrillId) ?? null
    : null;
  const wordSpeedComparison = compareWordsBySpeed(clarityResults);
  const displayedDuration =
    phase === 'recording'
      ? Math.max(0, (recorderState.durationMillis ?? 0) - speechOffsetMillisRef.current)
      : phase === 'recorded'
        ? takes[currentTakeNumber]?.durationMillis ?? 0
        : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>WEEKLY CHECK</Text>
            <Text style={styles.logo}>発話チェック</Text>
          </View>
          <View style={styles.dayBadge}>
            <Text style={styles.dayLabel}>継続</Text>
            <Text style={styles.dayValue}>1日</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          {phase === 'complete' ? (
            <>
              <View style={styles.completeBadge}>
                <Text style={styles.completeBadgeText}>測定完了</Text>
              </View>
              <Text style={styles.heroTitle}>6回の録音が完了しました</Text>
              <Text style={styles.instruction}>
                3つの例文を比較して、速さを上げても明瞭に話せているか確認しましょう。
              </Text>

              <View style={styles.resultList}>
                {sessionTexts.map((referenceText, sentenceIndex) => (
                  <View key={referenceText} style={styles.resultGroup}>
                    <Text style={styles.resultGroupLabel}>例文 {sentenceIndex + 1}</Text>
                    <Text style={styles.resultReference}>{referenceText}</Text>
                    {[0, 1].map((modeIndex) => {
                      const takeNumber = sentenceIndex * 2 + modeIndex + 1;
                      const take = takes[takeNumber];
                      if (!take) return null;
                      return (
                        <View key={takeNumber} style={styles.resultRow}>
                          <View>
                            <Text style={styles.resultLabel}>
                              {modeIndex === 0 ? '自然な速さ' : 'できるだけ速く'}
                            </Text>
                            <Text style={styles.resultTime}>
                              {take.voiceDetected
                                ? `発話 ${formatResultTime(take.durationMillis)}`
                                : '発話を検出できませんでした'}
                            </Text>
                            <Text style={styles.resultMic}>マイク: {take.microphoneName}</Text>
                          </View>
                          <Pressable style={styles.playButton} onPress={() => playTake(take)}>
                            <Text style={styles.playButtonText}>▶ 再生</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>時間から見た速度差</Text>
                <Text style={styles.summaryValue}>
                  {averageSpeedChange === null
                    ? '今回は算出できませんでした'
                    : averageSpeedChange >= 0
                      ? `3例文の平均で約 ${averageSpeedChange}% 速くなりました`
                      : `3例文の平均で約 ${Math.abs(averageSpeedChange)}% ゆっくりでした`}
                </Text>
                <Text style={styles.summaryNote}>
                  前後の無音を除いた、最初の発話から最後の発話までの簡易比較です。
                </Text>
              </View>

              {(wordSpeedComparison.declined.length > 0 || wordSpeedComparison.maintained.length > 0) && (
                <View style={styles.wordComparisonCard}>
                  <Text style={styles.wordComparisonEyebrow}>言葉ごとの明瞭さ × 速度</Text>
                  <Text style={styles.wordComparisonTitle}>早口で変化した言葉</Text>
                  <Text style={styles.wordComparisonNote}>同じ言葉の発音精度を比べ、変化が大きい順に表示しています。</Text>
                  {wordSpeedComparison.declined.length > 0 && (
                    <View style={styles.wordComparisonSection}>
                      <Text style={styles.wordComparisonSectionTitle}>早口で低下が大きかった言葉</Text>
                      {wordSpeedComparison.declined.map((item) => (
                        <View key={`declined-${item.word}`} style={styles.wordComparisonRow}>
                          <Text style={styles.wordComparisonWord}>{item.word}</Text>
                          <View style={styles.wordComparisonScores}>
                            <View style={[styles.wordScore, { backgroundColor: wordScoreColors(item.naturalScore).backgroundColor }]}><Text style={styles.wordScoreLabel}>通常</Text><Text style={[styles.wordScoreValue, { color: wordScoreColors(item.naturalScore).color }]}>{item.naturalScore}</Text></View>
                            <Text style={styles.wordComparisonArrow}>→</Text>
                            <View style={[styles.wordScore, { backgroundColor: wordScoreColors(item.fastScore).backgroundColor }]}><Text style={styles.wordScoreLabel}>早口</Text><Text style={[styles.wordScoreValue, { color: wordScoreColors(item.fastScore).color }]}>{item.fastScore}</Text></View>
                            <Text style={styles.wordDrop}>−{item.drop}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  {wordSpeedComparison.maintained.length > 0 && (
                    <View style={styles.wordComparisonSection}>
                      <Text style={styles.wordComparisonSectionTitle}>早口でも明瞭さを保てた言葉</Text>
                      {wordSpeedComparison.maintained.map((item) => (
                        <View key={`maintained-${item.word}`} style={styles.wordComparisonRow}>
                          <Text style={styles.wordComparisonWord}>{item.word}</Text>
                          <View style={styles.wordComparisonScores}>
                            <View style={[styles.wordScore, { backgroundColor: wordScoreColors(item.naturalScore).backgroundColor }]}><Text style={styles.wordScoreLabel}>通常</Text><Text style={[styles.wordScoreValue, { color: wordScoreColors(item.naturalScore).color }]}>{item.naturalScore}</Text></View>
                            <Text style={styles.wordComparisonArrow}>→</Text>
                            <View style={[styles.wordScore, { backgroundColor: wordScoreColors(item.fastScore).backgroundColor }]}><Text style={styles.wordScoreLabel}>早口</Text><Text style={[styles.wordScoreValue, { color: wordScoreColors(item.fastScore).color }]}>{item.fastScore}</Text></View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.wordComparisonFootnote}>文章一致度が70点未満の測定と、照合上「脱落」とされた語は比較から除いています。</Text>
                </View>
              )}

              {TAKE_NUMBERS.map((takeNumber) => {
                const result = clarityResults[takeNumber];
                if (!result) return null;
                const unclearWords = result.words
                  .filter(
                    (word) =>
                      word.errorType !== 'Omission' &&
                      (word.accuracyScore < 80 || word.errorType !== 'None')
                  )
                  .sort((left, right) => left.accuracyScore - right.accuracyScore)
                  .slice(0, 8);
                const omittedWords = result.words.filter((word) => word.errorType === 'Omission');
                return (
                  <View key={takeNumber} style={styles.clarityCard}>
                    <Text style={styles.clarityLabel}>
                      例文 {Math.ceil(takeNumber / 2)}・{takeNumber % 2 === 1 ? '自然な速さ' : 'できるだけ速く'}
                    </Text>
                    <Text style={styles.clarityScore}>
                      {Math.round(result.pronunciationScore)} / 100
                    </Text>
                    <View style={styles.scoreGrid}>
                      <Text style={styles.scoreItem}>発音精度 {Math.round(result.accuracyScore)} / 100</Text>
                      <Text style={styles.scoreItem}>流暢さ {Math.round(result.fluencyScore)} / 100</Text>
                      <Text style={styles.scoreItem}>文章一致度 {Math.round(result.completenessScore)} / 100</Text>
                    </View>
                    {result.completenessScore < 70 && (
                      <View style={styles.assessmentWarning}>
                        <Text style={styles.assessmentWarningTitle}>この総合点は判定保留です</Text>
                        <Text style={styles.assessmentWarningText}>
                          Azureが提示文の大部分を対応付けられていないため、発音精度と総合点も実際より低く出ている可能性があります。
                        </Text>
                      </View>
                    )}
                    <Text style={styles.recognizedLabel}>Azureが認識した文章</Text>
                    <Text style={styles.recognizedText}>
                      {result.recognizedText || '認識結果の文章がありません'}
                    </Text>
                    <Text style={styles.unclearTitle}>
                      {unclearWords.length > 0 ? '聞き取りにくかった可能性のある語' : '目立って不明瞭な語はありません'}
                    </Text>
                    {unclearWords.length > 0 && (
                      <View style={styles.wordList}>
                        {unclearWords.map((word, index) => (
                          <View key={`${word.word}-${index}`} style={styles.wordChip}>
                            <Text style={styles.wordChipText}>{word.word || '（脱落）'} {Math.round(word.accuracyScore)}点</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {omittedWords.length > 0 && (
                      <Text style={styles.omissionNote}>
                        Azureが提示文と対応付けられなかった語が {omittedWords.length} 個あります。これは発音0点ではなく、照合上の脱落扱いです。
                      </Text>
                    )}
                    <Text style={styles.clarityNote}>
                      発音精度は音素の近さ、流暢さは語間の無音、文章一致度は提示文の語をどれだけ認識できたかを示します。文章一致度が低い場合、総合点は発声能力の評価として扱いません。
                    </Text>
                  </View>
                );
              })}

              {Object.keys(clarityResults).length > 0 && (
                <View style={styles.aiDiagnosisCard}>
                  <View style={styles.aiDiagnosisHeader}>
                    <View>
                      <Text style={styles.aiDiagnosisEyebrow}>明瞭さ × 速度</Text>
                      <Text style={styles.aiDiagnosisTitle}>AIコーチの総評</Text>
                    </View>
                    <Text style={styles.aiBadge}>生成AI</Text>
                  </View>
                  {isCreatingDiagnosis && (
                    <Text style={styles.aiDiagnosisLoading}>6回の測定結果を比較しています…</Text>
                  )}
                  {aiDiagnosis && !isCreatingDiagnosis && (
                    <>
                      <Text style={styles.aiDiagnosisHeadline}>{aiDiagnosis.headline}</Text>
                      <Text style={styles.aiDiagnosisSummary}>{aiDiagnosis.summary}</Text>
                      {aiDiagnosis.strengths.length > 0 && (
                        <View style={styles.aiDiagnosisSection}>
                          <Text style={styles.aiDiagnosisSectionTitle}>今回の強み</Text>
                          {aiDiagnosis.strengths.map((item, index) => (
                            <Text key={`strength-${index}`} style={styles.aiDiagnosisItem}>・{item}</Text>
                          ))}
                        </View>
                      )}
                      {aiDiagnosis.cautions.length > 0 && (
                        <View style={styles.aiDiagnosisSection}>
                          <Text style={styles.aiDiagnosisSectionTitle}>気をつけるポイント</Text>
                          {aiDiagnosis.cautions.map((item, index) => (
                            <Text key={`caution-${index}`} style={styles.aiDiagnosisItem}>・{item}</Text>
                          ))}
                        </View>
                      )}
                      {aiDiagnosis.soundTendencies.length > 0 && (
                        <View style={styles.aiDiagnosisSection}>
                          <Text style={styles.aiDiagnosisSectionTitle}>音の傾向</Text>
                          {aiDiagnosis.soundTendencies.map((item, index) => (
                            <Text key={`sound-${index}`} style={styles.aiDiagnosisItem}>・{item}</Text>
                          ))}
                        </View>
                      )}
                      <View style={styles.aiDiagnosisSection}>
                        <Text style={styles.aiDiagnosisSectionTitle}>安定性</Text>
                        <Text style={styles.aiDiagnosisItem}>{aiDiagnosis.stability}</Text>
                      </View>
                      <View style={styles.practiceBox}>
                        <Text style={styles.practiceLabel}>次の練習</Text>
                        <Text style={styles.practiceText}>{aiDiagnosis.practice}</Text>
                      </View>
                      {recommendedDrill && (
                        <View style={styles.recommendedDrillCard}>
                          <View style={styles.recommendedDrillHeader}>
                            <Text style={styles.recommendedDrillEyebrow}>AIが最優先に選んだドリル</Text>
                            <Text style={styles.premiumBadge}>プレミアム</Text>
                          </View>
                          <Text style={styles.recommendedDrillTitle}>{recommendedDrill.title}</Text>
                          <Text style={styles.recommendedDrillReason}>{aiDiagnosis.recommendedDrillReason}</Text>
                          <Pressable style={styles.recommendedDrillButton} onPress={() => setIsPaywallOpen(true)}>
                            <Text style={styles.recommendedDrillButtonText}>このドリルを始める</Text>
                          </Pressable>
                        </View>
                      )}
                      {isPaywallOpen && recommendedDrill && (
                        <View style={styles.paywallCard}>
                          <Text style={styles.paywallTitle}>診断に合わせた練習を続ける</Text>
                          <Text style={styles.paywallText}>推奨ドリル、練習履歴、週次レポートは有料プランで提供予定です。現在は体験版として利用できます。</Text>
                          <Pressable
                            style={styles.recommendedDrillButton}
                            onPress={() => router.push({ pathname: '/drills', params: { drill: recommendedDrill.id, source: 'diagnosis' } })}>
                            <Text style={styles.recommendedDrillButtonText}>体験版でドリルへ進む</Text>
                          </Pressable>
                          <Pressable onPress={() => setIsPaywallOpen(false)}>
                            <Text style={styles.paywallClose}>今は閉じる</Text>
                          </Pressable>
                        </View>
                      )}
                    </>
                  )}
                  {diagnosisError && !isCreatingDiagnosis && (
                    <>
                      <Text style={styles.aiDiagnosisError}>{diagnosisError}</Text>
                      <Pressable style={styles.aiRetryButton} onPress={() => createAiDiagnosis()}>
                        <Text style={styles.aiRetryButtonText}>AI診断をもう一度作成する</Text>
                      </Pressable>
                    </>
                  )}
                  <Text style={styles.aiDiagnosisNote}>
                    AIはAzureの採点結果、語間、発話時間のばらつきを説明しています。新しい点数の採点や医学的な診断は行いません。
                  </Text>
                </View>
              )}

              {Object.keys(clarityResults).length === 0 && (
                <View style={styles.cloudConsentCard}>
                  <Text style={styles.cloudConsentTitle}>クラウドで明瞭さを測定</Text>
                  <Text style={styles.cloudConsentText}>
                    6件の録音音声と3つの例文を Microsoft Azure Speech に送信して分析します。音声はこの測定結果の算出に使用します。
                  </Text>
                  <Pressable
                    style={[styles.analysisButton, isAnalyzingClarity && styles.inputActionDisabled]}
                    onPress={analyzeClarity}
                    disabled={isAnalyzingClarity}>
                    <Text style={styles.analysisButtonText}>
                      {isAnalyzingClarity ? '明瞭さを分析中…' : '同意して明瞭さを測定する'}
                    </Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.restartActions}>
                <Pressable style={styles.primaryButton} onPress={() => restartTest(false)}>
                  <Text style={styles.primaryButtonText}>同じ3例文でもう一度発話する</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => restartTest(true)}>
                  <Text style={styles.secondaryButtonText}>違う3例文でもう一度測定する</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.progressRow}>
                <Text style={styles.step}>例文 {currentSentenceIndex + 1} / 3</Text>
                <Text style={styles.stepCount}>{currentTakeNumber} / 6</Text>
              </View>
              <Text style={styles.heroTitle}>
                {!isFastStep ? '自然な速さを測ります' : '速さと明瞭さの限界を測ります'}
              </Text>
              <Text style={styles.instruction}>{instruction}</Text>

              <View style={styles.textCard}>
                <Text style={styles.testText}>{sessionTexts[currentSentenceIndex]}</Text>
              </View>

              <View style={styles.inputCard}>
                <View style={styles.inputIndicator} />
                <View style={styles.inputTextWrap}>
                  <Text style={styles.inputLabel}>
                    {availableInputCount === null ? '使用予定のマイク' : '使用中のマイク'}
                  </Text>
                  <Text style={styles.inputName}>{currentInputName}</Text>
                  <Text style={styles.inputMeta}>
                    {availableInputCount === null
                      ? '録音準備が整うと実際のマイク名を表示します'
                      : `${availableInputCount}台の入力デバイスを認識`}
                  </Text>
                </View>
                {phase === 'ready' && (
                  <Pressable
                    style={[styles.inputAction, isLoadingInputs && styles.inputActionDisabled]}
                    onPress={
                      availableInputs.length > 0
                        ? () => setIsInputListOpen(true)
                        : loadMicrophoneInputs
                    }
                    disabled={isLoadingInputs}>
                    <Text style={styles.inputActionText}>
                      {isLoadingInputs ? '確認中…' : availableInputs.length > 0 ? '変更' : '選ぶ'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {phase === 'ready' && isInputListOpen && availableInputs.length > 0 && (
                <View style={styles.inputList}>
                  <Text style={styles.inputListTitle}>使用するマイクを選択</Text>
                  {availableInputs.map((input) => {
                    const selected = selectedInputUid === input.uid;
                    return (
                      <Pressable
                        key={input.uid}
                        style={[styles.inputOption, selected && styles.inputOptionSelected]}
                        onPress={() => selectMicrophoneInput(input)}>
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.inputOptionTextWrap}>
                          <Text style={styles.inputOptionName}>{input.name}</Text>
                          <Text style={styles.inputOptionType}>{input.type}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={styles.inputConfirmButton}
                    onPress={() => setIsInputListOpen(false)}>
                    <Text style={styles.inputConfirmButtonText}>このマイクに決定</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.timerWrap}>
                <View style={[styles.pulse, phase === 'recording' && styles.pulseActive]}>
                  <View style={[styles.mic, phase === 'recording' && styles.micActive]}>
                    <Text style={styles.micSymbol}>●</Text>
                  </View>
                </View>
                <Text style={styles.timer}>{formatTime(displayedDuration)}</Text>
                <Text style={styles.status}>
                  {phase === 'ready' && '準備ができたら録音を始めてください'}
                  {phase === 'warming' && 'マイクを準備しています。まだ話さずにお待ちください…'}
                  {phase === 'recording' && '録音中です。ここから話してください'}
                  {phase === 'recorded' && '録音できました'}
                </Text>
              </View>

              {phase === 'ready' && (
                <Pressable style={styles.primaryButton} onPress={startRecording}>
                  <Text style={styles.primaryButtonText}>録音を始める</Text>
                </Pressable>
              )}
              {phase === 'recording' && (
                <Pressable style={styles.stopButton} onPress={stopRecording}>
                  <Text style={styles.stopButtonText}>録音を終了する</Text>
                </Pressable>
              )}
              {phase === 'recorded' && (
                <Pressable style={styles.primaryButton} onPress={continueTest}>
                  <Text style={styles.primaryButtonText}>
                    {currentStep < TAKE_NUMBERS.length - 1 ? '次の測定へ' : '6回の測定を完了する'}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </View>

        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>この測定で見ること</Text>
          <Text style={styles.sectionNote}>
            3例文を自然な速さと早口で読み、クラウド評価と発話時間・語間を組み合わせて判定します。
          </Text>
          <View style={styles.metricsGrid}>
            {[
              ['明瞭さ', '言葉が正しく伝わる割合'],
              ['速度', '明瞭さを保てる速さ'],
              ['音の傾向', '複数の例文で繰り返す音の特徴'],
              ['安定性', '速度のばらつき・間・流暢さ'],
            ].map(([title, body]) => (
              <View key={title} style={styles.metricCard}>
                <View style={styles.metricTitleRow}>
                  <Text style={styles.metricTitle}>{title}</Text>
                  <Text style={styles.pendingBadge}>測定可能</Text>
                </View>
                <Text style={styles.metricBody}>{body}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.privacyNote}>
          録音は明瞭さ測定に同意した場合のみ Azure Speech へ送信します。APIキーはサーバー側で安全に管理します。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  ink: '#19312D',
  muted: '#60726E',
  mint: '#DDF4EA',
  green: '#187A64',
  greenDark: '#0F5E4D',
  coral: '#F06C55',
  cream: '#F6F3EC',
  white: '#FFFFFF',
  line: '#DCE6E2',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  homeLink: { color: colors.green, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  logo: { color: colors.ink, fontSize: 23, fontWeight: '800', marginTop: 3 },
  dayBadge: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  dayLabel: { color: colors.muted, fontSize: 10 },
  dayValue: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 10px 24px rgba(35, 68, 60, 0.08)',
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  step: { color: colors.green, fontWeight: '800', fontSize: 13 },
  stepCount: { color: colors.muted, fontSize: 13 },
  heroTitle: { color: colors.ink, fontSize: 28, lineHeight: 36, fontWeight: '800' },
  instruction: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  textCard: { backgroundColor: colors.mint, borderRadius: 20, padding: 20, marginTop: 20 },
  testText: { color: colors.ink, fontSize: 21, lineHeight: 36, fontWeight: '600' },
  timerWrap: { alignItems: 'center', paddingVertical: 24 },
  pulse: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EAF4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseActive: { backgroundColor: '#FFE3DE' },
  mic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: colors.coral },
  micSymbol: { color: colors.white, fontSize: 18 },
  timer: { color: colors.ink, fontSize: 34, fontWeight: '700', marginTop: 12 },
  status: { color: colors.muted, fontSize: 13, marginTop: 4 },
  primaryButton: {
    backgroundColor: colors.green,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  restartActions: { gap: 12 },
  secondaryButton: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.green,
  },
  secondaryButtonText: { color: colors.greenDark, fontSize: 17, fontWeight: '800' },
  stopButton: {
    backgroundColor: '#FFF0ED',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F7C2B8',
  },
  stopButtonText: { color: '#B63D2C', fontSize: 17, fontWeight: '800' },
  errorText: { color: '#B63D2C', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 14 },
  completeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  completeBadgeText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  resultList: { gap: 10, marginTop: 22, marginBottom: 16 },
  resultGroup: { backgroundColor: colors.cream, borderRadius: 18, padding: 14, gap: 8 },
  resultGroupLabel: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  resultReference: { color: colors.ink, fontSize: 12, lineHeight: 19, marginBottom: 2 },
  resultRow: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  resultTime: { color: colors.ink, fontSize: 23, fontWeight: '800', marginTop: 3 },
  resultTotal: { color: colors.muted, fontSize: 11, marginTop: 2 },
  resultMic: { color: colors.muted, fontSize: 10, marginTop: 3, maxWidth: 360 },
  playButton: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 11 },
  playButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: '800' },
  summaryCard: { backgroundColor: colors.mint, borderRadius: 18, padding: 17, marginBottom: 18 },
  summaryLabel: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: colors.ink, fontSize: 21, fontWeight: '800', marginTop: 4 },
  summaryNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  wordComparisonCard: { backgroundColor: colors.white, borderRadius: 18, padding: 17, marginBottom: 18, borderWidth: 1, borderColor: colors.line },
  wordComparisonEyebrow: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  wordComparisonTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 3 },
  wordComparisonNote: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  wordComparisonSection: { marginTop: 16, gap: 8 },
  wordComparisonSectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  wordComparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#EDF1EF', paddingTop: 9 },
  wordComparisonWord: { color: colors.ink, fontSize: 15, fontWeight: '800', minWidth: 80 },
  wordComparisonScores: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  wordScore: { minWidth: 64, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 5 },
  wordScoreLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  wordScoreValue: { fontSize: 16, fontWeight: '800' },
  wordComparisonArrow: { color: colors.muted, fontSize: 12 },
  wordDrop: { color: '#B15B23', fontSize: 13, fontWeight: '800', minWidth: 30 },
  wordComparisonFootnote: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 14 },
  clarityCard: { backgroundColor: '#F1F8F5', borderRadius: 18, padding: 17, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  clarityLabel: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  clarityScore: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 3 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  scoreItem: { color: colors.muted, fontSize: 12, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  unclearTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 13 },
  wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  wordChip: { backgroundColor: '#FFF0ED', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  wordChipText: { color: '#9A3A2A', fontSize: 12, fontWeight: '700' },
  omissionNote: { color: '#805B12', fontSize: 11, lineHeight: 17, marginTop: 9 },
  clarityNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 },
  assessmentWarning: { backgroundColor: '#FFF4DC', borderRadius: 12, padding: 11, marginTop: 12 },
  assessmentWarningTitle: { color: '#805B12', fontSize: 12, fontWeight: '800' },
  assessmentWarningText: { color: '#805B12', fontSize: 11, lineHeight: 17, marginTop: 3 },
  recognizedLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 13 },
  recognizedText: { color: colors.ink, fontSize: 13, lineHeight: 21, marginTop: 4, backgroundColor: colors.white, borderRadius: 12, padding: 11 },
  cloudConsentCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 17, marginBottom: 18 },
  cloudConsentTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  cloudConsentText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 13 },
  analysisButton: { backgroundColor: colors.greenDark, borderRadius: 14, alignItems: 'center', paddingVertical: 13 },
  analysisButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  aiDiagnosisCard: { backgroundColor: '#FFF9EA', borderRadius: 18, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: '#EBDCA8' },
  aiDiagnosisHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiDiagnosisEyebrow: { color: '#805B12', fontSize: 11, fontWeight: '800' },
  aiDiagnosisTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 2 },
  aiBadge: { color: '#805B12', fontSize: 10, fontWeight: '800', backgroundColor: '#FFF1BE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  aiDiagnosisLoading: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 16 },
  aiDiagnosisHeadline: { color: colors.ink, fontSize: 19, lineHeight: 27, fontWeight: '800', marginTop: 16 },
  aiDiagnosisSummary: { color: colors.ink, fontSize: 13, lineHeight: 22, marginTop: 8 },
  aiDiagnosisSection: { marginTop: 14 },
  aiDiagnosisSectionTitle: { color: '#805B12', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  aiDiagnosisItem: { color: colors.ink, fontSize: 12, lineHeight: 20 },
  practiceBox: { backgroundColor: colors.white, borderRadius: 13, padding: 13, marginTop: 15 },
  practiceLabel: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  practiceText: { color: colors.ink, fontSize: 12, lineHeight: 20, marginTop: 4 },
  recommendedDrillCard: { backgroundColor: '#F1F8F5', borderRadius: 15, padding: 15, marginTop: 14, borderWidth: 1, borderColor: colors.line },
  recommendedDrillHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  recommendedDrillEyebrow: { color: colors.greenDark, fontSize: 11, fontWeight: '800' },
  premiumBadge: { color: '#805B12', fontSize: 9, fontWeight: '800', backgroundColor: '#FFF1BE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  recommendedDrillTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 8 },
  recommendedDrillReason: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  recommendedDrillButton: { backgroundColor: colors.greenDark, borderRadius: 13, alignItems: 'center', paddingVertical: 12, marginTop: 12 },
  recommendedDrillButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  paywallCard: { backgroundColor: colors.white, borderRadius: 15, padding: 15, marginTop: 10, borderWidth: 1, borderColor: '#EBDCA8' },
  paywallTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  paywallText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  paywallClose: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 11 },
  aiDiagnosisError: { color: '#B63D2C', fontSize: 12, lineHeight: 19, marginTop: 15 },
  aiRetryButton: { borderWidth: 1, borderColor: '#C7A747', borderRadius: 12, alignItems: 'center', paddingVertical: 11, marginTop: 10 },
  aiRetryButtonText: { color: '#805B12', fontSize: 12, fontWeight: '800' },
  aiDiagnosisNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 14 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 14,
  },
  inputIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  inputTextWrap: { flex: 1 },
  inputLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  inputName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 2 },
  inputMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  inputAction: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.line,
  },
  inputActionDisabled: { opacity: 0.55 },
  inputActionText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  inputList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 10,
    marginTop: 8,
    gap: 7,
  },
  inputListTitle: { color: colors.muted, fontSize: 11, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 3 },
  inputOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  inputOptionSelected: { backgroundColor: colors.mint },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  inputOptionTextWrap: { flex: 1 },
  inputOptionName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  inputOptionType: { color: colors.muted, fontSize: 10, marginTop: 2 },
  inputConfirmButton: {
    backgroundColor: colors.green,
    borderRadius: 13,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  inputConfirmButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  metricsSection: { marginTop: 28 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sectionNote: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: -5, marginBottom: 13 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    minHeight: 100,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricTitle: { color: colors.greenDark, fontSize: 15, fontWeight: '800' },
  metricTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pendingBadge: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: colors.cream,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metricBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  privacyNote: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 22 },
});
