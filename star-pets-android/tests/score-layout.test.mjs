import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScoreLayout,
  SCORE_FALLBACK,
} from '../ui/src/score-layout.js';

// 实测几何（Playwright Firefox，见 measure-baseline.mjs）：
// 393×852：列表顶 431，小窝键凸起顶部 727；
// 320×852：列表顶 453（标题折两行高 22px），小窝键顶部仍是 727；
// 393×873：列表顶 431，小窝键顶部 748。
test('dynamic rows fill the space above the raised home button', () => {
  const a = computeScoreLayout({ chipsTop: 431, safeBottom: 727 });
  assert.equal(a.rows, 5);
  assert.ok(Math.abs(a.rowHeight - 47.2) < 0.01);
  // 5 行 × 47.2 + 4 间隙 4 = 252 = 727 - 431 - 44（圆点预留）。
  assert.ok(Math.abs(5 * a.rowHeight + 4 * 4 - 252) < 0.01);

  const b = computeScoreLayout({ chipsTop: 453, safeBottom: 727 });
  assert.equal(b.rows, 4);
  assert.ok(Math.abs(b.rowHeight - 54.5) < 0.01);

  const c = computeScoreLayout({ chipsTop: 431, safeBottom: 748 });
  assert.equal(c.rows, 5);
  assert.ok(Math.abs(c.rowHeight - 51.4) < 0.01);

  const d = computeScoreLayout({ chipsTop: 431, safeBottom: 775 });
  assert.equal(d.rows, 6);
  assert.ok(Math.abs(d.rowHeight - 46.666) < 0.01);
});

test('row height never drops below the 44px touch baseline', () => {
  // 剩余高度刚够 5 行 44px 时不取 6 行（行高会掉到 44 以下）。
  const a = computeScoreLayout({ chipsTop: 431, safeBottom: 727 - 4 });
  assert.equal(a.rows, 5);
  assert.ok(a.rowHeight >= 44);
  // 极矮视口：钳制在最少 3 行、行高仍是 44。
  const b = computeScoreLayout({ chipsTop: 431, safeBottom: 500 });
  assert.equal(b.rows, 3);
  assert.equal(b.rowHeight, 44);
  // 行数上限 8 条。
  const e = computeScoreLayout({ chipsTop: 100, safeBottom: 1200 });
  assert.equal(e.rows, 8);
  assert.ok(e.rowHeight >= 44);
});

test('unmeasurable geometry falls back to the fixed 6 rows', () => {
  assert.deepEqual(computeScoreLayout({}), { ...SCORE_FALLBACK });
  assert.deepEqual(computeScoreLayout({ chipsTop: 431 }), {
    ...SCORE_FALLBACK,
  });
  assert.deepEqual(computeScoreLayout({ safeBottom: 727 }), {
    ...SCORE_FALLBACK,
  });
});
