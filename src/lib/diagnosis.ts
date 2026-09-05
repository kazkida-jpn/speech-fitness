import type {
  AiDiagnosis,
  AssessmentSummary,
  ClarityAssessment,
  DiagnosisRequest,
} from '@/lib/assessment-types';
import {
  FAST_TAKE_NUMBERS,
  NATURAL_TAKE_NUMBERS,
  SOUND_FOCUS,
  sentenceIndexForTake,
  takeNumberFor,
  type RecordedTake,
  type TakeNumber,
} from '@/lib/check-session';
import {
  calculateSpeedChange,
  coefficientOfVariation,
  countLongPauses,
  unclearWords,
} from '@/lib/clarity-metrics';
import { recommendDrills, type DrillId } from '@/lib/drills';

type DiagnosisInput = {
  takes: Record<TakeNumber, RecordedTake>;
  results: Record<TakeNumber, ClarityAssessment>;
  sessionTexts: string[];
};

function summarizeAssessment(result: ClarityAssessment): AssessmentSummary {
  return {
    pronunciationScore: result.pronunciationScore,
    accuracyScore: result.accuracyScore,
    fluencyScore: result.fluencyScore,
    completenessScore: result.completenessScore,
    recognizedText: result.recognizedText,
    unclearWords: unclearWords(result).map((word) => ({
      word: word.word,
      accuracyScore: word.accuracyScore,
    })),
  };
}

/** Characters per second of speech, ignoring punctuation. Takes without speech are skipped. */
function speakingRates(takeNumbers: number[], { takes, sessionTexts }: DiagnosisInput) {
  const rates: number[] = [];
  for (const takeNumber of takeNumbers) {
    const take = takes[takeNumber as TakeNumber];
    if (take.durationMillis <= 0) continue;
    const characters = sessionTexts[sentenceIndexForTake(takeNumber)].replace(/[、。！？\s]/g, '');
    rates.push(characters.length / (take.durationMillis / 1000));
  }
  return rates;
}

function averageFluency(takeNumbers: number[], results: DiagnosisInput['results']) {
  const total = takeNumbers.reduce(
    (sum, takeNumber) => sum + results[takeNumber as TakeNumber].fluencyScore,
    0
  );
  return Math.round(total / takeNumbers.length);
}

function totalLongPauses(takeNumbers: number[], results: DiagnosisInput['results']) {
  return takeNumbers.reduce(
    (sum, takeNumber) => sum + countLongPauses(results[takeNumber as TakeNumber]),
    0
  );
}

/** Builds the body of POST /diagnosis from six takes and their assessments. */
export function buildDiagnosisRequest(input: DiagnosisInput): DiagnosisRequest {
  const { takes, results, sessionTexts } = input;
  return {
    pairs: sessionTexts.map((referenceText, sentenceIndex) => {
      const naturalTakeNumber = takeNumberFor(sentenceIndex, 'natural') as TakeNumber;
      const fastTakeNumber = takeNumberFor(sentenceIndex, 'fast') as TakeNumber;
      const naturalTake = takes[naturalTakeNumber];
      const fastTake = takes[fastTakeNumber];
      return {
        referenceText,
        focusSounds: SOUND_FOCUS[sentenceIndex],
        speedChangePercent: calculateSpeedChange(naturalTake, fastTake),
        naturalDurationSeconds: naturalTake.durationMillis / 1000,
        fastDurationSeconds: fastTake.durationMillis / 1000,
        natural: summarizeAssessment(results[naturalTakeNumber]),
        fast: summarizeAssessment(results[fastTakeNumber]),
      };
    }),
    stability: {
      naturalRateVariationPercent: coefficientOfVariation(
        speakingRates(NATURAL_TAKE_NUMBERS, input)
      ),
      fastRateVariationPercent: coefficientOfVariation(speakingRates(FAST_TAKE_NUMBERS, input)),
      naturalAverageFluency: averageFluency(NATURAL_TAKE_NUMBERS, results),
      fastAverageFluency: averageFluency(FAST_TAKE_NUMBERS, results),
      naturalLongPauseCount: totalLongPauses(NATURAL_TAKE_NUMBERS, results),
      fastLongPauseCount: totalLongPauses(FAST_TAKE_NUMBERS, results),
    },
  };
}

/**
 * Up to three drill ids to store with the assessment: the model's pick first, then drills
 * whose focus the diagnosis text mentions.
 */
export function recommendedDrillIds(diagnosis: AiDiagnosis): DrillId[] {
  const diagnosisText = [
    diagnosis.headline,
    diagnosis.summary,
    ...diagnosis.cautions,
    ...diagnosis.soundTendencies,
    diagnosis.stability,
    diagnosis.practice,
  ].join(' ');
  const ids = [diagnosis.recommendedDrillId, ...recommendDrills(diagnosisText)];
  return ids.filter((id, index) => id && ids.indexOf(id) === index).slice(0, 3);
}
