type DiagnosisRequest = {
  pairs: DiagnosisPair[];
  stability: StabilityMetrics;
};

type DiagnosisPair = {
  referenceText: string;
  focusSounds: string;
  speedChangePercent: number | null;
  naturalDurationSeconds: number;
  fastDurationSeconds: number;
  natural: AssessmentSummary;
  fast: AssessmentSummary;
};

type StabilityMetrics = {
  naturalRateVariationPercent: number | null;
  fastRateVariationPercent: number | null;
  naturalAverageFluency: number;
  fastAverageFluency: number;
  naturalLongPauseCount: number;
  fastLongPauseCount: number;
};

type AssessmentSummary = {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  recognizedText: string;
  unclearWords: { word: string; accuracyScore: number }[];
};

const diagnosisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'strengths', 'cautions', 'soundTendencies', 'stability', 'practice', 'recommendedDrillId', 'recommendedDrillReason'],
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    cautions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    soundTendencies: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    stability: { type: 'string' },
    practice: { type: 'string' },
    recommendedDrillId: {
      type: 'string',
      enum: ['sibilants', 'consonants', 'mora', 'endings', 'connections', 'rhythm', 'pauses', 'speed'],
    },
    recommendedDrillReason: { type: 'string' },
  },
};

function isAssessmentSummary(value: unknown): value is AssessmentSummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AssessmentSummary>;
  return (
    typeof item.pronunciationScore === 'number' &&
    typeof item.accuracyScore === 'number' &&
    typeof item.fluencyScore === 'number' &&
    typeof item.completenessScore === 'number' &&
    typeof item.recognizedText === 'string' &&
    Array.isArray(item.unclearWords)
  );
}

function isDiagnosisRequest(value: unknown): value is DiagnosisRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DiagnosisRequest>;
  return (
    Array.isArray(item.pairs) &&
    item.pairs.length === 3 &&
    item.pairs.every(isDiagnosisPair) &&
    isStabilityMetrics(item.stability)
  );
}

function isDiagnosisPair(value: unknown): value is DiagnosisPair {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DiagnosisPair>;
  return (
    typeof item.referenceText === 'string' &&
    item.referenceText.length <= 500 &&
    typeof item.focusSounds === 'string' &&
    (item.speedChangePercent === null || typeof item.speedChangePercent === 'number') &&
    typeof item.naturalDurationSeconds === 'number' &&
    typeof item.fastDurationSeconds === 'number' &&
    isAssessmentSummary(item.natural) &&
    isAssessmentSummary(item.fast)
  );
}

function isStabilityMetrics(value: unknown): value is StabilityMetrics {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StabilityMetrics>;
  return (
    (item.naturalRateVariationPercent === null || typeof item.naturalRateVariationPercent === 'number') &&
    (item.fastRateVariationPercent === null || typeof item.fastRateVariationPercent === 'number') &&
    typeof item.naturalAverageFluency === 'number' &&
    typeof item.fastAverageFluency === 'number' &&
    typeof item.naturalLongPauseCount === 'number' &&
    typeof item.fastLongPauseCount === 'number'
  );
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'AI診断を利用するには、サーバーに OPENAI_API_KEY の設定が必要です。' },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: '診断データを読み取れませんでした。' }, { status: 400 });
  }
  if (!isDiagnosisRequest(payload)) {
    return Response.json({ error: '診断データの形式が正しくありません。' }, { status: 400 });
  }

  const model = process.env.OPENAI_DIAGNOSIS_MODEL || 'gpt-5.4-mini';
  const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'low' },
      instructions:
        'あなたは日本語の発話トレーニング結果を説明するコーチです。入力には3つの例文について自然な速さと早口の計6測定が入っています。入力された測定値だけを根拠に、親しみやすく簡潔な日本語で総合診断してください。点数を新しく作らず、医学的診断をせず、文章一致度が低い測定は断定的に評価しないでください。3組を横断して、速くしても明瞭さが保たれたか、例文によるばらつきがあるかを説明してください。音の傾向はfocusSoundsと低評価語を根拠にし、複数の測定で繰り返した場合を重視してください。一度だけ低かった語や音は可能性として表現してください。安定性は速度変動率、平均流暢さ、0.6秒以上の語間の数だけを根拠に説明し、音量や声の高さについて推測しないでください。最後に今回もっとも優先すべきドリルを1つだけ選び、recommendedDrillIdには sibilants, consonants, mora, endings, connections, rhythm, pauses, speed のいずれかを入れてください。recommendedDrillReasonは測定結果に基づく短い理由にしてください。',
      input: JSON.stringify(payload),
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'speech_fitness_diagnosis',
          strict: true,
          schema: diagnosisSchema,
        },
      },
    }),
  });

  const responseBody = (await openAIResponse.json()) as Record<string, unknown>;
  if (!openAIResponse.ok) {
    const apiError = responseBody.error as { message?: string } | undefined;
    return Response.json(
      { error: apiError?.message || '生成AIから診断を取得できませんでした。' },
      { status: openAIResponse.status }
    );
  }

  const outputText = extractOutputText(responseBody);
  if (!outputText) {
    return Response.json({ error: '生成AIから診断文が返りませんでした。' }, { status: 502 });
  }
  try {
    return Response.json(JSON.parse(outputText));
  } catch {
    return Response.json({ error: '生成AIの診断結果を解釈できませんでした。' }, { status: 502 });
  }
}
