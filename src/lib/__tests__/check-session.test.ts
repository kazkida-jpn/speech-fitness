import { describe, expect, it } from 'vitest';

import {
  TAKE_NUMBERS,
  TEST_TEXT_POOLS,
  createTestSet,
  hasAllTakes,
  sentenceIndexForTake,
  speakingModeForTake,
  takeNumberFor,
} from '@/lib/check-session';

describe('take numbering', () => {
  it('maps sentence and mode to take numbers 1..6 and back', () => {
    expect(takeNumberFor(0, 'natural')).toBe(1);
    expect(takeNumberFor(0, 'fast')).toBe(2);
    expect(takeNumberFor(2, 'fast')).toBe(6);
    for (const takeNumber of TAKE_NUMBERS) {
      const sentenceIndex = sentenceIndexForTake(takeNumber);
      expect(takeNumberFor(sentenceIndex, speakingModeForTake(takeNumber))).toBe(takeNumber);
    }
  });
});

describe('hasAllTakes', () => {
  it('requires every take number to be present', () => {
    expect(hasAllTakes({ 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' })).toBe(true);
    expect(hasAllTakes({ 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' })).toBe(false);
  });
});

describe('createTestSet', () => {
  it('picks one sentence from each pool', () => {
    const texts = createTestSet(undefined, () => 0);
    expect(texts).toEqual(TEST_TEXT_POOLS.map((pool) => pool[0]));
  });

  it('avoids repeating the previous session sentence in each slot', () => {
    const previous = TEST_TEXT_POOLS.map((pool) => pool[0]);
    const next = createTestSet(previous, () => 0);
    next.forEach((text, index) => {
      expect(text).not.toBe(previous[index]);
      expect(TEST_TEXT_POOLS[index]).toContain(text);
    });
  });
});
