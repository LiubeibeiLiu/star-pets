import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOf } from '../ui/src/catalog.js';
test('all ten profile ranks obey star and sun boundaries', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => rankOf(i + 1)),
    [
      { kind: 'star', count: 1 },
      { kind: 'star', count: 2 },
      { kind: 'star', count: 2 },
      { kind: 'star', count: 2 },
      { kind: 'star', count: 3 },
      { kind: 'star', count: 3 },
      { kind: 'star', count: 3 },
      { kind: 'sun', count: 1 },
      { kind: 'sun', count: 1 },
      { kind: 'sun', count: 1 },
    ],
  );
});
