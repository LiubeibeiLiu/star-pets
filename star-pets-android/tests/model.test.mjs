import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  apply,
  totals,
  activePet,
  bank,
  records,
  habitCount,
  habitDue,
  hunger,
  memoryDisplayText,
  validate,
} from '../ui/src/model.js';
import { PETS, thresholds, levelOf, frameOf } from '../ui/src/catalog.js';
import { findHabitForGoal, goalDisplayName } from '../ui/src/goal-library.js';
const now = new Date('2026-10-29T12:00:00+08:00').getTime();
const step = (s, c, t = now) => apply(s, c, t).state;
const plus = (s, n = 5, extra = {}) =>
  step(s, { type: 'score', points: n, reason: '一次具体进步', ...extra });
const adopt = (s, id = 'cat') =>
  step(s, { type: 'adopt', species: id, name: '小星' });
const habit = (extra = {}) => ({
  name: '阅读',
  category: '学习',
  criteria: '15分钟',
  frequency: 'daily',
  target: 1,
  points: 3,
  start: '2026-10-01',
  end: '',
  status: 'active',
  times: ['19:00'],
  remind: false,
  ...extra,
});
test('an edited selected goal keeps its stable link after the habit is renamed', () => {
  let s = step(initialState(now), {
    type: 'habit',
    value: habit({ goalId: 'builtin-brush', name: '自己刷牙' }),
  });
  const original = s.habits[0];
  s = step(s, {
    type: 'habit',
    value: { ...original, name: '每天读书', criteria: '读完一章', times: ['20:00'] },
  });
  assert.equal(s.habits.length, 1);
  assert.equal(s.habits[0].id, original.id);
  assert.equal(s.habits[0].goalId, 'builtin-brush');
  assert.equal(s.habits[0].name, '每天读书');
  assert.equal(s.habits[0].criteria, '读完一章');
  assert.deepEqual(s.habits[0].times, ['20:00']);
  const goal = { id: 'builtin-brush', name: '自己刷牙' };
  assert.equal(findHabitForGoal(s.habits, goal)?.id, original.id);
  assert.equal(goalDisplayName(s.habits, goal), '每天读书');
  assert.doesNotThrow(() => validate(s));
  const legacy = step(initialState(now), { type: 'habit', value: habit() });
  delete legacy.habits[0].goalId;
  assert.equal(findHabitForGoal(legacy.habits, { id: 'builtin-read', name: '阅读' })?.id, legacy.habits[0].id);
  assert.doesNotThrow(() => validate(legacy));
});
test('18 unique pets, 10 monotone levels, five visible evolution stages', () => {
  assert.equal(PETS.length, 18);
  assert.equal(new Set(PETS.map((p) => p.id)).size, 18);
  assert.ok(!PETS.some((p) => p.id === 'xuanwu'));
  for (let n = 1; n < 30; n++) {
    const ts = thresholds(n);
    assert.equal(ts.length, 10);
    assert.ok(ts.every((v, i) => !i || v > ts[i - 1]));
    if (n > 1) assert.ok(ts[9] > thresholds(n - 1)[9]);
  }
  assert.equal(thresholds(1)[9], 60);
  assert.equal(thresholds(2)[9], 84);
  assert.equal(thresholds(3)[9], 114);
  assert.deepEqual([1, 3, 6, 9, 10].map(frameOf), [0, 1, 2, 3, 4]);
});
test('immutable commands and persistent revision', () => {
  const s = initialState(now),
    before = JSON.stringify(s);
  const a = plus(s);
  assert.equal(JSON.stringify(s), before);
  assert.equal(a.revision, 1);
  assert.equal(totals(a).earned, 5);
});
test('level gates, max overflow and new adoption conserve all points', () => {
  let s = adopt(initialState(now));
  assert.throws(() => adopt(s, 'dog'), /满级/);
  s = plus(s, 65);
  assert.equal(levelOf(s.pets[0]), 10);
  assert.equal(bank(s), 5);
  s = adopt(s, 'dog');
  assert.equal(s.pets[1].xp, 5);
  assert.equal(bank(s), 0);
  assert.equal(totals(s).earned, 65);
  assert.throws(() => adopt(s, 'cat'));
});
test('all pets maxed retains overflow without clearing lifetime score', () => {
  let s = initialState(now);
  let awarded = 0;
  for (const p of PETS) {
    s = adopt(s, p.id);
    const reward = thresholds(s.pets.length)[9] + 10;
    s = plus(s, reward);
    awarded += reward;
  }
  assert.equal(s.pets.length, 18);
  assert.equal(activePet(s), null);
  assert.ok(bank(s) > 0);
  assert.equal(totals(s).earned, awarded);
});
test('deduction preserves XP and can take the balance below zero', () => {
  let s = plus(adopt(initialState(now)), 12);
  s = plus(s, -5);
  assert.deepEqual(totals(s), { earned: 12, deducted: 5, net: 7 });
  assert.equal(s.pets[0].xp, 12);
  s = plus(s, -8);
  assert.deepEqual(totals(s), { earned: 12, deducted: 13, net: -1 });
  assert.equal(s.pets[0].xp, 12);
  assert.throws(() => plus(s, 1, { reason: ' ' }), /原因/);
});
test('duplicate token, decimal, zero, nonfinite, oversized score rejected', () => {
  let s = plus(initialState(now), 5, { token: 'same' });
  assert.throws(() => plus(s, 5, { token: 'same' }), /重复/);
  for (const n of [0, 1.5, NaN, Infinity, 100001])
    assert.throws(() => plus(s, n));
});
test('cross-pet correction replays allocation and preserves adoption history', () => {
  let s = plus(adopt(initialState(now)), 365);
  const event = s.events.find((e) => e.kind === 'plus');
  s = adopt(s, 'dog');
  s = plus(s, 20);
  s = step(s, { type: 'reverse', id: event.id, reason: '误录' });
  assert.equal(s.pets.length, 2);
  assert.equal(s.pets[0].xp, 20);
  assert.equal(s.pets[1].xp, 0);
  assert.equal(activePet(s).species, 'cat');
  assert.throws(() =>
    step(s, { type: 'reverse', id: event.id, reason: '再撤销' }),
  );
});
test('correction can take the balance below zero', () => {
  let s = plus(initialState(now), 5);
  const plusId = s.events[0].id;
  s = plus(s, -5);
  const minusId = s.events[1].id;
  s = step(s, { type: 'reverse', id: plusId, reason: '误记' });
  assert.equal(totals(s).net, -5);
  s = step(s, { type: 'reverse', id: minusId, reason: '撤销扣分' });
  assert.equal(totals(s).net, 0);
});
test('daily rewards exactly once with correction allowing redo', () => {
  let s = step(initialState(now), { type: 'habit', value: habit() });
  const h = s.habits[0];
  s = plus(s, 3, { habitId: h.id, date: '2026-10-29' });
  assert.equal(habitCount(s, h, '2026-10-29'), 1);
  assert.throws(
    () => plus(s, 3, { habitId: h.id, date: '2026-10-29' }),
    /领完/,
  );
  const id = s.events.at(-1).id;
  s = step(s, { type: 'reverse', id, reason: '录错日期' });
  assert.equal(habitCount(s, h, '2026-10-29'), 0);
  s = plus(s, 3, { habitId: h.id, date: '2026-10-29' });
  assert.equal(totals(s).earned, 3);
});
test('habit memories omit empty-note separators and read older entries cleanly', () => {
  let s = adopt(initialState(now));
  s = step(s, { type: 'habit', value: habit() });
  const id = s.habits[0].id;
  s = plus(s, 3, { habitId: id });
  assert.equal(s.memories.at(-1).text, '一次具体进步');
  assert.equal(
    memoryDisplayText({ source: 'habit', text: '一次具体进步 · ' }),
    '一次具体进步',
  );
  s = step(s, { type: 'reverse', id: s.events.at(-1).id, reason: '纠错' });
  s = plus(s, 3, { habitId: id, note: '自己坚持完成' });
  assert.equal(s.memories.at(-1).text, '一次具体进步 · 自己坚持完成');
});
test('weekly target covers multiple days and resets Monday', () => {
  let s = step(initialState(now), {
    type: 'habit',
    value: habit({ frequency: 'weekly', target: 2 }),
  });
  const h = s.habits[0];
  s = plus(s, 3, { habitId: h.id, date: '2026-10-27' });
  s = plus(s, 3, { habitId: h.id, date: '2026-10-28' });
  assert.equal(habitCount(s, h, '2026-10-29'), 2);
  assert.equal(habitCount(s, h, '2026-11-02'), 0);
  assert.throws(() => plus(s, 3, { habitId: h.id, date: '2026-10-29' }));
});
test('schedule ranges, weekday, interval, pause and legacy disabled flag', () => {
  assert.equal(
    habitDue(habit({ frequency: 'days', days: [4] }), '2026-10-29'),
    true,
  );
  assert.equal(
    habitDue(habit({ frequency: 'days', days: [1] }), '2026-10-29'),
    false,
  );
  assert.equal(
    habitDue(habit({ frequency: 'interval', interval: 2 }), '2026-10-29'),
    true,
  );
  assert.equal(habitDue(habit({ status: 'paused' }), '2026-10-29'), false);
  let s = step(initialState(now), { type: 'habit', value: habit() });
  s = step(s, { type: 'settings', value: { habits: false } });
  s = plus(s, 3, { habitId: s.habits[0].id });
  assert.equal(totals(s).earned, 3);
});
test('deleting a plan keeps awarded scores and rejects duplicate deletion', () => {
  let s = step(initialState(now), { type: 'habit', value: habit() });
  const id = s.habits[0].id;
  s = plus(s, 3, { habitId: id });
  s = step(s, { type: 'habitDelete', id });
  assert.equal(s.habits.length, 0);
  assert.equal(totals(s).earned, 3);
  assert.equal(s.events.find((e) => e.kind === 'plus').habitName, '阅读');
  assert.throws(() => step(s, { type: 'habitDelete', id }), /不存在/);
});
test('habit historical names and points remain unchanged', () => {
  let s = step(initialState(now), { type: 'habit', value: habit() });
  let h = s.habits[0];
  s = plus(s, 3, { habitId: h.id });
  s = step(s, { type: 'habit', value: { ...h, name: '新阅读', points: 8 } });
  const e = s.events.find((e) => e.kind === 'plus');
  assert.equal(e.habitName, '阅读');
  assert.equal(e.points, 3);
});
test('custom goals stay in the library until activated and remain isolated by child', () => {
  let s = initialState(now);
  const template = habit({ name: '自定义阅读', criteria: '睡前十分钟' });
  s = step(s, { type: 'goalTemplateSave', value: template });
  assert.equal(s.goalTemplates.length, 1);
  assert.equal(s.habits.length, 0);
  const saved = s.goalTemplates[0];
  assert.equal(saved.name, '自定义阅读');
  s = step(s, { type: 'profileAdd', name: '另一位小朋友' });
  const second = s.profiles.find((p) => p.id !== s.activeProfileId);
  s = step(s, { type: 'profileSwitch', id: second.id });
  assert.equal(s.goalTemplates.length, 0);
  s = step(s, {
    type: 'profileSwitch',
    id: s.profiles.find((p) => p.id !== s.activeProfileId).id,
  });
  assert.equal(s.goalTemplates[0].id, saved.id);
  s = step(s, {
    type: 'habit',
    value: { ...saved, id: '', start: '2026-10-29', end: '', status: 'active' },
  });
  assert.equal(s.habits.length, 1);
  assert.equal(s.goalTemplates.length, 1);
});
test('future backfill and invalid schedule rejected', () => {
  let s = step(initialState(now), { type: 'habit', value: habit() });
  assert.throws(() =>
    plus(s, 3, { habitId: s.habits[0].id, date: '2027-01-01' }),
  );
  for (const v of [
    habit({ target: 0 }),
    habit({ frequency: 'days', days: [] }),
    habit({ times: ['25:01'] }),
    habit({ end: '2020-01-01' }),
  ])
    assert.throws(() => step(s, { type: 'habit', value: v }));
});
test('ration once per day; feed independent of points', () => {
  let s = adopt(initialState(now));
  s.care.clock = now;
  s.care.elapsed = 50 * 3600000;
  s = step(s, { type: 'care', action: 'ration' });
  assert.throws(() => step(s, { type: 'care', action: 'ration' }));
  s = step(s, { type: 'care', action: 'feed' });
  assert.equal(hunger(s, now).stage, 0);
  assert.equal(totals(s).earned, 0);
});
test('sleep/boarding pauses hunger, rollback pauses further decay', () => {
  let s = adopt(initialState(now));
  const start = new Date('2026-10-28T21:00:00+08:00').getTime(),
    end = start + 10 * 3600000;
  s.care.clock = start;
  assert.equal(hunger(s, end).stage, 0);
  s.settings.boarding = true;
  s.care.clock = now;
  assert.equal(hunger(s, now + 72 * 3600000).stage, 0);
  s.settings.boarding = false;
  s = step(s, { type: 'tick' }, now - 600000);
  assert.equal(s.care.clockWarning, true);
  const elapsed = s.care.elapsed;
  s = step(s, { type: 'tick' }, now + 86400000);
  assert.equal(s.care.elapsed, elapsed);
});
test('large history pagination search date and last page clamping', () => {
  let s = initialState(now);
  for (let i = 0; i < 63; i++)
    s = plus(s, 1, { reason: i % 2 ? '阅读' : '整理' });
  assert.equal(records(s).pages, 4);
  assert.equal(records(s, { page: 4 }).items.length, 3);
  assert.equal(records(s, { query: '阅读', page: 100 }).page, 2);
  assert.equal(records(s, { query: '没有', page: 4 }).page, 1);
  assert.equal(records(s, { from: '2030-01-01' }).total, 0);
});
test('nickname rename and memory snapshot survive later changes', () => {
  let s = adopt(initialState(now));
  const p = s.pets[0];
  s = step(s, { type: 'memory', petId: p.id, kind: 'note', text: '你好！' });
  s = step(s, { type: 'rename', id: p.id, name: '团团' });
  assert.equal(s.memories[0].name, '小星');
  assert.equal(s.pets[0].name, '团团');
  assert.throws(() =>
    step(s, { type: 'memory', petId: p.id, kind: 'audio', file: '../secret' }),
  );
});
test('confirmed memory deletion accepts ordinary notes without changing scores', () => {
  let s = adopt(initialState(now));
  s = plus(s, 3);
  s = step(s, {
    type: 'memory',
    petId: s.pets[0].id,
    kind: 'note',
    text: '今天一起进步',
  });
  const id = s.memories[0].id;
  const total = totals(s);
  s = step(s, { type: 'memoryDelete', id });
  assert.equal(s.memories.length, 0);
  assert.deepEqual(totals(s), total);
  assert.throws(() => step(s, { type: 'memoryDelete', id }), /不存在/);
});
test('invalid import state, duplicate ledger and unknown reversal rejected', () => {
  const s = plus(initialState(now));
  assert.throws(() => validate({ ...s, schema: 2 }));
  assert.throws(() => validate({ ...s, events: [s.events[0], s.events[0]] }));
  assert.throws(() =>
    validate({
      ...s,
      events: [
        ...s.events,
        { id: 'bad', kind: 'reverse', at: now, ref: 'missing' },
      ],
    }),
  );
});
test('Vue reactive state works for hunger and immutable commands', async () => {
  const { reactive } = await import('vue');
  const s = reactive(adopt(initialState(now)));
  s.care.clock = now;
  s.care.elapsed = 48 * 3600000;
  assert.equal(hunger(s, now).stage, 2);
  const after = plus(s);
  assert.equal(after.pets[0].xp, 5);
  assert.equal(s.pets[0].xp, 0);
});
test('frequency edits count actual completion days and prevent duplicate rewards', () => {
  let s = step(initialState(now), {
    type: 'habit',
    value: habit({ frequency: 'weekly', target: 1 }),
  });
  const h = s.habits[0];
  s = plus(s, 3, { habitId: h.id, date: '2026-10-29' });
  s = step(s, { type: 'habit', value: { ...h, frequency: 'daily' } });
  assert.equal(habitCount(s, s.habits[0], '2026-10-29'), 1);
  assert.throws(
    () => plus(s, 3, { habitId: h.id, date: '2026-10-29' }),
    /领完/,
  );
});
test('impossible dates rejected even when Date.parse normalizes them', () => {
  for (const date of ['2026-02-30', '2026-02-29', '2026-13-01'])
    assert.throws(() =>
      step(initialState(now), { type: 'habit', value: habit({ start: date }) }),
    );
  let s = step(initialState(now), {
    type: 'habit',
    value: habit({ start: '2026-01-01' }),
  });
  assert.throws(
    () => plus(s, 3, { habitId: s.habits[0].id, date: '2026-02-30' }),
    /日期/,
  );
});
test('corrupt XP, unsafe imported URLs, malformed media and settings rejected', () => {
  const s = adopt(initialState(now));
  let bad = structuredClone(s);
  bad.pets[0].xp = 30;
  assert.throws(() => validate(bad), /经验/);
  bad = structuredClone(s);
  bad.settings.quietStart = 24;
  assert.throws(() => validate(bad), /睡眠/);
  bad = structuredClone(s);
  bad.imports.push({
    id: 'custom-abc',
    frames: 5,
    version: 1,
    sheet: 'https://evil.test/track.png',
  });
  assert.throws(() => validate(bad), /资源/);
  bad = structuredClone(s);
  bad.care.food = -1;
  assert.throws(() => validate(bad), /照料/);
});
test('maxed companions never become hungry', () => {
  let s = plus(adopt(initialState(now)), 360);
  s.care.elapsed = 7 * 86400000;
  assert.equal(hunger(s, now).stage, 0);
  assert.equal(hunger(s, now).label, '满级伙伴 · 自由生活');
});
