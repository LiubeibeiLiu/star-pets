import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply, positiveRules, deductionRules } from '../ui/src/model.js';
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
test('default daily performances paginate by catalog size', () => {
  const rules = initialState().rules;
  // v2 目录：加分 25 条、减分 21 条；每页 8 条时加分 4 页、减分 3 页。
  const plusPages = rulePage(rules, 1, '', 1, 8);
  const minusPages = rulePage(rules, -1, '', 1, 8);
  assert.equal(plusPages.pages, Math.ceil(positiveRules.length / 8));
  assert.equal(minusPages.pages, Math.ceil(deductionRules.length / 8));
  assert.equal(plusPages.items.length, 8);
  assert.equal(rulePage(rules, 1, '', plusPages.pages, 8).items.length, 1);
  assert.equal(rulePage(rules, -1, '', minusPages.pages, 8).items.length, 5);
});
test('rule catalog v2 migration adds the new daily rules once', () => {
  const s = initialState();
  assert.equal(s.rules.length, positiveRules.length + deductionRules.length);
  assert.equal(s.ruleCatalogVersion, 2);
  // 模拟 v1 存量档案：只有旧 32 条、版本 1。
  const oldIds = new Set([
    'tidy', 'read', 'help', 'brave', 'kind', 'rule-focus', 'rule-toys',
    'rule-greet', 'rule-share', 'rule-water', 'rule-sleep', 'rule-table',
    'rule-polite', 'rule-persist', 'rule-ready', 'rule-listen',
    'rule-push', 'rule-break', 'rule-unkind', 'rule-agreement', 'rule-danger',
    'rule-mess', 'rule-lie', 'rule-shout', 'rule-delay', 'rule-screen',
    'rule-waste', 'rule-rude', 'rule-homework', 'rule-bedtime', 'rule-grab',
    'rule-ignore',
  ]);
  s.rules = s.rules.filter((r) => oldIds.has(r.id));
  assert.equal(s.rules.length, 32);
  s.ruleCatalogVersion = 1;
  const migrated = apply(s, { type: 'tick' }).state;
  assert.equal(migrated.rules.length, 46);
  assert.equal(migrated.ruleCatalogVersion, 2);
  assert.ok(migrated.rules.some((r) => r.id === 'rule-brush'));
  assert.ok(migrated.rules.some((r) => r.id === 'rule-tantrum'));
  // 再 tick 一次不再重复添加。
  assert.equal(apply(migrated, { type: 'tick' }).state.rules.length, 46);
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
