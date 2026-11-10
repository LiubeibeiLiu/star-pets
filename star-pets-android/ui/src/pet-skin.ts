import * as T from 'three';
import rects from './rects.json';
import { frameOf } from './catalog.js';
type Point = [number, number];
// Landmarks are in each original evolution frame, not in a substitute character.
type Landmarks = {
  face: Point;
  neck: Point;
  mouth: Point;
  eyes: [Point, Point];
  arms: [Point, Point];
  feet: [Point, Point];
  tail: Point;
  wings?: boolean;
  fish?: boolean;
  ears?: [Point, Point];
};
const faces: Record<string, Point[]> = {
  cat: [
    [0.65, 0.31],
    [0.7, 0.28],
    [0.62, 0.24],
    [0.7, 0.24],
    [0.72, 0.29],
  ],
  dog: [
    [0.62, 0.3],
    [0.61, 0.26],
    [0.64, 0.26],
    [0.65, 0.25],
    [0.66, 0.27],
  ],
  rabbit: [
    [0.62, 0.33],
    [0.65, 0.29],
    [0.65, 0.3],
    [0.62, 0.31],
    [0.65, 0.34],
  ],
  hamster: [
    [0.6, 0.31],
    [0.63, 0.26],
    [0.64, 0.25],
    [0.65, 0.25],
    [0.67, 0.29],
  ],
  fox: [
    [0.6, 0.32],
    [0.65, 0.28],
    [0.66, 0.25],
    [0.66, 0.25],
    [0.7, 0.27],
  ],
  wolf: [
    [0.62, 0.29],
    [0.64, 0.28],
    [0.65, 0.26],
    [0.65, 0.25],
    [0.68, 0.26],
  ],
  deer: [
    [0.63, 0.33],
    [0.65, 0.31],
    [0.65, 0.3],
    [0.66, 0.31],
    [0.69, 0.33],
  ],
  turtle: [
    [0.7, 0.33],
    [0.74, 0.29],
    [0.75, 0.25],
    [0.76, 0.22],
    [0.77, 0.24],
  ],
  panda: [
    [0.6, 0.36],
    [0.64, 0.3],
    [0.4, 0.25],
    [0.46, 0.22],
    [0.5, 0.23],
  ],
  dragon: [
    [0.69, 0.37],
    [0.75, 0.3],
    [0.76, 0.25],
    [0.75, 0.23],
    [0.74, 0.25],
  ],
  qinglong: [
    [0.66, 0.32],
    [0.69, 0.27],
    [0.7, 0.26],
    [0.71, 0.25],
    [0.71, 0.26],
  ],
  baihu: [
    [0.64, 0.32],
    [0.67, 0.29],
    [0.68, 0.28],
    [0.68, 0.26],
    [0.7, 0.28],
  ],
  qilin: [
    [0.66, 0.34],
    [0.69, 0.29],
    [0.7, 0.28],
    [0.7, 0.27],
    [0.72, 0.3],
  ],
  pixiu: [
    [0.65, 0.32],
    [0.65, 0.28],
    [0.67, 0.27],
    [0.68, 0.25],
    [0.69, 0.28],
  ],
  phoenix: [
    [0.64, 0.37],
    [0.72, 0.26],
    [0.72, 0.26],
    [0.72, 0.25],
    [0.69, 0.29],
  ],
  zhuque: [
    [0.65, 0.36],
    [0.71, 0.27],
    [0.71, 0.25],
    [0.71, 0.24],
    [0.69, 0.27],
  ],
  fish: [
    [0.66, 0.44],
    [0.66, 0.23],
    [0.68, 0.19],
    [0.65, 0.23],
    [0.67, 0.21],
  ],
  frog: [
    [0.6, 0.43],
    [0.61, 0.31],
    [0.58, 0.34],
    [0.6, 0.3],
    [0.62, 0.34],
  ],
};
export function landmarks(id: string, frame: number): Landmarks {
  const f = (faces[id] || faces.cat)[frame],
    fish = id === 'fish',
    bird = ['phoenix', 'zhuque'].includes(id),
    panda = id === 'panda';
  return {
    face: f,
    neck: [f[0] - 0.03, f[1] + 0.18],
    mouth: [f[0] + 0.025, f[1] + 0.1],
    eyes: [
      [f[0] - 0.12, f[1]],
      [f[0] + 0.11, f[1] - 0.025],
    ],
    arms:
      panda && frame > 1
        ? [
            [0.32, 0.55],
            [0.8, 0.38],
          ]
        : [
            [f[0] - 0.13, 0.74],
            [f[0] + 0.14, 0.8],
          ],
    feet: [
      [0.28, 0.91],
      [0.68, 0.93],
    ],
    tail: fish ? (frame === 0 ? [0.16, 0.55] : [0.48, 0.77]) : [0.16, 0.53],
    wings: bird || id === 'dragon',
    fish,
    ears:
      !bird && !fish && !['frog', 'turtle'].includes(id)
        ? [
            [f[0] - 0.17, Math.max(0.035, f[1] - 0.19)],
            [f[0] + 0.12, Math.max(0.035, f[1] - 0.19)],
          ]
        : undefined,
  };
}
function falloff(x: number, y: number, c: Point, rx: number, ry: number) {
  const d = Math.hypot((x - c[0]) / rx, (y - c[1]) / ry);
  return d >= 1 ? 0 : Math.pow(1 - d * d, 2);
}
export class SkinRig {
  root = new T.Group();
  mesh: T.SkinnedMesh;
  bones: T.Bone[] = [];
  rest: T.Vector3[] = [];
  width: number;
  height = 2.7;
  marks: Landmarks;
  constructor(
    public id: string,
    public frame: number,
    texture?: T.Texture,
  ) {
    const rect = (rects as Record<string, number[][]>)[id]?.[frame] || [
      0, 0, 300, 350,
    ];
    this.width = (this.height * rect[2]) / rect[3];
    const w = this.width,
      h = this.height,
      m = (this.marks = landmarks(id, frame));
    const positions: Point[] = [
      [0.5, 0.65],
      m.neck,
      m.mouth,
      [m.arms[0][0], m.arms[0][1] - 0.13],
      [m.arms[1][0], m.arms[1][1] - 0.13],
      [m.feet[0][0], 0.8],
      [m.feet[1][0], 0.8],
      [0.34, 0.67],
      m.tail,
      m.eyes[0],
      m.eyes[1],
      [0.43, 0.52],
      [0.78, 0.5],
      m.ears?.[0] || m.face,
      m.ears?.[1] || m.face,
    ];
    const parents = [-1, 0, 1, 0, 0, 0, 0, 0, 7, 1, 1, 0, 0, 1, 1];
    for (let i = 0; i < positions.length; i++) {
      const b = new T.Bone();
      b.name = [
        'body',
        'head',
        'jaw',
        'leftPaw',
        'rightPaw',
        'leftFoot',
        'rightFoot',
        'tail',
        'tailTip',
        'leftEye',
        'rightEye',
        'leftWing',
        'rightWing',
        'leftEar',
        'rightEar',
      ][i];
      const pt = positions[i];
      b.position.set((pt[0] - 0.5) * w, (0.5 - pt[1]) * h, 0);
      if (parents[i] >= 0) {
        const parent = positions[parents[i]];
        b.position.x -= (parent[0] - 0.5) * w;
        b.position.y -= (0.5 - parent[1]) * h;
        this.bones[parents[i]].add(b);
      }
      this.bones.push(b);
      this.rest.push(b.position.clone());
    }
    // The pet is displayed at phone scale; this density keeps deformation smooth
    // while avoiding a 100k+ weight calculation during first render.
    const geometry = new T.PlaneGeometry(w, h, 48, 54),
      pos = geometry.attributes.position,
      indices = [],
      weights = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / w + 0.5,
        y = 0.5 - pos.getY(i) / h;
      const entries: [number, number][] = [];
      entries.push([1, falloff(x, y, m.face, 0.43, 0.3) * 2.6]);
      entries.push([2, falloff(x, y, m.mouth, 0.095, 0.072) * 8]);
      entries.push(
        [9, falloff(x, y, m.eyes[0], 0.085, 0.065) * 10],
        [10, falloff(x, y, m.eyes[1], 0.075, 0.06) * 10],
      );
      entries.push(
        [3, falloff(x, y, m.arms[0], 0.12, 0.18) * 3],
        [4, falloff(x, y, m.arms[1], 0.12, 0.17) * 3],
      );
      if (!m.fish)
        entries.push(
          [5, falloff(x, y, m.feet[0], 0.15, 0.13) * 3],
          [6, falloff(x, y, m.feet[1], 0.14, 0.13) * 3],
        );
      if (!['frog', 'turtle', 'panda'].includes(id))
        entries.push([
          8,
          falloff(x, y, m.tail, m.fish ? 0.36 : 0.21, m.fish ? 0.3 : 0.32) * 3,
        ]);
      if (m.wings)
        entries.push(
          [11, falloff(x, y, [0.25, 0.4], 0.27, 0.29) * 3],
          [12, falloff(x, y, [0.88, 0.47], 0.16, 0.23) * 3],
        );
      if (m.ears)
        entries.push(
          [13, falloff(x, y, m.ears[0], 0.1, 0.13) * 5],
          [14, falloff(x, y, m.ears[1], 0.1, 0.13) * 5],
        );
      entries.sort((a, b) => b[1] - a[1]);
      const best = entries.slice(0, 3);
      const amount = best.reduce((n, p) => n + p[1], 0);
      best.push([0, Math.max(0.04, 1 - amount)]);
      const total = best.reduce((n, p) => n + p[1], 0);
      for (const [index, weight] of best) {
        indices.push(index);
        weights.push(weight / total);
      }
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute(
      'skinWeight',
      new T.Float32BufferAttribute(weights, 4),
    );
    const material = new T.MeshBasicMaterial({
      map: texture || null,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.005,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new T.SkinnedMesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.add(this.bones[0]);
    this.mesh.bind(new T.Skeleton(this.bones));
    this.root.add(this.mesh);
  }
  pose(action: string, t: number, talking = 0, photo = false) {
    const b = this.bones,
      m = this.marks,
      s = Math.sin(t * 3),
      f = Math.sin(t * 6);
    b.forEach((bone, i) => {
      bone.position.copy(this.rest[i]);
      bone.rotation.set(0, 0, 0);
      bone.scale.set(1, 1, 1);
    });
    b[1].rotation.z = 0.012 * Math.sin(t * 1.6);
    b[8].rotation.z = 0.065 * Math.sin(t * 2.2);
    b[11].rotation.z = m.wings ? 0.045 * Math.sin(t * 2) : 0;
    b[12].rotation.z = -b[11].rotation.z;
    if (!photo) {
      b[1].position.y += 0.009 * Math.sin(t * 1.3);
      b[1].rotation.z += 0.015 * Math.sin(t * 0.7);
      b[8].rotation.z += 0.025 * Math.sin(t * 3.7);
      b[11].rotation.z += 0.025 * Math.sin(t * 2.1);
      b[12].rotation.z -= 0.018 * Math.sin(t * 2.6);
      b[3].rotation.z += 0.012 * Math.sin(t * 1.4);
      b[4].rotation.z -= 0.012 * Math.sin(t * 1.4);
    }
    if (!photo) {
      const phase = t % 5.1;
      const blink =
        phase > 4.75
          ? 1 - 0.9 * Math.sin(((phase - 4.75) / 0.35) * Math.PI)
          : 1;
      b[9].scale.y = blink;
      b[10].scale.y = blink;
    }
    b[2].scale.y = 1 + Math.max(0, talking) * 0.55;
    b[2].scale.x = 1 - Math.max(0, talking) * 0.13;
    b[2].position.y -= Math.max(0, talking) * 0.018;
    if (['pet', 'nuzzle', 'hug'].includes(action)) {
      b[1].rotation.z = 0.1;
      b[3].rotation.z = -0.14;
      b[4].rotation.z = 0.18;
      b[8].rotation.z = 0.16 * s;
    }
    if (['happy', 'cheer', 'upgrade'].includes(action)) {
      b[1].rotation.z = 0.045 * s;
      b[3].rotation.z = -0.24;
      b[4].rotation.z = 0.29;
      b[5].rotation.z = -0.09;
      b[6].rotation.z = 0.1;
      b[8].rotation.z = 0.22 * s;
    }
    if (['dance', 'play'].includes(action)) {
      b[0].rotation.z = 0.035 * s;
      b[1].rotation.z = -0.08 * s;
      b[3].rotation.z = -0.25 + 0.14 * s;
      b[4].rotation.z = 0.25 + 0.14 * s;
      b[5].rotation.z = 0.14 * s;
      b[6].rotation.z = -0.14 * s;
      b[5].position.y += Math.max(0, s) * 0.06;
      b[6].position.y += Math.max(0, -s) * 0.06;
      b[8].rotation.z = 0.2 * s;
      b[11].rotation.z = 0.12 * f;
      b[12].rotation.z = -0.12 * f;
    }
    if (action === 'jump') {
      const phase = (t % 2.4) / 2.4,
        prep = phase < 0.2 ? Math.sin(((phase / 0.2) * Math.PI) / 2) : 0,
        air =
          phase >= 0.2 && phase < 0.75
            ? Math.sin(((phase - 0.2) / 0.55) * Math.PI)
            : 0,
        land =
          phase >= 0.75
            ? Math.sin(((phase - 0.75) / 0.25) * Math.PI) *
              Math.exp(-(phase - 0.75) * 10)
            : 0;
      const bend = prep * 0.12 + land * 0.1;
      b[0].position.y += air * 0.24 - bend * 0.22;
      b[1].position.y -= bend * 0.2;
      b[3].rotation.z = -air * 0.26 + bend;
      b[4].rotation.z = air * 0.28 - bend;
      b[5].rotation.z = -air * 0.16 + bend;
      b[6].rotation.z = air * 0.16 - bend;
      b[5].position.y += air * 0.045;
      b[6].position.y += air * 0.045;
      b[8].rotation.z = -air * 0.12;
    }

    if (action === 'wave') {
      b[4].rotation.z = 0.32 + 0.12 * f;
      b[4].position.y += 0.06;
      b[1].rotation.z = -0.07;
      b[12].rotation.z = 0.15 + 0.08 * f;
    }
    if (['think', 'listen', 'peek'].includes(action)) {
      b[1].rotation.z = 0.11;
      b[3].rotation.z = -0.11;
      b[9].scale.y = 0.95;
      b[10].scale.y = 1.03;
    }
    if (action === 'nod') {
      const nod = Math.sin(t * 3);
      b[1].position.y -= 0.035 * nod;
      b[1].rotation.z = 0.025 * nod;
      b[11].rotation.z += 0.035 * nod;
      b[12].rotation.z -= 0.035 * nod;
    }
    if (action === 'bow') {
      b[1].rotation.z = -0.09;
      b[1].position.y -= 0.07;
      b[3].rotation.z = 0.1;
      b[4].rotation.z = -0.12;
    }
    if (['feed', 'eat'].includes(action)) {
      b[1].position.y -= 0.035;
      b[2].scale.y = 1.2 + 0.18 * f;
      b[3].rotation.z = -0.18;
      b[4].rotation.z = 0.16;
    }
    if (action === 'stretch') {
      b[3].rotation.z = -0.3;
      b[4].rotation.z = 0.3;
      b[1].position.y += 0.04;
      b[8].rotation.z = 0.22;
    }
    if (['sad', 'sleep', 'sit'].includes(action)) {
      b[1].rotation.z = -0.06;
      b[1].position.y -= 0.035;
      b[3].rotation.z = 0.08;
      b[4].rotation.z = -0.09;
      b[5].rotation.z = 0.11;
      b[6].rotation.z = -0.12;
      if (action === 'sleep') {
        b[9].scale.y = 0.1;
        b[10].scale.y = 0.1;
      }
    }
    if (action === 'hug') {
      const reach = 0.5 + 0.5 * Math.sin(t * 2);
      b[3].rotation.z = -0.35 * reach;
      b[4].rotation.z = 0.35 * reach;
      b[1].rotation.z = 0.06 * s;
      b[9].scale.y = 0.82;
      b[10].scale.y = 0.82;
      b[8].rotation.z = 0.2 * f;
    }
    if (action === 'peek') {
      b[1].position.x += 0.06 * s;
      b[1].rotation.z = 0.16 * s;
      b[3].rotation.z = -0.2;
      b[4].rotation.z = 0.12;
      b[11].rotation.z = 0.18 * f;
      b[12].rotation.z = -0.1 * f;
    }
    if (action === 'sit') {
      b[5].rotation.z = 0.28;
      b[6].rotation.z = -0.28;
      b[5].position.y += 0.06;
      b[6].position.y += 0.06;
      b[3].rotation.z = 0.1 * s;
      b[8].rotation.z = 0.2 * Math.sin(t * 1.4);
    }
    if (action === 'cheer') {
      b[3].rotation.z = -0.3 - 0.12 * f;
      b[4].rotation.z = 0.3 + 0.12 * f;
      b[1].position.y += 0.025 * Math.abs(f);
      b[9].scale.y = 0.8;
      b[10].scale.y = 0.8;
    }
    if (['happy', 'cheer', 'upgrade', 'nuzzle'].includes(action)) {
      b[9].scale.y *= 0.82 + 0.05 * Math.sin(t * 2);
      b[10].scale.y *= 0.82 + 0.05 * Math.sin(t * 2);
      b[2].scale.x *= 1.06;
      b[11].rotation.z += 0.07 * Math.sin(t * 4);
      b[12].rotation.z -= 0.06 * Math.sin(t * 4 + 0.4);
    }
    if (action === 'sad') {
      b[9].scale.y *= 0.7;
      b[10].scale.y *= 0.7;
      b[11].rotation.z = -0.12;
      b[12].rotation.z = 0.12;
      b[8].rotation.z = 0.035 * Math.sin(t * 1.1);
      b[1].position.y -= 0.015 * (1 + Math.sin(t));
    }
    if (action === 'listen' || action === 'think') {
      b[9].scale.x = 1.025;
      b[10].scale.x = 1.025;
      b[11].rotation.z = 0.09;
      b[12].rotation.z = -0.05;
      b[1].rotation.z += 0.018 * Math.sin(t * 1.5);
    }
    if (action === 'stretch') {
      const ease = 0.5 - 0.5 * Math.cos(t * 2);
      b[3].rotation.z = -0.18 - 0.15 * ease;
      b[4].rotation.z = 0.18 + 0.15 * ease;
      b[5].rotation.z = 0.06 * ease;
      b[6].rotation.z = -0.06 * ease;
      b[1].position.y += 0.025 * ease;
    }
    if (!photo) {
      const glance = 0.0035 * Math.sin(t * 0.85);
      b[9].position.x += glance;
      b[10].position.x += glance;
    }
    if (m.ears) {
      b[13].rotation.z = 0.025 * Math.sin(t * 1.7);
      b[14].rotation.z = -0.02 * Math.sin(t * 1.7 + 0.7);
      if (['listen', 'think', 'peek'].includes(action)) {
        b[13].rotation.z += 0.1;
        b[14].rotation.z -= 0.06;
      }
      if (['happy', 'cheer', 'nuzzle'].includes(action)) {
        b[13].rotation.z += 0.05 * Math.sin(t * 4);
        b[14].rotation.z -= 0.04 * Math.sin(t * 4 + 0.5);
      }
      if (action === 'sad') {
        b[13].rotation.z = -0.13;
        b[14].rotation.z = 0.12;
      }
    }
    if (action === 'groom') {
      const stroke = 0.5 - 0.5 * Math.cos(t * 3);
      b[3].rotation.z = -0.34 - 0.1 * stroke;
      b[3].position.y += 0.06 * stroke;
      b[1].rotation.z = 0.045;
      b[9].scale.y *= 0.72;
      b[10].scale.y *= 0.78;
      b[2].scale.x *= 1.035;
    }
    if (action === 'sniff') {
      const breath = Math.sin(t * 7);
      b[1].position.y -= 0.028;
      b[1].position.x += 0.012 * breath;
      b[2].scale.x = 1 + 0.035 * breath;
      b[3].rotation.z = -0.04;
      b[4].rotation.z = 0.05;
      if (m.ears) {
        b[13].rotation.z = 0.07;
        b[14].rotation.z = -0.07;
      }
    }
    if (action === 'lookAround') {
      const look = Math.sin(t * 1.6);
      b[1].rotation.z = 0.055 * look;
      b[9].position.x += 0.012 * look;
      b[10].position.x += 0.012 * look;
      b[8].rotation.z = 0.045 * Math.sin(t * 1.2);
      if (m.ears) {
        b[13].rotation.z = 0.07 * look;
        b[14].rotation.z = -0.05 * look;
      }
    }
    if (m.fish) {
      b[8].rotation.z += 0.07 * s;
      b[3].rotation.z += 0.05 * f;
      b[4].rotation.z -= 0.05 * f;
    }
    this.root.updateMatrixWorld(true);
  }
  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as T.Material).dispose();
    this.mesh.skeleton.dispose();
  }
}
const images = new Map<string, Promise<HTMLImageElement>>();
export async function skinTexture(pet: any, level: number) {
  let loading = images.get(pet.sheet);
  if (!loading) {
    loading = new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(Error('宠物原画加载失败'));
      im.src = pet.sheet;
    });
    images.set(pet.sheet, loading);
  }
  const im = await loading,
    frame = frameOf(level),
    r = (rects as Record<string, number[][]>)[pet.id]?.[frame] || [
      (im.width / 5) * frame,
      0,
      im.width / 5,
      im.height,
    ],
    c = document.createElement('canvas');
  c.width = r[2];
  c.height = r[3];
  c.getContext('2d')!.drawImage(
    im,
    ...(r as [number, number, number, number]),
    0,
    0,
    r[2],
    r[3],
  );
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export function skinStudio(canvas: HTMLCanvasElement) {
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 20);
  camera.position.z = 5;
  return {
    renderer,
    scene,
    camera,
    resize(w: number, h: number, artWidth = 2.5) {
      renderer.setSize(Math.round(w), Math.round(h), false);
      const aspect = w / h,
        span = Math.max(3.5, artWidth / (aspect * 0.88));
      camera.left = (-span * aspect) / 2;
      camera.right = (span * aspect) / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export async function renderSkinPose(pet: any, level: number, pose: string) {
  const c = document.createElement('canvas'),
    s = skinStudio(c),
    texture = await skinTexture(pet, level),
    rig = new SkinRig(pet.id, frameOf(level), texture);
  s.resize(700, 700, rig.width);
  s.scene.add(rig.root);
  rig.pose(pose, 1.15, 0, true);
  s.renderer.render(s.scene, s.camera);
  const copy = document.createElement('canvas');
  copy.width = 700;
  copy.height = 700;
  copy.getContext('2d')!.drawImage(c, 0, 0);
  rig.dispose();
  texture.dispose();
  s.dispose();
  return copy;
}
