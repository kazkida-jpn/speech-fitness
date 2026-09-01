import type { User } from '@supabase/supabase-js';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function userLabel(user: User) {
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'ログイン中';
}

export function AppHeader() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    supabase?.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.mainRow}>
        <Link href="/" style={styles.brand}>
          <Text style={styles.eyebrow}>SPEECH FITNESS</Text>
          <Text style={styles.logo}>発話フィットネス</Text>
        </Link>
        {user ? (
          <View style={styles.account}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{userLabel(user).slice(0, 1)}</Text></View>
            <View style={styles.accountText}>
              <Text style={styles.loginState}>ログイン中</Text>
              <Text style={styles.userName} numberOfLines={1}>{userLabel(user)}</Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={() => supabase?.auth.signOut()}>
              <Text style={styles.logoutText}>ログアウト</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.loginButton} onPress={signInWithGoogle} disabled={!isSupabaseConfigured}>
            <Text style={styles.loginButtonText}>{isSupabaseConfigured ? 'Googleでログイン' : 'ログイン準備中'}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.navigation}>
        <Link href="/" style={styles.navLink}>ホーム</Link>
        <Link href="/check" style={styles.navLink}>発話チェック</Link>
        <Link href="/drills" style={styles.navLink}>ドリル</Link>
        <Link href="/history" style={styles.navLink}>履歴</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 22, borderBottomWidth: 1, borderBottomColor: '#DCE6E2', paddingBottom: 13 },
  mainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  brand: { textDecorationLine: 'none' },
  eyebrow: { color: '#187A64', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  logo: { color: '#19312D', fontSize: 22, fontWeight: '800', marginTop: 2 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DDF4EA', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#0F5E4D', fontSize: 13, fontWeight: '800' },
  accountText: { maxWidth: 170 },
  loginState: { color: '#187A64', fontSize: 9, fontWeight: '800' },
  userName: { color: '#19312D', fontSize: 11, fontWeight: '700' },
  logoutButton: { borderWidth: 1, borderColor: '#DCE6E2', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  logoutText: { color: '#60726E', fontSize: 10, fontWeight: '700' },
  loginButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6E2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  loginButtonText: { color: '#0F5E4D', fontSize: 11, fontWeight: '800' },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 },
  navLink: { color: '#60726E', fontSize: 11, fontWeight: '700', textDecorationLine: 'none' },
});
