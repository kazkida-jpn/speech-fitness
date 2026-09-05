import type { DrillId } from '@/lib/drills';

// Shapes exchanged between the check screen and the API routes.
// Keep this file free of runtime imports so both bundles can share it.

export type ClarityWord = {
  word: string;
  accuracyScore: number;
  errorType: string;
  offsetSeconds: number;
  durationSeconds: number;
};

/** Response of POST /assessment: Azure pronunciation assessment for one take. */
export type ClarityAssessment = {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  recognizedText: string;
  words: ClarityWord[];
};

export type AssessmentSummary = {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  recognizedText: string;
  unclearWords: { word: string; accuracyScore: number }[];
};

export type DiagnosisPair = {
  referenceText: string;
  focusSounds: string;
  speedChangePercent: number | null;
  naturalDurationSeconds: number;
  fastDurationSeconds: number;
  natural: AssessmentSummary;
  fast: AssessmentSummary;
};

export type StabilityMetrics = {
  naturalRateVariationPercent: number | null;
  fastRateVariationPercent: number | null;
  naturalAverageFluency: number;
  fastAverageFluency: number;
  naturalLongPauseCount: number;
  fastLongPauseCount: number;
};

/** Body of POST /diagnosis. */
export type DiagnosisRequest = {
  pairs: DiagnosisPair[];
  stability: StabilityMetrics;
};

/** Response of POST /diagnosis, produced by the model under a strict JSON schema. */
export type AiDiagnosis = {
  headline: string;
  summary: string;
  strengths: string[];
  cautions: string[];
  soundTendencies: string[];
  stability: string;
  practice: string;
  recommendedDrillId: DrillId;
  recommendedDrillReason: string;
};

export type ApiErrorBody = { error?: string };
