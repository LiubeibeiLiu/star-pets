import test from 'node:test';
import assert from 'node:assert/strict';
import { thresholds, levelOf } from '../ui/src/catalog.js';
import {
  initialState,
  apply,
  totals,
  validate,
  bank,
} from '../ui/src/model.js';
test('growth starts gently and each successive pet requires more experience', () => {
  assert.deepEqual(thresholds(1), [0, 2, 4, 8, 13, 19, 28, 38, 48, 60]);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((n) => thresholds(n)[9]),
    [60, 84, 114, 150, 192, 240],
  );
  for (let n = 1; n <= 500; n++) {
    const t = thresholds(n);
    assert.ok(t.every((v, i) => !i || v > t[i - 1]));
    if (n > 1) assert.ok(t[9] > thresholds(n - 1)[9]);
  }
});
test('photo remarks change independently from scores and stored media', () => {
  let s = apply(initialState(), {
    type: 'adopt',
    species: 'cat',
    name: '小星',
  }).state;
  s = apply(s, {
    type: 'memory',
    petId: s.pets[0].id,
    kind: 'photo',
    file: 'abc-123.jpg',
    text: '初次合照',
  }).state;
  const original = s.memories[0];
  const next = apply(s, {
    type: 'memoryNote',
    id: original.id,
    text: '今天一起跳舞',
  }).state;
  assert.equal(next.memories[0].text, '今天一起跳舞');
  assert.equal(next.memories[0].file, original.file);
  assert.deepEqual(totals(next), totals(s));
  assert.equal(s.memories[0].text, '初次合照');
});
