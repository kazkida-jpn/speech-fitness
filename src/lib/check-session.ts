// Structure of one weekly check: three sentences, each read at a natural pace and then as
// fast as clarity allows, giving six takes numbered 1..6.

export const SENTENCE_COUNT = 3;

/**
 * Longest take accepted for cloud assessment. A sentence takes well under 15 seconds even
 * when read slowly; the margin covers the warm-up and the pauses before and after reading.
 * Bounds the Azure cost per request and the size of what the API route accepts.
 */
export const MAX_TAKE_SECONDS = 30;
export const TAKE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export type TakeNumber = (typeof TAKE_NUMBERS)[number];

export type SpeakingMode = 'natural' | 'fast';
export const SPEAKING_MODES: SpeakingMode[] = ['natural', 'fast'];
export const SPEAKING_MODE_LABELS: Record<SpeakingMode, string> = {
  natural: '自然な速さ',
  fast: 'できるだけ速く',
};

export const NATURAL_TAKE_NUMBERS = [1, 3, 5];
export const FAST_TAKE_NUMBERS = [2, 4, 6];

export function takeNumberFor(sentenceIndex: number, mode: SpeakingMode) {
  return sentenceIndex * 2 + (mode === 'natural' ? 1 : 2);
}

export function sentenceIndexForTake(takeNumber: number) {
  return Math.floor((takeNumber - 1) / 2);
}

export function speakingModeForTake(takeNumber: number): SpeakingMode {
  return takeNumber % 2 === 1 ? 'natural' : 'fast';
}

/** Anything keyed by take number; missing takes are simply absent. */
export type TakeMap<T> = Partial<Record<number, T>>;

export function hasAllTakes<T>(map: TakeMap<T>): map is Record<TakeNumber, T> {
  return TAKE_NUMBERS.every((takeNumber) => map[takeNumber] !== undefined);
}

export type RecordedTake = {
  uri: string;
  /** Speech duration: first detected voice to last detected voice. */
  durationMillis: number;
  /** Whole recording after the warm-up, including leading and trailing silence. */
  recordingDurationMillis: number;
  microphoneName: string;
  voiceDetected: boolean;
};

/** One pool per sentence slot; each slot targets a different sound group. */
export const TEST_TEXT_POOLS = [
  [
    '新しい施設では、少しずつ準備を進め、必要な資料を順番に整理しています。',
    '静かな図書室で資料を探し、必要な箇所に印をつけて順序よく整理しました。',
    '週末の朝は涼しい風を感じながら、川沿いの道を少しずつ進んでいきます。',
  ],
  [
    '公園の広場では、子どもたちがボールを投げたり、元気に走ったりして遊んでいます。',
    '料理をおいしく仕上げるため、材料を量ってから火加減と時間を丁寧に調整します。',
    '会議では結論を最初に伝え、理由と具体的な例を順番に説明してください。',
  ],
  [
    '出発の前に切符と案内を確認し、ゆっくり深呼吸して電車を待ちましょう。',
    '旅行の前日には荷物を一覧にして、切符や充電器を忘れていないか確認しましょう。',
    '庭に植えた小さな苗は、毎朝水を与えるうちに育ち、鮮やかな花を咲かせています。',
  ],
];

export const SOUND_FOCUS = [
  'サ行・ザ行・シ・ジ・チ・ツ',
  'カ行・ガ行・タ行・ダ行・パ行・バ行・ラ行',
  '長音・促音・撥音・母音の連続',
];

/** Picks one sentence per slot, avoiding the sentence used in the previous session. */
export function createTestSet(previous?: string[], random: () => number = Math.random) {
  return TEST_TEXT_POOLS.map((pool, index) => {
    const candidates = previous ? pool.filter((text) => text !== previous[index]) : pool;
    return candidates[Math.floor(random() * candidates.length)] ?? pool[0];
  });
}
