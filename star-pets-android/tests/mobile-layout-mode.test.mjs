import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIosLayout } from '../ui/src/mobile-layout-mode.js';

test('public browser previews honor the explicit iOS layout request', () => {
  assert.equal(
    isIosLayout({
      nativePlatform: undefined,
      hasNative: false,
      requestedLayout: 'ios',
    }),
    true,
  );
});

test('browser preview defaults to iOS without a query parameter', () => {
  assert.equal(
    isIosLayout({
      nativePlatform: undefined,
      hasNative: false,
      requestedLayout: null,
    }),
    true,
  );
  assert.equal(
    isIosLayout({
      nativePlatform: undefined,
      hasNative: false,
      requestedLayout: 'android',
    }),
    false,
  );
});

test('layout query cannot override a non-iOS native bridge', () => {
  assert.equal(
    isIosLayout({
      nativePlatform: 'android',
      hasNative: true,
      requestedLayout: 'ios',
    }),
    false,
  );
  assert.equal(
    isIosLayout({
      nativePlatform: 'ios',
      hasNative: true,
      requestedLayout: null,
    }),
    true,
  );
});
