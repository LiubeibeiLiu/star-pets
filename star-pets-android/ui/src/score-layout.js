// 日常表现每页条数动态计算（纯函数，可单测）。
// 思路（用户要求）：不要写死 6 条/页，实测页面几何倒推——
// 先保证滑动组件（小圆点）完整显示且不被底栏与凸起的小窝键遮挡，
// 剩余高度均分给列表行；行高不得低于 44px 触控基准。
//
// 输入（单位 px）：
//   chipsTop   列表顶在 .shell 内容坐标里的位置（滚动无关量，
//               用 chipsRect.top - shellRect.top + shell.scrollTop 算）
//   safeBottom 圆点底不得超过的位置，同样是 .shell 内容坐标，
//               以 scrollTop = 0 为基准换算（最紧的情形）：
//               小窝键凸起顶部（视口坐标） - shell 顶（视口坐标）。
//               底栏顶是 756px，但凸起的小窝键顶部在 727px 左右，
//               中间那颗圆点正好落在小窝键横向范围里，所以必须以
//               小窝键顶部为准，只躲底栏顶是不够的。
//   dotsReserve 圆点预留：margin-top 4 + 圆点高 36 + 安全间隙 4 = 44
//   rowGap     行间距（CSS 里 .rule-chips 的 gap，4px）
// 输出 { rows, rowHeight }：行数钳制在 3–8 条；行高 = 剩余高度均分，
// 下限 44px。量不到尺寸时调用方回退固定 6 条/页（见 QuickScore）。
export const SCORE_ROW_MIN = 44;
export const SCORE_ROWS_MIN = 3;
export const SCORE_ROWS_MAX = 8;

/**
 * @typedef {Object} ScoreLayoutInput
 * @property {number} [chipsTop] 列表顶在 .shell 内容坐标里的位置
 * @property {number} [safeBottom] 圆点底不得超过的位置（.shell 内容坐标）
 * @property {number} [dotsReserve] 圆点预留高度（默认 44）
 * @property {number} [rowGap] 行间距（默认 4）
 * @property {number} [minRow] 行高下限（默认 44）
 * @property {number} [minRows] 最少行数（默认 3）
 * @property {number} [maxRows] 最多行数（默认 8）
 *
 * @typedef {Object} ScoreLayout
 * @property {number} rows 每页行数
 * @property {number} rowHeight 均分后的行高
 */

/** @type {ScoreLayout} */
export const SCORE_FALLBACK = Object.freeze({ rows: 6, rowHeight: 44 });

/** @param {ScoreLayoutInput} [input] @returns {ScoreLayout} */
export function computeScoreLayout({
  chipsTop,
  safeBottom,
  dotsReserve = 44,
  rowGap = 4,
  minRow = SCORE_ROW_MIN,
  minRows = SCORE_ROWS_MIN,
  maxRows = SCORE_ROWS_MAX,
} = {}) {
  if (!Number.isFinite(chipsTop) || !Number.isFinite(safeBottom))
    return { ...SCORE_FALLBACK };
  const available = safeBottom - chipsTop - dotsReserve;
  if (available <= 0) return { rows: minRows, rowHeight: minRow };
  // rows * rowHeight + (rows - 1) * rowGap = available，且 rowHeight >= minRow：
  // rows <= (available + rowGap) / (minRow + rowGap)，向下取整得最多行数。
  const rows = Math.max(
    minRows,
    Math.min(maxRows, Math.floor((available + rowGap) / (minRow + rowGap))),
  );
  const rowHeight = Math.max(
    minRow,
    (available - (rows - 1) * rowGap) / rows,
  );
  return { rows, rowHeight };
}
