import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import { checkLimitMessage, type CheckQuota } from '@/lib/check-quota';

type Props = {
  /** A quota whose limit has been reached. */
  quota: CheckQuota;
  onSignIn: () => void;
  onSubscribe: () => void;
};

/** Shown in place of the check when the caller has used up the checks their plan allows. */
export function CheckLimitCard({ quota, onSignIn, onSubscribe }: Props) {
  const { title, body } = checkLimitMessage(quota);
  return (
    <View style={styles.limitCard}>
      <Text style={styles.limitTitle}>{title}</Text>
      <Text style={styles.limitText}>{body}</Text>
      {quota.tier === 'anonymous' && (
        <Pressable style={styles.limitButton} onPress={onSignIn}>
          <Text style={styles.limitButtonText}>Googleでログインする</Text>
        </Pressable>
      )}
      {quota.tier === 'free' && (
        <Pressable style={styles.limitButton} onPress={onSubscribe}>
          <Text style={styles.limitButtonText}>プレミアムを見る</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  limitCard: { backgroundColor: palette.mint, borderRadius: 18, padding: 18 },
  limitTitle: { color: palette.ink, fontSize: 19, lineHeight: 28, fontWeight: '800' },
  limitText: { color: palette.muted, fontSize: 16, lineHeight: 25, marginTop: 6 },
  limitButton: {
    backgroundColor: palette.green,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 14,
  },
  limitButtonText: { color: palette.white, fontSize: 16, fontWeight: '800' },
});
