// 目标库每页卡片数动态计算（纯函数，可单测）。
// 行高固定为内容高度，只按剩余空间决定能放几行，避免卡片被拉出大块空白。

export const GOAL_COLS = 2;
// 图标 40 + 内边距 16 + 标题一行或两行 + 说明 + 底部进度，按内容高度，不再把行拉满视口。
export const GOAL_ROW_MIN = 156;
export const GOAL_ROWS_MIN = 2;
export const GOAL_ROWS_MAX = 5;
export const GOAL_ROW_GAP = 12; // = --space-3

/** @type {{ rows: number, rowHeight: number, pageSize: number }} */
export const GOAL_FALLBACK = Object.freeze({
  rows: 3,
  rowHeight: 156,
  pageSize: 6,
});

/**
 * @param {import('./score-layout.js').ScoreLayoutInput & {
 *   cols?: number
 * }} [input]
 * @returns {{ rows: number, rowHeight: number, pageSize: number }}
 */
export function computeGoalLayout({
  chipsTop,
  safeBottom,
  dotsReserve = 56,
  rowGap = GOAL_ROW_GAP,
  minRow = GOAL_ROW_MIN,
  minRows = GOAL_ROWS_MIN,
  maxRows = GOAL_ROWS_MAX,
  cols = GOAL_COLS,
} = {}) {
  if (!Number.isFinite(chipsTop) || !Number.isFinite(safeBottom))
    return { ...GOAL_FALLBACK };
  const columns = Math.max(1, cols | 0 || GOAL_COLS);
  const available = safeBottom - chipsTop - dotsReserve;
  if (!(available > 0))
    return {
      rows: minRows,
      rowHeight: minRow,
      pageSize: minRows * columns,
    };
  const rows = Math.max(
    minRows,
    Math.min(maxRows, Math.floor((available + rowGap) / (minRow + rowGap))),
  );
  return { rows, rowHeight: minRow, pageSize: rows * columns };
}
