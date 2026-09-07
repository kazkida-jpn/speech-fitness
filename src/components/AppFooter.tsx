import { Link } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { COMPANY, SITE_NAME } from '@/constants/site';
import { palette } from '@/constants/palette';

const LINKS = [
  { href: '/welcome', label: 'サービス紹介' },
  { href: '/pricing', label: '料金' },
  { href: '/terms', label: '利用規約' },
  { href: '/privacy', label: 'プライバシーポリシー' },
  { href: '/legal', label: '特定商取引法に基づく表記' },
] as const;

export function AppFooter() {
  return (
    <View style={styles.footer}>
      <View style={styles.links}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} style={styles.link}>
            {link.label}
          </Link>
        ))}
        <Pressable onPress={() => Linking.openURL(`mailto:${COMPANY.email}`)}>
          <Text style={styles.link}>お問い合わせ</Text>
        </Pressable>
      </View>
      <Text style={styles.copyright}>
        © {new Date().getFullYear()} {COMPANY.name} · {SITE_NAME}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 40,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    gap: 12,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  link: { color: palette.muted, fontSize: 11, fontWeight: '700', textDecorationLine: 'none' },
  copyright: { color: palette.muted, fontSize: 11 },
});
