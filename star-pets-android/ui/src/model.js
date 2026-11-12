import { PETS, thresholds, levelOf } from './catalog.js';
import { DEFAULT_THEME_ID, THEME_IDS } from './theme-config.js';
export const NAME_LIMITS = Object.freeze({ child: 8, pet: 10 });
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateNo(s) {
  return Math.floor(Date.parse(s + 'T12:00:00Z') / 86400000);
}
function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
function weekKey(s) {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const text = (v, n = 120) =>
  String(v ?? '')
    .trim()
    .slice(0, n);
export function memoryDisplayText(memory) {
  const value = String(memory?.text ?? '');
  return memory?.source === 'habit' ? value.replace(/\s*·\s*$/u, '').trim() : value;
}
/** 解析「第一次相遇 · 寄语」：标题加粗居中，寄语按逗号拆成两行。 */
export function meetingWishParts(text) {
  const raw = String(text ?? '').trim();
  const match = raw.match(/^(第一次相遇)\s*[·•]\s*(.+)$/u);
  if (!match) return null;
  const title = match[1];
  const wish = match[2].trim();
  const comma = wish.indexOf('，');
  if (comma > 0 && comma < wish.length - 1) {
    return {
      title,
      line1: wish.slice(0, comma + 1),
      line2: wish.slice(comma + 1).trim(),
    };
  }
  return { title, line1: wish, line2: '' };
}
function must(v, msg) {
  if (!v) throw Error(msg);
}
export const positiveRules = [
  { id: 'tidy', name: '主动整理书包', points: 3 },
  { id: 'read', name: '认真阅读', points: 5 },
  { id: 'help', name: '帮助家人', points: 3 },
  { id: 'brave', name: '勇敢尝试', points: 2 },
  { id: 'kind', name: '友善表达', points: 3 },
  { id: 'rule-focus', name: '专心完成作业', points: 5 },
  { id: 'rule-toys', name: '主动收好玩具', points: 3 },
  { id: 'rule-greet', name: '主动向家人问好', points: 2 },
  { id: 'rule-share', name: '分享今天的开心事', points: 3 },
  { id: 'rule-water', name: '主动喝水', points: 2 },
  { id: 'rule-sleep', name: '按时准备睡觉', points: 3 },
  { id: 'rule-table', name: '帮助整理餐桌', points: 3 },
  { id: 'rule-polite', name: '礼貌表达自己的需要', points: 3 },
  { id: 'rule-persist', name: '遇到困难继续尝试', points: 4 },
  { id: 'rule-ready', name: '提前准备第二天用品', points: 3 },
  { id: 'rule-listen', name: '认真听完他人讲话', points: 3 },
  // v2 目录补充（日常行为缺口）：刷牙/穿衣/吃饭/运动/诚实/冷静/道歉/
  // 等待/安全——此前 16 条没有覆盖这些每天都会发生的行为。
  { id: 'rule-brush', name: '自己刷牙', points: 3 },
  { id: 'rule-dress', name: '自己穿衣服', points: 2 },
  { id: 'rule-meal', name: '好好吃饭不挑食', points: 3 },
  { id: 'rule-sport', name: '主动运动锻炼身体', points: 3 },
  { id: 'rule-honest', name: '诚实说出实情', points: 3 },
  { id: 'rule-calm', name: '生气时先冷静下来', points: 3 },
  { id: 'rule-apology', name: '做错事主动道歉', points: 3 },
  { id: 'rule-wait', name: '耐心等待轮到自己', points: 2 },
  { id: 'rule-safety', name: '主动遵守安全规则', points: 3 },
];
export const deductionRules = [
  { id: 'rule-push', name: '推搡或动手伤人', points: -3 },
  { id: 'rule-break', name: '故意损坏物品', points: -3 },
  { id: 'rule-unkind', name: '用伤人的话表达', points: -2 },
  { id: 'rule-agreement', name: '违反已约定的规则', points: -2 },
  { id: 'rule-danger', name: '提醒后继续危险行为', points: -3 },
  { id: 'rule-mess', name: '拒绝收拾自己的物品', points: -1 },
  { id: 'rule-lie', name: '故意隐瞒或说谎', points: -3 },
  { id: 'rule-shout', name: '大声打断他人讲话', points: -2 },
  { id: 'rule-delay', name: '反复拖延约定事项', points: -2 },
  { id: 'rule-screen', name: '超时使用电子设备', points: -2 },
  { id: 'rule-waste', name: '故意浪费食物或用品', points: -2 },
  { id: 'rule-rude', name: '没有礼貌地回应家人', points: -2 },
  { id: 'rule-homework', name: '拒绝完成当天作业', points: -3 },
  { id: 'rule-bedtime', name: '提醒后仍不准备睡觉', points: -2 },
  { id: 'rule-grab', name: '未经允许拿走他人物品', points: -3 },
  { id: 'rule-ignore', name: '多次无视安全提醒', points: -3 },
  // v2 目录补充（日常行为缺口）：发脾气/不洗手/赖床/顶嘴/哭闹要买东西。
  { id: 'rule-tantrum', name: '乱发脾气摔东西', points: -2 },
  { id: 'rule-wash', name: '饭前便后不洗手', points: -1 },
  { id: 'rule-latebed', name: '赖床不起', points: -2 },
  { id: 'rule-talkback', name: '顶撞长辈大声顶嘴', points: -2 },
  { id: 'rule-whine', name: '哭闹着要买东西', points: -2 },
];
export function initialState(now = Date.now()) {
  const id = uid();
  return {
    schema: 1,
    revision: 0,
    createdAt: now,
    deductionDefaults: 1,
    ruleCatalogVersion: 2,
    child: '小星星',
    profiles: [
      {
        id,
        name: '小星星',
        avatar: '⭐',
        avatarFile: '',
        birthDate: '',
        note: '',
        data: null,
      },
    ],
    activeProfileId: id,
    pets: [],
    events: [],
    habits: [],
    goalTemplates: [],
    memories: [],
    imports: [],
    settings: {
      habits: true,
      quietStart: 21,
      quietEnd: 7,
      reduceMotion: false,
      reduceGlass: false,
      hungerHours: 24,
      boarding: false,
      lockMinutes: 5,
      memoryExpanded: true,
      voiceEnabled: true,
      theme: DEFAULT_THEME_ID,
    },
    care: { clock: now, elapsed: 0, food: 0, rationDay: '', joyUntil: 0 },
    rules: [...positiveRules, ...deductionRules],
  };
}
const profileFields = [
  'deductionDefaults',
  'ruleCatalogVersion',
  'child',
  'pets',
  'events',
  'habits',
  'goalTemplates',
  'memories',
  'imports',
  'settings',
  'care',
  'rules',
];
function profileSnapshot(s) {
  return Object.fromEntries(profileFields.map((k) => [k, clone(s[k])]));
}
function syncThemeAcrossProfiles(s, theme = s.settings?.theme) {
  if (!THEME_IDS.includes(theme)) return;
  s.settings.theme = theme;
  for (const p of s.profiles || []) {
    if (p.data?.settings && typeof p.data.settings === 'object')
      p.data.settings.theme = theme;
  }
}
function ensureProfiles(s) {
  if (!Array.isArray(s.goalTemplates)) s.goalTemplates = [];
  if (Array.isArray(s.profiles) && s.profiles.length) {
    for (const p of s.profiles)
      if (p.data && !Array.isArray(p.data.goalTemplates))
        p.data.goalTemplates = [];
    return;
  }
  const id = uid();
  s.profiles = [
    {
      id,
      name: s.child,
      avatar: '⭐',
      avatarFile: '',
      birthDate: '',
      note: '',
      data: null,
    },
  ];
  s.activeProfileId = id;
}
export function catalog(s) {
  return [...PETS, ...s.imports];
}
export function activePet(s) {
  return s.pets.find((p) => levelOf(p) < 10) || null;
}
export function totals(s) {
  const reversed = new Set(
    s.events.filter((e) => e.kind === 'reverse').map((e) => e.ref),
  );
  let earned = 0,
    deducted = 0;
  for (const e of s.events) {
    if (reversed.has(e.id)) continue;
    if (e.kind === 'plus') earned += e.points;
    if (e.kind === 'minus') deducted += e.points;
  }
  return { earned, deducted, net: earned - deducted };
}
function xpAllocation(s) {
  const xp = new Map(s.pets.map((p) => [p.id, 0]));
  let remaining = 0;
  if (!s.events.some((e) => e.kind === 'reverse' && e.targetPetId)) {
    remaining = totals(s).earned;
    for (const p of s.pets) {
      const n = Math.min(p.thresholds[9], Math.max(0, remaining));
      xp.set(p.id, n);
      remaining -= n;
    }
    return { xp, remaining: Math.max(0, remaining) };
  }
  const cancelled = new Set(
      s.events
        .filter((e) => e.kind === 'reverse' && !e.targetPetId)
        .map((e) => e.ref),
    ),
    adopted = new Set();
  const distribute = () => {
    for (const p of s.pets) {
      if (!adopted.has(p.id)) continue;
      const gain = Math.min(remaining, p.thresholds[9] - xp.get(p.id));
      xp.set(p.id, xp.get(p.id) + gain);
      remaining -= gain;
    }
  };
  for (const e of s.events) {
    if (e.kind === 'adopt') {
      adopted.add(e.petId);
      distribute();
    } else if (e.kind === 'plus' && !cancelled.has(e.id)) {
      remaining += e.points;
      distribute();
    } else if (e.kind === 'reverse' && e.targetPetId) {
      const original = s.events.find((o) => o.id === e.ref);
      if (original?.kind === 'plus') {
        const current = xp.get(e.targetPetId) || 0;
        xp.set(e.targetPetId, Math.max(0, current - original.points));
      }
    }
  }
  return { xp, remaining };
}
export function rebuildXP(s) {
  const a = xpAllocation(s);
  for (const p of s.pets) p.xp = a.xp.get(p.id);
  return a.remaining;
}
export function bank(s) {
  return xpAllocation(s).remaining;
}
export function isReversed(s, id) {
  return s.events.some((e) => e.kind === 'reverse' && e.ref === id);
}
export function habitPeriod(h, date) {
  return h.frequency === 'weekly' ? weekKey(date) : date;
}
export function habitDue(h, date) {
  if (h.status !== 'active' || date < h.start || (h.end && date > h.end))
    return false;
  const d = new Date(date + 'T12:00:00');
  if (h.frequency === 'days') return h.days.includes(d.getDay());
  if (h.frequency === 'interval')
    return (dateNo(date) - dateNo(h.start)) % h.interval === 0;
  return true;
}
export function habitCount(s, h, date) {
  const period = habitPeriod(h, date),
    reversed = new Set(
      s.events.filter((e) => e.kind === 'reverse').map((e) => e.ref),
    );
  return s.events.filter(
    (e) =>
      e.kind === 'plus' &&
      e.habitId === h.id &&
      habitPeriod(h, e.day) === period &&
      !reversed.has(e.id),
  ).length;
}
export function advanceCare(s, now) {
  const c = s.care;
  if (now < c.clock - 300000) {
    c.clockWarning = true;
    return;
  }
  if (c.clockWarning) return;
  let delta = 0,
    start = c.clock; // bounded to 7 days; hunger is capped, no background service
  if (!s.settings.boarding) {
    start = Math.max(start, now - 7 * 86400000);
    for (let t = start; t < now; ) {
      const end = Math.min(now, t + 60000),
        hour = new Date(t).getHours(),
        qs = s.settings.quietStart,
        qe = s.settings.quietEnd;
      const quiet =
        qs === qe
          ? false
          : qs > qe
            ? hour >= qs || hour < qe
            : hour >= qs && hour < qe;
      if (!quiet) delta += end - t;
      t = end;
    }
  }
  c.elapsed = Math.min(c.elapsed + delta, 7 * 86400000);
  c.clock = now;
}
export function hunger(s, now = Date.now()) {
  if (!activePet(s))
    return {
      label: s.pets.length ? '满级伙伴 · 自由生活' : '等待伙伴',
      stage: 0,
    };
  const a = { care: { ...s.care }, settings: { ...s.settings } };
  advanceCare(a, now);
  const h = a.care.elapsed / 3600000;
  return {
    label: s.settings.boarding
      ? '安心托管'
      : h >= s.settings.hungerHours * 2
        ? '需要喂食'
        : h >= s.settings.hungerHours
          ? '有点饿'
          : '饱饱的',
    stage: s.settings.boarding
      ? 0
      : h >= s.settings.hungerHours * 2
        ? 2
        : h >= s.settings.hungerHours
          ? 1
          : 0,
  };
}
export function validate(s) {
  must(s && s.schema === 1, '备份版本不兼容');
  for (const k of ['pets', 'events', 'habits', 'memories', 'imports', 'rules'])
    must(Array.isArray(s[k]), '数据结构缺失：' + k);
  must(
    s.events.length <= 100000 &&
      s.pets.length <= 500 &&
      s.imports.length <= 100,
    '记录数量超出限制',
  );
  must(
    s.settings && s.care && Number.isSafeInteger(s.revision) && s.revision >= 0,
    '设置或版本无效',
  );
  must(
    new Set(s.events.map((e) => e.id)).size === s.events.length,
    '流水编号重复',
  );
  must(
    new Set(s.pets.map((p) => p.species)).size === s.pets.length,
    '重复领养',
  );
  for (const p of s.pets) {
    must(
      catalog(s).some((x) => x.id === p.species),
      '缺少宠物资源',
    );
    must(
      Array.isArray(p.thresholds) &&
        p.thresholds.length === 10 &&
        p.thresholds[0] === 0 &&
        p.thresholds.every(
          (n, i) =>
            Number.isSafeInteger(n) &&
            n >= 0 &&
            (!i || n > p.thresholds[i - 1]),
        ),
      '等级门槛无效',
    );
  }
  for (const e of s.events) {
    must(
      typeof e.id === 'string' &&
        [
          'plus',
          'minus',
          'reverse',
          'adopt',
          'care',
          'habit',
          'rename',
          'memory',
        ].includes(e.kind),
      '流水类型无效',
    );
    must(Number.isFinite(e.at), '流水时间无效');
    if (['plus', 'minus'].includes(e.kind))
      must(
        Number.isSafeInteger(e.points) && e.points > 0 && e.points <= 100000,
        '分数无效',
      );
    if (e.kind === 'reverse')
      must(
        s.events.some(
          (o) => o.id === e.ref && ['plus', 'minus'].includes(o.kind),
        ),
        '撤销引用无效',
      );
  }
  for (const e of s.events)
    if (e.kind === 'reverse' && e.targetPetId)
      must(
        s.pets.some((p) => p.id === e.targetPetId),
        '撤销目标伙伴不存在',
      );
  const refs = s.events.filter((e) => e.kind === 'reverse').map((e) => e.ref);
  must(new Set(refs).size === refs.length, '重复撤销');
  must(
    typeof s.child === 'string' &&
      s.child.trim().length > 0 &&
      s.child.length <= 20,
    '孩子昵称无效',
  );
  for (const k of ['habits', 'reduceMotion', 'reduceGlass', 'boarding'])
    must(typeof s.settings[k] === 'boolean', '设置无效：' + k);
  must(
    [12, 24, 48].includes(s.settings.hungerHours) &&
      [0, 1, 5, 15].includes(s.settings.lockMinutes),
    '照料或锁定设置无效',
  );
  must(
    s.settings.theme === undefined || THEME_IDS.includes(s.settings.theme),
    '主题设置无效',
  );
  for (const k of ['quietStart', 'quietEnd'])
    must(
      Number.isInteger(s.settings[k]) &&
        s.settings[k] >= 0 &&
        s.settings[k] <= 23,
      '睡眠时间无效',
    );
  must(
    Number.isFinite(s.care.clock) &&
      Number.isFinite(s.care.elapsed) &&
      s.care.elapsed >= 0 &&
      s.care.elapsed <= 7 * 86400000 &&
      Number.isSafeInteger(s.care.food) &&
      s.care.food >= 0,
    '照料数据无效',
  );
  must(
    new Set(catalog(s).map((p) => p.id)).size === catalog(s).length,
    '宠物资源编号重复',
  );
  for (const p of s.imports) {
    must(
      /^custom-[a-z0-9-]{1,40}$/.test(p.id) &&
        p.frames === 5 &&
        Number.isInteger(p.version) &&
        p.version >= 1 &&
        /^\/media\/[a-f0-9-]+\.png$/.test(p.sheet),
      '导入宠物资源无效',
    );
    for (const k of ['name', 'adult', 'description'])
      must(
        typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 200,
        '宠物文字无效',
      );
  }
  for (const key of ['pets', 'habits', 'memories'])
    must(
      new Set(s[key].map((v) => v.id)).size === s[key].length,
      '数据编号重复：' + key,
    );
  const allocation = xpAllocation(s);
  for (const p of s.pets) {
    must(
      typeof p.name === 'string' &&
        p.name.trim().length > 0 &&
        p.name.length <= 20,
      '伙伴昵称无效',
    );
    must(p.xp === allocation.xp.get(p.id), '经验与积分流水不一致');
  }
  for (const h of s.habits) {
    must(
      typeof h.name === 'string' &&
        h.name.trim().length > 0 &&
        ['daily', 'days', 'interval', 'weekly'].includes(h.frequency) &&
        ['active', 'paused', 'mastered', 'archived'].includes(h.status),
      '习惯定义无效',
    );
    must(!h.goalId || (typeof h.goalId === 'string' && h.goalId.length <= 80), '目标关联无效');
    must(
      validDate(h.start) && (!h.end || (validDate(h.end) && h.end >= h.start)),
      '习惯日期无效',
    );
    must(
      Number.isInteger(h.points) &&
        h.points > 0 &&
        h.points <= 1000 &&
        Number.isInteger(h.target) &&
        h.target > 0 &&
        h.target <= 20,
      '习惯奖励无效',
    );
    must(
      Array.isArray(h.days) &&
        h.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) &&
        (h.frequency !== 'days' || h.days.length > 0) &&
        Number.isInteger(h.interval) &&
        h.interval >= 1 &&
        h.interval <= 365,
      '习惯周期无效',
    );
    must(
      Array.isArray(h.times) &&
        h.times.length <= 24 &&
        h.times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)),
      '习惯时间无效',
    );
  }
  for (const m of s.memories) {
    must(
      s.pets.some((p) => p.id === m.petId) &&
        ['audio', 'photo', 'note'].includes(m.kind) &&
        typeof m.text === 'string' &&
        m.text.length <= 500,
      '纪念数据无效',
    );
    must(
      m.kind === 'note' ||
        (m.kind === 'audio'
          ? /^[a-f0-9-]+\.m4a$/
          : /^[a-f0-9-]+\.(jpg|png)$/
        ).test(m.file),
      '纪念文件无效',
    );
  }
  if (s.goalTemplates !== undefined) {
    must(
      Array.isArray(s.goalTemplates) && s.goalTemplates.length <= 100,
      '目标库数量无效',
    );
    must(
      new Set(s.goalTemplates.map((g) => g.id)).size === s.goalTemplates.length,
      '目标编号重复',
    );
    for (const g of s.goalTemplates)
      must(
        /^goal-[a-f0-9-]+$/.test(g.id) &&
          typeof g.name === 'string' &&
          g.name.trim() &&
          g.name.length <= 40 &&
          typeof g.category === 'string' &&
          g.category.length <= 20 &&
          typeof g.criteria === 'string' &&
          g.criteria.length <= 200 &&
          Number.isInteger(g.points) &&
          g.points >= 1 &&
          g.points <= 1000,
        '目标定义无效',
      );
  }
  must(
    s.rules.length <= 200 &&
      s.rules.every(
        (r) =>
          typeof r.name === 'string' &&
          r.name.trim() &&
          Number.isInteger(r.points) &&
          r.points !== 0 &&
          Math.abs(r.points) <= 1000,
      ),
    '快捷规则无效',
  );
  for (const e of s.events) must(validDate(e.day), '流水日期无效');
  if (s.profiles !== undefined) {
    must(
      Array.isArray(s.profiles) &&
        s.profiles.length >= 1 &&
        s.profiles.length <= 10,
      '孩子档案数量无效',
    );
    must(
      new Set(s.profiles.map((p) => p.id)).size === s.profiles.length,
      '孩子档案编号重复',
    );
    must(
      s.profiles.some((p) => p.id === s.activeProfileId),
      '当前孩子不存在',
    );
    for (const p of s.profiles) {
      must(
        typeof p.id === 'string' &&
          p.id.length > 0 &&
          text(p.name, 20) === p.name,
        '孩子档案名称无效',
      );
      must(
        typeof p.avatar === 'string' &&
          p.avatar.length <= 8 &&
          (!p.avatarFile || /^[a-f0-9-]+\.(jpg|png)$/.test(p.avatarFile)),
        '孩子头像无效',
      );
      must(
        !p.birthDate || (validDate(p.birthDate) && p.birthDate <= dayKey()),
        '出生日期无效',
      );
      must(typeof p.note === 'string' && p.note.length <= 200, '孩子资料无效');
      if (p.id !== s.activeProfileId) {
        must(p.data && typeof p.data === 'object', '孩子数据缺失');
        validate({ ...p.data, schema: 1, revision: 0, createdAt: s.createdAt });
      }
    }
  }
  return s;
}
export function apply(before, cmd, now = Date.now()) {
  const s = clone(before);
  ensureProfiles(s);
  advanceCare(s, now);
  const add = (e) =>
    s.events.push({ id: uid(), at: now, day: dayKey(now), ...e });
  let result = {};
  if (
    cmd.type === 'travelReturn' &&
    cmd.profileId &&
    cmd.profileId !== s.activeProfileId
  ) {
    const owner = s.profiles.find((p) => p.id === cmd.profileId);
    must(owner?.data, '旅行所属小朋友不存在');
    const child = {
      ...clone(owner.data),
      schema: 1,
      revision: 0,
      createdAt: s.createdAt,
    };
    const completed = apply(child, { ...cmd, profileId: undefined }, now);
    owner.data = profileSnapshot(completed.state);
    validate(s);
    s.revision = before.revision + 1;
    return { state: s, result: completed.result };
  }
  switch (cmd.type) {
    case 'adopt': {
      must(!activePet(s), '请先把当前伙伴培养到满级');
      must(
        catalog(s).some((p) => p.id === cmd.species),
        '宠物不存在',
      );
      must(!s.pets.some((p) => p.species === cmd.species), '已领养这只宠物');
      const petName = String(cmd.name ?? '').trim();
      must(petName && petName.length <= NAME_LIMITS.pet, `伙伴名字最多 ${NAME_LIMITS.pet} 个字`);
      if (cmd.firstPhoto)
        must(/^[a-f0-9-]+\.jpg$/.test(cmd.firstPhoto), '第一次相遇照片无效');
      const p = {
        id: uid(),
        species: cmd.species,
        name: petName,
        adoptedAt: now,
        order: s.pets.length + 1,
        thresholds: thresholds(s.pets.length + 1),
        xp: 0,
      };
      s.pets.push(p);
      s.care.elapsed = 0;
      s.care.food += 1;
      add({ kind: 'adopt', petId: p.id, reason: `与${p.name}初次相遇` });
      if (cmd.firstPhoto) {
        const wish = text(cmd.wish, 160) || '愿我们一起，把每一次勇敢和快乐都收藏起来。';
        s.memories.push({
          id: uid(),
          petId: p.id,
          kind: 'photo',
          source: 'adoption',
          file: cmd.firstPhoto,
          text: `第一次相遇 · ${wish}`,
          at: now,
          level: 1,
          name: p.name,
        });
        add({ kind: 'memory', petId: p.id, reason: '收藏第一次相遇的照片' });
      }
      result.petId = p.id;
      break;
    }
    case 'score': {
      must(
        Number.isSafeInteger(cmd.points) &&
          cmd.points !== 0 &&
          Math.abs(cmd.points) <= 100000,
        '分数须为非零整数，范围 ±100000',
      );
      must(text(cmd.reason), '请填写具体原因');
      must(
        !cmd.token || !s.events.some((e) => e.token === cmd.token),
        '本次记录已保存，请勿重复提交',
      );
      const date = cmd.date || dayKey(now);
      must(validDate(date) && date <= dayKey(now), '记录日期无效');
      if (cmd.occurredAt !== undefined)
        must(
          Number.isFinite(cmd.occurredAt) &&
            cmd.occurredAt <= now &&
            dayKey(cmd.occurredAt) === date,
          '记录时间无效',
        );
      let extra = {
        day: date,
        ...(cmd.occurredAt !== undefined ? { occurredAt: cmd.occurredAt } : {}),
      };
      if (cmd.habitId) {
        const h = s.habits.find((x) => x.id === cmd.habitId);
        must(h, '习惯不存在');
        must(habitDue(h, date), '该日期不在培养计划中');
        must(habitCount(s, h, date) < h.target, '该周期奖励已领完');
        must(cmd.points === h.points, '习惯分值已更新，请重新打开');
        extra = {
          habitId: h.id,
          habitName: h.name,
          period: habitPeriod(h, date),
          day: date,
          frequency: h.frequency,
          completion: cmd.completion || '独立完成',
        };
      }
      const scoreId = uid();
      if (cmd.habitId && activePet(s)) {
        const p = activePet(s);
        s.memories.push({
          id: uid(),
          petId: p.id,
          kind: 'note',
          source: 'habit',
          eventId: scoreId,
          habitId: cmd.habitId,
          file: '',
          text: [text(cmd.reason), text(cmd.note, 300)].filter(Boolean).join(' · '),
          at: now,
          level: levelOf(p),
          name: p.name,
        });
      }
      const p = activePet(s);
      add({
        id: scoreId,
        kind: cmd.points > 0 ? 'plus' : 'minus',
        points: Math.abs(cmd.points),
        reason: text(cmd.reason),
        note: text(cmd.note, 300),
        petId: p?.id || null,
        token: cmd.token || uid(),
        ...extra,
      });
      if (cmd.points > 0) {
        s.care.elapsed = 0;
        s.care.food += 1;
        s.care.joyUntil = now + 5000;
      }
      result.emotion = cmd.points > 0 ? 'happy' : 'sad';
      break;
    }
    case 'reverse': {
      const e = s.events.find((x) => x.id === cmd.id);
      must(
        e && ['plus', 'minus'].includes(e.kind) && !isReversed(s, e.id),
        '该记录不能再次撤销',
      );
      must(e.day.slice(0, 7) === dayKey(now).slice(0, 7), '只能撤销本月记录');
      must(text(cmd.reason), '请填写纠错原因');
      if (cmd.targetPetId)
        must(
          s.pets.some((p) => p.id === cmd.targetPetId),
          '当前伙伴不存在',
        );
      add({
        kind: 'reverse',
        ref: e.id,
        reason: text(cmd.reason),
        points: e.points,
        original: e.reason,
        ...(cmd.targetPetId ? { targetPetId: cmd.targetPetId } : {}),
      });
      for (const m of s.memories)
        if (m.eventId === e.id) {
          m.reversedAt = now;
          m.reverseReason = text(cmd.reason);
        }
      break;
    }
    case 'care': {
      must(s.pets.length, '先领养你的伙伴');
      if (cmd.action === 'ration') {
        must(s.care.rationDay !== dayKey(now), '今天的基础口粮已领取');
        s.care.rationDay = dayKey(now);
        s.care.food += 2;
      } else if (cmd.action === 'feed') {
        must(s.care.food > 0, '口粮用完了，先领取每日口粮');
        s.care.food--;
        s.care.elapsed = 0;
      } else must(['pet', 'play'].includes(cmd.action), '未知互动');
      s.care.joyUntil = now + 4000;
      add({
        kind: 'care',
        action: cmd.action,
        reason: {
          ration: '领取每日口粮',
          feed: '给伙伴喂食',
          pet: '温柔地抚摸伙伴',
          play: '陪伙伴玩耍',
        }[cmd.action],
      });
      break;
    }
    case 'habit': {
      const v = cmd.value;
      must(text(v.name, 40), '请填写习惯名称');
      must(
        ['daily', 'days', 'interval', 'weekly'].includes(v.frequency),
        '请选择频率',
      );
      must(
        Number.isInteger(v.points) && v.points > 0 && v.points <= 1000,
        '奖励须为 1–1000',
      );
      must(
        Number.isInteger(v.target) && v.target >= 1 && v.target <= 20,
        '次数须为 1–20',
      );
      must(validDate(v.start), '开始日期无效');
      must(!v.end || (v.end >= v.start && validDate(v.end)), '结束日期无效');
      must(
        v.frequency !== 'days' ||
          (Array.isArray(v.days) &&
            v.days.length &&
            v.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)),
        '至少选择一个星期',
      );
      must(
        v.frequency !== 'interval' ||
          (Number.isInteger(v.interval) &&
            v.interval >= 1 &&
            v.interval <= 365),
        '间隔须为 1–365 天',
      );
      must(
        ['active', 'paused', 'mastered', 'archived'].includes(v.status),
        '习惯状态无效',
      );
      must(
        Array.isArray(v.times) &&
          v.times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)),
        '时间格式应为 HH:MM',
      );
      must(!v.goalId || (typeof v.goalId === 'string' && v.goalId.length <= 80), '目标关联无效');
      const h = {
        id: v.id || uid(),
        goalId: v.goalId || '',
        name: text(v.name, 40),
        category: text(v.category, 20),
        criteria: text(v.criteria, 200),
        frequency: v.frequency,
        days: v.days || [],
        interval: v.interval || 1,
        target: v.target,
        points: v.points,
        start: v.start,
        end: v.end || '',
        status: v.status,
        times: [...new Set(v.times)].sort(),
        remind: !!v.remind,
        updatedAt: now,
      };
      const i = s.habits.findIndex((x) => x.id === h.id);
      if (i >= 0) s.habits[i] = h;
      else s.habits.push(h);
      add({
        kind: 'habit',
        reason: `${i < 0 ? '新建' : '调整'}习惯：${h.name}`,
      });
      break;
    }
    case 'habitDelete': {
      const i = s.habits.findIndex((h) => h.id === cmd.id);
      must(i >= 0, '培养计划不存在');
      const [h] = s.habits.splice(i, 1);
      add({ kind: 'habit', reason: `删除习惯：${h.name}` });
      break;
    }
    case 'goalTemplateSave': {
      const v = cmd.value;
      must(text(v.name, 40), '请填写习惯名称');
      must(
        Number.isInteger(v.points) && v.points >= 1 && v.points <= 1000,
        '奖励分数无效',
      );
      must(
        Number.isInteger(v.target) && v.target >= 1 && v.target <= 20,
        '目标次数无效',
      );
      must(
        ['daily', 'days', 'interval', 'weekly'].includes(v.frequency),
        '目标频率无效',
      );
      must(
        Array.isArray(v.times) &&
          v.times.length <= 24 &&
          v.times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)),
        '目标时间无效',
      );
      must(
        v.frequency !== 'days' || (Array.isArray(v.days) && v.days.length),
        '至少选择一个星期',
      );
      must(
        v.frequency !== 'interval' ||
          (Number.isInteger(v.interval) &&
            v.interval >= 1 &&
            v.interval <= 365),
        '间隔天数无效',
      );
      const id = cmd.id || 'goal-' + uid();
      must(/^goal-[a-f0-9-]+$/.test(id), '目标编号无效');
      const g = {
        id,
        name: text(v.name, 40),
        category: text(v.category, 20),
        criteria: text(v.criteria, 200),
        frequency: v.frequency,
        days: Array.isArray(v.days) ? v.days : [],
        interval: Number.isInteger(v.interval) ? v.interval : 1,
        target: v.target,
        points: v.points,
        times: v.times,
        remind: !!v.remind,
      };
      const i = s.goalTemplates.findIndex((x) => x.id === id);
      if (i >= 0) s.goalTemplates[i] = g;
      else s.goalTemplates.push(g);
      result.goalId = id;
      break;
    }
    case 'rename': {
      const p = s.pets.find((x) => x.id === cmd.id);
      const petName = String(cmd.name ?? '').trim();
      must(p && petName && petName.length <= NAME_LIMITS.pet, `伙伴名字最多 ${NAME_LIMITS.pet} 个字`);
      const old = p.name;
      p.name = petName;
      add({ kind: 'rename', petId: p.id, reason: `${old}改名为${p.name}` });
      break;
    }
    case 'memoryNote': {
      const m = s.memories.find((m) => m.id === cmd.id && m.kind === 'photo');
      must(m, '照片记录不存在');
      m.text = text(cmd.text, 500);
      if (m.source === 'exploration') m.diary = true;
      break;
    }
    case 'memory': {
      must(
        s.pets.some((p) => p.id === cmd.petId),
        '请先领养',
      );
      must(['audio', 'photo', 'note'].includes(cmd.kind), '纪念类型无效');
      must(
        cmd.kind === 'note'
          ? text(cmd.text, 500)
          : /^[a-f0-9-]+\.(m4a|jpg|png)$/.test(cmd.file),
        '纪念内容无效',
      );
      const p = s.pets.find((p) => p.id === cmd.petId);
      s.memories.push({
        id: uid(),
        petId: p.id,
        kind: cmd.kind,
        file: cmd.file || '',
        text: text(cmd.text, 500),
        at: now,
        level: levelOf(p),
        name: p.name,
      });
      add({
        kind: 'memory',
        petId: p.id,
        reason:
          cmd.kind === 'audio'
            ? '保存了一段成长留言'
            : cmd.kind === 'photo'
              ? '保存了一张伙伴合照'
              : '写下一段成长留言',
      });
      break;
    }
    case 'settings': {
      const v = cmd.value;
      if (v.voiceEnabled !== undefined)
        s.settings.voiceEnabled = !!v.voiceEnabled;
      if (v.travelEnabled !== undefined)
        s.settings.travelEnabled = !!v.travelEnabled;
      if (v.travelMaxHours !== undefined) {
        must(
          Number.isInteger(v.travelMaxHours) &&
            v.travelMaxHours >= 1 &&
            v.travelMaxHours <= 24,
          '最长时间须为1–24小时',
        );
        s.settings.travelMaxHours = v.travelMaxHours;
      }
      if (v.recordDates !== undefined) {
        const d = v.recordDates;
        must(
          (!d.from || validDate(d.from)) &&
            (!d.to || validDate(d.to)) &&
            (!d.from || !d.to || d.from <= d.to),
          '日期范围无效',
        );
        s.settings.recordDates = { from: d.from || '', to: d.to || '' };
      }
      if (v.companion !== undefined) {
        const c = v.companion;
        for (const [k, values] of Object.entries({
          actionMode: ['builtin', 'ai'],
          language: ['zh-CN', 'en-US'],
          proactive: ['quiet', 'moderate', 'lively'],
          habitFocus: ['off', 'gentle', 'active'],
          affection: ['subtle', 'warm', 'enthusiastic'],
        }))
          must(values.includes(c[k]), '陪伴设置无效：' + k);
        must(
          typeof c.chatEnabled === 'boolean' && typeof c.voice === 'boolean',
          '陪伴开关无效',
        );
        s.settings.companion = clone(c);
      }
      if (v.child !== undefined) {
        must(text(v.child, 20), '昵称不能为空');
        s.child = text(v.child, 20);
        s.profiles.find((p) => p.id === s.activeProfileId).name = s.child;
      }
      for (const k of ['habits', 'reduceMotion', 'reduceGlass', 'boarding'])
        if (v[k] !== undefined) s.settings[k] = !!v[k];
      for (const k of ['quietStart', 'quietEnd'])
        if (v[k] !== undefined) {
          must(
            Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 23,
            '睡眠时间无效',
          );
          s.settings[k] = v[k];
        }
      if (v.hungerHours !== undefined) {
        must([12, 24, 48].includes(v.hungerHours), '饥饿阈值无效');
        s.settings.hungerHours = v.hungerHours;
      }
      if (v.lockMinutes !== undefined) {
        must([0, 1, 5, 15].includes(v.lockMinutes), '锁定时间无效');
        s.settings.lockMinutes = v.lockMinutes;
      }
      if (v.theme !== undefined) {
        must(THEME_IDS.includes(v.theme), '主题无效');
        syncThemeAcrossProfiles(s, v.theme);
      }
      if (v.memoryExpanded !== undefined)
        s.settings.memoryExpanded = !!v.memoryExpanded;
      break;
    }
    case 'rules': {
      must(
        Array.isArray(cmd.rules) && cmd.rules.length <= 200,
        '快捷规则最多 200 项',
      );
      s.rules = cmd.rules.map((r) => {
        must(
          text(r.name, 40) &&
            Number.isInteger(r.points) &&
            r.points !== 0 &&
            Math.abs(r.points) <= 1000,
          '规则名称或分值无效',
        );
        // 规则自带图标（新建规则时用户在图标选择器里挑的）：只保留文件名
        // 形式的合法值，其它未知字段仍丢弃；加载时校验只检查 name/points，
        // 带 icon 的规则不受影响，无 icon 的旧规则也不受影响。
        const icon =
          typeof r.icon === 'string' &&
          r.icon.length <= 40 &&
          /^[a-z0-9][a-z0-9-]*\.png$/.test(r.icon)
            ? r.icon
            : '';
        return {
          id: r.id || uid(),
          name: text(r.name, 40),
          points: r.points,
          ...(icon ? { icon } : {}),
        };
      });
      break;
    }
    case 'profileAdd': {
      must(s.profiles.length < 10, '最多可设置 10 位小朋友');
      const name = String(cmd.name ?? '').trim(),
        avatar = String(cmd.avatar ?? '⭐'),
        avatarFile = String(cmd.avatarFile ?? ''),
        birthDate = String(cmd.birthDate ?? ''),
        note = text(cmd.note, 200);
      must(name && name.length <= NAME_LIMITS.child, `小朋友名字最多 ${NAME_LIMITS.child} 个字`);
      must(
          avatar.length <= 8 &&
          (!avatarFile || /^[a-f0-9-]+\.(jpg|png)$/.test(avatarFile)) &&
          (!birthDate || (validDate(birthDate) && birthDate <= dayKey(now))),
        '孩子资料格式无效',
      );
      const fresh = initialState(now);
      fresh.child = name;
      fresh.settings.theme = s.settings.theme;
      const id = uid();
      s.profiles.push({
        id,
        name,
        avatar,
        avatarFile,
        birthDate,
        note,
        data: profileSnapshot(fresh),
      });
      result.profileId = id;
      break;
    }
    case 'profileUpdate': {
      const p = s.profiles.find((p) => p.id === cmd.id);
      must(p, '孩子档案不存在');
      const name = String(cmd.name ?? '').trim(),
        avatar = String(cmd.avatar ?? '⭐'),
        avatarFile = String(cmd.avatarFile ?? ''),
        birthDate = String(cmd.birthDate ?? ''),
        note = text(cmd.note, 200);
      must(name && name.length <= NAME_LIMITS.child, `小朋友名字最多 ${NAME_LIMITS.child} 个字`);
      must(
          avatar.length <= 8 &&
          (!avatarFile || /^[a-f0-9-]+\.(jpg|png)$/.test(avatarFile)) &&
          (!birthDate || (validDate(birthDate) && birthDate <= dayKey(now))),
        '孩子资料格式无效',
      );
      Object.assign(p, { name, avatar, avatarFile, birthDate, note });
      if (p.id === s.activeProfileId) s.child = name;
      else p.data.child = name;
      break;
    }
    case 'profileSwitch': {
      const p = s.profiles.find((p) => p.id === cmd.id);
      must(p, '孩子档案不存在');
      if (p.id !== s.activeProfileId) {
        const theme = s.settings.theme;
        const active = s.profiles.find((p) => p.id === s.activeProfileId);
        active.data = profileSnapshot(s);
        must(p.data, '目标孩子数据缺失');
        for (const k of profileFields) s[k] = clone(p.data[k]);
        p.data = null;
        s.activeProfileId = p.id;
        s.child = p.name;
        syncThemeAcrossProfiles(s, theme);
      }
      break;
    }
    case 'profileDelete': {
      must(s.profiles.length > 1, '至少保留一位小朋友');
      const index = s.profiles.findIndex((p) => p.id === cmd.id);
      must(index >= 0, '孩子档案不存在');
      const theme = s.settings.theme;
      if (cmd.id === s.activeProfileId) {
        const next = s.profiles.find((p) => p.id !== cmd.id);
        must(next?.data, '下一位小朋友数据缺失');
        for (const k of profileFields) s[k] = clone(next.data[k]);
        s.activeProfileId = next.id;
        s.child = next.name;
        next.data = null;
      }
      s.profiles.splice(index, 1);
      syncThemeAcrossProfiles(s, theme);
      result.profileId = s.activeProfileId;
      break;
    }
    case 'travelStart': {
      must(s.settings.travelEnabled !== false, '探索已关闭');
      must(!s.care.trip, '伙伴正在旅行');
      must(
        s.pets.some((p) => p.id === cmd.petId),
        '请先领养',
      );
      must(/^\d{3}$/.test(cmd.destination), '目的地无效');
      const max = s.settings.travelMaxHours || 5;
      must(
        Number.isFinite(cmd.hours) && cmd.hours >= 1 && cmd.hours <= max,
        '旅行时长无效',
      );
      s.care.trip = {
        id: uid(),
        petId: cmd.petId,
        destination: cmd.destination,
        name: text(cmd.name),
        departAt: now,
        returnAt: now + cmd.hours * 3600000,
      };
      s.care.usedTravel = [
        ...new Set([...(s.care.usedTravel || []), cmd.destination]),
      ];
      break;
    }
    case 'travelReturn': {
      if ((s.care.completedTrips || []).includes(cmd.tripId)) {
        result.alreadyReturned = true;
        break;
      }
      const t = s.care.trip;
      must(t && t.id === cmd.tripId && now >= t.returnAt, '旅行尚未结束');
      must(/^[a-f0-9-]+\.jpg$/.test(cmd.file), '旅行照片无效');
      const p = s.pets.find((p) => p.id === t.petId);
      s.memories.push({
        id: uid(),
        petId: p.id,
        kind: 'photo',
        source: 'exploration',
        destination: t.destination,
        tripId: t.id,
        departAt: t.departAt,
        travelHours: (t.returnAt - t.departAt) / 3600000,
        file: cmd.file,
        diary: true,
        text:
          '今天从成都出发，来到' + t.name + '。看过新风景，带着好心情回家啦！',
        at: t.returnAt,
        level: levelOf(p),
        name: p.name,
        credit: cmd.credit || '',
        albumSaved: cmd.albumSaved === true,
      });
      s.care.completedTrips = [...(s.care.completedTrips || []), t.id];
      s.care.trip = null;
      break;
    }
    case 'memoryDelete': {
      const m = s.memories.find((m) => m.id === cmd.id);
      must(m, '回忆不存在');
      s.memories = s.memories.filter((m) => m.id !== cmd.id);
      break;
    }
    case 'attention':
      s.care.attentionAt = now;
      break;
    case 'clock':
      s.care.clock = now;
      s.care.clockWarning = false;
      break;
    case 'tick':
      for (const m of s.memories) {
        if (m.source === 'habit' && !m.eventId) {
          const candidates = s.events.filter(
            (e) =>
              e.kind === 'plus' &&
              e.habitId &&
              e.at === m.at &&
              e.petId === m.petId,
          );
          if (candidates.length === 1) {
            m.eventId = candidates[0].id;
            m.habitId = candidates[0].habitId;
          }
        }
        if (m.eventId) {
          const reversal = s.events.find(
            (e) => e.kind === 'reverse' && e.ref === m.eventId,
          );
          if (reversal) {
            m.reversedAt = reversal.at;
            m.reverseReason = reversal.reason;
          }
        }
      }
      if (!s.deductionDefaults) {
        if (!s.rules.some((r) => r.points < 0)) s.rules.push(...deductionRules);
        s.deductionDefaults = 1;
      }
      if (!s.ruleCatalogVersion || s.ruleCatalogVersion < 2) {
        const existing = new Set(s.rules.map((r) => r.name));
        for (const rule of [...positiveRules, ...deductionRules])
          if (!existing.has(rule.name)) s.rules.push(rule);
        s.ruleCatalogVersion = 2;
      }
      break;
    default:
      throw Error('未知操作');
  }
  rebuildXP(s);
  validate(s);
  s.revision = before.revision + 1;
  return { state: s, result };
}
export function records(
  s,
  {
    query = '',
    kind = 'all',
    from = '',
    to = '',
    petId = '',
    page = 1,
    size = 20,
  } = {},
) {
  const q = query.toLocaleLowerCase();
  const a = s.events
    .filter(
      (e) =>
        (kind === 'all' ||
          (kind === 'score'
            ? ['plus', 'minus', 'reverse'].includes(e.kind)
            : e.kind === kind)) &&
        (!from || e.day >= from) &&
        (!to || e.day <= to) &&
        (!petId || e.petId === petId) &&
        `${e.reason} ${e.note || ''} ${e.habitName || ''}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .slice()
    .reverse();
  const pages = Math.max(1, Math.ceil(a.length / size));
  page = Math.min(Math.max(1, page), pages);
  return {
    items: a.slice((page - 1) * size, page * size),
    page,
    pages,
    total: a.length,
  };
}
