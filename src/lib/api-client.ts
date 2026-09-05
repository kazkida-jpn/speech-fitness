import type {
  AiDiagnosis,
  ApiErrorBody,
  ClarityAssessment,
  DiagnosisRequest,
} from '@/lib/assessment-types';

// Thin wrappers around the app's own API routes. Each throws an Error whose message is
// safe to show to the user.

async function readJson<T>(response: Response, fallbackMessage: string) {
  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) throw new Error(body.error || fallbackMessage);
  return body as T;
}

/** Sends one take to Azure pronunciation assessment via POST /assessment. */
export async function requestAssessment(wav: Blob, referenceText: string, fileName: string) {
  const form = new FormData();
  form.append('audio', wav, fileName);
  form.append('referenceText', referenceText);
  const response = await fetch('/assessment', { method: 'POST', body: form });
  return readJson<ClarityAssessment>(response, '明瞭さを評価できませんでした。');
}

/** Asks the coaching model for a diagnosis via POST /diagnosis. */
export async function requestDiagnosis(request: DiagnosisRequest) {
  const response = await fetch('/diagnosis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readJson<AiDiagnosis>(response, 'AI診断を作成できませんでした。');
}
