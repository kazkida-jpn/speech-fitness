import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const DRILL_HISTORY_KEY = 'speech-fitness:drill-history';
const ASSESSMENT_HISTORY_KEY = 'speech-fitness:assessment-history';

export type DrillHistoryEntry = { id: string; date: string; drillId: string; durationSeconds: number; sentenceCount: number };
export type AssessmentHistoryEntry = { id: string; date: string; headline: string; recommendedDrillIds: string[] };

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function readList<T>(key: string): Promise<T[]> {
  try { return JSON.parse((await AsyncStorage.getItem(key)) || '[]') as T[]; } catch { return []; }
}

export const getDrillHistory = () => readList<DrillHistoryEntry>(DRILL_HISTORY_KEY);
export const getAssessmentHistory = () => readList<AssessmentHistoryEntry>(ASSESSMENT_HISTORY_KEY);

export async function saveDrillHistory(entry: Omit<DrillHistoryEntry, 'id' | 'date'>) {
  const current = await getDrillHistory();
  const saved = { ...entry, id: `${Date.now()}-${Math.random()}`, date: localDateKey() };
  current.push(saved);
  await AsyncStorage.setItem(DRILL_HISTORY_KEY, JSON.stringify(current));
  try {
    const user = (await supabase?.auth.getUser())?.data.user;
    if (user) await supabase?.from('drill_sessions').insert({ user_id: user.id, performed_at: new Date().toISOString(), drill_id: entry.drillId, duration_seconds: entry.durationSeconds, sentence_count: entry.sentenceCount });
  } catch {
    // Local history remains authoritative while offline or before the cloud schema is installed.
  }
}

export async function saveAssessmentHistory(entry: Omit<AssessmentHistoryEntry, 'id' | 'date'>) {
  const current = await getAssessmentHistory();
  const saved = { ...entry, id: `${Date.now()}-${Math.random()}`, date: localDateKey() };
  current.push(saved);
  await AsyncStorage.setItem(ASSESSMENT_HISTORY_KEY, JSON.stringify(current));
  try {
    const user = (await supabase?.auth.getUser())?.data.user;
    if (user) await supabase?.from('assessment_sessions').insert({ user_id: user.id, performed_at: new Date().toISOString(), headline: entry.headline, recommended_drill_ids: entry.recommendedDrillIds });
  } catch {
    // The result is safely retained on-device and can be synchronized later.
  }
}
