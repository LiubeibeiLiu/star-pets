import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PETS } from '../ui/src/catalog.js';
const output = await build({
  entryPoints: ['ui/src/pet-skin.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const { SkinRig, landmarks } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(output.outputFiles[0].text).toString('base64')
);
test('18 original pets × 5 stages bind normalized mesh weights and independent joints', () => {
  for (const pet of PETS)
    for (let frame = 0; frame < 5; frame++) {
      const r = new SkinRig(pet.id, frame);
      const weights = r.mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < weights.count; i++) {
        const total =
          weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
        assert.ok(Math.abs(total - 1) < 0.00001);
      }
      r.pose('idle', 1);
      const root = r.root.rotation.toArray(),
        paw = r.bones[4].rotation.z;
      r.pose('wave', 1);
      assert.notEqual(r.bones[4].rotation.z, paw);
      assert.deepEqual(r.root.rotation.toArray(), root);
      assert.equal(r.bones.length, 15);
      const marks = landmarks(pet.id, frame);
      assert.ok(marks.face.every((n) => n > 0 && n < 1));
      r.dispose();
    }
});
test('eight photo poses differ at joints; speech changes jaw geometry only', () => {
  const r = new SkinRig('cat', 4);
  const signatures = new Set();
  for (const pose of [
    'wave',
    'hug',
    'peek',
    'cheer',
    'bow',
    'dance',
    'sit',
    'jump',
  ]) {
    r.pose(pose, 1.1, 0, true);
    signatures.add(
      JSON.stringify(
        r.bones.map((b) => [...b.rotation.toArray(), ...b.position.toArray()]),
      ),
    );
  }
  assert.equal(signatures.size, 8);
  r.pose('idle', 0, 0);
  const closed = r.bones[2].scale.y;
  r.pose('idle', 0, 0.8);
  assert.ok(r.bones[2].scale.y > closed);
  assert.equal(r.root.scale.x, 1);
  r.dispose();
});

test('ear weights affect original mesh and nuanced poses stay finite with fixed root', () => {
  for (const id of ['cat', 'fish', 'frog']) {
    const r = new SkinRig(id, 0);
    if (id === 'cat') {
      const indices = r.mesh.geometry.getAttribute('skinIndex'),
        weights = r.mesh.geometry.getAttribute('skinWeight');
      let count = 0;
      for (let i = 0; i < indices.count; i++)
        for (let k = 0; k < 4; k++)
          if (indices.array[i * 4 + k] >= 13 && weights.array[i * 4 + k] > 0.01)
            count++;
      assert.ok(count > 0);
    }
    for (const action of [
      'groom',
      'sniff',
      'lookAround',
      'jump',
      'sad',
      'listen',
    ])
      for (const t of [0, 0.3, 0.8, 1.4, 2.2]) {
        r.pose(action, t);
        for (const b of r.bones)
          assert.ok(
            [
              ...b.position.toArray(),
              ...b.quaternion.toArray(),
              ...b.scale.toArray(),
            ].every(Number.isFinite),
          );
        assert.deepEqual(r.root.scale.toArray(), [1, 1, 1]);
      }
    r.dispose();
  }
});
