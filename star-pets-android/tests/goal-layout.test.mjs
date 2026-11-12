import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGoalLayout,
  GOAL_FALLBACK,
  GOAL_COLS,
  GOAL_ROW_MIN,
  GOAL_ROWS_MAX,
} from '../ui/src/goal-layout.js';

test('goal rows keep room for title and subtitle', () => {
  // 可用 727-280-56=391：floor((391+12)/(112+12))=3 → 3 行 × 2 列。
  const a = computeGoalLayout({
    chipsTop: 280,
    safeBottom: 727,
    dotsReserve: 56,
  });
  assert.equal(a.rows, 3);
  assert.equal(a.pageSize, 3 * GOAL_COLS);
  assert.ok(a.rowHeight >= GOAL_ROW_MIN);

  // 更高视口：升到行数上限。
  const b = computeGoalLayout({
    chipsTop: 120,
    safeBottom: 860,
    dotsReserve: 56,
  });
  assert.equal(b.rows, GOAL_ROWS_MAX);
  assert.equal(b.pageSize, GOAL_ROWS_MAX * GOAL_COLS);
  assert.ok(b.rowHeight >= GOAL_ROW_MIN);
});

test('short viewport clamps to min rows without shrinking below min height', () => {
  const a = computeGoalLayout({
    chipsTop: 500,
    safeBottom: 620,
    dotsReserve: 56,
  });
  assert.equal(a.rows, 2);
  assert.equal(a.pageSize, 4);
  assert.equal(a.rowHeight, GOAL_ROW_MIN);
});

test('unmeasurable geometry falls back to 3×2 cards', () => {
  assert.deepEqual(computeGoalLayout({}), { ...GOAL_FALLBACK });
  assert.deepEqual(computeGoalLayout({ chipsTop: 280 }), {
    ...GOAL_FALLBACK,
  });
});
