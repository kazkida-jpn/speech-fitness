# 技術方針

## 採用構成

- アプリ: Expo / React Native / TypeScript
- 画面遷移: Expo Router
- 録音: Expo Audio
- ソース管理: GitHub
- Web公開: Vercel（検証完了後）
- 会員・データ・音声保存: Supabase（後続段階）
- 秘密鍵を使うAPI: Vercel Functions（後続段階）
- ストアビルド: Expo EAS Build
- ストア提出: Expo EAS Submit
- 整形と静的検査: Prettier / ESLint（eslint-config-expo）
- ユニットテスト: vitest（`src/lib` の純粋関数が対象）

## 依存関係の注意

Speech SDK が内部で使う `ws` や `bent` などは、Metro が API ルートのバンドルに取り込むため、直接依存に入れる必要はない。

## 公開方針

公開ドメインは `speech-fitness.learn-k.net`。お名前.com の DNS で `speech-fitness` を Vercel 指定の CNAME に向け、Vercel のプロジェクトにドメインを追加する。手順と残作業は `LAUNCH_CHECKLIST.md` を参照。

## 安全方針

- 初期試作では音声を端末外へ送信しない。
- APIキーをブラウザやスマホアプリに埋め込まない。
- 音声保存は目的、保存期間、削除方法を決めてから導入する。
- 各利用者のデータには本人だけがアクセスできる制御を設ける。
