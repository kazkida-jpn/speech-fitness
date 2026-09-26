import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { ScreenTitle } from '@/components/ScreenTitle';
import { palette } from '@/constants/palette';
import { trackEvent } from '@/lib/analytics';
import { signInWithGoogle, useAuthUser } from '@/lib/auth';
import { openBillingPortal, startCheckout, syncPlan, usePlan } from '@/lib/billing';
import { isBillingPlan } from '@/lib/pending-checkout';
import { rememberPendingCheckout } from '@/lib/pending-checkout-storage';
import {
  BILLING_PLANS,
  isAdminEmail,
  PREMIUM_FEATURES,
  TRIAL_DAYS,
  type BillingPlan,
} from '@/lib/plans';
import { isSupabaseConfigured } from '@/lib/supabase';

const TRIAL_STEPS = [
  {
    title: '申し込み時の請求は0円',
    text: 'カードを登録するだけで、その日の請求はありません。すぐにプレミアムの全機能が使えます。',
  },
  {
    title: `${TRIAL_DAYS}日間は無料で利用`,
    text: '無料期間の終了7日前に、登録したメールアドレスへお知らせが届きます。',
  },
  {
    title: `${TRIAL_DAYS + 1}日目に初回の請求`,
    text: '無料期間が終わると、選んだプランの料金が自動で請求され、以降は同じ間隔で自動更新されます。',
  },
  {
    title: '続けない場合は無料期間中に解約',
    text: 'このページの「お支払いの管理・解約」からいつでも解約できます。無料期間中に解約すれば請求は0円で、期間末まで利用できます。',
  },
];

export default function PricingScreen() {
  const params = useLocalSearchParams<{ checkout?: string; plan?: string }>();
  const user = useAuthUser();
  const { plan, isPremium, isLoading, refresh } = usePlan();
  const [busyPlan, setBusyPlan] = useState<BillingPlan | 'portal' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resumedPlan = useRef<BillingPlan | null>(null);
  const signedOut = user === null;
  const isAdmin = isAdminEmail(user?.email);

  // Reconcile with Stripe on every signed-in visit rather than trusting the webhook alone:
  // a delivery missed while the database was unreachable would otherwise leave a stale plan.
  // Back from Checkout the same pass also records the start of the subscription.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    syncPlan()
      .then((synced) => {
        if (synced === 'premium' && params.checkout === 'success')
          trackEvent('subscription_started');
        refresh();
      })
      .catch(() => {});
  }, [userId, params.checkout, refresh]);

  const subscribe = async (billingPlan: BillingPlan) => {
    setMessage(null);
    setBusyPlan(billingPlan);
    try {
      await startCheckout(billingPlan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '決済ページを開けませんでした。');
      setBusyPlan(null);
    }
  };

  // A signed-out visitor picks a plan: remember it, sign in, and CheckoutResume brings
  // them back here with ?plan= so the checkout continues without a second click.
  const signInThenSubscribe = async (billingPlan: BillingPlan) => {
    setMessage(null);
    setBusyPlan(billingPlan);
    try {
      await rememberPendingCheckout(billingPlan);
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ログインを開始できませんでした。');
      setBusyPlan(null);
    }
  };

  useEffect(() => {
    if (!isBillingPlan(params.plan) || resumedPlan.current) return;
    if (!user || plan === null || isPremium) return;
    const chosen = params.plan;
    resumedPlan.current = chosen;
    // Deferred so the effect itself does not set state; it runs once per page load.
    queueMicrotask(() => subscribe(chosen));
  }, [params.plan, user, plan, isPremium]);

  const manage = async () => {
    setMessage(null);
    setBusyPlan('portal');
    try {
      await openBillingPortal();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ページを開けませんでした。');
      setBusyPlan(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenTitle title="料金" />
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader />
        <Text style={styles.eyebrow}>PREMIUM</Text>
        <Text style={styles.title}>診断に合わせた練習を、続けられる形で</Text>
        <Text style={styles.lede}>
          週1回の発話チェックは無料です。プレミアムでは、診断結果に合わせたドリルと、過去の自分との比較ができます。
        </Text>

        {params.checkout === 'success' && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>ご登録ありがとうございます</Text>
            <Text style={styles.noticeText}>
              反映まで数秒かかることがあります。プレミアムの表示に変わらない場合は、ページを開き直してください。
            </Text>
          </View>
        )}
        {params.checkout === 'cancel' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>お手続きを中断しました。いつでも再開できます。</Text>
          </View>
        )}
        {isBillingPlan(params.plan) && busyPlan === params.plan && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>ログインできました。決済ページへ移動しています…</Text>
          </View>
        )}

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>現在のプラン</Text>
          <Text style={styles.statusValue}>
            {isLoading ? '確認中…' : isPremium ? 'プレミアム' : '無料'}
          </Text>
          {isAdmin && (
            <Text style={styles.statusNote}>
              管理者アカウントのため、常にプレミアムで利用できます。
            </Text>
          )}
          {isPremium && !isAdmin && (
            <Pressable
              style={[styles.secondaryButton, busyPlan === 'portal' && styles.disabled]}
              onPress={manage}
              disabled={busyPlan !== null}>
              <Text style={styles.secondaryButtonText}>
                {busyPlan === 'portal' ? '開いています…' : 'お支払いの管理・解約'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>プレミアムでできること</Text>
          {PREMIUM_FEATURES.map((feature) => (
            <Text key={feature} style={styles.featureItem}>
              ・{feature}
            </Text>
          ))}
          <Text style={styles.trialNote}>
            初回は{TRIAL_DAYS}日間無料。無料期間中に解約すれば料金はかかりません。
          </Text>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>無料期間の流れ</Text>
          {TRIAL_STEPS.map((step, index) => (
            <View key={step.title} style={styles.flowRow}>
              <Text style={styles.flowIndex}>{index + 1}</Text>
              <View style={styles.flowBody}>
                <Text style={styles.flowStepTitle}>{step.title}</Text>
                <Text style={styles.flowStepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPremium && (
          <View style={styles.planGrid}>
            {(Object.keys(BILLING_PLANS) as BillingPlan[]).map((key) => {
              const item = BILLING_PLANS[key];
              const featured = key === 'yearly';
              return (
                <View key={key} style={[styles.planCard, featured && styles.planCardFeatured]}>
                  {featured && <Text style={styles.planBadge}>おすすめ</Text>}
                  <Text style={styles.planLabel}>{item.label}</Text>
                  <Text style={styles.planAmount}>
                    ¥{item.amount.toLocaleString('ja-JP')}
                    <Text style={styles.planPer}> / {item.per}</Text>
                  </Text>
                  <Text style={styles.planNote}>{item.note}</Text>
                  <Pressable
                    style={[styles.primaryButton, busyPlan !== null && styles.disabled]}
                    onPress={() => (signedOut ? signInThenSubscribe(key) : subscribe(key))}
                    disabled={busyPlan !== null || plan === null || user === undefined}>
                    <Text style={styles.primaryButtonText}>
                      {busyPlan === key
                        ? signedOut
                          ? 'ログイン画面へ移動中…'
                          : '決済ページへ移動中…'
                        : signedOut
                          ? 'Googleでログインして始める'
                          : `${TRIAL_DAYS}日間無料で始める`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {!isSupabaseConfigured && (
          <Text style={styles.hint}>ログイン機能の設定後にお申し込みいただけます。</Text>
        )}
        {isSupabaseConfigured && signedOut && !isPremium && (
          <Text style={styles.hint}>
            お申し込みにはGoogleログインが必要です。ログイン後、そのまま決済ページへ進みます。
          </Text>
        )}
        {message && <Text style={styles.error}>{message}</Text>}

        <View style={styles.legal}>
          <Text style={styles.legalTitle}>特定商取引法に基づく表記</Text>
          <Text style={styles.legalRow}>販売事業者: 合同会社LearnK</Text>
          <Text style={styles.legalRow}>
            販売価格: 月額プラン 500円、年額プラン 3,980円（いずれも税込）
          </Text>
          <Text style={styles.legalRow}>支払方法: クレジットカード（Stripe による決済）</Text>
          <Text style={styles.legalRow}>
            支払時期: 無料期間終了後に初回請求、以降は各更新日に自動更新
          </Text>
          <Text style={styles.legalRow}>
            解約:
            「お支払いの管理・解約」からいつでも可能。解約後も期間末まで利用できます。日割り返金は行いません。
          </Text>
          <Text style={styles.legalRow}>提供時期: 決済完了後すぐに利用できます</Text>
          <Text style={styles.legalNote}>
            本サービスは発話のトレーニングを目的としたもので、医療機器ではなく、疾患の診断や治療を行うものではありません。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 50 },
  eyebrow: { color: palette.green, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  title: { color: palette.ink, fontSize: 29, lineHeight: 39, fontWeight: '800', marginTop: 4 },
  lede: { color: palette.muted, fontSize: 16, lineHeight: 25, marginTop: 8, marginBottom: 18 },
  notice: {
    backgroundColor: palette.mint,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  noticeTitle: { color: palette.greenDark, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  noticeText: { color: palette.ink, fontSize: 16, lineHeight: 25 },
  statusCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  statusLabel: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  statusValue: { color: palette.ink, fontSize: 24, fontWeight: '800', marginTop: 4 },
  statusNote: { color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 6 },
  featureCard: {
    backgroundColor: palette.amberCream,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.amberLine,
    marginBottom: 14,
  },
  featureTitle: { color: palette.amber, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  featureItem: { color: palette.ink, fontSize: 16, lineHeight: 27 },
  trialNote: { color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 10 },
  flowCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
    gap: 12,
  },
  flowTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  flowRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flowIndex: {
    width: 30,
    height: 30,
    lineHeight: 30,
    textAlign: 'center',
    borderRadius: 15,
    backgroundColor: palette.mint,
    color: palette.greenDark,
    fontSize: 16,
    fontWeight: '800',
    overflow: 'hidden',
  },
  flowBody: { flex: 1 },
  flowStepTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  flowStepText: { color: palette.muted, fontSize: 15, lineHeight: 24, marginTop: 2 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
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
  planBadge: {
    alignSelf: 'flex-start',
    color: palette.greenDark,
    backgroundColor: palette.mint,
    fontSize: 12,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  planLabel: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  planAmount: { color: palette.ink, fontSize: 32, fontWeight: '800', marginTop: 4 },
  planPer: { color: palette.muted, fontSize: 16, fontWeight: '700' },
  planNote: { color: palette.muted, fontSize: 15, marginTop: 4, marginBottom: 14 },
  primaryButton: {
    backgroundColor: palette.green,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: { color: palette.white, fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: palette.green,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  secondaryButtonText: { color: palette.greenDark, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  hint: { color: palette.muted, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  error: { color: palette.danger, fontSize: 16, textAlign: 'center', marginBottom: 12 },
  legal: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16, marginTop: 10 },
  legalTitle: { color: palette.ink, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  legalRow: { color: palette.muted, fontSize: 14, lineHeight: 23 },
  legalNote: { color: palette.muted, fontSize: 14, lineHeight: 23, marginTop: 8 },
});
