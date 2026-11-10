import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, initialState, validate } from '../ui/src/model.js';

test('first adoption records the portrait and greeting as one state change', () => {
  const before = initialState();
  const { state, result } = apply(before, {
    type: 'adopt',
    species: 'cat',
    name: '星纹小猫',
    firstPhoto: 'a1b2c3d4.jpg',
    wish: '愿我们一起发现新世界。',
  });
  assert.equal(before.pets.length, 0);
  assert.equal(before.memories.length, 0);
  assert.equal(state.memories.length, 1);
  assert.deepEqual(
    {
      petId: state.memories[0].petId,
      kind: state.memories[0].kind,
      source: state.memories[0].source,
      file: state.memories[0].file,
      text: state.memories[0].text,
    },
    {
      petId: result.petId,
      kind: 'photo',
      source: 'adoption',
      file: 'a1b2c3d4.jpg',
      text: '第一次相遇 · 愿我们一起发现新世界。',
    },
  );
  assert.equal(state.events.filter((event) => event.kind === 'memory').length, 1);
  assert.doesNotThrow(() => validate(state));
});

test('invalid first-meeting photo prevents adoption', () => {
  assert.throws(() =>
    apply(initialState(), {
      type: 'adopt',
      species: 'cat',
      name: '星纹小猫',
      firstPhoto: '../broken.jpg',
    }),
  );
});
