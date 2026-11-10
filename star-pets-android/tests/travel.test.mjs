import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, apply } from '../ui/src/model.js';
test('travel persists deadline, marks use, returns once and deletes memory without resetting usage', () => {
  const now = Date.now();
  let s = apply(
    initialState(now),
    { type: 'adopt', species: 'cat', name: '小猫' },
    now,
  ).state;
  const id = s.pets[0].id;
  s = apply(
    s,
    {
      type: 'travelStart',
      petId: id,
      destination: '001',
      name: '风景',
      hours: 2,
    },
    now,
  ).state;
  const trip = s.care.trip;
  assert.equal(trip.returnAt, now + 7200000);
  assert.deepEqual(s.care.usedTravel, ['001']);
  assert.throws(() =>
    apply(
      s,
      { type: 'travelStart', petId: id, destination: '002', hours: 1 },
      now,
    ),
  );
  assert.throws(() =>
    apply(s, { type: 'travelReturn', tripId: trip.id, file: 'abc.jpg' }, now),
  );
  s = apply(
    s,
    { type: 'travelReturn', tripId: trip.id, file: 'abc.jpg' },
    now + 7200000,
  ).state;
  assert.equal(s.care.trip, null);
  assert.equal(s.memories[0].source, 'exploration');
  assert.equal(
    apply(
      s,
      { type: 'travelReturn', tripId: trip.id, file: 'abc.jpg' },
      now + 7200000,
    ).result.alreadyReturned,
    true,
  );
  s = apply(
    s,
    { type: 'memoryDelete', id: s.memories[0].id },
    now + 7200000,
  ).state;
  assert.equal(s.memories.length, 0);
  assert.deepEqual(s.care.usedTravel, ['001']);
});

test('return while another child is active writes only origin child and stays idempotent after deletion', () => {
  const now = Date.now();
  let s = initialState(now);
  const go = (c, t = now) => (s = apply(s, c, t).state);
  const first = s.activeProfileId;
  go({ type: 'adopt', species: 'cat', name: '甲猫' });
  go({
    type: 'travelStart',
    petId: s.pets[0].id,
    destination: '001',
    name: '风景',
    hours: 1,
  });
  const trip = s.care.trip;
  go({ type: 'profileAdd', name: '乙', avatar: '⭐' });
  const second = s.profiles[1].id;
  go({ type: 'profileSwitch', id: second });
  go({ type: 'adopt', species: 'frog', name: '乙蛙' });
  go({ type: 'score', points: 3, reason: '乙的努力' });
  const cmd = {
    type: 'travelReturn',
    profileId: first,
    tripId: trip.id,
    file: trip.id + '.jpg',
    albumSaved: true,
  };
  go(cmd, now + 3600001);
  assert.equal(s.activeProfileId, second);
  assert.equal(s.memories.length, 0);
  assert.equal(s.pets[0].name, '乙蛙');
  assert.equal(s.pets[0].xp, 3);
  const data = s.profiles.find((p) => p.id === first).data;
  assert.equal(data.memories.length, 1);
  assert.equal(data.memories[0].name, '甲猫');
  assert.equal(data.care.trip, null);
  go(cmd, now + 3600002);
  assert.equal(s.profiles[0].data.memories.length, 1);
  go({ type: 'profileSwitch', id: first }, now + 3600003);
  go({ type: 'memoryDelete', id: s.memories[0].id }, now + 3600004);
  go(cmd, now + 3600005);
  assert.equal(s.memories.length, 0);
  assert.deepEqual(s.care.usedTravel, ['001']);
});
