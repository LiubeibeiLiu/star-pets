import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  migrateThemeState,
  normalizeThemeId,
  themes,
} from '../ui/src/theme-config.js';

test('theme catalog exposes dayflower blue, starry black, lavender purple, milo warm, and azure blue', () => {
  assert.equal(DEFAULT_THEME_ID, 'milo');
  assert.deepEqual(THEME_IDS, ['dayflower', 'starry', 'lavender', 'milo', 'azure']);
  assert.deepEqual(
    themes.map(({ name, colors }) => [name, ...colors]),
    [
      ['露草蓝', '#0079FF', '#64ADFF', '#AED3FF'],
      ['星夜黑', '#000000', '#BFCBD9', '#E4E8EF'],
      ['星雾紫', '#7C5CE6', '#B39EF5', '#EDE7FB'],
      ['暖陶 Milo', '#F2A88A', '#E8A85C', '#F7EDE3'],
      ['蔚蓝', '#2B6CF6', '#FF8A3D', '#F2F6FC'],
    ],
  );
  assert.equal(normalizeThemeId('milo'), 'milo');
  assert.equal(themes.find((theme) => theme.id === 'milo').background, '#F7EDE3');
  assert.equal(normalizeThemeId('azure'), 'azure');
  assert.equal(themes.find((theme) => theme.id === 'azure').background, '#F2F6FC');
});

test('legacy themes migrate deterministically across child profiles', () => {
  const state = {
    settings: { theme: 'mint' },
    profiles: [
      { data: null },
      { data: { settings: { theme: 'dark' } } },
      { data: { settings: { theme: 'grape' } } },
      { data: { settings: {} } },
    ],
  };
  assert.equal(migrateThemeState(state), true);
  assert.equal(state.settings.theme, 'dayflower');
  assert.equal(state.profiles[1].data.settings.theme, 'starry');
  assert.equal(state.profiles[2].data.settings.theme, 'lavender');
  // No legacy mapping for an empty setting: it falls back to the new default.
  assert.equal(state.profiles[3].data.settings.theme, 'milo');
  assert.equal(migrateThemeState(state), false);
  assert.equal(normalizeThemeId('unknown'), 'milo');
  assert.equal(normalizeThemeId('milo'), 'milo');
});
