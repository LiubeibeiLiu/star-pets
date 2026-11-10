export function isIosLayout({
  nativePlatform,
  hasNative,
  requestedLayout,
}) {
  return (
    nativePlatform === 'ios' ||
    (!hasNative && requestedLayout !== 'android')
  );
}
