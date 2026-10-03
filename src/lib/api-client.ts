import type {
  AiDiagnosis,
  ApiErrorBody,
  ClarityAssessment,
  DiagnosisRequest,
} from '@/lib/assessment-types';
import { DEVICE_ID_HEADER, type CheckQuota } from '@/lib/check-quota';
import { getDeviceId } from '@/lib/device-id';
import { supabase } from '@/lib/supabase';

// Thin wrappers around the app's own API routes. Each throws an Error whose message is
// safe to show to the user.

async function readJson<T>(response: Response, fallbackMessage: string) {
  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) throw new Error(body.error || fallbackMessage);
  return body as T;
}

/**
 * Headers that tell the server who is running the speech check, so it can apply the limit for
 * that plan: the session token when signed in, and the device id either way.
 */
async function callerHeaders() {
  const headers: Record<string, string> = {};
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const deviceId = await getDeviceId();
  if (deviceId) headers[DEVICE_ID_HEADER] = deviceId;
  return headers;
}

/** Asks whether a speech check can be started now via GET /check-quota. */
export async function fetchCheckQuota() {
  const response = await fetch('/check-quota', { headers: await callerHeaders() });
  return readJson<CheckQuota>(response, '発話チェックの利用状況を確認できませんでした。');
}

/** Sends one take to Azure pronunciation assessment via POST /assessment. */
export async function requestAssessment(wav: Blob, referenceText: string, fileName: string) {
  const form = new FormData();
  form.append('audio', wav, fileName);
  form.append('referenceText', referenceText);
  const response = await fetch('/assessment', {
    method: 'POST',
    headers: await callerHeaders(),
    body: form,
  });
  return readJson<ClarityAssessment>(response, '明瞭さを評価できませんでした。');
}

/** Asks the coaching model for a diagnosis via POST /diagnosis. */
export async function requestDiagnosis(request: DiagnosisRequest) {
  const response = await fetch('/diagnosis', {
    method: 'POST',
    headers: { ...(await callerHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson<AiDiagnosis>(response, 'AI診断を作成できませんでした。');
}
