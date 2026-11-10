import { isIosLayout } from './mobile-layout-mode.js';

// Keep focused controls inside the visible viewport when Android resizes its WebView.
export function installMobileLayout() {
  // Native iOS excludes the status bar and keyboard; CSS owns the bottom inset.
  const ios = isIosLayout({
    nativePlatform: window.StarNative?.platform,
    hasNative: !!window.StarNative,
    requestedLayout: new URLSearchParams(location.search).get('layout'),
  });
  if (ios) {
    // Prevent double-tap zoom with touch-action, while preserving pinch zoom and text scaling.
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        'content',
        'width=device-width,initial-scale=1,viewport-fit=cover',
      );
    if (!window.StarNative)
      document.documentElement.style.setProperty('--ios-top-inset', '59px');
    if (!window.StarNative)
      document.documentElement.style.setProperty('--ios-bottom-inset', '34px');
  }
  let fullHeight = window.innerHeight;
  let frame = 0;
  let settle: ReturnType<typeof setTimeout>;
  const editable = (el: Element | null): el is HTMLElement =>
    !!el?.matches(
      'textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])',
    );
  function applyLayout() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    const focused = document.activeElement;
    if (!editable(focused))
      fullHeight = Math.max(fullHeight, window.innerHeight);
    const keyboard =
      editable(focused) && (fullHeight - height > 120 || height < 480);
    document.documentElement.style.setProperty(
      '--visible-height',
      `${height}px`,
    );
    document.documentElement.style.setProperty('--visible-top', `${top}px`);
    document.body.classList.toggle('keyboard-open', keyboard);
    clearTimeout(settle);
    if (keyboard && editable(focused))
      settle = setTimeout(() => {
        if (focused !== document.activeElement) return;
        const r = focused.getBoundingClientRect();
        if (r.bottom > top + height - 20 || r.top < top + 12)
          focused.scrollIntoView({ block: 'center', behavior: 'auto' });
      }, 180);
  }
  function update() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyLayout);
  }
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  // Set the viewport before Vue mounts, so the home stage has its final height
  // in the first painted frame instead of jumping after requestAnimationFrame.
  applyLayout();
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(settle);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    document.removeEventListener('focusin', update);
    document.removeEventListener('focusout', update);
    document.body.classList.remove('keyboard-open');
  };
}
