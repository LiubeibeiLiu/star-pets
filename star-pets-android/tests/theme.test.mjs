import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  migrateThemeState,
  normalizeThemeId,
  themes,
} from '../ui/src/theme-config.js';

test('theme catalog exposes dayflower blue, starry black, and lavender purple', () => {
  assert.equal(DEFAULT_THEME_ID, 'dayflower');
  assert.deepEqual(THEME_IDS, ['dayflower', 'starry', 'lavender']);
  assert.deepEqual(
    themes.map(({ name, colors }) => [name, ...colors]),
    [
      ['露草蓝', '#0079FF', '#64ADFF', '#AED3FF'],
      ['星夜黑', '#000000', '#BFCBD9', '#E4E8EF'],
      ['星雾紫', '#7C5CE6', '#B39EF5', '#EDE7FB'],
    ],
  );
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
  assert.equal(state.profiles[3].data.settings.theme, 'dayflower');
  assert.equal(migrateThemeState(state), false);
  assert.equal(normalizeThemeId('unknown'), 'dayflower');
});
