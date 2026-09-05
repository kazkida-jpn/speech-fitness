import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { WordSpeedComparison, WordSpeedComparisonSummary } from '@/lib/clarity-metrics';

type Props = {
  comparison: WordSpeedComparisonSummary;
};

function wordScoreColors(score: number) {
  if (score >= 80) return { backgroundColor: palette.mint, color: palette.greenDark };
  if (score >= 70) return { backgroundColor: '#EAF4D8', color: '#456124' };
  if (score >= 60) return { backgroundColor: palette.amberSoft, color: palette.amber };
  return { backgroundColor: '#FFE1DA', color: '#9A3A2A' };
}

function WordScore({ label, score }: { label: string; score: number }) {
  const colors = wordScoreColors(score);
  return (
    <View style={[styles.wordScore, { backgroundColor: colors.backgroundColor }]}>
      <Text style={styles.wordScoreLabel}>{label}</Text>
      <Text style={[styles.wordScoreValue, { color: colors.color }]}>{score}</Text>
    </View>
  );
}

function ScorePair({ item }: { item: WordSpeedComparison }) {
  return (
    <>
      <WordScore label="通常" score={item.naturalScore} />
      <Text style={styles.wordComparisonArrow}>→</Text>
      <WordScore label="早口" score={item.fastScore} />
    </>
  );
}

/** Words whose accuracy dropped or held when reading fast. Renders nothing without data. */
export function WordSpeedComparisonCard({ comparison }: Props) {
  const { declined, maintained } = comparison;
  if (declined.length === 0 && maintained.length === 0) return null;

  return (
    <View style={styles.wordComparisonCard}>
      <Text style={styles.wordComparisonEyebrow}>言葉ごとの明瞭さ × 速度</Text>
      <Text style={styles.wordComparisonTitle}>早口で変化した言葉</Text>
      <Text style={styles.wordComparisonNote}>
        同じ言葉の発音精度を比べ、変化が大きい順に表示しています。
      </Text>
      {declined.length > 0 && (
        <View style={styles.wordComparisonSection}>
          <Text style={styles.wordComparisonSectionTitle}>早口で低下が大きかった言葉</Text>
          {declined.map((item) => (
            <View key={`declined-${item.word}-${item.focusWord}`} style={styles.wordComparisonRow}>
              <View style={styles.wordComparisonGuidance}>
                <Text style={styles.wordComparisonWord}>{item.word}</Text>
                <Text style={styles.wordComparisonTip}>
                  「{item.word}」をひとまとまりで、最後まで音を残して読んでみましょう。
                </Text>
              </View>
              <View style={styles.wordComparisonScores}>
                <ScorePair item={item} />
                <Text style={styles.wordDrop}>−{item.drop}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {maintained.length > 0 && (
        <View style={styles.wordComparisonSection}>
          <Text style={styles.wordComparisonSectionTitle}>早口でも明瞭さを保てた言葉</Text>
          {maintained.map((item) => (
            <View
              key={`maintained-${item.word}-${item.focusWord}`}
              style={styles.wordComparisonRow}>
              <Text style={styles.wordComparisonWord}>{item.word}</Text>
              <View style={styles.wordComparisonScores}>
                <ScorePair item={item} />
              </View>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.wordComparisonFootnote}>
        一文字の助詞や語尾は、練習しやすいよう前後を含むまとまりで表示しています。点数は、その中でAzureが採点した対象部分の発音精度です。文章一致度が70点未満の測定と、照合上「脱落」とされた語は比較から除いています。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordComparisonCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 17,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  wordComparisonEyebrow: { color: palette.greenDark, fontSize: 11, fontWeight: '800' },
  wordComparisonTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', marginTop: 3 },
  wordComparisonNote: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  wordComparisonSection: { marginTop: 16, gap: 8 },
  wordComparisonSectionTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  wordComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#EDF1EF',
    paddingTop: 9,
  },
  wordComparisonWord: { color: palette.ink, fontSize: 15, fontWeight: '800', minWidth: 80 },
  wordComparisonGuidance: { flex: 1, minWidth: 180 },
  wordComparisonTip: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  wordComparisonScores: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  wordScore: {
    minWidth: 64,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 5,
  },
  wordScoreLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  wordScoreValue: { fontSize: 16, fontWeight: '800' },
  wordComparisonArrow: { color: palette.muted, fontSize: 12 },
  wordDrop: { color: '#B15B23', fontSize: 13, fontWeight: '800', minWidth: 30 },
  wordComparisonFootnote: { color: palette.muted, fontSize: 9, lineHeight: 15, marginTop: 14 },
});
