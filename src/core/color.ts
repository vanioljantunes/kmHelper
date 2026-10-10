import type { Lab, Raster, Rgb } from './types';

/** D65 reference white, the one sRGB is defined against. */
const WHITE = { x: 95.047, y: 100, z: 108.883 } as const;

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Undo the sRGB transfer function: 0-255 to linear 0-1. */
function toLinear(channel: number): number {
  const c = clamp255(channel) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB to CIELAB under D65. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  // sRGB to XYZ, scaled to the 0-100 range the Lab formula expects.
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100;
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x / WHITE.x);
  const fy = f(y / WHITE.y);
  const fz = f(z / WHITE.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Plain euclidean distance in Lab. Cheap, used only where speed beats accuracy. */
export function deltaE76(p: Lab, q: Lab): number {
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

/**
 * CIEDE2000. This is the threshold the colour pick uses: it tracks how different two colours
 * look far better than RGB distance does, which matters because a published figure's line is
 * anti-aliased and JPEG-smeared at its edges.
 */
export function deltaE2000(p: Lab, q: Lab): number {
  const lBar = (p.l + q.l) / 2;
  const c1 = Math.hypot(p.a, p.b);
  const c2 = Math.hypot(q.a, q.b);
  const cBar = (c1 + c2) / 2;
  const cBar7 = Math.pow(cBar, 7);
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 6103515625))); // 25^7
  const a1 = p.a * (1 + g);
  const a2 = q.a * (1 + g);
  const cp1 = Math.hypot(a1, p.b);
  const cp2 = Math.hypot(a2, q.b);
  const cpBar = (cp1 + cp2) / 2;

  const hue = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0;
    const deg = (Math.atan2(b, a) * 180) / Math.PI;
    return deg >= 0 ? deg : deg + 360;
  };
  const h1 = hue(a1, p.b);
  const h2 = hue(a2, q.b);

  let dh: number;
  if (cp1 * cp2 === 0) dh = 0;
  else if (Math.abs(h2 - h1) <= 180) dh = h2 - h1;
  else if (h2 <= h1) dh = h2 - h1 + 360;
  else dh = h2 - h1 - 360;

  let hBar: number;
  if (cp1 * cp2 === 0) hBar = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) hBar = (h1 + h2) / 2;
  else if (h1 + h2 < 360) hBar = (h1 + h2 + 360) / 2;
  else hBar = (h1 + h2 - 360) / 2;

  const dL = q.l - p.l;
  const dC = cp2 - cp1;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * Math.PI) / 360);

  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const t =
    1 -
    0.17 * Math.cos(rad(hBar - 30)) +
    0.24 * Math.cos(rad(2 * hBar)) +
    0.32 * Math.cos(rad(3 * hBar + 6)) -
    0.2 * Math.cos(rad(4 * hBar - 63));

  const lBarSq = (lBar - 50) * (lBar - 50);
  const sL = 1 + (0.015 * lBarSq) / Math.sqrt(20 + lBarSq);
  const sC = 1 + 0.045 * cpBar;
  const sH = 1 + 0.015 * cpBar * t;

  const cpBar7 = Math.pow(cpBar, 7);
  const rC = 2 * Math.sqrt(cpBar7 / (cpBar7 + 6103515625));
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) * ((hBar - 275) / 25)));
  const rT = -rC * Math.sin(rad(2 * dTheta));

  const kL = 1;
  const kC = 1;
  const kH = 1;
  const termL = dL / (kL * sL);
  const termC = dC / (kC * sC);
  const termH = dH / (kH * sH);
  return Math.sqrt(termL * termL + termC * termC + termH * termH + rT * termC * termH);
}

/** One pixel, or null when the coordinates fall outside the raster. */
export function pixelAt(image: Raster, x: number, y: number): Rgb | null {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return null;
  const i = (py * image.width + px) * 4;
  return { r: image.data[i] ?? 0, g: image.data[i + 1] ?? 0, b: image.data[i + 2] ?? 0 };
}

/**
 * Average a square patch of side 2r+1 centred on (x, y), skipping fully transparent pixels.
 * A single pixel on a thin anti-aliased line is often half background, so the patch is what
 * actually defines the arm's colour. Returns null when nothing opaque is in range.
 */
export function samplePatch(image: Raster, x: number, y: number, r = 1): Rgb | null {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
      const i = (py * image.width + px) * 4;
      if ((image.data[i + 3] ?? 255) < 8) continue;
      sr += image.data[i] ?? 0;
      sg += image.data[i + 1] ?? 0;
      sb += image.data[i + 2] ?? 0;
      n += 1;
    }
  }
  if (n === 0) return null;
  return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
}

/** '#rrggbb' from an Rgb. */
export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number): string =>
    Math.round(clamp255(v)).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** An Rgb from '#rgb' or '#rrggbb', or null when the text is not a colour. */
export function fromHex(text: string): Rgb | null {
  const hex = text.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [a, b, c] = hex;
    return fromHex(`${a}${a}${b}${b}${c}${c}`);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
