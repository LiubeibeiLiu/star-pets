import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGoalLayout,
  GOAL_FALLBACK,
  GOAL_COLS,
  GOAL_ROW_MIN,
} from '../ui/src/goal-layout.js';

test('goal rows keep room for title and subtitle', () => {
  // 可用 391：按内容行高 156 约 2 行，行高不再拉满剩余空间。
  const a = computeGoalLayout({
    chipsTop: 280,
    safeBottom: 727,
    dotsReserve: 56,
  });
  assert.equal(a.rows, 2);
  assert.equal(a.pageSize, 2 * GOAL_COLS);
  assert.equal(a.rowHeight, GOAL_ROW_MIN);

  const b = computeGoalLayout({
    chipsTop: 120,
    safeBottom: 860,
    dotsReserve: 56,
  });
  assert.equal(b.rows, 4);
  assert.equal(b.pageSize, 4 * GOAL_COLS);
  assert.equal(b.rowHeight, GOAL_ROW_MIN);
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
