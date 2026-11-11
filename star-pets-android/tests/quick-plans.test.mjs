import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initialState,
  apply,
  totals,
  habitCount,
} from '../ui/src/model.js';

const now = new Date('2026-10-29T12:00:00+08:00').getTime();
const today = '2026-10-29';
const step = (s, c, t = now) => apply(s, c, t).state;
const appVue = readFileSync(new URL('../ui/src/App.vue', import.meta.url), 'utf8');
const quickBlock = appVue.slice(
  appVue.indexOf('async function quickComplete'),
  appVue.indexOf('let completeFrom'),
);
const habit = (extra = {}) => ({
  name: '自己刷牙',
  category: '日常自理',
  criteria: '刷干净',
  frequency: 'daily',
  target: 1,
  points: 3,
  start: '2026-10-01',
  end: '',
  status: 'active',
  times: ['08:00'],
  remind: false,
  ...extra,
});
// 与 App.vue buildScoreForm(1, h) 逐字段一致的快速完成载荷。
const quickForm = (h, token = 'quick-test-token') => ({
  points: h.points,
  reason: h.name,
  note: '',
  habitId: h.id,
  date: today,
  completion: '独立完成',
  token,
  sign: 1,
});
const withPetAndHabit = () => {
  let s = step(initialState(now), {
    type: 'adopt',
    species: 'cat',
    name: '小星',
  });
  s = step(s, { type: 'habit', value: habit() });
  return s;
};

test('未领养时今日计划入口与卡片堆都不出现', () => {
  // 入口按钮本身带 v-if="current"；卡片堆所在的 home-zone 也在 v-if="current" 的小窝模板内。
  assert.match(
    appVue,
    /<div v-if="current" class="dock-group" aria-label="今日计划"/,
  );
  const playground = appVue.indexOf('<template v-if="current">');
  const stack = appVue.indexOf('class="today-stack"');
  const empty = appVue.indexOf('<template v-else', playground);
  assert.ok(playground !== -1 && stack !== -1 && empty !== -1);
  assert.ok(playground < stack && stack < empty);
});

test('快速完成与确认框路径分值一致：同一份记分载荷，同一条提交逻辑', () => {
  // 两条路径共用 buildScoreForm，且快速完成直接调 saveScore，不另写计分。
  assert.ok(appVue.includes('form.value = buildScoreForm(sign, h);'));
  assert.ok(quickBlock.includes('const payload = buildScoreForm(1, h);'));
  assert.ok(quickBlock.includes('await saveScore({ silentPet: away.value });'));
  // 全文件只有 score() 一处打开 habitComplete 确认框，快速完成跳过它。
  assert.equal(appVue.split("open('habitComplete'").length - 1, 1);
  assert.ok(!quickBlock.includes("open('habitComplete'"));

  const s0 = withPetAndHabit();
  const h = s0.habits[0];
  const before = totals(s0);
  const s1 = step(s0, { type: 'score', ...quickForm(h) });
  assert.equal(totals(s1).earned - before.earned, h.points);
  assert.equal(totals(s1).net - before.net, h.points);
  assert.equal(habitCount(s1, h, today), 1);
  assert.equal(habitCount(s1, h, today), h.target);
});

test('动画进行中重复点按不重复记分：飞行/提交锁 + 同 token 模型层拒收', () => {
  assert.ok(quickBlock.startsWith('async function quickComplete'));
  assert.match(
    quickBlock,
    /if \(quickBusy\.value \|\| busy\.value\) return;/,
  );
  assert.ok(quickBlock.includes('quickBusy.value = true;'));
  assert.match(
    appVue,
    /:disabled="i !== 0 \|\| quickBusy \|\| busy"/,
  );
  // 同一 token 再提交一次，模型层直接拒收，分值不变。
  const s0 = withPetAndHabit();
  const h = s0.habits[0];
  const s1 = step(s0, { type: 'score', ...quickForm(h) });
  assert.throws(
    () => apply(s1, { type: 'score', ...quickForm(h) }, now),
    /重复提交/,
  );
  assert.equal(totals(s1).earned, totals(s0).earned + h.points);
});

test('reduceMotion 时不启动飞行，只涨数字', () => {
  // 先读 reduceMotion 设置，飞行只在 !reduceMotion 分支里创建 chip。
  const reduceAt = quickBlock.indexOf(
    'const reduceMotion = !!state.value.settings.reduceMotion;',
  );
  const flyAt = quickBlock.indexOf('quickFly.value = {');
  assert.ok(reduceAt !== -1 && flyAt !== -1 && reduceAt < flyAt);
  assert.match(
    quickBlock,
    /if \(!reduceMotion\) \{[\s\S]*?quickFly\.value = \{/,
  );
  // chip 只在 quickFly 存在时渲染；记分调用在飞行分支之外，两种模式都会走。
  assert.match(appVue, /<span\s+v-if="quickFly"\s+[\s\S]*?class="quick-fly-chip num"/);
  assert.ok(quickBlock.includes('await saveScore({ silentPet: away.value });'));
});

test('外出时快速完成只飞进度条，不播宠物反应', () => {
  assert.ok(
    quickBlock.includes('await saveScore({ silentPet: away.value });'),
  );
  assert.match(
    appVue,
    /if \(!opts\?\.silentPet\) animate\(level\.value > old \? 'upgrade' : result\.emotion\);/,
  );
});

test('全部完成显示“今日计划都完成啦”并自动收起卡片区', () => {
  assert.ok(appVue.includes('今日计划都完成啦'));
  assert.ok(appVue.includes('watch(todayGoals, scheduleQuickDoneClose);'));
  assert.match(
    appVue,
    /quickDoneTimer = setTimeout\(\(\) => \{\s*todayOpen\.value = false;\s*\}, 1500\);/,
  );
});
