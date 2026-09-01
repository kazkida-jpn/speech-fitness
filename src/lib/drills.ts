export type Drill = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  sentences: string[];
};

export const DRILLS: Drill[] = [
  {
    id: 'sibilants', title: 'サ行・ザ行を明瞭に', shortTitle: 'サ行・ザ行', accent: '#DFF4EC',
    description: '舌先と息の流れを意識して、摩擦音と破擦音をはっきり発音します。',
    sentences: ['少しずつ姿勢を整えて、静かに深呼吸しましょう。', '新しい資料を順番に整理して、必要な数字を確認します。', '涼しい風を感じながら、川沿いの道をゆっくり進みます。'],
  },
  {
    id: 'consonants', title: '子音の立ち上がり', shortTitle: '子音', accent: '#E7F0FF',
    description: 'カ行・ガ行・タ行・ダ行・パ行・バ行・ラ行を丁寧に始めます。',
    sentences: ['公園の広場で、子どもたちが元気にボールを投げています。', '料理の材料を量ってから、火加減を丁寧に調整します。', '理由と具体的な例を、分かりやすい言葉で説明します。'],
  },
  {
    id: 'mora', title: '長音・促音・撥音', shortTitle: '音の長さ', accent: '#FFF0DA',
    description: '伸ばす音、「っ」、「ん」を省略せず、一拍ずつ保ちます。',
    sentences: ['出発の前に、切符と案内をしっかり確認しましょう。', 'ゆっくり深呼吸して、電車が来るまで待っています。', '健康診断の結果を確認して、今後の予定を考えます。'],
  },
  {
    id: 'endings', title: '語尾を最後まで届ける', shortTitle: '語尾', accent: '#FCE5E2',
    description: '「です」「ます」まで息と声を保ち、文末を明瞭にします。',
    sentences: ['明日の予定について、順番に説明します。', '必要な持ち物は、机の上に用意してあります。', '今日も最後まで落ち着いて話すことができました。'],
  },
  {
    id: 'connections', title: '音をなめらかにつなぐ', shortTitle: '音のつながり', accent: '#EAE4F8',
    description: '音が連続する場所でも、子音を落とさず滑らかにつなぎます。',
    sentences: ['水を与えるうちに、小さな苗が少しずつ育ちました。', '具体的な例を挙げてから、理由を分かりやすく伝えます。', '必要な資料をそろえて、会議の準備を始めましょう。'],
  },
  {
    id: 'rhythm', title: '一定の速度とリズム', shortTitle: 'リズム', accent: '#E3F2D9',
    description: '文の前半と後半で速度をそろえ、一定のテンポで読みます。',
    sentences: ['朝起きて窓を開け、温かいお茶をゆっくり飲みました。', '駅まで歩いたあと、電車に乗って図書館へ向かいます。', '結論を最初に述べて、理由を二つ順番に説明します。'],
  },
  {
    id: 'pauses', title: '自然な間と呼吸', shortTitle: '間と呼吸', accent: '#DDEEF3',
    description: '読点では短く、句点では少し長く区切って呼吸します。',
    sentences: ['天気を確認してから、傘を持って、ゆっくり出かけました。', '話を始める前に深呼吸し、相手を見て、落ち着いて伝えます。', '午前中に買い物を済ませ、午後は家で、本を読む予定です。'],
  },
  {
    id: 'speed', title: '明瞭さを保って速度アップ', shortTitle: '速度アップ', accent: '#FFE5C7',
    description: '自然な速さから少しずつ速め、音を省略せずに読みます。',
    sentences: ['新しい図書館の窓から、明るい日差しが入っています。', '旅行の前日には、必要な荷物を一覧にして確認します。', '季節の変わり目には、体調を崩さないよう気をつけます。'],
  },
];

export function recommendDrills(text: string) {
  const rules: Array<[RegExp, string]> = [
    [/サ行|ザ行|シ|ジ|チ|ツ|ずつ/, 'sibilants'], [/カ行|ガ行|タ行|ダ行|パ行|バ行|ラ行|子音/, 'consonants'],
    [/長音|促音|撥音|切符|音の長さ/, 'mora'], [/語尾|文末|です|ます/, 'endings'],
    [/つながり|連続|なめらか/, 'connections'], [/リズム|一定|ばらつき/, 'rhythm'],
    [/間|呼吸|停止/, 'pauses'], [/早口|速度|速く/, 'speed'],
  ];
  const matches = rules.filter(([pattern]) => pattern.test(text)).map(([, id]) => id);
  return Array.from(new Set(matches)).slice(0, 3);
}
