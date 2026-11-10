import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, deductionRules } from '../ui/src/model.js';
import {
  sanitizeReply,
  builtinReply,
  rulePage,
  POSES,
  nextPose,
  preferences,
} from '../ui/src/companion.js';
test('legacy default deductions migrate once and deleted rules stay deleted', () => {
  const s = initialState();
  delete s.deductionDefaults;
  s.rules = s.rules.filter((r) => r.points > 0);
  const a = apply(s, { type: 'tick' }).state;
  assert.equal(a.rules.filter((r) => r.points < 0).length, deductionRules.length);
  const b = apply(a, { type: 'rules', rules: [] }).state;
  assert.equal(apply(b, { type: 'tick' }).state.rules.length, 0);
});
test('rule search separates signs and clamps pages after filtering', () => {
  const rules = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    name: 'rule ' + i,
    points: i % 2 ? 3 : -3,
  }));
  assert.equal(rulePage(rules, 1, '', 9).page, 9);
  assert.equal(rulePage(rules, -1, 'rule 98', 99).page, 1);
  assert.equal(rulePage(rules, -1, 'rule 98', 99).items[0].name, 'rule 98');
  assert.equal(rulePage(rules, 1, 'missing').total, 0);
  assert.equal(rulePage(rules, 1, '', 1).items.length, 6);
});
test('default daily performances provide two full pages for each score direction', () => {
  const rules = initialState().rules;
  for (const sign of [1, -1]) {
    const first = rulePage(rules, sign, '', 1, 8);
    const second = rulePage(rules, sign, '', 2, 8);
    assert.equal(first.pages, 2);
    assert.equal(first.items.length, 8);
    assert.equal(second.items.length, 8);
  }
});
test('AI choreography allows only bounded known actions and never executable payloads', () => {
  const r = sanitizeReply({
    text: '你好'.repeat(100),
    mood: 'evil',
    actions: [
      { id: 'eval', code: 'alert(1)' },
      { id: 'dance', duration: 1e50 },
      { id: 'jump', duration: -500 },
      { id: 'sleep', duration: 100 },
    ],
  });
  assert.equal(Array.from(r.text).length, 60);
  assert.equal(r.mood, 'calm');
  assert.deepEqual(r.actions, [
    { id: 'dance', at: 0, duration: 2400 },
    { id: 'jump', at: 2400, duration: 500 },
  ]);
  assert.equal(
    r.actions.some((a) => 'code' in a),
    false,
  );
});
test('malformed AI content falls back to a valid local plan', () => {
  assert.equal(sanitizeReply('plain answer').text, 'plain answer');
  assert.equal(sanitizeReply(null).actions[0].id, 'nod');
  assert.ok(
    sanitizeReply(
      { text: Array(100).fill('hello').join(' ') },
      'en-US',
    ).text.split(' ').length <= 28,
  );
});
test('local bilingual replies and six-pose repeat avoidance work without API', () => {
  assert.match(builtinReply('跳舞', {}, 'zh-CN').text, /跳舞/);
  assert.equal(builtinReply('dance', {}, 'en-US').actions[0].id, 'dance');
  assert.equal(builtinReply('sad', {}, 'en-US').actions[0].id, 'listen');
  let history = [];
  for (let i = 0; i < 30; i++) {
    const next = nextPose(history, () => 0.1);
    assert.ok(!history.slice(-5).includes(next));
    assert.ok(POSES.some((p) => p[0] === next));
    history.push(next);
  }
});
test('companion settings persist, reject unsupported modes, and never change score', () => {
  let s = initialState();
  s = apply(s, {
    type: 'settings',
    value: {
      companion: { ...preferences(), language: 'en-US', actionMode: 'ai' },
    },
  }).state;
  assert.equal(s.settings.companion.language, 'en-US');
  assert.equal(s.events.length, 0);
  assert.throws(() =>
    apply(s, {
      type: 'settings',
      value: { companion: { ...preferences(), actionMode: 'javascript' } },
    }),
  );
  const a = apply(s, { type: 'attention' }, Date.now()).state;
  assert.ok(a.care.attentionAt);
  assert.equal(a.events.length, 0);
});
