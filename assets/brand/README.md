# ブランド素材

発話フィットネスのロゴとアイコンの元データです。PNG はすべてここの SVG から生成します。

## ファイル

| ファイル              | 用途                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `mark.svg`            | ロゴマーク（透過）。明るい背景用。アプリ内ヘッダー、スプラッシュの元 |
| `mark-white.svg`      | 単色白のマーク。暗い背景、Android のテーマアイコン用                 |
| `icon.svg`            | アプリアイコン（クリーム地に濃い緑のマーク）。iOS / Android / PWA 用 |
| `logo-horizontal.svg` | マーク＋ワードマークの横組み。資料や SNS プロフィール用              |

## 意味

吹き出しは「話すこと」、中の 4 本のバーは声の波形と、右へ向かって伸びる「変化」を表します。
一番高いバーだけコーラル色にして、「今日の一歩」を示します。

## 色

| 名前      | 値        | 使いどころ                 |
| --------- | --------- | -------------------------- |
| greenDark | `#0F5E4D` | マーク本体、強調カード     |
| green     | `#187A64` | ボタン、リンク、眉見出し   |
| mint      | `#DDF4EA` | 薄いバー、バッジ           |
| coral     | `#F06C55` | アクセント（最も高いバー） |
| cream     | `#F6F3EC` | 背景、アイコンのタイル     |
| ink       | `#19312D` | 本文、ワードマーク         |

アプリ内の色は `src/constants/palette.ts` と同じです。

## PNG の再生成

SVG を編集したら、次を実行すると `assets/images/` と `public/` の PNG がすべて更新されます。

```bash
pnpm dlx --package=@resvg/resvg-js node scripts/render-brand.mjs
```

生成されるもの:

- `assets/images/icon.png` 1024px（iOS / 汎用アイコン）
- `assets/images/android-icon-{foreground,background,monochrome}.png` 1024px（Android アダプティブアイコン。マークはセーフゾーン 66% 内）
- `assets/images/splash-icon.png` 1024px（透過。スプラッシュとアプリ内ヘッダー）
- `assets/images/favicon.png` 64px（Expo が `favicon.ico` を生成する元）
- `public/favicon-32.png`, `public/favicon-192.png`, `public/apple-touch-icon.png`, `public/icon-512.png`, `public/icon-512-maskable.png`（Web / PWA）
- `public/og-image.png` 1200×630（SNS シェア用）

OG 画像の日本語は、生成する PC にあるフォント（Yu Gothic など）で描画されます。
