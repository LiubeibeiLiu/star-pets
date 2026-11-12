// 目标库每页卡片数动态计算（纯函数，可单测）。
// 思路与日常表现 score-layout 一致：先保证底部滑点完整可见，
// 剩余高度按行等分给 2 列卡片网格；行高不得低于内容触控下限。
import { computeScoreLayout } from './score-layout.js';

export const GOAL_COLS = 2;
// 图标 40 + 内边距 16 + 间距 6 + 标题/副文案两行，保证第二行不被裁切。
export const GOAL_ROW_MIN = 132;
export const GOAL_ROWS_MIN = 2;
export const GOAL_ROWS_MAX = 5;
export const GOAL_ROW_GAP = 12; // = --space-3

/** @type {{ rows: number, rowHeight: number, pageSize: number }} */
export const GOAL_FALLBACK = Object.freeze({
  rows: 3,
  rowHeight: 132,
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
  const { rows, rowHeight } = computeScoreLayout({
    chipsTop,
    safeBottom,
    dotsReserve,
    rowGap,
    minRow,
    minRows,
    maxRows,
  });
  return {
    rows,
    rowHeight,
    pageSize: rows * Math.max(1, cols | 0 || GOAL_COLS),
  };
}
