# SNS 自動投稿（Instagram / Facebook）

発話フィットネスのオーガニック投稿を、ストック → 画像生成 → 自動投稿の順で回す仕組みです。

```
marketing/social/queue.json   投稿ストック（本文・ハッシュタグ・画像の指定）
marketing/social/brand.json   ブランド名・会社名・IGハンドル・共通ハッシュタグ
marketing/social/templates.mjs 画像テンプレート（statement / drill / steps）
scripts/social-render.mjs     queue.json → public/promo/<id>.png（1080×1080）
src/server/social.ts          Graph API 呼び出しと投稿ログ
src/app/social/publish+api.ts Vercel Cron が叩くエンドポイント
supabase/schema.sql           social_posts（投稿済みログ）
vercel.json                   crons: 月・水・金 09:00 JST
```

## 仕組み

1. Vercel Cron が月・水・金の 09:00 JST（UTC 00:00）に `GET /social/publish` を呼ぶ。
2. エンドポイントは Supabase の `social_posts` を見て、`queue.json` の中で `status: "ready"` かつ未投稿の最初の 1 件を選ぶ。
3. 画像 URL `https://<ドメイン>/promo/<id>.png` と本文を Graph API に渡し、Instagram → Facebook ページの順に投稿する。
4. 成功したチャンネルごとに `social_posts` に 1 行書く。片方が失敗した場合、次回は失敗した側だけ再送する。
5. ストックが尽きたら何もしない（`post: null` を返す）。

投稿本文はチャンネルごとに組み立てます。

- Facebook: 本文 + `▶ 無料で試す: <サイトURL>`
- Instagram: 本文 + `▶ プロフィールのリンクから、無料で試せます。` + ハッシュタグ（brand.json の core + 投稿ごとの hashtags、最大 30 個）

## 初回セットアップ（Meta 側）

合同会社ランケイ名義で行います。個人アカウントとは分けてください。

1. **Facebook ページ** を作る（ページ名: 発話フィットネス）。
2. **Instagram プロアカウント**（ビジネス）を作り、上の Facebook ページとリンクする。
   Instagram アプリ → 設定 → アカウントの種類とツール → プロアカウントに切り替え → ページをリンク。
3. **Meta for Developers** で開発者登録し、アプリを作成（種類: ビジネス）。
   製品に「Instagram」と「Facebook ログイン for Business」を追加。
4. **Graph API Explorer** で以下の権限を付けてユーザートークンを取得する。
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`
5. ユーザートークンを **長期トークン**に交換し、そこから **ページトークン**を取る（長期ユーザートークン由来のページトークンは無期限）。

   ```bash
   # 長期ユーザートークン
   curl "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<短期ユーザートークン>"
   # ページ一覧（id と access_token = ページトークン）
   curl "https://graph.facebook.com/v23.0/me/accounts?access_token=<長期ユーザートークン>"
   # ページに紐づく IG ユーザー ID
   curl "https://graph.facebook.com/v23.0/<PAGE_ID>?fields=instagram_business_account&access_token=<ページトークン>"
   ```

   アプリが「開発モード」のままでも、アプリの管理者・開発者・テスターが管理するページと IG アカウントには投稿できます。公開審査は不要です。

6. 取得した値を Vercel の環境変数（Production）に設定する。

   | 変数                        | 内容                                                                                                                       |
   | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
   | `META_PAGE_ID`              | Facebook ページ ID                                                                                                         |
   | `META_PAGE_ACCESS_TOKEN`    | ページトークン（無期限）                                                                                                   |
   | `META_IG_USER_ID`           | Instagram ビジネスアカウント ID                                                                                            |
   | `META_GRAPH_VERSION`        | 省略可。既定 `v23.0`                                                                                                       |
   | `CRON_SECRET`               | 任意の長いランダム文字列。Vercel Cron が自動で Bearer に付ける                                                             |
   | `SOCIAL_SITE_URL`           | 省略可。画像 URL とリンク先の元になる本番 URL（例 `https://speech-fitness.example`）。未設定ならリクエストの origin を使う |
   | `SUPABASE_SERVICE_ROLE_KEY` | 既存。投稿ログの書き込みに使う                                                                                             |

7. Supabase の SQL Editor で `supabase/schema.sql` の `social_posts` 部分を実行する。
8. `brand.json` の `instagramHandle` と `siteUrl` を埋めて、`pnpm social:render` で画像を作り直す（フッターの表示が会社名 → @ハンドルに変わる）。
9. Instagram のプロフィール欄にアプリの URL を入れる（IG の本文中のリンクは押せないため）。

## 動作確認

デプロイ後、投稿せずに次の 1 件を確認します。

```bash
SOCIAL_ENDPOINT=https://<ドメイン>/social/publish CRON_SECRET=... pnpm social:publish
```

返ってくる JSON の `imageUrl` をブラウザで開けること、`results[].caption` の文面が意図どおりであることを確認してから、実際に 1 件投稿します。

```bash
SOCIAL_ENDPOINT=... CRON_SECRET=... pnpm social:publish --send
```

Instagram の画像 URL は Meta のサーバーから取りに来るため、Vercel の Deployment Protection がかかった Preview URL では失敗します。本番 URL を使ってください。

## ストックの増やし方

1. `queue.json` の `posts` 配列の末尾に項目を足す。順番どおりに投稿される。
   - `id`: 一意（ファイル名になる）
   - `status`: `ready` で投稿対象。`draft` は飛ばす。`archived` は投稿しない
   - `channels`: `["instagram", "facebook"]`
   - `image.template`: `statement`（見出し 2〜4 行 + サブ）/ `drill`（例文 1 文 + コツ）/ `steps`（タイトル + 3 手順）
   - `caption`: 本文。ハッシュタグとリンク行は自動で付くので書かない
   - `hashtags`: 投稿ごとの追加タグ（core とは別）
2. `pnpm social:render <id>` で画像を作り、`public/promo/<id>.png` を目で確認する。
3. `pnpm test` を通す（id の重複、テンプレート名、画像の有無を検査する）。
4. コミットしてデプロイする。

投稿の文面は `docs/PRODUCT_CONSTITUTION.md` に沿わせます。「治る」「予防できる」と断定しない、不安をあおらない、他人と比べない、変化を記録するという言い方にする。

見出しは 1 行 12 文字以内、例文カードは 2 行に収まる長さ（30 文字程度まで）が目安です。長い場合は自動で折り返されますが、レイアウトが崩れていないか画像で確認してください。

## 投稿テーマのローテーション

| テーマ                          | 狙い                                                           | テンプレート      |
| ------------------------------- | -------------------------------------------------------------- | ----------------- |
| 共感・気づき（insight）         | 「話す機会が減った」「聞き返される」に心当たりのある人に届ける | statement         |
| 今日の 1 文（drill）            | アプリ内の例文を 1 つ出して、その場で声を出してもらう          | drill             |
| 使い方・約束（howto / feature） | 週 1 チェック、過去の自分と比べる、無料でできる範囲            | steps / statement |

12 本のストック（4 週分）を入れてあります。週 3 本ペースなら、3 週目に入ったら次の 12 本を足してください。

## 投稿を止める・やり直す

- 一時停止: `vercel.json` の `crons` を空にしてデプロイするか、Vercel ダッシュボードの Cron Jobs で無効化する。
- 特定の投稿を飛ばす: `status` を `draft` にする。
- 同じ投稿をもう一度出す: Supabase の `social_posts` から該当行を削除する。
- 投稿履歴: Supabase の `social_posts`（`external_id` が Meta 側の投稿 ID）。

## 今後の候補

- Claude Code の定期エージェント（routine）で、毎週ストックの残数を確認し、足りなければ新しい投稿案を PR にする。
- 投稿後 1 週間のインサイト（リーチ、保存数）を Graph API で取り、伸びたテーマに寄せる。
