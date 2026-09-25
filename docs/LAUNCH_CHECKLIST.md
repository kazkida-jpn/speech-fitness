# 公開チェックリスト

発話フィットネスを合同会社LearnK のサービスとして `https://speech-fitness.learn-k.net` で有料公開するまでの作業一覧です。
2026-09-06 に本番決済つきで公開し（告知なしのソフトローンチ）、2026-09-25 時点の状態に更新しました。
「済」は完了、「要作業」は管理画面などで人が行う作業、「任意」は公開に必須ではないものです。

## 現在の状態（2026-09-25）

- 本番 URL `https://speech-fitness.learn-k.net` で稼働中。`/`, `/welcome`, `/pricing`, `/terms`, `/privacy`, `/legal` すべて 200。
- Stripe は本番キーで稼働。2026-09-06 に実購入テストでプレミアムへの切り替えを確認済み。
- 告知はまだ行っていない。正式ローンチ（Instagram での告知開始）が次の大きな作業。

## 1. ドメインと配信

| 項目                                                                                         | 状態 |
| -------------------------------------------------------------------------------------------- | ---- |
| 公開ドメインを `speech-fitness.learn-k.net` に決定（`learn-k.net` は お名前.com の DNS）     | 済   |
| コード内の公開 URL（`src/constants/site.ts`）、OGP、canonical、特商法の販売 URL              | 済   |
| Vercel のプロジェクト設定 → Domains に `speech-fitness.learn-k.net` を追加                   | 済   |
| お名前.com の DNS に CNAME `speech-fitness` → `cname.vercel-dns.com` を追加                  | 済   |
| 本番デプロイ後、`/`, `/welcome`, `/pricing`, `/terms`, `/privacy`, `/legal` が開くことを確認 | 済   |
| Google Analytics 4（`EXPO_PUBLIC_GA_MEASUREMENT_ID`、`src/app/+html.tsx` でタグ注入）        | 済   |

## 2. 法務ページ

| 項目                                                                                          | 状態   |
| --------------------------------------------------------------------------------------------- | ------ |
| 利用規約 `/terms`（`src/content/terms.ts`）                                                   | 済     |
| プライバシーポリシー `/privacy`（`src/content/privacy.ts`、§6 で GA4 を開示）                 | 済     |
| 特定商取引法に基づく表記 `/legal`（`src/content/tokushoho.ts`）                               | 済     |
| 全画面フッターから法務ページへのリンク（`AppFooter`）                                         | 済     |
| 会社情報の確認: 登記上の商号（LearnK / ランケイ）、代表者名、電話番号、受付時間               | 済     |
| 所在地の扱い: 現在は「千葉県松戸市（請求があれば開示）」。番地まで載せるなら `site.ts` を変更 | 要判断 |
| 管轄裁判所: 東京地方裁判所（SQL リテラシー診断テストと同じ）。変えるなら `terms.ts` 第15条    | 要判断 |
| 内容の最終確認（可能なら専門家のレビュー）                                                    | 任意   |

法務ページの文面は `src/content/` にデータとして置いてあります。金額と無料期間は `src/lib/plans.ts` から自動で埋まります。文面を変えたら `src/constants/site.ts` の `LEGAL_UPDATED` も更新してください。

## 3. ロゴ・アイコン・OGP

| 項目                                                                         | 状態 |
| ---------------------------------------------------------------------------- | ---- |
| ロゴマーク SVG（`assets/brand/`）とアプリ内ヘッダーへの表示                  | 済   |
| iOS / Android / Expo Go 用アイコン、スプラッシュ画像                         | 済   |
| Web ファビコン（`favicon.ico`, 32px, 192px）、Apple touch icon、PWA manifest | 済   |
| OGP 画像 `public/og-image.png` と `<head>` のメタタグ（`src/app/+html.tsx`） | 済   |
| Expo テンプレートの iOS Icon Composer アイコン（`assets/expo.icon`）を削除   | 済   |

## 4. ランディングページ

| 項目                                                                                           | 状態 |
| ---------------------------------------------------------------------------------------------- | ---- |
| `/` を初回訪問者向けランディング、再訪者とログイン済みはホームに自動で切替                     | 済   |
| `/welcome` で常にランディングを表示（フッターやシェア用）                                      | 済   |
| 構成: ヒーロー → 結果イメージ → 測る・鍛える・見える化 → 使い方 → 8 ドリル → 料金 → 安心 → FAQ | 済   |
| 実際の画面のスクリーンショットに差し替え（現在は結果イメージを CSS で描画）                    | 任意 |
| Google Search Console への登録、`_sitemap` の確認                                              | 任意 |

## 5. 決済（Stripe）

| 項目                                                                                                             | 状態 |
| ---------------------------------------------------------------------------------------------------------------- | ---- |
| 商品と価格（月額 500 円 / 年額 3,980 円）、Webhook（`scripts/stripe-setup.mjs`）                                 | 済   |
| 本番の `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET` を Vercel の環境変数へ                     | 済   |
| Stripe 公開情報: 事業者名、サポートメール、サイト URL、特商法 / 利用規約 / プライバシーの URL                    | 済   |
| 明細書表示名（statement descriptor）を LEARNK / 合同会社LearnK に                                                | 済   |
| Stripe からの通知メール（無料期間終了 7 日前、カード期限、決済失敗、ポータルへのリンク）                         | 済   |
| Checkout 後の即時反映（`/billing/sync` で Stripe と照合）と `profiles` への service_role 権限                    | 済   |
| 本番での実購入テスト（2026-09-06、プレミアムへの切り替えを確認）                                                 | 済   |
| 未ログインで申し込みボタンを押したとき、Google ログインを促してからそのまま決済へ進める                          | 済   |
| Stripe ダッシュボードのブランドロゴ（Checkout とポータルに表示）                                                 | 任意 |
| Checkout の利用規約同意（`consent_collection.terms_of_service`）を有効にするなら、Stripe 側に利用規約 URL を登録 | 任意 |

## 6. ログイン（Google / Supabase）

| 項目                                                                                                                                  | 状態 |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Google Cloud の OAuth 同意画面を「本番」に公開（アプリ名、ホームページ、プライバシー / 利用規約 URL、承認済みドメイン `learn-k.net`） | 済   |
| Supabase → Authentication → URL Configuration の Site URL と Redirect URLs に本番ドメインを追加                                       | 済   |
| `supabase/schema.sql` を本番プロジェクトで実行                                                                                        | 済   |
| 本番の `EXPO_PUBLIC_SUPABASE_URL` などを Vercel の環境変数へ                                                                          | 済   |
| Google OAuth 同意画面のロゴ（登録すると Google の審査が必要）                                                                         | 任意 |
| Supabase に残っている開発中のテストアカウントの削除                                                                                   | 任意 |

## 7. 運用

| 項目                                                                                           | 状態   |
| ---------------------------------------------------------------------------------------------- | ------ |
| 問い合わせ窓口 `info@learn-k.net` の受信確認                                                   | 済     |
| Azure Speech / OpenAI の本番キーと利用上限（OpenAI 月 $10、Azure 月 $20 の予算アラート）       | 済     |
| README の公開に関する記述を更新                                                                | 済     |
| 退会（アカウント削除）依頼が来たときの手順（Supabase の auth.users 削除と Stripe 顧客の解約）  | 要作業 |
| 会計: Stripe の入金と消費税（税込表示済み）、インボイス登録番号を領収書に載せるか              | 要判断 |
| 週1回の発話チェックにログインを必須にするか（現在は匿名で無制限、1 回あたり Azure 約 2〜3 円） | 要判断 |

## 8. 正式ローンチ（Instagram での告知）

コードと投稿ストックは `marketing/social/` に用意済みです。手順の詳細は `marketing/social/README.md` を参照してください。

| 項目                                                                                                | 状態   |
| --------------------------------------------------------------------------------------------------- | ------ |
| 投稿ストック（`queue.json` 12 本）、画像テンプレート、Vercel Cron（月水金 9:00）、Graph API 連携    | 済     |
| 合同会社ランケイ名義の Facebook ページと Instagram プロアカウントの作成、両者の連携                 | 要作業 |
| Meta 開発者アプリの作成と長期ページアクセストークンの取得                                           | 要作業 |
| Vercel の環境変数 `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_IG_USER_ID`, `CRON_SECRET` を設定 | 要作業 |
| 本番 Supabase で `social_posts` テーブルの SQL を実行                                               | 要作業 |
| `marketing/social/brand.json` の `instagramHandle` と `siteUrl` を埋めて `pnpm social:render`       | 要作業 |
| Instagram のプロフィールにサイト URL を記載                                                         | 要作業 |
| `pnpm social:publish`（ドライラン）→ `--send` で 1 本目を投稿                                       | 要作業 |
