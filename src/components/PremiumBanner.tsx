import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import { usePlan } from '@/lib/billing';
import { TRIAL_DAYS } from '@/lib/plans';

type Props = {
  /** One line on what premium adds in the current screen's context. */
  message?: string;
};

/** Compact upsell shown only to users who are not on premium yet. */
export function PremiumBanner({
  message = '診断に合わせたドリルと、過去の自分との比較が使えます。',
}: Props) {
  const { isPremium, isLoading } = usePlan();
  if (isPremium || isLoading) return null;
  return (
    <View style={styles.banner}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>プレミアムは{TRIAL_DAYS}日間無料</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
      <Link href="/pricing" style={styles.button}>
        {TRIAL_DAYS}日間無料で始める
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: palette.amberCream,
    borderWidth: 1,
    borderColor: palette.amberLine,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  textBlock: { flexGrow: 1, flexBasis: 240, flexShrink: 1 },
  title: { color: palette.amber, fontSize: 13, fontWeight: '800' },
  text: { color: palette.ink, fontSize: 12, lineHeight: 18, marginTop: 2 },
  button: {
    color: palette.white,
    backgroundColor: palette.green,
    fontSize: 13,
    fontWeight: '800',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
});
