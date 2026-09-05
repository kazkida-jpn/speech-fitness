import { describe, expect, it } from 'vitest';

import type { ClarityAssessment, ClarityWord } from '@/lib/assessment-types';
import {
  averageSpeedChange,
  calculateSpeedChange,
  coefficientOfVariation,
  compareWordsBySpeed,
  countLongPauses,
  omittedWords,
  speakingContext,
  unclearWords,
} from '@/lib/clarity-metrics';

function word(text: string, accuracyScore: number, extra: Partial<ClarityWord> = {}): ClarityWord {
  return {
    word: text,
    accuracyScore,
    errorType: 'None',
    offsetSeconds: 0,
    durationSeconds: 0.3,
    ...extra,
  };
}

function assessment(
  words: ClarityWord[],
  extra: Partial<ClarityAssessment> = {}
): ClarityAssessment {
  return {
    pronunciationScore: 80,
    accuracyScore: 80,
    fluencyScore: 80,
    completenessScore: 100,
    recognizedText: words.map((item) => item.word).join(''),
    words,
    ...extra,
  };
}

describe('calculateSpeedChange', () => {
  it('reports how much faster the fast read was', () => {
    const natural = { durationMillis: 3000, voiceDetected: true };
    const fast = { durationMillis: 2000, voiceDetected: true };
    expect(calculateSpeedChange(natural, fast)).toBe(50);
  });

  it('is null when either take has no detected voice', () => {
    const natural = { durationMillis: 3000, voiceDetected: true };
    expect(calculateSpeedChange(natural, { durationMillis: 0, voiceDetected: false })).toBeNull();
    expect(calculateSpeedChange(undefined, natural)).toBeNull();
  });
});

describe('averageSpeedChange', () => {
  it('averages only the measurable sentence pairs', () => {
    const takes = {
      1: { durationMillis: 3000, voiceDetected: true },
      2: { durationMillis: 2000, voiceDetected: true },
      3: { durationMillis: 2000, voiceDetected: true },
      4: { durationMillis: 2000, voiceDetected: true },
      5: { durationMillis: 1000, voiceDetected: false },
      6: { durationMillis: 1000, voiceDetected: true },
    };
    expect(averageSpeedChange(takes)).toBe(25);
  });

  it('is null with no measurable pairs', () => {
    expect(averageSpeedChange({})).toBeNull();
  });
});

describe('coefficientOfVariation', () => {
  it('is 0 for identical values and null for empty input', () => {
    expect(coefficientOfVariation([2, 2, 2])).toBe(0);
    expect(coefficientOfVariation([])).toBeNull();
  });

  it('returns the standard deviation as a percent of the mean', () => {
    expect(coefficientOfVariation([1, 3])).toBe(50);
  });
});

describe('countLongPauses', () => {
  it('counts gaps of at least 0.6 seconds between spoken words', () => {
    const result = assessment([
      word('a', 90, { offsetSeconds: 0, durationSeconds: 0.3 }),
      word('b', 90, { offsetSeconds: 1.0, durationSeconds: 0.3 }),
      word('c', 90, { offsetSeconds: 1.4, durationSeconds: 0.3 }),
      word('d', 0, { offsetSeconds: 0, durationSeconds: 0, errorType: 'Omission' }),
      word('e', 90, { offsetSeconds: 3.0, durationSeconds: 0.3 }),
    ]);
    expect(countLongPauses(result)).toBe(2);
  });
});

describe('unclearWords and omittedWords', () => {
  const result = assessment([
    word('明瞭', 95),
    word('資料', 60),
    word('準備', 85, { errorType: 'Mispronunciation' }),
    word('整理', 0, { errorType: 'Omission' }),
    word('順番', 40),
  ]);

  it('lists low-accuracy spoken words, worst first, never omissions', () => {
    expect(unclearWords(result).map((item) => item.word)).toEqual(['順番', '資料']);
  });

  it('can also include words flagged by Azure regardless of score', () => {
    expect(unclearWords(result, { includeFlagged: true }).map((item) => item.word)).toEqual([
      '順番',
      '資料',
      '準備',
    ]);
  });

  it('separates omissions', () => {
    expect(omittedWords(result).map((item) => item.word)).toEqual(['整理']);
  });
});

describe('speakingContext', () => {
  const words = [
    word('資料', 90),
    word('を', 70),
    word('整理', 90),
    word('し', 60),
    word('て', 90),
  ];

  it('returns content words as they are', () => {
    expect(speakingContext(words, 0)).toBe('資料');
  });

  it('attaches a particle to the preceding content word', () => {
    expect(speakingContext(words, 1)).toBe('資料を');
  });

  it('keeps し and て together', () => {
    expect(speakingContext(words, 3)).toBe('整理して');
  });
});

describe('compareWordsBySpeed', () => {
  it('matches words across natural and fast reads and ranks the drops', () => {
    const natural = assessment([word('資料', 90), word('整理', 88), word('順番', 85)]);
    const fast = assessment([word('資料', 60), word('整理', 86), word('順番', 90)]);
    const summary = compareWordsBySpeed({ 1: natural, 2: fast });

    expect(summary.declined.map((item) => [item.word, item.drop])).toEqual([
      ['資料', 30],
      ['整理', 2],
    ]);
    expect(summary.maintained.map((item) => item.word)).toEqual(['順番', '整理']);
  });

  it('skips pairs whose completeness is below 70', () => {
    const natural = assessment([word('資料', 90)], { completenessScore: 50 });
    const fast = assessment([word('資料', 60)]);
    expect(compareWordsBySpeed({ 1: natural, 2: fast })).toEqual({ declined: [], maintained: [] });
  });
});
