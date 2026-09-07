import { COMPANY, SITE_NAME, SITE_URL } from '@/constants/site';
import { BILLING_PLANS, TRIAL_DAYS } from '@/lib/plans';

// 特定商取引法に基づく表記。Rendered as a label/value list by the legal page.

const monthly = BILLING_PLANS.monthly.amount.toLocaleString('ja-JP');
const yearly = BILLING_PLANS.yearly.amount.toLocaleString('ja-JP');

export const TOKUSHOHO_TITLE = '特定商取引法に基づく表記';

export const TOKUSHOHO_ROWS: { label: string; value: string }[] = [
  { label: '販売事業者', value: COMPANY.name },
  { label: '運営責任者', value: COMPANY.representative },
  {
    label: '所在地',
    value: `${COMPANY.address}（詳細な住所は、ご請求があれば遅滞なく開示します）`,
  },
  {
    label: '電話番号',
    value: `${COMPANY.phone}（受付時間 ${COMPANY.phoneHours}。お問い合わせは電子メールをお願いします）`,
  },
  { label: '電子メール', value: COMPANY.email },
  { label: '販売URL', value: SITE_URL },
  { label: 'サービス名', value: `${SITE_NAME} プレミアムプラン` },
  {
    label: '販売価格',
    value: `月額プラン ${monthly}円（税込）、年額プラン ${yearly}円（税込）。価格は申込画面にも表示します。`,
  },
  {
    label: '商品代金以外の必要料金',
    value: 'インターネット接続にかかる通信費は利用者の負担です。',
  },
  {
    label: '支払方法',
    value:
      'クレジットカード（Visa、Mastercard、American Express、JCB）。決済代行はStripeを利用します。',
  },
  {
    label: '支払時期',
    value: `初回申込時に${TRIAL_DAYS}日間の無料期間があり、無料期間終了時に初回の料金を請求します。以降は、月額プランは毎月、年額プランは毎年、同じ日に自動更新し請求します。`,
  },
  {
    label: 'サービスの提供時期',
    value: '申込手続きの完了後、ただちにプレミアムプランの機能を利用できます。',
  },
  {
    label: '解約について',
    value:
      'サービス内の「お支払いの管理・解約」からいつでも解約できます。解約後も、支払い済みの期間が終了するまで利用できます。無料期間中に解約した場合、料金はかかりません。',
  },
  {
    label: '返品・返金について',
    value:
      'デジタルサービスの性質上、申込後の返品はできません。契約期間の途中で解約した場合も、残りの期間の料金は返金せず、日割り計算も行いません。当社の責めに帰すべき事由でサービスを継続して利用できなかった場合は、個別に対応します。',
  },
  {
    label: 'クーリング・オフ',
    value: '本サービスは通信販売のため、クーリング・オフの適用はありません。',
  },
  {
    label: '動作環境',
    value:
      'マイクを利用できるパソコンまたはスマートフォンと、最新のGoogle Chrome、Safari、Microsoft Edge、Firefox。Googleアカウントが必要です。',
  },
  {
    label: '特記事項',
    value:
      '本サービスは発話のトレーニングを目的としたもので、医療機器ではなく、疾患の診断や治療を行うものではありません。測定結果は録音環境や体調により変動します。',
  },
];
