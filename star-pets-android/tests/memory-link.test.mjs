import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, totals } from '../ui/src/model.js';
test('habit memory links to score, reversal is visible, repeated reversal rejected', () => {
  const now = Date.now();
  let s = initialState(now);
  const go = (c) => (s = apply(s, c, now).state);
  go({ type: 'adopt', species: 'cat', name: '小猫' });
  go({
    type: 'habit',
    value: {
      name: '阅读',
      frequency: 'daily',
      target: 1,
      points: 3,
      start: '2026-01-01',
      end: '',
      status: 'active',
      times: [],
      days: [],
      interval: 1,
    },
  });
  go({
    type: 'score',
    habitId: s.habits[0].id,
    points: 3,
    reason: '阅读',
    note: '独立完成',
  });
  const memory = s.memories[0],
    event = s.events.find((e) => e.id === memory.eventId);
  assert.equal(event.kind, 'plus');
  go({ type: 'reverse', id: event.id, reason: '误记' });
  assert.equal(s.memories[0].reverseReason, '误记');
  assert.equal(s.memories[0].reversedAt, now);
  assert.equal(totals(s).net, 0);
  assert.throws(() => go({ type: 'reverse', id: event.id, reason: '重复' }));
  const legacy = structuredClone(s);
  delete legacy.memories[0].eventId;
  delete legacy.memories[0].reversedAt;
  delete legacy.memories[0].reverseReason;
  const migrated = apply(legacy, { type: 'tick' }, now).state;
  assert.equal(migrated.memories[0].eventId, event.id);
  assert.equal(migrated.memories[0].reverseReason, '误记');
});

test('only current calendar month is reversible; prior month rejected without mutation', () => {
  const now = new Date(2026, 9, 29, 12).getTime();
  let s = initialState(now);
  s = apply(s, { type: 'adopt', species: 'cat', name: '小猫' }, now).state;
  s = apply(
    s,
    { type: 'score', points: 5, reason: '上月', date: '2026-09-30' },
    now,
  ).state;
  const id = s.events.at(-1).id,
    before = JSON.stringify(s);
  assert.throws(
    () => apply(s, { type: 'reverse', id, reason: '纠错' }, now),
    /本月/,
  );
  assert.equal(JSON.stringify(s), before);
  s = apply(
    s,
    { type: 'score', points: 3, reason: '本月', date: '2026-10-01' },
    now,
  ).state;
  const currentId = s.events.at(-1).id;
  s = apply(s, { type: 'reverse', id: currentId, reason: '纠错' }, now).state;
  assert.equal(s.pets[0].xp, 5);
  s = apply(s, { type: 'score', points: -2, reason: '扣分' }, now).state;
  const minusId = s.events.at(-1).id;
  s = apply(s, { type: 'reverse', id: minusId, reason: '纠错' }, now).state;
  assert.equal(totals(s).net, 5);
  assert.equal(s.pets[0].xp, 5);
});

test('targeted reversal reduces only selected pet, clamps zero and subsequent score refills it', () => {
  const now = Date.now();
  let s = initialState(now);
  const go = (c) => (s = apply(s, c, now).state);
  go({ type: 'adopt', species: 'cat', name: '小猫' });
  go({ type: 'score', points: s.pets[0].thresholds[9], reason: '第一只满级' });
  const firstScore = s.events.at(-1).id;
  go({ type: 'adopt', species: 'frog', name: '小蛙' });
  go({ type: 'score', points: 5, reason: '第二只成长' });
  const firstXp = s.pets[0].xp,
    second = s.pets[1].id;
  go({
    type: 'reverse',
    id: firstScore,
    targetPetId: second,
    reason: '当前伙伴扣回',
  });
  assert.equal(s.pets[0].xp, firstXp);
  assert.equal(s.pets[1].xp, 0);
  go({ type: 'score', points: 3, reason: '继续培养' });
  assert.equal(s.pets[0].xp, firstXp);
  assert.equal(s.pets[1].xp, 3);
});
