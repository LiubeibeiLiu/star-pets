export const DEFAULT_THEME_ID = 'azure';

export const themes = Object.freeze([
  Object.freeze({
    id: 'azure',
    name: '露草蓝',
    description: '清爽、温和，适合日常陪伴',
    colors: Object.freeze(['#2B6CF6', '#FF8A3D', '#F2F6FC']),
    background: '#F2F6FC',
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
  Object.freeze({
    id: 'milo',
    name: '暖陶 Milo',
    description: '温暖、现代，陶瓷质感的日常陪伴',
    colors: Object.freeze(['#F2A88A', '#E8A85C', '#F7EDE3']),
    background: '#F7EDE3',
    darkSurface: false,
  }),
]);

export const THEME_IDS = Object.freeze(themes.map(({ id }) => id));

const legacyThemes = Object.freeze({
  // Removed catalog entries collapse onto the new 露草蓝 (azure).
  dayflower: 'azure',
  starry: 'azure',
  ocean: 'azure',
  light: 'azure',
  dark: 'azure',
  mint: 'azure',
  lemon: 'azure',
  sunny: 'azure',
  grape: 'lavender',
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
  for (const profile of state?.profiles || [])
    migrateSettings(profile?.data?.settings);
  // Theme is household-wide: keep every child profile on the active theme.
  const canonical = normalizeThemeId(state?.settings?.theme);
  if (state?.settings && state.settings.theme !== canonical) {
    state.settings.theme = canonical;
    changed = true;
  }
  for (const profile of state?.profiles || []) {
    const settings = profile?.data?.settings;
    if (!settings || typeof settings !== 'object') continue;
    if (settings.theme !== canonical) {
      settings.theme = canonical;
      changed = true;
    }
  }
  return changed;
}
