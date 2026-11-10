import { STORIES } from './pet-stories.js';
export const PETS = [
  [
    'cat',
    '星纹小猫',
    '星光守护猫',
    '暖心伙伴',
    '#eab67c',
    '温柔的呼噜声，陪你发现每一天的小进步。',
  ],
  [
    'dog',
    '星星小狗',
    '星甲守卫犬',
    '忠诚伙伴',
    '#c89471',
    '每一次击掌，都在为你的勇敢喝彩。',
  ],
  [
    'rabbit',
    '月芽小兔',
    '月华灵兔',
    '月光精灵',
    '#d4b9ee',
    '一起跳过小困难，走向更亮的月光。',
  ],
  [
    'hamster',
    '团团仓鼠',
    '星晶寻宝鼠',
    '寻宝高手',
    '#eccb86',
    '把你的每一点努力，收藏成珍贵的宝藏。',
  ],
  [
    'fox',
    '微光小狐',
    '九尾星狐',
    '灵动伙伴',
    '#edaa8b',
    '摇摇尾巴，陪你想出新的好办法。',
  ],
  [
    'wolf',
    '蓝霆小狼',
    '雷霆苍狼',
    '勇气伙伴',
    '#91b9d8',
    '再试一次，就是向勇敢迈出一步。',
  ],
  [
    'deer',
    '云角小鹿',
    '星角灵鹿',
    '森林精灵',
    '#9ac7b6',
    '用温柔和耐心，养出自己的小森林。',
  ],
  [
    'turtle',
    '晶背小龟',
    '玄晶神龟',
    '坚持伙伴',
    '#8fc9c3',
    '慢慢来，每一步都算数。',
  ],
  [
    'dragon',
    '星焰幼龙',
    '星焰神龙',
    '星火神兽',
    '#b2a0ed',
    '小小的星火，也能长成闪耀的翅膀。',
  ],
  [
    'phoenix',
    '极光雏凤',
    '极光凤凰',
    '幻彩神兽',
    '#c2a0d4',
    '把今天的努力，织成明天的极光。',
  ],
  [
    'qinglong',
    '青龙',
    '苍穹青龙',
    '中华圣兽',
    '#79b9ab',
    '乘云而起，把坚持写进青色星空。',
  ],
  [
    'baihu',
    '白虎',
    '啸风白虎',
    '中华圣兽',
    '#c7c9df',
    '踏风前行，守护每一次勇敢的尝试。',
  ],
  [
    'zhuque',
    '朱雀',
    '赤霄朱雀',
    '中华圣兽',
    '#e89879',
    '让心里的小火苗，照亮新的挑战。',
  ],
  [
    'qilin',
    '玉麟',
    '瑞光麒麟',
    '中华瑞兽',
    '#b9cfaa',
    '玉色鳞甲与金色祥云，守护每一个小小进步。',
  ],
  [
    'panda',
    '竹团熊猫',
    '翠竹守护熊猫',
    '竹林伙伴',
    '#b4c6a1',
    '抱抱小竹子，把耐心一点一点养大。',
  ],
  [
    'pixiu',
    '金团貔貅',
    '瑞金貔貅',
    '中华瑞兽',
    '#dfbc77',
    '把你的坚持，珍藏成闪耀的星星。',
  ],
  [
    'fish',
    '星波锦鲤',
    '流光锦鲤',
    '水中伙伴',
    '#e2ad80',
    '每一次摆尾，都在向着新的目标前进。',
  ],
  [
    'frog',
    '荷叶小蛙',
    '碧荷灵蛙',
    '荷塘伙伴',
    '#9ec6a7',
    '轻轻一跃，跨过今天的小挑战。',
  ],
]
  .map(([id, name, adult, tag, color, description]) => ({
    id,
    name,
    adult,
    tag,
    color,
    description,
    ...STORIES[id],
    version: 1,
    sheet: `pets/${id}.webp`,
    frames: 5,
  }))
  .sort((a, b) => {
    const order = [
      'fish',
      'frog',
      'cat',
      'dog',
      'rabbit',
      'hamster',
      'fox',
      'wolf',
      'deer',
      'turtle',
      'panda',
      'dragon',
      'phoenix',
      'qinglong',
      'baihu',
      'zhuque',
      'qilin',
      'pixiu',
    ];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
export const BASE_THRESHOLDS = [0, 3, 8, 15, 25, 38, 55, 75, 96, 120];
export function thresholds(order) {
  return BASE_THRESHOLDS.map((n) =>
    Math.round(n * 0.5 * (1 + 0.35 * (order - 1) + 0.05 * (order - 1) ** 2)),
  );
}
export function levelOf(p) {
  let l = 1;
  for (let i = 1; i < p.thresholds.length; i++)
    if (p.xp >= p.thresholds[i]) l = i + 1;
  return l;
}
export function frameOf(level) {
  return level < 3 ? 0 : level < 6 ? 1 : level < 9 ? 2 : level < 10 ? 3 : 4;
}

export function rankOf(level) {
  return level >= 8
    ? { kind: 'sun', count: 1 }
    : { kind: 'star', count: level >= 5 ? 3 : level >= 2 ? 2 : 1 };
}
