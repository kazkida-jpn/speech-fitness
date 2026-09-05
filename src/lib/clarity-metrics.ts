import type { ClarityAssessment, ClarityWord } from '@/lib/assessment-types';
import {
  SENTENCE_COUNT,
  takeNumberFor,
  type RecordedTake,
  type TakeMap,
} from '@/lib/check-session';

// Pure calculations over recorded takes and Azure assessment results.

type TimedTake = Pick<RecordedTake, 'durationMillis' | 'voiceDetected'>;

/** Percent by which the fast read was faster than the natural read, or null if unmeasurable. */
export function calculateSpeedChange(naturalTake?: TimedTake, fastTake?: TimedTake) {
  if (
    !naturalTake?.voiceDetected ||
    !fastTake?.voiceDetected ||
    naturalTake.durationMillis <= 0 ||
    fastTake.durationMillis <= 0
  ) {
    return null;
  }
  return Math.round((naturalTake.durationMillis / fastTake.durationMillis - 1) * 100);
}

/** Mean speed change across the sentence pairs that could be measured. */
export function averageSpeedChange(takes: TakeMap<TimedTake>, sentenceCount = SENTENCE_COUNT) {
  const changes: number[] = [];
  for (let sentenceIndex = 0; sentenceIndex < sentenceCount; sentenceIndex += 1) {
    const change = calculateSpeedChange(
      takes[takeNumberFor(sentenceIndex, 'natural')],
      takes[takeNumberFor(sentenceIndex, 'fast')]
    );
    if (change !== null) changes.push(change);
  }
  if (changes.length === 0) return null;
  return Math.round(changes.reduce((total, value) => total + value, 0) / changes.length);
}

/** Standard deviation as a percent of the mean, rounded. */
export function coefficientOfVariation(values: number[]) {
  if (values.length === 0) return null;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  if (average === 0) return null;
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.round((Math.sqrt(variance) / average) * 100);
}

/** Number of gaps between spoken words that last at least `minPauseSeconds`. */
export function countLongPauses(result: ClarityAssessment, minPauseSeconds = 0.6) {
  const spokenWords = result.words
    .filter((word) => word.errorType !== 'Omission' && word.durationSeconds > 0)
    .sort((left, right) => left.offsetSeconds - right.offsetSeconds);
  let pauses = 0;
  for (let index = 1; index < spokenWords.length; index += 1) {
    const previous = spokenWords[index - 1];
    const previousEnd = previous.offsetSeconds + previous.durationSeconds;
    if (spokenWords[index].offsetSeconds - previousEnd >= minPauseSeconds) pauses += 1;
  }
  return pauses;
}

type UnclearWordOptions = {
  /** Also include words Azure flagged with an error type even if they scored 80 or more. */
  includeFlagged?: boolean;
  limit?: number;
};

/** Lowest-scoring spoken words, worst first. Omitted words are never included. */
export function unclearWords(
  result: ClarityAssessment,
  { includeFlagged = false, limit = 8 }: UnclearWordOptions = {}
) {
  return result.words
    .filter(
      (word) =>
        word.errorType !== 'Omission' &&
        (word.accuracyScore < 80 || (includeFlagged && word.errorType !== 'None'))
    )
    .sort((left, right) => left.accuracyScore - right.accuracyScore)
    .slice(0, limit);
}

export function omittedWords(result: ClarityAssessment) {
  return result.words.filter((word) => word.errorType === 'Omission');
}

export function normalizeComparedWord(word: string) {
  return word.replace(/[\s、。！？!?「」『』（）()・]/g, '').trim();
}

const CONTEXT_DEPENDENT_WORDS = new Set([
  'は',
  'が',
  'を',
  'に',
  'へ',
  'と',
  'で',
  'の',
  'も',
  'や',
  'か',
  'ね',
  'よ',
  'て',
  'し',
  'です',
  'ます',
  'でした',
  'ました',
  'ません',
  'ない',
  'たい',
  'れる',
  'られる',
  'せる',
  'させる',
]);

/** Particles and inflections are not practicable on their own; show them with a neighbor. */
function needsSpeakingContext(word: string) {
  return /^[ぁ-んー]+$/.test(word) && (word.length === 1 || CONTEXT_DEPENDENT_WORDS.has(word));
}

/** The word at `index`, extended backwards to the nearest content word when it is a particle. */
export function speakingContext(words: ClarityWord[], index: number) {
  const focusWord = normalizeComparedWord(words[index]?.word ?? '');
  if (!focusWord || !needsSpeakingContext(focusWord)) return focusWord;

  let start = index;
  while (start > 0) {
    start -= 1;
    const previous = normalizeComparedWord(words[start]?.word ?? '');
    if (previous && !needsSpeakingContext(previous)) break;
  }
  let end = index;
  if (focusWord === 'し' && normalizeComparedWord(words[index + 1]?.word ?? '') === 'て') end += 1;
  if (start === index && words[index + 1]) end = index + 1;

  const phrase = words
    .slice(start, end + 1)
    .map((word) => normalizeComparedWord(word.word))
    .filter(Boolean)
    .join('');
  return phrase || focusWord;
}

export type WordSpeedComparison = {
  /** Phrase shown to the user, including context for short tokens. */
  word: string;
  /** The token Azure actually scored. */
  focusWord: string;
  naturalScore: number;
  fastScore: number;
  drop: number;
};

export type WordSpeedComparisonSummary = {
  declined: WordSpeedComparison[];
  maintained: WordSpeedComparison[];
};

const MIN_COMPLETENESS_FOR_COMPARISON = 70;

/**
 * Matches each word of a natural read with the same word in the fast read and reports the
 * three words that lost the most accuracy and the three that stayed clear.
 */
export function compareWordsBySpeed(
  results: TakeMap<ClarityAssessment>,
  sentenceCount = SENTENCE_COUNT
): WordSpeedComparisonSummary {
  const comparisons: WordSpeedComparison[] = [];
  for (let sentenceIndex = 0; sentenceIndex < sentenceCount; sentenceIndex += 1) {
    const natural = results[takeNumberFor(sentenceIndex, 'natural')];
    const fast = results[takeNumberFor(sentenceIndex, 'fast')];
    if (
      !natural ||
      !fast ||
      natural.completenessScore < MIN_COMPLETENESS_FOR_COMPARISON ||
      fast.completenessScore < MIN_COMPLETENESS_FOR_COMPARISON
    ) {
      continue;
    }

    const availableFastWords = fast.words.map((word) => ({ word, used: false }));
    natural.words.forEach((naturalWord, naturalIndex) => {
      const normalized = normalizeComparedWord(naturalWord.word);
      if (!normalized || naturalWord.errorType === 'Omission') return;
      const matched = availableFastWords.find(
        (candidate) =>
          !candidate.used &&
          candidate.word.errorType !== 'Omission' &&
          normalizeComparedWord(candidate.word.word) === normalized
      );
      if (!matched) return;
      matched.used = true;
      comparisons.push({
        word: speakingContext(natural.words, naturalIndex),
        focusWord: normalized,
        naturalScore: Math.round(naturalWord.accuracyScore),
        fastScore: Math.round(matched.word.accuracyScore),
        drop: Math.round(naturalWord.accuracyScore - matched.word.accuracyScore),
      });
    });
  }

  const mostRelevantByWord = new Map<string, WordSpeedComparison>();
  comparisons.forEach((comparison) => {
    const key = `${normalizeComparedWord(comparison.word)}:${comparison.focusWord}`;
    const previous = mostRelevantByWord.get(key);
    if (!previous || comparison.drop > previous.drop) mostRelevantByWord.set(key, comparison);
  });
  const unique = Array.from(mostRelevantByWord.values());
  return {
    declined: unique
      .filter((item) => item.drop > 0)
      .sort((left, right) => right.drop - left.drop)
      .slice(0, 3),
    maintained: unique
      .filter((item) => item.naturalScore >= 80 && item.fastScore >= 80 && item.drop <= 5)
      .sort((left, right) => right.fastScore - left.fastScore || left.drop - right.drop)
      .slice(0, 3),
  };
}
