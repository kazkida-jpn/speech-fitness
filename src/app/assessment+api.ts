type AzureWord = {
  Word?: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: string;
  };
};

type AzureResult = {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: Array<{
    Display?: string;
    PronunciationAssessment?: {
      PronScore?: number;
      AccuracyScore?: number;
      FluencyScore?: number;
      CompletenessScore?: number;
      ProsodyScore?: number;
    };
    Words?: AzureWord[];
  }>;
};

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return Response.json(
      { error: 'Azure Speech が未設定です。サーバーの環境変数を確認してください。' },
      { status: 503 }
    );
  }

  const form = (await request.formData()) as unknown as {
    get(name: string): FormDataEntryValue | null;
  };
  const audio = form.get('audio');
  const referenceText = form.get('referenceText');
  if (!(audio instanceof Blob) || typeof referenceText !== 'string' || !referenceText.trim()) {
    return Response.json({ error: '録音または基準文がありません。' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: '録音データが大きすぎます。' }, { status: 413 });
  }

  let recognizer: speechsdk.SpeechRecognizer | null = null;
  let audioConfig: speechsdk.AudioConfig | null = null;
  try {
    const speechConfig = speechsdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = 'ja-JP';
    speechConfig.outputFormat = speechsdk.OutputFormat.Detailed;
    const audioBytes = Buffer.from(await audio.arrayBuffer());
    audioConfig = speechsdk.AudioConfig.fromWavFileInput(audioBytes, 'recording.wav');
    recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
    const assessmentConfig = new speechsdk.PronunciationAssessmentConfig(
      referenceText,
      speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
      speechsdk.PronunciationAssessmentGranularity.Phoneme,
      true
    );
    assessmentConfig.applyTo(recognizer);

    const result = await new Promise<speechsdk.SpeechRecognitionResult>((resolve, reject) => {
      recognizer?.recognizeOnceAsync(resolve, reject);
    });
    if (result.reason === speechsdk.ResultReason.Canceled) {
      const details = speechsdk.CancellationDetails.fromResult(result);
      return Response.json(
        { error: `Azureの発音評価が中断されました: ${details.errorDetails || details.reason}` },
        { status: 502 }
      );
    }
    if (result.reason !== speechsdk.ResultReason.RecognizedSpeech) {
      return Response.json(
        { error: 'Azureが音声を日本語の発話として認識できませんでした。' },
        { status: 422 }
      );
    }

    const raw = JSON.parse(result.json) as AzureResult;

    const best = raw.NBest?.[0];
    const scores = best?.PronunciationAssessment;
    if (!best || !scores) {
      const recognitionStatus = raw.RecognitionStatus ?? 'Unknown';
      const responseKeys = Object.keys(raw).slice(0, 12);
      console.warn('Azure Speech returned no pronunciation result', {
        recognitionStatus,
        responseKeys,
        nBestCount: raw.NBest?.length ?? 0,
      });
      const statusMessage: Record<string, string> = {
        InitialSilenceTimeout: 'Azureが発話開始前の無音を長すぎると判定しました。',
        BabbleTimeout: 'Azureが音声を発話ではなく雑音と判定しました。',
        NoMatch: 'Azureは音声を受信しましたが、日本語の発話として一致する結果を得られませんでした。',
        Error: 'Azureの音声認識処理でエラーが発生しました。',
      };
      return Response.json(
        {
          error:
            statusMessage[recognitionStatus] ??
            `Azureから採点結果が返りませんでした（状態: ${recognitionStatus}、応答: ${responseKeys.join(', ') || '空'}）。`,
          recognitionStatus,
        },
        { status: 422 }
      );
    }

    return Response.json({
      pronunciationScore: scores.PronScore ?? 0,
      accuracyScore: scores.AccuracyScore ?? 0,
      fluencyScore: scores.FluencyScore ?? 0,
      completenessScore: scores.CompletenessScore ?? 0,
      prosodyScore: scores.ProsodyScore,
      recognizedText: best.Display ?? raw.DisplayText ?? result.text ?? '',
      words: (best.Words ?? []).map((word) => ({
        word: word.Word ?? '',
        accuracyScore: word.PronunciationAssessment?.AccuracyScore ?? 0,
        errorType: word.PronunciationAssessment?.ErrorType ?? 'None',
        offsetSeconds: (word.Offset ?? 0) / 10_000_000,
        durationSeconds: (word.Duration ?? 0) / 10_000_000,
      })),
    });
  } catch {
    return Response.json({ error: '明瞭さの評価サービスへ接続できませんでした。' }, { status: 502 });
  } finally {
    recognizer?.close();
    audioConfig?.close();
  }
}
import { Buffer } from 'node:buffer';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
