import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../ui/src/ChatPanel.vue', import.meta.url),
  'utf8',
)
  .match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  .replace(/import .*?from ['"][^'"]+['"];?/g, '');
const js = ts.transpile(
  source +
    '\nreturn {beginHold,moveHold,endHold,releaseHold,stage,draft,holding,notice};',
  { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
);
function setup(delayedCancel = false) {
  const calls = [];
  let releaseCancel, resolveListen, rejectListen;
  const native = (name) => {
    calls.push(name);
    if (name === 'voiceCancel') {
      if (rejectListen) rejectListen(Error('cancelled'));
      if (delayedCancel) {
        delayedCancel = false;
        return new Promise((r) => (releaseCancel = r));
      }
      return Promise.resolve({});
    }
    if (name === 'voiceListen')
      return new Promise((r, j) => {
        resolveListen = r;
        rejectListen = j;
      });
    if (name === 'voiceStop') {
      resolveListen({ text: '今天整理了玩具' });
      return Promise.resolve({});
    }
    return Promise.resolve({});
  };
  const factory = new Function(
    'ref',
    'watch',
    'onMounted',
    'onBeforeUnmount',
    'nextTick',
    'defineProps',
    'defineEmits',
    'native',
    'isNative',
    js,
  );
  const api = factory(
    (v) => ({ value: v }),
    () => {},
    () => {},
    () => {},
    () => Promise.resolve(),
    () => ({ preferences: { language: 'zh-CN' } }),
    () => () => {},
    native,
    true,
  );
  return { api, calls, release: () => releaseCancel({}) };
}
const press = {
  button: 0,
  pointerId: 1,
  clientY: 200,
  preventDefault() {},
  currentTarget: { setPointerCapture() {} },
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
test('quick release before native cancel finishes never starts recording', async () => {
  const x = setup(true);
  x.api.beginHold(press);
  x.api.endHold();
  x.release();
  await flush();
  assert.deepEqual(x.calls, ['voiceCancel']);
  assert.equal(x.api.holding.value, false);
});
test('hold then release stops capture and fills draft without confirmation notice', async () => {
  const x = setup();
  x.api.beginHold(press);
  await flush();
  assert.equal(x.api.stage.value, 'listening');
  x.api.releaseHold({ pointerId: 1 });
  await flush();
  assert.deepEqual(x.calls, ['voiceCancel', 'voiceListen', 'voiceStop']);
  assert.equal(x.api.draft.value, '今天整理了玩具');
  assert.equal(x.api.notice.value, '');
  assert.equal(x.api.stage.value, 'idle');
});
test('slide up cancels recording and keeps prior text', async () => {
  const x = setup();
  x.api.draft.value = '原有文字';
  x.api.beginHold(press);
  await flush();
  x.api.moveHold({ pointerId: 1, clientY: 140 });
  x.api.endHold();
  await flush();
  assert.deepEqual(x.calls, ['voiceCancel', 'voiceListen', 'voiceCancel']);
  assert.equal(x.api.draft.value, '原有文字');
  assert.equal(x.api.stage.value, 'idle');
});
test('pointer interruption cancels and cannot submit recognized text', async () => {
  const x = setup();
  x.api.beginHold(press);
  await flush();
  x.api.endHold(true);
  await flush();
  assert.equal(x.api.stage.value, 'idle');
  assert.equal(x.api.draft.value, '');
  assert.equal(x.api.holding.value, false);
});
