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

## 公開について

現段階では公開しません。技術検証後、VercelへWeb版を展開し、将来の候補として `voice.learn-k.net` を使用します。

## 次の開発

1. Googleログイン済み端末間の履歴同期
2. 過去診断結果との推移比較
3. 週次チェックの通知
4. 無料／プレミアム権限の決済連携
5. 実機での録音品質検証
