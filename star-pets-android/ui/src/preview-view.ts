import { ref, watch } from 'vue';

const storageKey = 'star-pets-view';
const restorableViews = new Set([
  'home',
  'habits',
  'photos',
  'pets',
  'settings',
  'goalLibrary',
  'children',
  'companionSettings',
  'voiceSettings',
]);

export function usePreviewView(storage?: Storage) {
  const savedView = storage?.getItem(storageKey) ?? '';
  const view = ref(restorableViews.has(savedView) ? savedView : 'home');

  if (storage) {
    watch(view, (page) => {
      if (restorableViews.has(page)) storage.setItem(storageKey, page);
    });
  }

  return view;
}
