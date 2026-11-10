import rects from './rects.json';

/** A first-meeting photograph made from the adopted pet's own original artwork. */
export async function createFirstMeetingPhoto(species: { id: string; sheet: string }) {
  const image = new Image();
  image.src = species.sheet;
  await image.decode();
  const [sx, sy, sw, sh] =
    (rects as Record<string, number[][]>)[species.id]?.[0] ||
    [0, 0, image.width / 5, image.height];
  if (!sw || !sh) throw new Error('伙伴原画无法用于生成第一次相遇照片');

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 810;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('设备无法创建第一次相遇照片');
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#f7f2fb');
  background.addColorStop(1, '#e9e0f4');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const halo = context.createRadialGradient(540, 360, 80, 540, 360, 390);
  halo.addColorStop(0, 'rgba(255,255,255,0.92)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, canvas.width, 720);

  const scale = Math.min(660 / sw, 600 / sh);
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sx, sy, sw, sh, (1080 - width) / 2, 680 - height, width, height);
  context.fillStyle = '#6b5488';
  context.font = '600 48px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('第一次相遇', 540, 766);
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
}
