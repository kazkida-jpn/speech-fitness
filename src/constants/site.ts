// Public identity of the service. Used by the landing page, legal pages, and <head> metadata.
export const SITE_URL = 'https://speech-fitness.learn-k.net';
export const SITE_NAME = '発話フィットネス';
export const SITE_TAGLINE = '毎日数分で、伝わる話し方を保つ';
export const SITE_DESCRIPTION =
  '話す機会が減って発話の衰えを感じる大人のための発話トレーニング。週1回の発話チェックと毎日2〜5分のドリルで、明瞭さと速さを測り、鍛え、過去の自分との変化を見える化します。';

export const COMPANY = {
  name: '合同会社LearnK',
  nameReading: 'ランケイ',
  representative: '木田 和廣',
  address: '千葉県松戸市',
  phone: '050-1726-6327',
  phoneHours: '平日 9:00〜18:00',
  email: 'info@learn-k.net',
  site: 'https://learn-k.net',
} as const;

/** Date shown as 最終更新日 on every legal page. Bump when any legal text changes. */
export const LEGAL_UPDATED = '2026年9月6日';
