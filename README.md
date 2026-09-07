# 発話フィットネス

話す機会が減り、発話の衰えを感じる大人のための、毎日数分の発話トレーニングアプリです。

## 現在の状態

最初のローカル試作品です。スマホとWebで共通利用できるExpoアプリとして、次の部分まで実装しています。

- 3つの例文を自然な速度と最速時で読む6回測定
- マイク利用許可
- 録音開始・停止
- 録音時間表示
- 6回分の録音保持と再生
- 自然時と最速時の録音時間比較
- 測定完了画面と再測定
- 発話測定の基本画面
- Azure Speechによる明瞭さ・語別発音評価（明示同意後のみ送信）
- 生成AIによる明瞭さと速度の比較診断
- 生成AIによる音の傾向と発話安定性の初期診断
- 診断傾向に応じた8種類の発話ドリル
- 例文の録音・自己再生・完了記録
- 練習時間と例文数の日別カレンダー／履歴
- 週1回の「発話チェック」までの日数表示
- Supabase + Googleログインの接続口（未設定時は端末内保存）

録音データは現在の測定中だけ保持され、アプリを閉じると破棄されます。明瞭さ測定を選んだ場合だけAzure Speechへ送信します。ドリルでは音声そのものを保存せず、実施日・時間・例文数だけを記録します。

## Googleログインと履歴保存

Supabaseプロジェクトを作成し、Googleプロバイダーを有効にして、公開可能な接続情報を設定します。

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

SupabaseのSQL Editorで `supabase/schema.sql` を実行すると、ユーザーごとのドリル履歴・診断履歴を保存できます。Row Level Securityを有効にしているため、ログイン中の本人だけが自分の履歴を読み書きできます。設定前も端末内の履歴保存と全ドリルは利用できます。

## 明瞭さ測定の設定

Azure AI Speechリソースを作成し、サーバー環境に次を設定してください。キーを `EXPO_PUBLIC_` で始まる変数へ入れないでください。

```bash
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=japaneast
```

カスタムドメインを使う場合は `AZURE_SPEECH_ENDPOINT` も利用できます。ローカルでは環境変数を設定して `pnpm web`、本番ではEAS HostingなどExpo Router API Routes対応環境へ設定します。

## AIコーチ診断の設定

Azureの測定結果と発話時間を文章で説明するには、サーバー環境にOpenAI APIキーを設定します。音声はOpenAIへ送信せず、測定値と認識文章だけを送信します。

```bash
OPENAI_API_KEY=...
OPENAI_DIAGNOSIS_MODEL=gpt-5.4-mini
```

`OPENAI_DIAGNOSIS_MODEL` は省略可能です。APIキーを `EXPO_PUBLIC_` で始まる変数へ入れないでください。

## 技術構成

- Expo / React Native / TypeScript
- Expo Router
- Expo Audio
- Supabase Auth / PostgreSQL（設定時）

## ローカル起動

Node.jsとpnpmを用意して、プロジェクトフォルダで次を実行します。

```bash
pnpm install
pnpm web
```

## 開発コマンド

```bash
pnpm lint          # ESLint（Prettier の整形チェックを含む）
pnpm format        # Prettier で全ファイルを整形
pnpm test          # vitest で純粋関数のユニットテスト
pnpm vercel-build  # Web 書き出しと Vercel 用ページ配置
```

## コード構成

- `src/app/` 画面と API ルート。`check.tsx` は測定フローの制御だけを持ちます。
- `src/components/check/` 測定結果の表示カード群
- `src/components/MicrophonePicker.tsx` 測定とドリルで共通のマイク選択 UI
- `src/hooks/` 録音（`use-take-recorder`）、マイク選択、再生のフック
- `src/lib/` 純粋関数と型。`clarity-metrics.ts`、`diagnosis.ts`、`wav.ts`、`check-session.ts` にはテストがあります
- `src/constants/palette.ts` 全画面共通の色

新しい画面を追加したら、`vercel.json` の rewrites にもパスを足してください。`scripts/prepare-vercel.js` が不足を警告します。

## 公開について

合同会社LearnK のサービスとして `https://speech-fitness.learn-k.net` で公開します。公開までに必要な作業は `docs/LAUNCH_CHECKLIST.md` にまとめています。

- `/` は初回訪問者にランディングページ、再訪者とログイン済みの人にホームを表示します。`/welcome` は常にランディングです。
- 利用規約 `/terms`、プライバシーポリシー `/privacy`、特定商取引法に基づく表記 `/legal` の文面は `src/content/` にあります。会社情報と公開URLは `src/constants/site.ts` です。
- ロゴとアイコンの元データは `assets/brand/` にあり、PNG は `scripts/render-brand.mjs` で生成します。

## 次の開発

1. Googleログイン済み端末間の履歴同期
2. 過去診断結果との推移比較
3. 週次チェックの通知
4. 無料／プレミアム権限の決済連携
5. 実機での録音品質検証

## 課金の設定

Stripe で月額と年額のサブスクリプションを販売します。サーバー環境に次を設定してください。`scripts/stripe-setup.mjs` を `STRIPE_SECRET_KEY` を付けて実行すると、商品・価格・カスタマーポータル設定・Webhook を作成して値を表示します。

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Webhook の URL は `https://<ドメイン>/billing/webhook` です。プランは Supabase の `profiles.plan` 列で判定し、Webhook が更新します。
