import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';

type Props = {
  /** Mean speed change in percent across measurable sentence pairs, or null. */
  averageSpeedChange: number | null;
};

export function SpeedChangeSummary({ averageSpeedChange }: Props) {
  return (
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
  );
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: palette.mint, borderRadius: 18, padding: 17, marginBottom: 18 },
  summaryLabel: { color: palette.greenDark, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: palette.ink, fontSize: 21, fontWeight: '800', marginTop: 4 },
  summaryNote: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
