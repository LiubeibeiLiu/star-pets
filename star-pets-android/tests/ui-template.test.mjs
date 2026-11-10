import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';

test('self-closing components do not leave visible angle-bracket text nodes', () => {
  const root = new URL('../ui/src/', import.meta.url);
  for (const file of readdirSync(root).filter((name) => name.endsWith('.vue'))) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /\/>\s*>\s*</, file);
  }
});
