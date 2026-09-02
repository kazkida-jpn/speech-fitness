import { supabase } from '@/lib/supabase';

export type DrillHistoryEntry = { id: string; date: string; drillId: string; durationSeconds: number; sentenceCount: number };
export type AssessmentHistoryEntry = { id: string; date: string; headline: string; recommendedDrillIds: string[] };

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function currentUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function isHistoryUserSignedIn() {
  return Boolean(await currentUserId());
}

export async function getDrillHistory(): Promise<DrillHistoryEntry[]> {
  const userId = await currentUserId();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('drill_sessions').select('id, performed_at, drill_id, duration_seconds, sentence_count').eq('user_id', userId).order('performed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, date: localDateKey(new Date(row.performed_at)), drillId: row.drill_id, durationSeconds: row.duration_seconds, sentenceCount: row.sentence_count }));
}

export async function getAssessmentHistory(): Promise<AssessmentHistoryEntry[]> {
  const userId = await currentUserId();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('assessment_sessions').select('id, performed_at, headline, recommended_drill_ids').eq('user_id', userId).order('performed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, date: localDateKey(new Date(row.performed_at)), headline: row.headline, recommendedDrillIds: row.recommended_drill_ids ?? [] }));
}

export async function saveDrillHistory(entry: Omit<DrillHistoryEntry, 'id' | 'date'>) {
  const userId = await currentUserId();
  if (!supabase || !userId) return false;
  const { error } = await supabase.from('drill_sessions').insert({ user_id: userId, performed_at: new Date().toISOString(), drill_id: entry.drillId, duration_seconds: entry.durationSeconds, sentence_count: entry.sentenceCount });
  if (error) throw error;
  return true;
}

export async function saveAssessmentHistory(entry: Omit<AssessmentHistoryEntry, 'id' | 'date'>) {
  const userId = await currentUserId();
  if (!supabase || !userId) return false;
  const { error } = await supabase.from('assessment_sessions').insert({ user_id: userId, performed_at: new Date().toISOString(), headline: entry.headline, recommended_drill_ids: entry.recommendedDrillIds });
  if (error) throw error;
  return true;
}
