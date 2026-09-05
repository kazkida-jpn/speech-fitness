import { describe, expect, it } from 'vitest';

import type { AiDiagnosis, ClarityAssessment } from '@/lib/assessment-types';
import type { RecordedTake, TakeNumber } from '@/lib/check-session';
import { buildDiagnosisRequest, recommendedDrillIds } from '@/lib/diagnosis';

const sessionTexts = ['あいうえお。', 'かきくけこ、さしすせそ。', 'たちつてと。'];

function take(durationMillis: number, voiceDetected = true): RecordedTake {
  return {
    uri: 'blob:take',
    durationMillis,
    recordingDurationMillis: durationMillis + 500,
    microphoneName: 'Test Mic',
    voiceDetected,
  };
}

function result(fluencyScore: number): ClarityAssessment {
  return {
    pronunciationScore: 80,
    accuracyScore: 80,
    fluencyScore,
    completenessScore: 100,
    recognizedText: '',
    words: [
      { word: 'あ', accuracyScore: 50, errorType: 'None', offsetSeconds: 0, durationSeconds: 0.2 },
      { word: 'い', accuracyScore: 95, errorType: 'None', offsetSeconds: 1, durationSeconds: 0.2 },
    ],
  };
}

const takes: Record<TakeNumber, RecordedTake> = {
  1: take(2500),
  2: take(2000),
  3: take(5000),
  4: take(4000),
  5: take(2500),
  6: take(0, false),
};

const results: Record<TakeNumber, ClarityAssessment> = {
  1: result(90),
  2: result(70),
  3: result(80),
  4: result(60),
  5: result(70),
  6: result(50),
};

describe('buildDiagnosisRequest', () => {
  const request = buildDiagnosisRequest({ takes, results, sessionTexts });

  it('pairs each sentence with its natural and fast takes', () => {
    expect(request.pairs).toHaveLength(3);
    expect(request.pairs[0]).toMatchObject({
      referenceText: 'あいうえお。',
      speedChangePercent: 25,
      naturalDurationSeconds: 2.5,
      fastDurationSeconds: 2,
    });
    expect(request.pairs[2].speedChangePercent).toBeNull();
  });

  it('summarizes assessments with only the unclear words', () => {
    expect(request.pairs[0].natural.unclearWords).toEqual([{ word: 'あ', accuracyScore: 50 }]);
  });

  it('computes stability from rates, fluency, and pauses', () => {
    // Natural rates: 5/2.5, 10/5, 5/2.5 = 2 chars/s each, so no variation.
    expect(request.stability.naturalRateVariationPercent).toBe(0);
    // Fast take 6 has no speech and is skipped: 5/2 and 10/4 = 2.5 chars/s each.
    expect(request.stability.fastRateVariationPercent).toBe(0);
    expect(request.stability.naturalAverageFluency).toBe(80);
    expect(request.stability.fastAverageFluency).toBe(60);
    expect(request.stability.naturalLongPauseCount).toBe(3);
    expect(request.stability.fastLongPauseCount).toBe(3);
  });
});

describe('recommendedDrillIds', () => {
  const diagnosis: AiDiagnosis = {
    headline: '語尾が弱くなります',
    summary: '早口になるとサ行が不明瞭です。',
    strengths: [],
    cautions: ['文末まで声を保ちましょう'],
    soundTendencies: [],
    stability: '速度は一定です。',
    practice: '語尾を意識して読みましょう。',
    recommendedDrillId: 'endings',
    recommendedDrillReason: '文末が弱い',
  };

  it('puts the model pick first, then text matches, without duplicates', () => {
    expect(recommendedDrillIds(diagnosis)).toEqual(['endings', 'sibilants', 'rhythm']);
  });
});
