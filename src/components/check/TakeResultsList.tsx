import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import {
  SPEAKING_MODES,
  SPEAKING_MODE_LABELS,
  takeNumberFor,
  type RecordedTake,
  type TakeMap,
} from '@/lib/check-session';
import { formatResultTime } from '@/lib/format';

type Props = {
  sessionTexts: string[];
  takes: TakeMap<RecordedTake>;
  onPlay: (take: RecordedTake) => void;
};

/** The six recordings grouped by sentence, each with a play button. */
export function TakeResultsList({ sessionTexts, takes, onPlay }: Props) {
  return (
    <View style={styles.resultList}>
      {sessionTexts.map((referenceText, sentenceIndex) => (
        <View key={referenceText} style={styles.resultGroup}>
          <Text style={styles.resultGroupLabel}>例文 {sentenceIndex + 1}</Text>
          <Text style={styles.resultReference}>{referenceText}</Text>
          {SPEAKING_MODES.map((mode) => {
            const takeNumber = takeNumberFor(sentenceIndex, mode);
            const take = takes[takeNumber];
            if (!take) return null;
            return (
              <View key={takeNumber} style={styles.resultRow}>
                <View>
                  <Text style={styles.resultLabel}>{SPEAKING_MODE_LABELS[mode]}</Text>
                  <Text style={styles.resultTime}>
                    {take.voiceDetected
                      ? `発話 ${formatResultTime(take.durationMillis)}`
                      : '発話を検出できませんでした'}
                  </Text>
                  <Text style={styles.resultMic}>マイク: {take.microphoneName}</Text>
                </View>
                <Pressable style={styles.playButton} onPress={() => onPlay(take)}>
                  <Text style={styles.playButtonText}>▶ 再生</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  resultList: { gap: 10, marginTop: 22, marginBottom: 16 },
  resultGroup: { backgroundColor: palette.cream, borderRadius: 18, padding: 14, gap: 8 },
  resultGroupLabel: { color: palette.greenDark, fontSize: 12, fontWeight: '800' },
  resultReference: { color: palette.ink, fontSize: 12, lineHeight: 19, marginBottom: 2 },
  resultRow: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  resultTime: { color: palette.ink, fontSize: 23, fontWeight: '800', marginTop: 3 },
  resultMic: { color: palette.muted, fontSize: 10, marginTop: 3, maxWidth: 360 },
  playButton: {
    backgroundColor: palette.white,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  playButtonText: { color: palette.greenDark, fontSize: 14, fontWeight: '800' },
});
