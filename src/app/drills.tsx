import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { ScreenTitle } from '@/components/ScreenTitle';
import { MicrophonePicker } from '@/components/MicrophonePicker';
import { PremiumBanner } from '@/components/PremiumBanner';
import { palette } from '@/constants/palette';
import { useMicrophoneSelection } from '@/hooks/use-microphone-selection';
import { useRecordingPlayback } from '@/hooks/use-recording-playback';
import { usePlan } from '@/lib/billing';
import { DRILLS, type Drill } from '@/lib/drills';
import { isDrillFree } from '@/lib/plans';
import { saveDrillHistory } from '@/lib/progress';
import { RECORDING_OPTIONS } from '@/lib/recorder';

type Phase = 'ready' | 'recording' | 'recorded' | 'complete';

export default function DrillsScreen() {
  const params = useLocalSearchParams<{ drill?: string; source?: string }>();
  const router = useRouter();
  const { isPremium, isLoading: isPlanLoading } = usePlan();
  const [active, setActive] = useState<Drill | null>(
    () => DRILLS.find((item) => item.id === params.drill) ?? null
  );
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [completedSentences, setCompletedSentences] = useState(0);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [lastRecordingSeconds, setLastRecordingSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [reflection, setReflection] = useState<'clear' | 'difficult' | null>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const microphone = useMicrophoneSelection(recorder);
  const playback = useRecordingPlayback();

  const chooseDrill = (drill: Drill) => {
    playback.stop();
    setActive(drill);
    setSentenceIndex(0);
    setPhase('ready');
    setRecordingUri(null);
    setCompletedSentences(0);
    setCompletedSeconds(0);
    setLastRecordingSeconds(0);
    setReflection(null);
    setMessage(null);
  };

  const start = async () => {
    setMessage(null);
    setReflection(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setMessage('マイクの利用を許可してください。');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      await microphone.applyPreferredInput();
      recorder.record();
      setPhase('recording');
    } catch {
      setMessage('録音を開始できませんでした。');
    }
  };

  const stop = async () => {
    try {
      const seconds = Math.max(1, Math.round((recorder.getStatus().durationMillis ?? 0) / 1000));
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecordingUri(recorder.uri);
      setLastRecordingSeconds(seconds);
      setCompletedSeconds((value) => value + seconds);
      setPhase('recorded');
    } catch {
      setMessage('録音を終了できませんでした。');
    }
  };

  const play = async () => {
    if (!recordingUri) return;
    setMessage(null);
    try {
      await playback.play(recordingUri);
    } catch {
      setMessage('録音を再生できませんでした。もう一度録音してください。');
    }
  };

  const completeSentence = async () => {
    if (!active) return;
    setCompletedSentences((value) => value + 1);
    try {
      await saveDrillHistory({
        drillId: active.id,
        durationSeconds: lastRecordingSeconds,
        sentenceCount: 1,
      });
    } catch {
      // Practice continues offline; only the cloud record is missing.
      setMessage('練習記録を保存できませんでした。練習はそのまま続けられます。');
    }
    if (sentenceIndex >= active.sentences.length - 1) {
      setPhase('complete');
    } else {
      setSentenceIndex((value) => value + 1);
      setRecordingUri(null);
      setLastRecordingSeconds(0);
      setReflection(null);
      setPhase('ready');
    }
  };

  const retrySentence = () => {
    playback.stop();
    setRecordingUri(null);
    setLastRecordingSeconds(0);
    setReflection(null);
    setPhase('ready');
  };

  const isLocked = (drill: Drill) => !isPremium && !isDrillFree(drill.id);
  const activeLocked = active !== null && !isPlanLoading && isLocked(active);
  const progressRatio = active ? Math.min(1, completedSentences / active.sentences.length) : 0;
  const progressGreen = `rgba(24,122,100,${0.2 + progressRatio * 0.8})`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenTitle title="ドリル" />
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader />
        {!active ? (
          <>
            <PremiumBanner message="無料は2種類。8種類すべてのドリルと測定履歴が使えます。" />
            <Text style={styles.hero}>今日鍛えるところを選びましょう</Text>
            <Text style={styles.intro}>
              点数はつきません。例文を読み、自分の声を聞いて、少しずつ習慣にします。
            </Text>
            <View style={styles.grid}>
              {DRILLS.map((drill) => {
                const locked = !isPlanLoading && isLocked(drill);
                return (
                  <Pressable
                    key={drill.id}
                    style={[styles.drillCard, { backgroundColor: drill.accent }]}
                    onPress={() => (locked ? router.push('/pricing') : chooseDrill(drill))}>
                    <View style={styles.drillTitleRow}>
                      <Text style={styles.drillTitle}>{drill.title}</Text>
                      {locked && <Text style={styles.premiumBadge}>プレミアム</Text>}
                    </View>
                    <Text style={styles.drillBody}>{drill.description}</Text>
                    <Text style={styles.startLink}>
                      {locked ? 'プレミアムで始める →' : '始める →'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View>
            <Pressable onPress={() => setActive(null)}>
              <Text style={styles.change}>‹ ドリル一覧へ</Text>
            </Pressable>
            <Text style={styles.hero}>{active.title}</Text>
            <Text style={styles.intro}>{active.description}</Text>
            {params.source === 'diagnosis' && (
              <View style={styles.diagnosisBanner}>
                <Text style={styles.diagnosisBannerTitle}>AI診断からのおすすめ</Text>
                <Text style={styles.diagnosisBannerText}>
                  今回の診断結果を優先して選んだドリルです。
                </Text>
              </View>
            )}
            <View style={styles.practiceMeterCard}>
              <View style={[styles.practiceMeter, { backgroundColor: progressGreen }]}>
                <Text style={styles.practiceMeterValue}>{completedSentences}</Text>
                <Text style={styles.practiceMeterUnit}>文</Text>
              </View>
              <View style={styles.practiceMeterCopy}>
                <Text style={styles.practiceMeterTitle}>今日の練習メーター</Text>
                <Text style={styles.practiceMeterText}>
                  {completedSentences === 0
                    ? `10文・約3分。最初の1文から始めましょう。`
                    : phase === 'complete'
                      ? `${active.sentences.length}文完了。今日の練習を記録しました。`
                      : `${completedSentences}文完了。続けるほど円が濃くなります。`}
                </Text>
              </View>
            </View>
            {activeLocked ? (
              <View style={styles.completeCard}>
                <Text style={styles.completeTitle}>このドリルはプレミアムで利用できます</Text>
                <Text style={styles.completeNote}>
                  8種類すべてのドリルと測定履歴が使えます。初回は14日間無料です。
                </Text>
                <Pressable style={styles.primary} onPress={() => router.push('/pricing')}>
                  <Text style={styles.primaryText}>14日間無料で始める</Text>
                </Pressable>
              </View>
            ) : phase === 'complete' ? (
              <View style={styles.completeCard}>
                <Text style={styles.completeMark}>✓</Text>
                <Text style={styles.completeTitle}>今日のドリル完了</Text>
                <Text style={styles.completeValue}>
                  {completedSentences}文・約{Math.max(1, Math.round(completedSeconds / 60))}分
                </Text>
                <Text style={styles.completeNote}>今日の発話カレンダーに記録しました。</Text>
                <Link href="/" asChild>
                  <Pressable style={styles.primary}>
                    <Text style={styles.primaryText}>ホームへ戻る</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View style={styles.practiceCard}>
                <View style={styles.progressRow}>
                  <Text style={styles.progress}>
                    例文 {sentenceIndex + 1} / {active.sentences.length}
                  </Text>
                  <Text style={styles.progress}>{completedSentences}文完了</Text>
                </View>
                <Text style={styles.sentence}>{active.sentences[sentenceIndex]}</Text>
                <MicrophonePicker selection={microphone} enabled={phase === 'ready'} />
                <View style={styles.micWrap}>
                  <View style={[styles.mic, phase === 'recording' && styles.micActive]}>
                    <Text style={styles.micDot}>●</Text>
                  </View>
                  <Text style={styles.timer}>
                    {phase === 'recorded'
                      ? lastRecordingSeconds
                      : Math.floor((recorderState.durationMillis ?? 0) / 1000)}
                    秒
                  </Text>
                  <Text style={styles.status}>
                    {phase === 'recording'
                      ? '録音中です'
                      : phase === 'recorded'
                        ? '録音できました。自分の声を聞いてみましょう。'
                        : '準備ができたら録音してください。'}
                  </Text>
                </View>
                {phase === 'ready' && (
                  <Pressable style={styles.primary} onPress={start}>
                    <Text style={styles.primaryText}>録音を始める</Text>
                  </Pressable>
                )}
                {phase === 'recording' && (
                  <Pressable style={styles.stop} onPress={stop}>
                    <Text style={styles.stopText}>録音を終了する</Text>
                  </Pressable>
                )}
                {phase === 'recorded' && (
                  <View style={styles.actions}>
                    <Pressable style={styles.secondary} onPress={play}>
                      <Text style={styles.secondaryText}>▶ 自分の声を聞く</Text>
                    </Pressable>
                    <View style={styles.reflectionCard}>
                      <Text style={styles.reflectionTitle}>
                        聞き返して、今日の感覚を残しましょう
                      </Text>
                      <Text style={styles.reflectionHint}>
                        練習対象の音と、文末まで声が届いているかを確認してください。
                      </Text>
                      <View style={styles.reflectionRow}>
                        <Pressable
                          style={[
                            styles.reflectionChip,
                            reflection === 'clear' && styles.reflectionChipActive,
                          ]}
                          onPress={() => setReflection('clear')}>
                          <Text
                            style={[
                              styles.reflectionChipText,
                              reflection === 'clear' && styles.reflectionChipTextActive,
                            ]}>
                            言いやすかった
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.reflectionChip,
                            reflection === 'difficult' && styles.reflectionChipActive,
                          ]}
                          onPress={() => setReflection('difficult')}>
                          <Text
                            style={[
                              styles.reflectionChipText,
                              reflection === 'difficult' && styles.reflectionChipTextActive,
                            ]}>
                            少し難しかった
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={retrySentence}>
                        <Text style={styles.retryLink}>この例文をもう一度録音する</Text>
                      </Pressable>
                    </View>
                    <Pressable style={styles.primary} onPress={completeSentence}>
                      <Text style={styles.primaryText}>
                        {sentenceIndex === active.sentences.length - 1
                          ? 'ドリルを完了する'
                          : '完了して次の例文へ'}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {message && <Text style={styles.error}>{message}</Text>}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  container: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 22, paddingBottom: 50 },
  hero: { color: palette.ink, fontSize: 27, lineHeight: 35, fontWeight: '800' },
  intro: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 7, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  drillCard: { flexGrow: 1, flexBasis: 300, borderRadius: 18, padding: 18, minHeight: 155 },
  drillTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  drillTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  premiumBadge: {
    color: palette.amber,
    backgroundColor: palette.amberSoft,
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  drillBody: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  startLink: {
    color: palette.greenDark,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 'auto',
    paddingTop: 12,
  },
  change: { color: palette.green, fontSize: 12, fontWeight: '700', marginBottom: 13 },
  diagnosisBanner: {
    backgroundColor: palette.amberCream,
    borderWidth: 1,
    borderColor: palette.amberLine,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  diagnosisBannerTitle: { color: palette.amber, fontSize: 12, fontWeight: '800' },
  diagnosisBannerText: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  practiceMeterCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  practiceMeter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 7,
    borderColor: '#CBE7DD',
  },
  practiceMeterValue: { color: palette.greenDark, fontSize: 24, fontWeight: '800' },
  practiceMeterUnit: { color: palette.greenDark, fontSize: 10, fontWeight: '800' },
  practiceMeterCopy: { flex: 1 },
  practiceMeterTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  practiceMeterText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  practiceCard: {
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progress: { color: palette.green, fontSize: 11, fontWeight: '800' },
  sentence: {
    color: palette.ink,
    fontSize: 23,
    lineHeight: 38,
    fontWeight: '600',
    backgroundColor: palette.mint,
    borderRadius: 18,
    padding: 20,
    marginTop: 15,
  },
  micWrap: { alignItems: 'center', paddingVertical: 23 },
  mic: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: palette.coral },
  micDot: { color: palette.white, fontSize: 18 },
  timer: { color: palette.ink, fontSize: 25, fontWeight: '800', marginTop: 8 },
  status: { color: palette.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  primary: {
    backgroundColor: palette.green,
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: { color: palette.white, fontSize: 14, fontWeight: '800' },
  stop: {
    backgroundColor: palette.dangerSoft,
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 14,
  },
  stopText: { color: palette.danger, fontSize: 14, fontWeight: '800' },
  actions: { gap: 10 },
  secondary: {
    borderWidth: 1,
    borderColor: palette.green,
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 13,
  },
  secondaryText: { color: palette.greenDark, fontSize: 14, fontWeight: '800' },
  reflectionCard: { backgroundColor: palette.cream, borderRadius: 15, padding: 13 },
  reflectionTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  reflectionHint: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  reflectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  reflectionChip: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reflectionChipActive: { backgroundColor: palette.green, borderColor: palette.green },
  reflectionChipText: { color: palette.greenDark, fontSize: 11, fontWeight: '700' },
  reflectionChipTextActive: { color: palette.white },
  retryLink: {
    color: palette.green,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 11,
    textAlign: 'center',
  },
  error: { color: palette.danger, fontSize: 12, textAlign: 'center', marginTop: 10 },
  completeCard: {
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },
  completeMark: { color: palette.green, fontSize: 38, fontWeight: '800' },
  completeTitle: { color: palette.ink, fontSize: 23, fontWeight: '800', marginTop: 6 },
  completeValue: { color: palette.greenDark, fontSize: 18, fontWeight: '800', marginTop: 10 },
  completeNote: { color: palette.muted, fontSize: 12, marginTop: 5, marginBottom: 20 },
});
