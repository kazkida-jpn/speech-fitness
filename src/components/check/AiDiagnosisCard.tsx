import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { AiDiagnosis } from '@/lib/assessment-types';
import type { Drill } from '@/lib/drills';

type Props = {
  diagnosis: AiDiagnosis | null;
  isCreating: boolean;
  error: string | null;
  /** The drill matching `diagnosis.recommendedDrillId`, resolved by the caller. */
  recommendedDrill: Drill | null;
  /** Whether the user may run the recommended drill right away. */
  isPremium: boolean;
  onRetry: () => void;
  onStartDrill: (drill: Drill) => void;
  onSubscribe: () => void;
};

function DiagnosisSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.aiDiagnosisSection}>
      <Text style={styles.aiDiagnosisSectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <Text key={`${title}-${index}`} style={styles.aiDiagnosisItem}>
          ・{item}
        </Text>
      ))}
    </View>
  );
}

/** The generated coaching summary, its recommended drill, and the trial paywall notice. */
export function AiDiagnosisCard({
  diagnosis,
  isCreating,
  error,
  recommendedDrill,
  isPremium,
  onRetry,
  onStartDrill,
  onSubscribe,
}: Props) {
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  return (
    <View style={styles.aiDiagnosisCard}>
      <View style={styles.aiDiagnosisHeader}>
        <View>
          <Text style={styles.aiDiagnosisEyebrow}>明瞭さ × 速度</Text>
          <Text style={styles.aiDiagnosisTitle}>AIコーチの総評</Text>
        </View>
        <Text style={styles.aiBadge}>生成AI</Text>
      </View>
      {isCreating && <Text style={styles.aiDiagnosisLoading}>6回の測定結果を比較しています…</Text>}
      {diagnosis && !isCreating && (
        <>
          <Text style={styles.aiDiagnosisHeadline}>{diagnosis.headline}</Text>
          <Text style={styles.aiDiagnosisSummary}>{diagnosis.summary}</Text>
          <DiagnosisSection title="今回の強み" items={diagnosis.strengths} />
          <DiagnosisSection title="気をつけるポイント" items={diagnosis.cautions} />
          <DiagnosisSection title="音の傾向" items={diagnosis.soundTendencies} />
          <View style={styles.aiDiagnosisSection}>
            <Text style={styles.aiDiagnosisSectionTitle}>安定性</Text>
            <Text style={styles.aiDiagnosisItem}>{diagnosis.stability}</Text>
          </View>
          <View style={styles.practiceBox}>
            <Text style={styles.practiceLabel}>次の練習</Text>
            <Text style={styles.practiceText}>{diagnosis.practice}</Text>
          </View>
          {recommendedDrill && (
            <View style={styles.recommendedDrillCard}>
              <View style={styles.recommendedDrillHeader}>
                <Text style={styles.recommendedDrillEyebrow}>AIが最優先に選んだドリル</Text>
                <Text style={styles.premiumBadge}>プレミアム</Text>
              </View>
              <Text style={styles.recommendedDrillTitle}>{recommendedDrill.title}</Text>
              <Text style={styles.recommendedDrillReason}>{diagnosis.recommendedDrillReason}</Text>
              <Pressable
                style={styles.recommendedDrillButton}
                onPress={() =>
                  isPremium ? onStartDrill(recommendedDrill) : setIsPaywallOpen(true)
                }>
                <Text style={styles.recommendedDrillButtonText}>このドリルを始める</Text>
              </Pressable>
            </View>
          )}
          {isPaywallOpen && recommendedDrill && !isPremium && (
            <View style={styles.paywallCard}>
              <Text style={styles.paywallTitle}>診断に合わせた練習を続ける</Text>
              <Text style={styles.paywallText}>
                AIが選んだドリル、8種類すべてのドリル、測定履歴はプレミアムで利用できます。初回は14日間無料です。
              </Text>
              <Pressable style={styles.recommendedDrillButton} onPress={onSubscribe}>
                <Text style={styles.recommendedDrillButtonText}>14日間無料で始める</Text>
              </Pressable>
              <Pressable onPress={() => setIsPaywallOpen(false)}>
                <Text style={styles.paywallClose}>今は閉じる</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {error && !isCreating && (
        <>
          <Text style={styles.aiDiagnosisError}>{error}</Text>
          <Pressable style={styles.aiRetryButton} onPress={onRetry}>
            <Text style={styles.aiRetryButtonText}>AI診断をもう一度作成する</Text>
          </Pressable>
        </>
      )}
      <Text style={styles.aiDiagnosisNote}>
        AIはAzureの採点結果、語間、発話時間のばらつきを説明しています。新しい点数の採点や医学的な診断は行いません。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aiDiagnosisCard: {
    backgroundColor: palette.amberCream,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: palette.amberLine,
  },
  aiDiagnosisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiDiagnosisEyebrow: { color: palette.amber, fontSize: 11, fontWeight: '800' },
  aiDiagnosisTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', marginTop: 2 },
  aiBadge: {
    color: palette.amber,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: palette.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  aiDiagnosisLoading: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 16 },
  aiDiagnosisHeadline: {
    color: palette.ink,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '800',
    marginTop: 16,
  },
  aiDiagnosisSummary: { color: palette.ink, fontSize: 13, lineHeight: 22, marginTop: 8 },
  aiDiagnosisSection: { marginTop: 14 },
  aiDiagnosisSectionTitle: {
    color: palette.amber,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  aiDiagnosisItem: { color: palette.ink, fontSize: 12, lineHeight: 20 },
  practiceBox: { backgroundColor: palette.white, borderRadius: 13, padding: 13, marginTop: 15 },
  practiceLabel: { color: palette.greenDark, fontSize: 11, fontWeight: '800' },
  practiceText: { color: palette.ink, fontSize: 12, lineHeight: 20, marginTop: 4 },
  recommendedDrillCard: {
    backgroundColor: '#F1F8F5',
    borderRadius: 15,
    padding: 15,
    marginTop: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  recommendedDrillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recommendedDrillEyebrow: { color: palette.greenDark, fontSize: 11, fontWeight: '800' },
  premiumBadge: {
    color: palette.amber,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: palette.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendedDrillTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginTop: 8 },
  recommendedDrillReason: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  recommendedDrillButton: {
    backgroundColor: palette.greenDark,
    borderRadius: 13,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  recommendedDrillButtonText: { color: palette.white, fontSize: 13, fontWeight: '800' },
  paywallCard: {
    backgroundColor: palette.white,
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.amberLine,
  },
  paywallTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  paywallText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  paywallClose: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 11,
  },
  aiDiagnosisError: { color: palette.danger, fontSize: 12, lineHeight: 19, marginTop: 15 },
  aiRetryButton: {
    borderWidth: 1,
    borderColor: '#C7A747',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 10,
  },
  aiRetryButtonText: { color: palette.amber, fontSize: 12, fontWeight: '800' },
  aiDiagnosisNote: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 14 },
});
