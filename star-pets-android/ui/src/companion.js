// Pure, deterministic boundary between conversation and the local animation engine.
export const ACTIONS = [
  'idle',
  'wave',
  'nod',
  'nuzzle',
  'dance',
  'jump',
  'cheer',
  'bow',
  'think',
  'listen',
  'eat',
  'sad',
  'sleep',
  'stretch',
  'groom',
  'sniff',
  'lookAround',
];
export const POSES = [
  ['wave', '招招手'],
  ['hug', '抱抱你'],
  ['peek', '偷偷探头'],
  ['cheer', '一起比耶'],
  ['bow', '小小绅士'],
  ['dance', '跳支舞'],
  ['sit', '乖乖坐好'],
  ['jump', '跃起击掌'],
];
export const companionDefaults = {
  chatEnabled: false,
  actionMode: 'builtin',
  language: 'zh-CN',
  proactive: 'quiet',
  habitFocus: 'gentle',
  affection: 'warm',
  voice: true,
};
export function preferences(s) {
  return { ...companionDefaults, ...s };
}
export function sanitizeReply(raw, language = 'zh-CN') {
  let r = raw;
  if (typeof r === 'string') {
    try {
      r = JSON.parse(r.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      r = { text: r };
    }
  }
  const value = String(r?.text || '')
    .replace(/<[^>]*>/g, '')
    .trim();
  const text = language.startsWith('en')
    ? value.split(/\s+/).slice(0, 28).join(' ')
    : Array.from(value).slice(0, 60).join('');
  const mood = ['happy', 'calm', 'curious', 'sleepy', 'sad'].includes(r?.mood)
    ? r.mood
    : 'calm';
  const timeline = [];
  let end = 0;
  for (const item of (Array.isArray(r?.actions) ? r.actions : []).slice(0, 4)) {
    if (!ACTIONS.includes(item.id) || ['sleep', 'sad'].includes(item.id))
      continue;
    const duration = Math.max(
      500,
      Math.min(2400, Number(item.duration) || 1400),
    );
    if (end + duration > 8000) break;
    timeline.push({ id: item.id, at: end, duration });
    end += duration;
  }
  return {
    text,
    mood,
    actions: timeline.length
      ? timeline
      : [{ id: 'nod', at: 0, duration: 1400 }],
  };
}
export function builtinReply(text, context, language = 'zh-CN') {
  const en = language.startsWith('en'),
    s = String(text).toLowerCase();
  let answer = en
      ? 'I’m right here. What made you smile today?'
      : '我在这里呀。今天有什么开心的小事？',
    id = 'nuzzle';
  if (/跳舞|dance/.test(s)) {
    answer = en
      ? 'Let’s dance! Watch my little paws.'
      : '一起跳舞吧！看我的小爪子。';
    id = 'dance';
  } else if (/跳|jump/.test(s)) {
    answer = en ? 'Ready, set, hop! Your turn!' : '准备，跳！轮到你啦。';
    id = 'jump';
  } else if (/难过|伤心|sad|upset/.test(s)) {
    answer = en
      ? 'I’m listening. Want to tell a grown-up together?'
      : '我听着呢。我们一起找爸爸妈妈聊聊好吗？';
    id = 'listen';
  } else if (/晚安|sleep|good night/.test(s)) {
    answer = en
      ? 'Good night. Rest well, little friend.'
      : '晚安，小主人，安心休息吧。';
    id = 'bow';
  } else if (/习惯|计划|habit|plan/.test(s)) {
    const h = context.habits?.find((h) => !h.done);
    answer = h
      ? en
        ? `One little step: ${h.name}. Shall we try?`
        : `今天试试「${h.name}」吧，一小步就很好。`
      : en
        ? 'You can choose a little habit with your family.'
        : '和家人一起选一个小习惯吧。';
    id = 'nod';
  } else if (/完成|做到|finished|did it/.test(s)) {
    answer = en
      ? 'You kept trying! Tell your family about it.'
      : '你认真尝试啦！快和家人分享这份进步。';
    id = 'cheer';
  }
  return sanitizeReply(
    { text: answer, mood: 'happy', actions: [{ id, duration: 2200 }] },
    language,
  );
}
export function chatContext(state, pet, species, hunger, tasks) {
  return {
    pet: {
      name: pet?.name || species.name,
      species: species.name,
      level: pet?.level || 1,
      state: hunger.label,
    },
    habits: tasks.slice(0, 6).map((h) => ({ name: h.name, done: !!h.done })),
    attention: preferences(state.settings.companion),
  };
}
export function nextPose(last = [], random = Math.random) {
  const choices = POSES.map((p) => p[0]).filter(
    (p) => !last.slice(-5).includes(p),
  );
  return choices[Math.floor(random() * choices.length)] || 'wave';
}
export function rulePage(rules, sign, query = '', page = 1, size = 6) {
  const all = rules.filter(
    (r) =>
      (sign > 0 ? r.points > 0 : r.points < 0) &&
      r.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(all.length / size)),
    current = Math.max(1, Math.min(pages, page));
  return {
    items: all.slice((current - 1) * size, current * size),
    pages,
    page: current,
    total: all.length,
  };
}

const poseHistory = [];
export function choosePhotoPose() {
  const p = nextPose(poseHistory);
  poseHistory.push(p);
  if (poseHistory.length > 5) poseHistory.shift();
  return p;
}
