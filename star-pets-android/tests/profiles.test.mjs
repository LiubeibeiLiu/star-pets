import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, totals, validate, NAME_LIMITS } from '../ui/src/model.js';

const now = new Date('2026-10-29T12:00:00+08:00').getTime();
const command = (state, value) => apply(state, value, now);

test('new child and pet names have enforced length limits', () => {
  let s = initialState(now);
  assert.throws(
    () => command(s, { type: 'profileAdd', name: '123456789' }),
    /小朋友名字最多 8 个字/,
  );
  s = command(s, { type: 'profileAdd', name: '12345678' }).state;
  assert.equal(s.profiles[1].name.length, NAME_LIMITS.child);
  assert.throws(
    () => command(s, { type: 'profileUpdate', id: s.profiles[1].id, name: '123456789' }),
    /小朋友名字最多 8 个字/,
  );
  assert.throws(
    () => command(s, { type: 'adopt', species: 'cat', name: '12345678901' }),
    /伙伴名字最多 10 个字/,
  );
  s = command(s, { type: 'adopt', species: 'cat', name: '1234567890' }).state;
  assert.equal(s.pets[0].name.length, NAME_LIMITS.pet);
  assert.throws(
    () => command(s, { type: 'rename', id: s.pets[0].id, name: '12345678901' }),
    /伙伴名字最多 10 个字/,
  );
});

test('old single-child data migrates without changing its scores', () => {
  let old = initialState(now);
  old = command(old, { type: 'score', points: 7, reason: '整理书包' }).state;
  delete old.profiles;
  delete old.activeProfileId;
  const result = command(old, { type: 'tick' }).state;
  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0].name, '小星星');
  assert.equal(totals(result).earned, 7);
  validate(result);
});

test('two child profiles isolate scores, habits, memories, pets and settings', () => {
  let s = initialState(now);
  s = command(s, { type: 'adopt', species: 'cat', name: '星纹小猫' }).state;
  s = command(s, { type: 'score', points: 9, reason: '独立整理' }).state;
  s = command(s, {
    type: 'habit',
    value: {
      name: '阅读',
      category: '学习',
      criteria: '十五分钟',
      frequency: 'daily',
      days: [],
      interval: 1,
      target: 1,
      points: 3,
      start: '2026-10-01',
      end: '',
      status: 'active',
      times: [],
      remind: false,
    },
  }).state;
  const first = s.activeProfileId;
  const added = command(s, {
    type: 'profileAdd',
    name: '小月',
    avatar: '🌙',
    birthDate: '2020-03-01',
    note: '喜欢读书',
  });
  s = command(added.state, {
    type: 'profileSwitch',
    id: added.result.profileId,
  }).state;
  assert.equal(s.child, '小月');
  assert.equal(totals(s).earned, 0);
  assert.equal(s.pets.length, 0);
  assert.equal(s.habits.length, 0);
  s = command(s, { type: 'score', points: 4, reason: '主动打招呼' }).state;
  s = command(s, { type: 'settings', value: { reduceMotion: true, theme: 'milo' } }).state;
  s = command(s, { type: 'profileSwitch', id: first }).state;
  assert.equal(s.child, '小星星');
  assert.equal(totals(s).earned, 9);
  assert.equal(s.pets.length, 1);
  assert.equal(s.habits.length, 1);
  assert.equal(s.settings.reduceMotion, false);
  // Theme is household-wide; other settings stay per child.
  assert.equal(s.settings.theme, 'milo');
  s = command(s, { type: 'profileSwitch', id: added.result.profileId }).state;
  assert.equal(totals(s).earned, 4);
  assert.equal(s.settings.reduceMotion, true);
  assert.equal(s.settings.theme, 'milo');
  validate(s);
});

test('manual score date is preserved and invalid future date is rejected', () => {
  const s = initialState(now);
  const result = command(s, {
    type: 'score',
    points: 3,
    reason: '补记一次表现',
    date: '2026-10-20',
  }).state;
  assert.equal(result.events[0].day, '2026-10-20');
  assert.throws(
    () =>
      command(s, {
        type: 'score',
        points: 3,
        reason: '将来',
        date: '2027-01-01',
      }),
    /日期/,
  );
});

test('deleting a child preserves the remaining active profile and forbids deleting the last child', () => {
  let s = initialState(now);
  assert.throws(
    () => command(s, { type: 'profileDelete', id: s.activeProfileId }),
    /至少保留/,
  );
  s = command(s, { type: 'score', points: 7, reason: '第一位的记录' }).state;
  const first = s.activeProfileId;
  const added = command(s, { type: 'profileAdd', name: '小月', avatar: '🌙' });
  s = command(added.state, {
    type: 'profileSwitch',
    id: added.result.profileId,
  }).state;
  s = command(s, { type: 'score', points: 4, reason: '第二位的记录' }).state;
  s = command(s, { type: 'profileDelete', id: first }).state;
  assert.equal(s.profiles.length, 1);
  assert.equal(s.child, '小月');
  assert.equal(totals(s).earned, 4);
  validate(s);
  const third = command(s, { type: 'profileAdd', name: '小星', avatar: '⭐' });
  s = command(third.state, {
    type: 'profileDelete',
    id: s.activeProfileId,
  }).state;
  assert.equal(s.activeProfileId, third.result.profileId);
  assert.equal(s.child, '小星');
  assert.equal(totals(s).earned, 0);
  validate(s);
});
