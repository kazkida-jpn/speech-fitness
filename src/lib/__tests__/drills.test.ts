import { describe, expect, it } from 'vitest';

import { DRILLS, SENTENCES_PER_SESSION, sessionSentences } from '../drills';

const byId = (id: string) => DRILLS.find((drill) => drill.id === id)!;

// Kana-level start checks; kanji-initial sentences are trusted (no dictionary here).
const SIBILANT_STARTS = /^[さしすせそざじずぜぞシジ]/;
const STOP_STARTS =
  /^[かきくけこがぎぐげごたちつてとだぢづでどぱぴぷぺぽばびぶべぼらりるれろカキクケコガギグゲゴタチツテトダヂヅデドパピプペポバビブベボラリルレロ]/;

describe('drill pools', () => {
  it('gives every drill 40 unique sentences of a readable length', () => {
    for (const drill of DRILLS) {
      expect(drill.sentences, drill.id).toHaveLength(40);
      expect(new Set(drill.sentences).size, drill.id).toBe(40);
      for (const sentence of drill.sentences) {
        expect(sentence.length, `${drill.id}: ${sentence}`).toBeGreaterThanOrEqual(14);
        expect(sentence.length, `${drill.id}: ${sentence}`).toBeLessThanOrEqual(40);
      }
    }
  });

  it('ends every 語尾 sentence in a full polite form', () => {
    for (const sentence of byId('endings').sentences) {
      expect(sentence, sentence).toMatch(/(ます|ました|ません|ください|です|でしょうか|しょう)。$/);
    }
  });

  it('gives every 間と呼吸 sentence at least one pause', () => {
    for (const sentence of byId('pauses').sentences) {
      expect(sentence, sentence).toMatch(/、/);
    }
  });

  it('starts kana-initial sentences on the drill sound', () => {
    for (const sentence of byId('sibilants').sentences) {
      if (/^[ぁ-んァ-ン]/.test(sentence)) expect(sentence, sentence).toMatch(SIBILANT_STARTS);
    }
    for (const sentence of byId('consonants').sentences) {
      if (/^[ぁ-んァ-ン]/.test(sentence)) expect(sentence, sentence).toMatch(STOP_STARTS);
    }
  });
});

describe('sessionSentences', () => {
  const drill = byId('sibilants');

  it('returns the session size with no repeats', () => {
    const set = sessionSentences(drill, new Date(2026, 8, 8));
    expect(set).toHaveLength(SENTENCES_PER_SESSION);
    expect(new Set(set).size).toBe(SENTENCES_PER_SESSION);
    for (const sentence of set) expect(drill.sentences).toContain(sentence);
  });

  it('is stable within a day and changes across days', () => {
    const morning = sessionSentences(drill, new Date(2026, 8, 8, 7, 0));
    const night = sessionSentences(drill, new Date(2026, 8, 8, 23, 30));
    const tomorrow = sessionSentences(drill, new Date(2026, 8, 9, 7, 0));
    expect(night).toEqual(morning);
    expect(tomorrow).not.toEqual(morning);
  });

  it('differs between drills on the same day', () => {
    const day = new Date(2026, 8, 8);
    const a = sessionSentences(byId('rhythm'), day);
    const b = sessionSentences(byId('speed'), day);
    expect(a).not.toEqual(b);
  });

  it('does not repeat the same set within a month', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day += 1) {
      seen.add(sessionSentences(drill, new Date(2026, 8, day)).join('|'));
    }
    expect(seen.size).toBe(30);
  });
});
