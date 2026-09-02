import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { DRILLS } from '@/lib/drills';
import { getAssessmentHistory, getDrillHistory, isHistoryUserSignedIn, localDateKey } from '@/lib/progress';
import { isSupabaseConfigured } from '@/lib/supabase';

const colors = { ink: '#19312D', muted: '#60726E', cream: '#F6F3EC', white: '#FFFFFF', green: '#187A64', greenDark: '#0F5E4D', mint: '#DDF4EA', line: '#DCE6E2' };

export default function HomeScreen() {
  const [month, setMonth] = useState(() => new Date());
  const [historyByDate, setHistoryByDate] = useState<Record<string, { seconds: number; sentences: number }>>({});
  const [recommendedIds, setRecommendedIds] = useState<string[]>(['sibilants', 'speed']);
  const [lastCheckDate, setLastCheckDate] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([isHistoryUserSignedIn(), getDrillHistory(), getAssessmentHistory()]).then(([signedIn, drills, checks]) => {
      if (!active) return;
      setIsSignedIn(signedIn);
      const grouped: Record<string, { seconds: number; sentences: number }> = {};
      drills.forEach((entry) => {
        grouped[entry.date] ||= { seconds: 0, sentences: 0 };
        grouped[entry.date].seconds += entry.durationSeconds;
        grouped[entry.date].sentences += entry.sentenceCount;
      });
      setHistoryByDate(grouped);
      const latest = checks.at(-1);
      if (latest) {
        setLastCheckDate(latest.date);
        if (latest.recommendedDrillIds.length) setRecommendedIds(latest.recommendedDrillIds);
      }
    }).catch(() => {
      if (!active) return;
      setIsSignedIn(false);
      setHistoryByDate({});
    });
    return () => { active = false; };
  }, []));

  const nextCheck = lastCheckDate ? new Date(`${lastCheckDate}T00:00:00`) : null;
  if (nextCheck) nextCheck.setDate(nextCheck.getDate() + 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilCheck = nextCheck ? Math.max(0, Math.ceil((nextCheck.getTime() - today.getTime()) / 86_400_000)) : 0;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const monthEntries = Object.entries(historyByDate).filter(([date]) => date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`));
  const monthSeconds = monthEntries.reduce((total, [, value]) => total + value.seconds, 0);
  const monthSentences = monthEntries.reduce((total, [, value]) => total + value.sentences, 0);
  const recommended = recommendedIds.map((id) => DRILLS.find((drill) => drill.id === id)).filter(Boolean).slice(0, 2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader />

        <View style={styles.checkCard}>
          <Text style={styles.checkLabel}>次回の発話チェック</Text>
          <Text style={styles.checkValue}>{daysUntilCheck === 0 ? '今週のチェックができます' : `あと ${daysUntilCheck} 日`}</Text>
          <Text style={styles.checkNote}>3つの例文を自然な速さと早口で読み、今の状態を確認します。</Text>
          {daysUntilCheck === 0 && <Link href="/check" asChild><Pressable style={styles.checkButton}><Text style={styles.checkButtonText}>発話チェックを始める</Text></Pressable></Link>}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>今日のおすすめ</Text><Link href="/drills" style={styles.textLink}>すべて見る</Link></View>
        <View style={styles.recommendGrid}>
          {recommended.map((drill) => drill && (
            <Pressable key={drill.id} style={[styles.recommendCard, { backgroundColor: drill.accent }]} onPress={() => router.push({ pathname: '/drills', params: { drill: drill.id } })}>
                <Text style={styles.recommendTag}>おすすめドリル</Text><Text style={styles.recommendTitle}>{drill.title}</Text><Text style={styles.recommendBody}>{drill.description}</Text><Text style={styles.recommendAction}>練習する →</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>発話カレンダー</Text>{isSignedIn && <Link href="/history" style={styles.textLink}>履歴を見る</Link>}</View>
        <View style={styles.calendarCard}>
          {!isSignedIn && <View style={styles.loginNotice}><Text style={styles.loginNoticeTitle}>ログインすると練習記録を残せます</Text><Text style={styles.loginNoticeText}>ドリルはそのままお試しいただけます。ログイン後の練習は日ごとに記録されます。</Text></View>}
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth(new Date(year, monthIndex - 1, 1))}><Text style={styles.monthArrow}>‹</Text></Pressable>
            <Text style={styles.monthTitle}>{year}年{monthIndex + 1}月</Text>
            <Pressable onPress={() => setMonth(new Date(year, monthIndex + 1, 1))}><Text style={styles.monthArrow}>›</Text></Pressable>
          </View>
          <View style={styles.weekRow}>{['日','月','火','水','木','金','土'].map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
              const value = historyByDate[localDateKey(new Date(year, monthIndex, day))];
              const minutes = value ? Math.max(1, Math.round(value.seconds / 60)) : 0;
              const intensity = minutes >= 10 ? '#187A64' : minutes >= 6 ? '#4CA886' : minutes >= 3 ? '#8CCDB5' : minutes ? '#CBE9DD' : '#F1F3F2';
              return <View key={day} style={[styles.dayCell, { backgroundColor: intensity }]}><Text style={[styles.dayNumber, minutes >= 6 && styles.dayTextLight]}>{day}</Text>{minutes > 0 && <Text style={[styles.dayMinutes, minutes >= 6 && styles.dayTextLight]}>{minutes}分</Text>}</View>;
            })}
          </View>
          {isSignedIn && <Text style={styles.monthSummary}>今月 {Math.round(monthSeconds / 60)}分・{monthSentences}文・{monthEntries.length}日練習</Text>}
        </View>
        {!isSupabaseConfigured && <Text style={styles.setupNote}>Googleログインとクラウド保存はSupabase設定後に有効になります。</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:colors.cream},container:{width:'100%',maxWidth:820,alignSelf:'center',padding:22,paddingBottom:50},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:22},eyebrow:{color:colors.green,fontSize:11,fontWeight:'800',letterSpacing:2},logo:{color:colors.ink,fontSize:24,fontWeight:'800',marginTop:3},userName:{color:colors.muted,fontSize:12,maxWidth:220},loginButton:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:14,paddingHorizontal:13,paddingVertical:10},loginButtonText:{color:colors.greenDark,fontSize:12,fontWeight:'800'},checkCard:{backgroundColor:colors.greenDark,borderRadius:24,padding:22},checkLabel:{color:'#CBE9DD',fontSize:12,fontWeight:'700'},checkValue:{color:colors.white,fontSize:27,fontWeight:'800',marginTop:5},checkNote:{color:'#E6F4EF',fontSize:13,lineHeight:20,marginTop:7},checkButton:{backgroundColor:colors.white,borderRadius:14,alignItems:'center',paddingVertical:13,marginTop:16},checkButtonText:{color:colors.greenDark,fontSize:14,fontWeight:'800'},sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:28,marginBottom:12},sectionTitle:{color:colors.ink,fontSize:19,fontWeight:'800'},textLink:{color:colors.green,fontSize:12,fontWeight:'700'},recommendGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},recommendCard:{flexGrow:1,flexBasis:280,borderRadius:18,padding:17,minHeight:160},recommendTag:{color:colors.greenDark,fontSize:10,fontWeight:'800'},recommendTitle:{color:colors.ink,fontSize:18,fontWeight:'800',marginTop:5},recommendBody:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:7},recommendAction:{color:colors.greenDark,fontSize:12,fontWeight:'800',marginTop:'auto',paddingTop:12},calendarCard:{backgroundColor:colors.white,borderRadius:22,padding:16,borderWidth:1,borderColor:colors.line},loginNotice:{backgroundColor:'#FFF7D6',borderRadius:14,padding:14,marginBottom:12},loginNoticeTitle:{color:colors.ink,fontSize:13,fontWeight:'800'},loginNoticeText:{color:colors.muted,fontSize:11,lineHeight:18,marginTop:3},monthNav:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:22,marginBottom:12},monthArrow:{color:colors.greenDark,fontSize:28,paddingHorizontal:8},monthTitle:{color:colors.ink,fontSize:16,fontWeight:'800'},weekRow:{flexDirection:'row'},weekDay:{width:'14.285%',textAlign:'center',color:colors.muted,fontSize:11,paddingBottom:7},calendarGrid:{flexDirection:'row',flexWrap:'wrap',gap:0},dayCell:{width:'13.4%',aspectRatio:1,borderRadius:9,margin:'0.44%',alignItems:'center',justifyContent:'center'},dayCellEmpty:{width:'13.4%',aspectRatio:1,margin:'0.44%'},dayNumber:{color:colors.ink,fontSize:11,fontWeight:'700'},dayMinutes:{color:colors.greenDark,fontSize:9,fontWeight:'800',marginTop:2},dayTextLight:{color:colors.white},monthSummary:{color:colors.muted,fontSize:11,marginTop:12},setupNote:{color:colors.muted,fontSize:11,lineHeight:18,textAlign:'center',marginTop:18},
});
