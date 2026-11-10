import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleLoginMaintenance } from '../ui/src/login-maintenance.js';

test('login remains successful when the maintenance tick conflicts', async () => {
  let reloaded = 0;
  let notified = 0;
  const result = await settleLoginMaintenance({
    tick: async () => {
      throw Error('版本冲突');
    },
    reload: async () => {
      reloaded++;
    },
    onConflict: () => {
      notified++;
    },
  });
  assert.equal(result, 'reloaded');
  assert.equal(reloaded, 1);
  assert.equal(notified, 1);
});

test('noncritical maintenance failures do not reject login', async () => {
  let deferred = 0;
  const result = await settleLoginMaintenance({
    tick: async () => {
      throw Error('暂时无法保存');
    },
    reload: async () => assert.fail('unexpected reload'),
    onDeferred: () => {
      deferred++;
    },
  });
  assert.equal(result, 'deferred');
  assert.equal(deferred, 1);
});
