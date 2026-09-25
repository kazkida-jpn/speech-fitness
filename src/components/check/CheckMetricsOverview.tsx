import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';

const METRICS: [title: string, body: string][] = [
  ['明瞭さ', '言葉が正しく伝わる割合'],
  ['速度', '明瞭さを保てる速さ'],
  ['音の傾向', '複数の例文で繰り返す音の特徴'],
  ['安定性', '速度のばらつき・間・流暢さ'],
];

/** Static explanation of what the weekly check measures. */
export function CheckMetricsOverview() {
  return (
    <View style={styles.metricsSection}>
      <Text style={styles.sectionTitle}>この測定で見ること</Text>
      <Text style={styles.sectionNote}>
        3例文を自然な速さと早口で読み、クラウド評価と発話時間・語間を組み合わせて判定します。
      </Text>
      <View style={styles.metricsGrid}>
        {METRICS.map(([title, body]) => (
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
  );
}

const styles = StyleSheet.create({
  metricsSection: { marginTop: 28 },
  sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  sectionNote: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: -5,
    marginBottom: 13,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    minHeight: 100,
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricTitle: { color: palette.greenDark, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  pendingBadge: {
    flexShrink: 0,
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: palette.cream,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metricBody: { color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 5 },
});
