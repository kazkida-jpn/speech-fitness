import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { ClarityAssessment } from '@/lib/assessment-types';
import {
  SPEAKING_MODE_LABELS,
  sentenceIndexForTake,
  speakingModeForTake,
} from '@/lib/check-session';
import { omittedWords, unclearWords } from '@/lib/clarity-metrics';

type Props = {
  takeNumber: number;
  result: ClarityAssessment;
};

/** Azure's scores for one take, with the words it found unclear or could not match. */
export function ClarityResultCard({ takeNumber, result }: Props) {
  const unclear = unclearWords(result, { includeFlagged: true });
  const omitted = omittedWords(result);

  return (
    <View style={styles.clarityCard}>
      <Text style={styles.clarityLabel}>
        例文 {sentenceIndexForTake(takeNumber) + 1}・
        {SPEAKING_MODE_LABELS[speakingModeForTake(takeNumber)]}
      </Text>
      <Text style={styles.clarityScore}>{Math.round(result.pronunciationScore)} / 100</Text>
      <View style={styles.scoreGrid}>
        <Text style={styles.scoreItem}>発音精度 {Math.round(result.accuracyScore)} / 100</Text>
        <Text style={styles.scoreItem}>流暢さ {Math.round(result.fluencyScore)} / 100</Text>
        <Text style={styles.scoreItem}>
          文章一致度 {Math.round(result.completenessScore)} / 100
        </Text>
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
        {unclear.length > 0 ? '聞き取りにくかった可能性のある語' : '目立って不明瞭な語はありません'}
      </Text>
      {unclear.length > 0 && (
        <View style={styles.wordList}>
          {unclear.map((word, index) => (
            <View key={`${word.word}-${index}`} style={styles.wordChip}>
              <Text style={styles.wordChipText}>
                {word.word || '（脱落）'} {Math.round(word.accuracyScore)}点
              </Text>
            </View>
          ))}
        </View>
      )}
      {omitted.length > 0 && (
        <Text style={styles.omissionNote}>
          Azureが提示文と対応付けられなかった語が {omitted.length}{' '}
          個あります。これは発音0点ではなく、照合上の脱落扱いです。
        </Text>
      )}
      <Text style={styles.clarityNote}>
        発音精度は音素の近さ、流暢さは語間の無音、文章一致度は提示文の語をどれだけ認識できたかを示します。文章一致度が低い場合、総合点は発声能力の評価として扱いません。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clarityCard: {
    backgroundColor: '#F1F8F5',
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  clarityLabel: { color: palette.greenDark, fontSize: 12, fontWeight: '800' },
  clarityScore: { color: palette.ink, fontSize: 30, fontWeight: '800', marginTop: 3 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  scoreItem: {
    color: palette.muted,
    fontSize: 12,
    backgroundColor: palette.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  assessmentWarning: { backgroundColor: '#FFF4DC', borderRadius: 12, padding: 11, marginTop: 12 },
  assessmentWarningTitle: { color: palette.amber, fontSize: 12, fontWeight: '800' },
  assessmentWarningText: { color: palette.amber, fontSize: 11, lineHeight: 17, marginTop: 3 },
  recognizedLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 13 },
  recognizedText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 4,
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 11,
  },
  unclearTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 13 },
  wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  wordChip: {
    backgroundColor: palette.dangerSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  wordChipText: { color: '#9A3A2A', fontSize: 12, fontWeight: '700' },
  omissionNote: { color: palette.amber, fontSize: 11, lineHeight: 17, marginTop: 9 },
  clarityNote: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 10 },
});
