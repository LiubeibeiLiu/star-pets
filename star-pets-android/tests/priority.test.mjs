import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulePage } from '../ui/src/companion.js';
import { normalizeModel } from '../ui/src/cloud-config.js';
import { serialQueue } from '../ui/src/transactions.js';
test('25 rules paginate 12/12/1, filter signs and clamp stale page', () => {
  const rs = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    name: '条款' + i,
    points: 3,
  }));
  rs.push({ id: 'minus', name: '负分', points: -2 });
  assert.equal(rulePage(rs, 1, '', 1, 12).items.length, 12);
  assert.equal(rulePage(rs, 1, '', 2, 12).items[0].id, '12');
  assert.equal(rulePage(rs, 1, '', 3, 12).items.length, 1);
  assert.equal(rulePage(rs, -1, '', 3, 12).page, 1);
  assert.equal(rulePage(rs, 1, '条款24', 3, 12).items[0].id, '24');
});
test('DeepSeek config fixes official endpoint, retains saved key and rejects invalid data', () => {
  const base = {
    name: '小伙伴',
    provider: 'deepseek',
    endpoint: 'https://bad.example',
    model: 'deepseek-flash',
    key: 'test-only-key',
  };
  assert.equal(normalizeModel(base).endpoint, 'https://api.deepseek.com');
  assert.equal(normalizeModel({ ...base, key: '', hasKey: true }).key, '');
  assert.throws(() => normalizeModel({ ...base, key: '' }), /API Key/);
  assert.throws(() => normalizeModel({ ...base, key: 'abc def' }), /格式/);
  assert.throws(
    () =>
      normalizeModel({
        ...base,
        provider: 'compatible',
        endpoint: 'http://example.com',
      }),
    /模型名称/,
  );
  assert.throws(
    () =>
      normalizeModel({
        ...base,
        provider: 'compatible',
        endpoint: 'https://user:pass@example.com',
      }),
    /模型名称/,
  );
});
test('serial state saves preserve ordering and recover after rejected write', async () => {
  const q = serialQueue(),
    order = [];
  let release;
  const wait = new Promise((r) => (release = r));
  const a = q(async () => {
    order.push('save1');
    await wait;
    order.push('done1');
    return 1;
  });
  const b = q(async () => {
    order.push('switch');
    throw Error('save failure');
  });
  const caught = b.catch((e) => e.message);
  const c = q(async () => {
    order.push('return');
    return 3;
  });
  await Promise.resolve();
  assert.deepEqual(order, ['save1']);
  release();
  assert.equal(await a, 1);
  assert.equal(await caught, 'save failure');
  assert.equal(await c, 3);
  assert.deepEqual(order, ['save1', 'done1', 'switch', 'return']);
});

test('Gemini uses fixed official endpoint and does not accept custom names or models', () => {
  const c = normalizeModel({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    name: 'ignored',
    endpoint: 'https://bad.example',
    key: 'test-key',
  });
  assert.equal(c.name, 'Gemini');
  assert.equal(
    c.endpoint,
    'https://generativelanguage.googleapis.com/v1beta/openai',
  );
  assert.throws(() => normalizeModel({ ...c, model: 'custom' }), /模型版本/);
  assert.throws(
    () => normalizeModel({ ...c, key: '', hasKey: false }),
    /API Key/,
  );
});
