import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';

type Props = {
  isAnalyzing: boolean;
  onAnalyze: () => void;
};

/** Explicit consent before any audio leaves the device for Azure Speech. */
export function ClarityConsentCard({ isAnalyzing, onAnalyze }: Props) {
  return (
    <View style={styles.cloudConsentCard}>
      <Text style={styles.cloudConsentTitle}>クラウドで明瞭さを測定</Text>
      <Text style={styles.cloudConsentText}>
        6件の録音音声と3つの例文を Microsoft Azure Speech
        に送信して分析します。音声はこの測定結果の算出に使用します。
      </Text>
      <Pressable
        style={[styles.analysisButton, isAnalyzing && styles.analysisButtonDisabled]}
        onPress={onAnalyze}
        disabled={isAnalyzing}>
        <Text style={styles.analysisButtonText}>
          {isAnalyzing ? '明瞭さを分析中…' : '同意して明瞭さを測定する'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cloudConsentCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 17,
    marginBottom: 18,
  },
  cloudConsentTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  cloudConsentText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 13,
  },
  analysisButton: {
    backgroundColor: palette.greenDark,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
  },
  analysisButtonDisabled: { opacity: 0.55 },
  analysisButtonText: { color: palette.white, fontSize: 14, fontWeight: '800' },
});
