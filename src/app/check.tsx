import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { MicrophonePicker } from '@/components/MicrophonePicker';
import { AiDiagnosisCard } from '@/components/check/AiDiagnosisCard';
import { CheckMetricsOverview } from '@/components/check/CheckMetricsOverview';
import { ClarityConsentCard } from '@/components/check/ClarityConsentCard';
import { ClarityResultCard } from '@/components/check/ClarityResultCard';
import { SpeedChangeSummary } from '@/components/check/SpeedChangeSummary';
import { TakeResultsList } from '@/components/check/TakeResultsList';
import { WordSpeedComparisonCard } from '@/components/check/WordSpeedComparisonCard';
import { palette } from '@/constants/palette';
import { useMicrophoneSelection } from '@/hooks/use-microphone-selection';
import { useRecordingPlayback } from '@/hooks/use-recording-playback';
import { useTakeRecorder } from '@/hooks/use-take-recorder';
import { requestAssessment, requestDiagnosis } from '@/lib/api-client';
import type { AiDiagnosis, ClarityAssessment } from '@/lib/assessment-types';
import {
  SENTENCE_COUNT,
  TAKE_NUMBERS,
  createTestSet,
  hasAllTakes,
  sentenceIndexForTake,
  type RecordedTake,
  type TakeMap,
} from '@/lib/check-session';
import { averageSpeedChange, compareWordsBySpeed } from '@/lib/clarity-metrics';
import { buildDiagnosisRequest, recommendedDrillIds } from '@/lib/diagnosis';
import { DRILLS, type Drill } from '@/lib/drills';
import { formatTime } from '@/lib/format';
import { saveAssessmentHistory } from '@/lib/progress';
import { convertRecordingToAssessmentWav } from '@/lib/wav';

/** Screen state between recordings. While the recorder runs, its own status takes over. */
type StepPhase = 'ready' | 'recorded' | 'complete';
type Phase = StepPhase | 'warming' | 'recording';

export default function CheckScreen() {
  const router = useRouter();
  const takeRecorder = useTakeRecorder();
  const microphone = useMicrophoneSelection(takeRecorder.recorder);
  const playback = useRecordingPlayback();
  const assessmentSavedRef = useRef(false);
  const [stepPhase, setStepPhase] = useState<StepPhase>('ready');
  const [currentStep, setCurrentStep] = useState(0);
  const [takes, setTakes] = useState<TakeMap<RecordedTake>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionTexts, setSessionTexts] = useState<string[]>(() => createTestSet());
  const [clarityResults, setClarityResults] = useState<TakeMap<ClarityAssessment>>({});
  const [isAnalyzingClarity, setIsAnalyzingClarity] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosis | null>(null);
  const [isCreatingDiagnosis, setIsCreatingDiagnosis] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  const phase: Phase = takeRecorder.status === 'idle' ? stepPhase : takeRecorder.status;
  const isFastStep = currentStep % 2 === 1;
  const currentTakeNumber = currentStep + 1;
  const currentSentenceIndex = sentenceIndexForTake(currentTakeNumber);
  const isLastStep = currentStep === TAKE_NUMBERS.length - 1;

  const startRecording = async () => {
    setErrorMessage(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('マイクを使用できません。ブラウザまたは端末の設定から許可してください。');
      return;
    }
    try {
      await takeRecorder.start(microphone.applyPreferredInput);
    } catch {
      setErrorMessage(
        '録音を開始できませんでした。マイクの接続を確認して、もう一度お試しください。'
      );
    }
  };

  const stopRecording = async () => {
    try {
      const recording = await takeRecorder.stop();
      if (!recording) {
        setErrorMessage('録音データを作成できませんでした。もう一度録音してください。');
        setStepPhase('ready');
        return;
      }
      setTakes((current) => ({
        ...current,
        [currentTakeNumber]: { ...recording, microphoneName: microphone.currentInputName },
      }));
      setStepPhase('recorded');
    } catch {
      setErrorMessage('録音を終了できませんでした。もう一度お試しください。');
      setStepPhase('ready');
    }
  };

  const continueTest = () => {
    if (!isLastStep) {
      setCurrentStep((step) => step + 1);
      setStepPhase('ready');
      return;
    }
    setStepPhase('complete');
  };

  const playTake = async (take: RecordedTake) => {
    setErrorMessage(null);
    try {
      await playback.play(take.uri);
    } catch {
      setErrorMessage('録音を再生できませんでした。もう一度測定してください。');
    }
  };

  const restartTest = (changeText: boolean) => {
    playback.stop();
    takeRecorder.reset();
    setTakes({});
    setCurrentStep(0);
    setStepPhase('ready');
    setErrorMessage(null);
    setClarityResults({});
    setAiDiagnosis(null);
    setDiagnosisError(null);
    assessmentSavedRef.current = false;
    if (changeText) setSessionTexts((current) => createTestSet(current));
  };

  const createAiDiagnosis = async (results: TakeMap<ClarityAssessment> = clarityResults) => {
    if (!hasAllTakes(takes) || !hasAllTakes(results)) return;
    setDiagnosisError(null);
    setIsCreatingDiagnosis(true);
    let diagnosis: AiDiagnosis;
    try {
      diagnosis = await requestDiagnosis(buildDiagnosisRequest({ takes, results, sessionTexts }));
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : 'AI診断を作成できませんでした。');
      return;
    } finally {
      setIsCreatingDiagnosis(false);
    }
    setAiDiagnosis(diagnosis);
    await saveDiagnosisHistory(diagnosis);
  };

  /** Stores the headline and drill ids once per session; failure only shows a note. */
  const saveDiagnosisHistory = async (diagnosis: AiDiagnosis) => {
    if (assessmentSavedRef.current) return;
    try {
      await saveAssessmentHistory({
        headline: diagnosis.headline,
        recommendedDrillIds: recommendedDrillIds(diagnosis),
      });
      assessmentSavedRef.current = true;
    } catch {
      setErrorMessage('診断結果は表示できましたが、履歴の保存に失敗しました。');
    }
  };

  const analyzeClarity = async () => {
    if (!hasAllTakes(takes)) return;
    setErrorMessage(null);
    setIsAnalyzingClarity(true);
    try {
      const results: TakeMap<ClarityAssessment> = {};
      for (const takeNumber of TAKE_NUMBERS) {
        const wav = await convertRecordingToAssessmentWav(takes[takeNumber].uri);
        results[takeNumber] = await requestAssessment(
          wav,
          sessionTexts[sentenceIndexForTake(takeNumber)],
          `take-${takeNumber}.wav`
        );
      }
      setClarityResults(results);
      await createAiDiagnosis(results);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '明瞭さを評価できませんでした。');
    } finally {
      setIsAnalyzingClarity(false);
    }
  };

  const openRecommendedDrill = (drill: Drill) => {
    router.push({ pathname: '/drills', params: { drill: drill.id, source: 'diagnosis' } });
  };

  const hasClarityResults = Object.keys(clarityResults).length > 0;
  const recommendedDrill = aiDiagnosis
    ? (DRILLS.find((drill) => drill.id === aiDiagnosis.recommendedDrillId) ?? null)
    : null;
  const displayedDuration =
    phase === 'recording'
      ? takeRecorder.elapsedMillis
      : phase === 'recorded'
        ? (takes[currentTakeNumber]?.durationMillis ?? 0)
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

              <TakeResultsList sessionTexts={sessionTexts} takes={takes} onPlay={playTake} />
              <SpeedChangeSummary averageSpeedChange={averageSpeedChange(takes)} />
              <WordSpeedComparisonCard comparison={compareWordsBySpeed(clarityResults)} />
              {TAKE_NUMBERS.map((takeNumber) => {
                const result = clarityResults[takeNumber];
                return result ? (
                  <ClarityResultCard key={takeNumber} takeNumber={takeNumber} result={result} />
                ) : null;
              })}
              {hasClarityResults ? (
                <AiDiagnosisCard
                  diagnosis={aiDiagnosis}
                  isCreating={isCreatingDiagnosis}
                  error={diagnosisError}
                  recommendedDrill={recommendedDrill}
                  onRetry={() => createAiDiagnosis()}
                  onStartDrill={openRecommendedDrill}
                />
              ) : (
                <ClarityConsentCard isAnalyzing={isAnalyzingClarity} onAnalyze={analyzeClarity} />
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
                <Text style={styles.step}>
                  例文 {currentSentenceIndex + 1} / {SENTENCE_COUNT}
                </Text>
                <Text style={styles.stepCount}>
                  {currentTakeNumber} / {TAKE_NUMBERS.length}
                </Text>
              </View>
              <Text style={styles.heroTitle}>
                {isFastStep ? '速さと明瞭さの限界を測ります' : '自然な速さを測ります'}
              </Text>
              <Text style={styles.instruction}>
                {isFastStep
                  ? '明瞭さを保てる範囲で、できるだけ速く読んでください。'
                  : '普段どおりの、自然で楽な速さで読んでください。'}
              </Text>

              <View style={styles.textCard}>
                <Text style={styles.testText}>{sessionTexts[currentSentenceIndex]}</Text>
              </View>

              <MicrophonePicker selection={microphone} enabled={phase === 'ready'} />

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
                    {isLastStep ? '6回の測定を完了する' : '次の測定へ'}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </View>

        <CheckMetricsOverview />

        <Text style={styles.privacyNote}>
          録音は明瞭さ測定に同意した場合のみ Azure Speech
          へ送信します。APIキーはサーバー側で安全に管理します。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: { color: palette.green, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  logo: { color: palette.ink, fontSize: 23, fontWeight: '800', marginTop: 3 },
  dayBadge: {
    backgroundColor: palette.white,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  dayLabel: { color: palette.muted, fontSize: 10 },
  dayValue: { color: palette.greenDark, fontSize: 15, fontWeight: '800' },
  heroCard: {
    backgroundColor: palette.white,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
    boxShadow: '0 10px 24px rgba(35, 68, 60, 0.08)',
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  step: { color: palette.green, fontWeight: '800', fontSize: 13 },
  stepCount: { color: palette.muted, fontSize: 13 },
  heroTitle: { color: palette.ink, fontSize: 28, lineHeight: 36, fontWeight: '800' },
  instruction: { color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  textCard: { backgroundColor: palette.mint, borderRadius: 20, padding: 20, marginTop: 20 },
  testText: { color: palette.ink, fontSize: 21, lineHeight: 36, fontWeight: '600' },
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
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: palette.coral },
  micSymbol: { color: palette.white, fontSize: 18 },
  timer: { color: palette.ink, fontSize: 34, fontWeight: '700', marginTop: 12 },
  status: { color: palette.muted, fontSize: 13, marginTop: 4 },
  primaryButton: {
    backgroundColor: palette.green,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: palette.white, fontSize: 17, fontWeight: '800' },
  restartActions: { gap: 12 },
  secondaryButton: {
    backgroundColor: palette.white,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.green,
  },
  secondaryButtonText: { color: palette.greenDark, fontSize: 17, fontWeight: '800' },
  stopButton: {
    backgroundColor: palette.dangerSoft,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F7C2B8',
  },
  stopButtonText: { color: palette.danger, fontSize: 17, fontWeight: '800' },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 14,
  },
  completeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.mint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  completeBadgeText: { color: palette.greenDark, fontSize: 12, fontWeight: '800' },
  privacyNote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 22,
  },
});
