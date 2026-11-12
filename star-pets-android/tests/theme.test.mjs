import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  migrateThemeState,
  normalizeThemeId,
  themes,
} from '../ui/src/theme-config.js';
import { initialState, apply } from '../ui/src/model.js';

test('theme catalog keeps azure as 露草蓝 and drops dayflower/starry', () => {
  assert.equal(DEFAULT_THEME_ID, 'azure');
  assert.deepEqual(THEME_IDS, ['azure', 'lavender', 'milo']);
  assert.deepEqual(
    themes.map(({ id, name, colors }) => [id, name, ...colors]),
    [
      ['azure', '露草蓝', '#2B6CF6', '#FF8A3D', '#F2F6FC'],
      ['lavender', '星雾紫', '#7C5CE6', '#B39EF5', '#EDE7FB'],
      ['milo', '暖陶 Milo', '#F2A88A', '#E8A85C', '#F7EDE3'],
    ],
  );
  assert.equal(normalizeThemeId('milo'), 'milo');
  assert.equal(normalizeThemeId('azure'), 'azure');
  assert.equal(normalizeThemeId('dayflower'), 'azure');
  assert.equal(normalizeThemeId('starry'), 'azure');
  assert.equal(normalizeThemeId('unknown'), 'azure');
  assert.equal(themes.find((theme) => theme.id === 'azure').name, '露草蓝');
  assert.equal(initialState(Date.now()).settings.theme, 'azure');
});

test('legacy themes migrate and then unify across child profiles', () => {
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
  assert.equal(state.settings.theme, 'azure');
  assert.equal(state.profiles[1].data.settings.theme, 'azure');
  assert.equal(state.profiles[2].data.settings.theme, 'azure');
  assert.equal(state.profiles[3].data.settings.theme, 'azure');
  assert.equal(migrateThemeState(state), false);
});

test('theme setting applies to every child profile and survives switches', () => {
  const now = new Date('2026-10-29T12:00:00+08:00').getTime();
  let s = initialState(now);
  const first = s.activeProfileId;
  s = apply(s, { type: 'profileAdd', name: '小月', avatar: '🌙' }, now).state;
  const second = s.profiles.find((p) => p.id !== first).id;
  s = apply(s, { type: 'settings', value: { theme: 'milo' } }, now).state;
  assert.equal(s.settings.theme, 'milo');
  assert.equal(s.profiles.find((p) => p.id === second).data.settings.theme, 'milo');
  s = apply(s, { type: 'profileSwitch', id: second }, now).state;
  assert.equal(s.settings.theme, 'milo');
  assert.equal(s.profiles.find((p) => p.id === first).data.settings.theme, 'milo');
  s = apply(s, { type: 'settings', value: { theme: 'lavender' } }, now).state;
  s = apply(s, { type: 'profileSwitch', id: first }, now).state;
  assert.equal(s.settings.theme, 'lavender');
});
