import Head from 'expo-router/head';
import { Link, router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/AppFooter';
import { BrandMark } from '@/components/BrandMark';
import { palette } from '@/constants/palette';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/constants/site';
import { DRILLS } from '@/lib/drills';
import { markStarted } from '@/lib/onboarding';
import { BILLING_PLANS, FREE_DRILL_IDS, PREMIUM_FEATURES, TRIAL_DAYS } from '@/lib/plans';

const VALUES = [
  {
    title: '測る',
    body: '同じ3つの例文を、自然な速さと早口の2回ずつ読みます。明瞭さ・速さ・音ごとの傾向を分けて記録するので、変化が比べられます。',
  },
  {
    title: '鍛える',
    body: 'AIコーチが測定結果から苦手な音や課題を読み取り、8種類のドリルから今日やるべきものを選びます。1回2〜5分です。',
  },
  {
    title: '見える化する',
    body: '練習した日はカレンダーに色がつき、週1回の発話チェックで過去の自分との違いが見えます。競う相手は他人ではなく、以前の自分です。',
  },
];

const STEPS = [
  {
    step: '1',
    title: '発話チェック（約3分）',
    body: '例文を読むだけ。録音はブラウザ内に残り、明瞭さ測定は同意したときだけ送信されます。',
  },
  {
    step: '2',
    title: 'AIコーチの診断',
    body: '明瞭さと速さの関係、目立つ音の傾向、読みの安定性を、やさしい言葉で説明します。',
  },
  {
    step: '3',
    title: '毎日のドリル',
    body: 'おすすめの2つを中心に、10文ずつ声に出して読みます。録音を聞き返して確認できます。',
  },
  {
    step: '4',
    title: '週1回、また測る',
    body: '同じ条件で測り直し、変化を記録します。良くなった点も、次の課題も残ります。',
  },
];

const FAQ = [
  {
    q: '医療機関の検査の代わりになりますか？',
    a: 'なりません。本サービスは発話のフィットネスアプリで、病気や認知機能を診断しません。声や飲み込みに不安があるときは、医師や言語聴覚士に相談してください。',
  },
  {
    q: '録音した声はどこに保存されますか？',
    a: '発話チェックの録音は測定中だけブラウザ内に保持し、アプリを閉じると消えます。明瞭さ測定に同意した場合のみ、音声認識のために外部サービスへ送信します。ドリルの録音は保存しません。',
  },
  {
    q: '無料でどこまで使えますか？',
    a: `週1回の発話チェックと、${FREE_DRILL_IDS.length}種類のドリルはずっと無料です。Googleでログインすると練習カレンダーも記録されます。`,
  },
  {
    q: 'プレミアムはいつでもやめられますか？',
    a: `はい。「お支払いの管理・解約」からいつでも解約できます。初回は${TRIAL_DAYS}日間無料で、その間に解約すれば料金はかかりません。`,
  },
];

export function LandingScreen() {
  const [starting, setStarting] = useState(false);
  const pathname = usePathname();

  // Remember the visit, then show the home screen: at "/" the root screen re-renders on its
  // own, from any other URL we navigate there.
  const start = async () => {
    setStarting(true);
    await markStarted();
    if (pathname !== '/') router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Head>
        <title>{`${SITE_NAME} | ${SITE_TAGLINE}`}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content={`${SITE_NAME} | ${SITE_TAGLINE}`} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/`} />
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <BrandMark size={34} />
            <View>
              <Text style={styles.eyebrow}>SPEECH FITNESS</Text>
              <Text style={styles.brandName}>{SITE_NAME}</Text>
            </View>
          </View>
          <View style={styles.topLinks}>
            <Link href="/pricing" style={styles.topLink}>
              料金
            </Link>
            <Pressable style={styles.topButton} onPress={start} disabled={starting}>
              <Text style={styles.topButtonText}>アプリを開く</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTag}>話す機会が減った大人のための、発話トレーニング</Text>
          <Text style={styles.heroTitle}>話す力は、{'\n'}毎日数分で保てる。</Text>
          <Text style={styles.heroLead}>
            在宅勤務や退職で会話が減り、「言葉が出にくい」「滑舌が落ちた」と感じていませんか。
            {SITE_NAME}
            は、週1回の発話チェックと毎日2〜5分のドリルで、伝わる話し方を測り、鍛え、変化を見える化します。
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={start} disabled={starting}>
              <Text style={styles.primaryButtonText}>
                {starting ? '開いています…' : '無料で始める'}
              </Text>
            </Pressable>
            <Link href="/pricing" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>料金を見る</Text>
              </Pressable>
            </Link>
          </View>
          <Text style={styles.heroNote}>
            インストール不要。マイク付きのパソコンやスマートフォンのブラウザで使えます。
          </Text>
        </View>

        <View style={styles.demoCard}>
          <Text style={styles.demoLabel}>発話チェックの結果イメージ</Text>
          <View style={styles.demoRow}>
            <View style={styles.demoMetric}>
              <Text style={styles.demoMetricLabel}>自然な速さ</Text>
              <Text style={styles.demoMetricValue}>6.8 文字/秒</Text>
              <Text style={styles.demoMetricSub}>明瞭さ 92</Text>
            </View>
            <View style={styles.demoMetric}>
              <Text style={styles.demoMetricLabel}>早口</Text>
              <Text style={styles.demoMetricValue}>9.1 文字/秒</Text>
              <Text style={styles.demoMetricSub}>明瞭さ 78</Text>
            </View>
          </View>
          <View style={styles.demoBars}>
            {[36, 52, 70, 58, 84, 64, 92, 74].map((height, index) => (
              <View
                key={index}
                style={[
                  styles.demoBar,
                  { height, backgroundColor: index === 6 ? palette.coral : palette.green },
                ]}
              />
            ))}
          </View>
          <Text style={styles.demoDiagnosis}>
            速くすると「サ行」と語尾の明瞭さが下がります。今週は「サ行・ザ行を明瞭に」と「語尾を最後まで届ける」がおすすめです。
          </Text>
        </View>

        <Text style={styles.sectionTitle}>3つのこと</Text>
        <View style={styles.valueGrid}>
          {VALUES.map((value) => (
            <View key={value.title} style={styles.valueCard}>
              <Text style={styles.valueTitle}>{value.title}</Text>
              <Text style={styles.valueBody}>{value.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>使い方</Text>
        <View style={styles.stepList}>
          {STEPS.map((item) => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{item.step}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{DRILLS.length}種類のドリル</Text>
        <View style={styles.drillGrid}>
          {DRILLS.map((drill) => (
            <View key={drill.id} style={[styles.drillCard, { backgroundColor: drill.accent }]}>
              <Text style={styles.drillTitle}>{drill.title}</Text>
              <Text style={styles.drillBody}>{drill.description}</Text>
              {FREE_DRILL_IDS.includes(drill.id) && <Text style={styles.drillFree}>無料</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>料金</Text>
        <View style={styles.planGrid}>
          <View style={styles.planCard}>
            <Text style={styles.planName}>無料</Text>
            <Text style={styles.planPrice}>¥0</Text>
            <Text style={styles.planItem}>・週1回の発話チェックとAI診断</Text>
            <Text style={styles.planItem}>・{FREE_DRILL_IDS.length}種類のドリル</Text>
            <Text style={styles.planItem}>・練習カレンダー（ログイン時）</Text>
          </View>
          <View style={[styles.planCard, styles.planCardFeatured]}>
            <Text style={styles.planName}>プレミアム</Text>
            <Text style={styles.planPrice}>
              ¥{BILLING_PLANS.monthly.amount.toLocaleString('ja-JP')}
              <Text style={styles.planPer}> / 月</Text>
            </Text>
            <Text style={styles.planAlt}>
              年額 ¥{BILLING_PLANS.yearly.amount.toLocaleString('ja-JP')}（
              {BILLING_PLANS.yearly.note}）
            </Text>
            {PREMIUM_FEATURES.map((feature) => (
              <Text key={feature} style={styles.planItem}>
                ・{feature}
              </Text>
            ))}
            <Text style={styles.planTrial}>初回{TRIAL_DAYS}日間無料。いつでも解約できます。</Text>
          </View>
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>安心して使うために</Text>
          <Text style={styles.safetyBody}>
            本サービスは医療機器ではなく、病気や認知機能の診断はしません。「治る」「予防できる」と断定もしません。同じ人を同じ条件で測り続け、前向きな練習につなげることを大切にしています。
          </Text>
          <Text style={styles.safetyBody}>
            録音は測定中だけブラウザ内に保持し、明瞭さ測定は同意したときだけ送信します。カード情報はStripeが管理し、当社は保持しません。
          </Text>
        </View>

        <Text style={styles.sectionTitle}>よくある質問</Text>
        <View style={styles.faqList}>
          {FAQ.map((item) => (
            <View key={item.q} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Text style={styles.faqAnswer}>{item.a}</Text>
            </View>
          ))}
        </View>

        <View style={styles.closing}>
          <Text style={styles.closingTitle}>今日の声を、記録するところから。</Text>
          <Pressable style={styles.primaryButton} onPress={start} disabled={starting}>
            <Text style={styles.primaryButtonText}>無料で始める</Text>
          </Pressable>
        </View>

        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 22, paddingBottom: 50 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { color: palette.green, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  brandName: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topLink: { color: palette.muted, fontSize: 12, fontWeight: '700', textDecorationLine: 'none' },
  topButton: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topButtonText: { color: palette.greenDark, fontSize: 12, fontWeight: '800' },
  hero: { marginTop: 40 },
  heroTag: { color: palette.green, fontSize: 13, fontWeight: '800' },
  heroTitle: {
    color: palette.ink,
    fontSize: 40,
    lineHeight: 52,
    fontWeight: '800',
    marginTop: 10,
  },
  heroLead: { color: palette.muted, fontSize: 15, lineHeight: 26, marginTop: 16, maxWidth: 620 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  heroNote: { color: palette.muted, fontSize: 12, marginTop: 12 },
  primaryButton: {
    backgroundColor: palette.green,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: palette.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: palette.green,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: palette.greenDark, fontSize: 15, fontWeight: '800' },
  demoCard: {
    marginTop: 34,
    backgroundColor: palette.greenDark,
    borderRadius: 24,
    padding: 22,
  },
  demoLabel: { color: '#CBE9DD', fontSize: 11, fontWeight: '800' },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  demoMetric: {
    flexGrow: 1,
    flexBasis: 200,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
  },
  demoMetricLabel: { color: '#CBE9DD', fontSize: 11, fontWeight: '700' },
  demoMetricValue: { color: palette.white, fontSize: 22, fontWeight: '800', marginTop: 4 },
  demoMetricSub: { color: '#E6F4EF', fontSize: 12, marginTop: 2 },
  demoBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
    marginTop: 18,
  },
  demoBar: { flex: 1, borderRadius: 6, opacity: 0.9 },
  demoDiagnosis: { color: '#E6F4EF', fontSize: 13, lineHeight: 21, marginTop: 16 },
  sectionTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 44,
    marginBottom: 14,
  },
  valueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  valueCard: {
    flexGrow: 1,
    flexBasis: 240,
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  valueTitle: { color: palette.greenDark, fontSize: 18, fontWeight: '800' },
  valueBody: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  stepList: { gap: 12 },
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: palette.greenDark, fontSize: 14, fontWeight: '800' },
  stepText: { flex: 1 },
  stepTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  stepBody: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 3 },
  drillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  drillCard: { flexGrow: 1, flexBasis: 200, borderRadius: 16, padding: 14, minHeight: 110 },
  drillTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  drillBody: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  drillFree: {
    alignSelf: 'flex-start',
    color: palette.greenDark,
    backgroundColor: palette.white,
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 8,
  },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  planCard: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  planCardFeatured: { borderColor: palette.green, borderWidth: 2 },
  planName: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  planPrice: { color: palette.ink, fontSize: 30, fontWeight: '800', marginTop: 4 },
  planPer: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  planAlt: { color: palette.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  planItem: { color: palette.ink, fontSize: 13, lineHeight: 22 },
  planTrial: { color: palette.green, fontSize: 12, fontWeight: '700', marginTop: 10 },
  safetyCard: {
    marginTop: 34,
    backgroundColor: palette.amberCream,
    borderWidth: 1,
    borderColor: palette.amberLine,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  safetyTitle: { color: palette.amber, fontSize: 13, fontWeight: '800' },
  safetyBody: { color: palette.ink, fontSize: 13, lineHeight: 21 },
  faqList: { gap: 10 },
  faqItem: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  faqQuestion: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  faqAnswer: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 6 },
  closing: { alignItems: 'center', gap: 14, marginTop: 44 },
  closingTitle: { color: palette.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
});
