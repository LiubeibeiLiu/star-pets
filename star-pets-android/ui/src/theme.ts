import { computed, watch, type Ref } from 'vue';
import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  themes,
} from './theme-config.js';

const STORAGE_KEY = 'star-pets-theme';

type ThemeState = {
  settings?: {
    theme?: string;
  };
};

type NativeBridge = (
  action: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

export function useTheme(
  state: Ref<ThemeState>,
  platform: { isNative: boolean; native: NativeBridge },
) {
  const themeId = computed(() => normalizeThemeId(state.value.settings?.theme));

  function applyTheme(value: unknown) {
    const id = normalizeThemeId(value);
    const theme = themes.find((item) => item.id === id) || themes[0];
    document.documentElement.dataset.theme = theme.id;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.background);
    if (platform.isNative)
      void platform
        .native('systemBars', {
          color: theme.background,
          dark: theme.darkSurface,
        })
        .catch(() => {});
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {}
  }

  try {
    applyTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID);
  } catch {
    applyTheme(DEFAULT_THEME_ID);
  }

  // State is replaced after load and after every commit. Watching the ref itself
  // keeps the cached login appearance until authoritative profile data arrives.
  watch(state, () => applyTheme(themeId.value));

  return { themes, themeId };
}
