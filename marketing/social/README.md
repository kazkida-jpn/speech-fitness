# SNS 自動投稿（Facebook / Instagram）

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
2. エンドポイントは Supabase の `social_posts` を見て、チャンネルごとに、`queue.json` の中で `status: "ready"` かつそのチャンネルに未投稿の最初の 1 件を選ぶ。
3. 画像 URL `https://<ドメイン>/promo/<id>.png` と本文を Graph API に渡して投稿する。
4. 成功したチャンネルごとに `social_posts` に 1 行書く。失敗したチャンネルは、次回に同じ投稿を再送する。
5. ストックが尽きたチャンネルには何もしない（すべて尽きると `results: []` を返す）。

投稿先は環境変数で決まります。

- Facebook ページ: `META_PAGE_ID` と `META_PAGE_ACCESS_TOKEN` があれば投稿する。
- Instagram: さらに `META_IG_USER_ID` があるときだけ投稿する。ないあいだは Facebook だけで進む。

チャンネルはそれぞれ自分の位置でストックを進みます。Instagram をあとから有効にすると、Instagram は 1 本目から週 3 本で出ていき、Facebook はその続きをそのまま進みます（同じ日に別々の投稿が出る）。片方が止まっても、もう片方は止まりません。

Instagram を 1 本目からではなく Facebook と同じ位置から始めたい場合は、有効にする前に、飛ばしたい投稿の行を `social_posts` に入れます。

```sql
insert into public.social_posts (post_id, channel, external_id)
select post_id, 'instagram', 'skipped' from public.social_posts where channel = 'facebook';
```

投稿本文はチャンネルごとに組み立てます。

- Facebook: 本文 + `▶ 無料で試す: <サイトURL>`
- Instagram: 本文 + `▶ プロフィールのリンクから、無料で試せます。` + ハッシュタグ（brand.json の core + 投稿ごとの hashtags、最大 30 個）

## 初回セットアップ（Meta 側）

合同会社LearnK 名義で行います。個人アカウントとは分けてください。

2026-10-04 時点の状況: Facebook ページ「発話フィットネス」、Meta 開発者アプリ `LearnK Publisher`、無期限のページトークンはそろっている。Instagram はアカウントの作り直し待ちで、それまでは Facebook だけで投稿する。

1. **Facebook ページ** を作る（ページ名: 発話フィットネス）。
   作成の画面にウェブサイトとメールを入れる欄はない。作成後に、ページの「基本データ」→「リンク」と「連絡先情報」から入れる。
2. **Instagram プロアカウント**（ビジネス）を作り、上の Facebook ページとリンクする。
   Instagram アプリ → 設定 → アカウントの種類とツール → プロアカウントに切り替え → ページをリンク。
   新規アカウントは、登録直後に自動で停止されることがある（2026-10-03 に PC のブラウザから登録したアカウントは、本人確認のあと翌日に永久停止になった）。
3. **Meta for Developers** で開発者登録し、アプリを作成する。
   - 作成の流れは、アプリの詳細 → ユースケース → ビジネス → 要件 → 概要。
   - ユースケースは、フィルター「コンテンツ管理」の中の「ページのすべてを管理」と「Instagramでメッセージとコンテンツを管理」を選ぶ。
   - ビジネスポートフォリオは「現時点ではリンクしない」でよい。
   - 権限は、作成後に各ユースケースの「カスタマイズ」で追加する。「ページのすべてを管理」では `pages_manage_posts` を手で追加する。Instagram は「FacebookログインによるAPI設定」の「Add required content permissions」を押す。「InstagramログインによるAPI設定」は別方式なので使わない。
4. **Graph API Explorer** で以下の権限を付けてユーザートークンを取得する。
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`。Instagram にも投稿するときは `instagram_basic`, `instagram_content_publish` も付ける。
   許可画面ではページとビジネスを選ぶ。ページは「現在のページのみ」で対象のページだけを選ぶ。ビジネスは、0 件のときは「現在および今後のビジネスすべて」を選ばないと続行できない。
5. ユーザートークンを **長期トークン**に交換し、そこから **ページトークン**を取る（長期ユーザートークン由来のページトークンは無期限）。

   ```bash
   # 長期ユーザートークン
   curl "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<短期ユーザートークン>"
   # ページ一覧（id と access_token = ページトークン）
   curl "https://graph.facebook.com/v23.0/me/accounts?access_token=<長期ユーザートークン>"
   # ページに紐づく IG ユーザー ID
   curl "https://graph.facebook.com/v23.0/<PAGE_ID>?fields=instagram_business_account&access_token=<ページトークン>"
   ```

   - 上の例は bash 用。Windows では PowerShell の `Invoke-RestMethod` で同じリクエストを実行する。
   - アプリ ID と app secret は「アプリの設定」→「ベーシック」のものを使う。Instagram の設定画面にある「InstagramアプリID」「Instagram app secret」は別物。
   - ページ ID は `me/accounts` が返す `id` を使う。ページの URL にある `profile.php?id=...` の番号はプロフィールの番号で、ページ ID ではない。
   - アプリが「開発モード」のままでも、アプリの管理者・開発者・テスターが管理するページと IG アカウントには投稿できる。公開審査は不要。
   - トークンは、Facebook のパスワードを変えたとき、アプリへの許可を取り消したとき、ページの管理者でなくなったときに無効になる。取り直して `META_PAGE_ACCESS_TOKEN` を入れ替える。
   - Instagram の権限が入っていないトークンでは Instagram に投稿できない。Instagram を連携したら、6 つの権限でトークンを取り直して入れ替える。

6. 取得した値を Vercel の環境変数（Production）に設定する。

   | 変数                        | 内容                                                                                                                        |
   | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
   | `META_PAGE_ID`              | Facebook ページ ID                                                                                                          |
   | `META_PAGE_ACCESS_TOKEN`    | ページトークン（無期限）                                                                                                    |
   | `META_IG_USER_ID`           | Instagram ビジネスアカウント ID。入れたときから Instagram にも投稿する。ないあいだは Facebook だけ                          |
   | `META_GRAPH_VERSION`        | 省略可。既定 `v23.0`                                                                                                        |
   | `CRON_SECRET`               | 任意の長いランダム文字列。Vercel Cron が自動で Bearer に付ける                                                              |
   | `SOCIAL_SITE_URL`           | 省略可。画像 URL とリンク先の元になる本番 URL。未設定なら `brand.json` の `siteUrl`、それも空ならリクエストの origin を使う |
   | `SUPABASE_SERVICE_ROLE_KEY` | 既存。投稿ログの書き込みに使う                                                                                              |

   `META_PAGE_ID` と `META_PAGE_ACCESS_TOKEN` を入れてデプロイすると、次の月・水・金から投稿が始まる。手順 7 と下の「動作確認」のドライランを先に済ませる。

7. Supabase の SQL Editor で `supabase/schema.sql` の `social_posts` 部分を実行する。
8. Instagram のハンドルが決まったら `brand.json` の `instagramHandle` を埋めて、`pnpm social:render` で画像を作り直す（フッターの表示が会社名 → @ハンドルに変わる。投稿済みの画像は差し替わらない）。
   `siteUrl`（と `SOCIAL_SITE_URL`）はルートの `https://speech-fitness.learn-k.net` にする。この値に `/promo/<id>.png` をつないで画像 URL を作るので、`/welcome` などのパスを付けると Meta が画像を取得できない。
9. Instagram のプロフィール欄にアプリの URL を入れる（IG の本文中のリンクは押せないため）。

## 動作確認

デプロイ後、投稿せずに次の 1 件を確認します。ドライランは `META_*` の環境変数を入れる前でも動きます（`CRON_SECRET` と `social_posts` テーブルは必要）。

```bash
SOCIAL_ENDPOINT=https://<ドメイン>/social/publish CRON_SECRET=... pnpm social:publish
```

返ってくる JSON の `results[]` に、チャンネルごとの次の 1 件が入ります。`imageUrl` をブラウザで開けること、`caption` の文面が意図どおりであることを確認してから、実際に 1 件投稿します。

```bash
SOCIAL_ENDPOINT=... CRON_SECRET=... pnpm social:publish --send
```

画像 URL は Meta のサーバーから取りに来るため、Vercel の Deployment Protection がかかった Preview URL では失敗します。本番 URL を使ってください。

## ストックの増やし方

1. `queue.json` の `posts` 配列の末尾に項目を足す。順番どおりに投稿される。
   - `id`: 一意（ファイル名になる）
   - `status`: `ready` で投稿対象。`draft` は飛ばす。`archived` は投稿しない
   - `channels`: `["instagram", "facebook"]`（片方だけにすると、そのチャンネルにだけ出る）
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
- Instagram だけ止める: `META_IG_USER_ID` を消してデプロイする。
- 投稿履歴: Supabase の `social_posts`（`external_id` が Meta 側の投稿 ID）。

## 今後の候補

- Claude Code の定期エージェント（routine）で、毎週ストックの残数を確認し、足りなければ新しい投稿案を PR にする。
- 投稿後 1 週間のインサイト（リーチ、保存数）を Graph API で取り、伸びたテーマに寄せる。
