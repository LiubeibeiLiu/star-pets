/** Place the transparent pet portrait over a destination photo without stretching it. */
export function placePetSelfie(
  target: CanvasRenderingContext2D,
  portrait: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const source = portrait.getContext('2d', { willReadFrequently: true });
  if (!source) throw new Error('宠物自拍无法读取');
  const { data } = source.getImageData(0, 0, portrait.width, portrait.height);
  let left = portrait.width;
  let top = portrait.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < portrait.height; y++) {
    for (let x = 0; x < portrait.width; x++) {
      if (data[(y * portrait.width + x) * 4 + 3] < 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('宠物自拍没有可见内容');
  const sourceWidth = right - left + 1;
  const sourceHeight = bottom - top + 1;
  const inset = Math.max(24, Math.round(Math.min(width, height) * 0.035));
  const scale = Math.min(500 / sourceWidth, width * 0.4 / sourceWidth, height * 0.62 / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);
  target.drawImage(
    portrait,
    left, top, sourceWidth, sourceHeight,
    width - drawWidth - inset, height - drawHeight - inset,
    drawWidth, drawHeight,
  );
}
