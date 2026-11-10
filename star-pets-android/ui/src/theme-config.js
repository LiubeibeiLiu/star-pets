export const DEFAULT_THEME_ID = 'dayflower';

export const themes = Object.freeze([
  Object.freeze({
    id: 'dayflower',
    name: '露草蓝',
    description: '明快、温和，适合日常陪伴',
    colors: Object.freeze(['#0079FF', '#64ADFF', '#AED3FF']),
    background: '#FFFFFF',
    darkSurface: false,
  }),
  Object.freeze({
    id: 'starry',
    name: '星夜黑',
    description: '纯净、沉稳，搭配偏蓝灰层次',
    colors: Object.freeze(['#000000', '#BFCBD9', '#E4E8EF']),
    background: '#FFFFFF',
    darkSurface: false,
  }),
  Object.freeze({
    id: 'lavender',
    name: '星雾紫',
    description: '柔和、梦幻，温柔陪伴成长时光',
    colors: Object.freeze(['#7C5CE6', '#B39EF5', '#EDE7FB']),
    background: '#FFFFFF',
    darkSurface: false,
  }),
]);

export const THEME_IDS = Object.freeze(themes.map(({ id }) => id));

const legacyThemes = Object.freeze({
  ocean: 'dayflower',
  light: 'starry',
  dark: 'starry',
  grape: 'lavender',
  mint: 'dayflower',
  lemon: 'dayflower',
  sunny: 'dayflower',
  berry: 'lavender',
});

export function normalizeThemeId(value) {
  if (THEME_IDS.includes(value)) return value;
  return legacyThemes[value] || DEFAULT_THEME_ID;
}

export function migrateThemeState(state) {
  let changed = false;
  const migrateSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return;
    const next = normalizeThemeId(settings.theme);
    if (settings.theme !== next) {
      settings.theme = next;
      changed = true;
    }
  };
  migrateSettings(state?.settings);
  for (const profile of state?.profiles || []) migrateSettings(profile?.data?.settings);
  return changed;
}
