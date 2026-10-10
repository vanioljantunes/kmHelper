import { deltaE2000, rgbToLab } from './color';
import type { Lab, PlotBox, Raster } from './types';

export interface MaskResult {
  /** One byte per pixel inside the box, row-major: 1 when the pixel matches the arm colour. */
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly matched: number;
}

/** The default CIEDE2000 threshold. Tight enough to separate two arms, loose enough for JPEG. */
export const DEFAULT_TOLERANCE = 12;

/**
 * A cheap pre-filter: when no channel is within this of the target, the colours cannot be close
 * enough in Lab to matter, so the expensive CIEDE2000 call is skipped. The bound is generous, so
 * it never rejects a pixel the real test would have accepted at a sane tolerance.
 */
const CHANNEL_GUARD = 140;

export function clampBox(box: PlotBox, image: Raster): PlotBox {
  return {
    left: Math.max(0, Math.min(Math.round(box.left), image.width - 1)),
    right: Math.max(0, Math.min(Math.round(box.right), image.width - 1)),
    top: Math.max(0, Math.min(Math.round(box.top), image.height - 1)),
    bottom: Math.max(0, Math.min(Math.round(box.bottom), image.height - 1)),
  };
}

/**
 * Mark every pixel inside the plot box whose colour is within `tolerance` CIEDE2000 units of the
 * arm colour. This is what replaces clicking along the curve: the arm is named once by its
 * colour, and the same image and colour always give the same mask.
 */
export function buildMask(
  image: Raster,
  box: PlotBox,
  target: Lab,
  tolerance: number = DEFAULT_TOLERANCE,
): MaskResult {
  const b = clampBox(box, image);
  const width = Math.max(0, b.right - b.left + 1);
  const height = Math.max(0, b.bottom - b.top + 1);
  const mask = new Uint8Array(width * height);
  if (width === 0 || height === 0) return { mask, width, height, matched: 0 };

  // The guard needs the target back in sRGB terms; approximate it by its own Lab round trip
  // bounds instead, which is why the guard is on the generous side.
  let matched = 0;
  const cache = new Map<number, number>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = ((y + b.top) * image.width + (x + b.left)) * 4;
      if ((image.data[i + 3] ?? 255) < 8) continue;
      const r = image.data[i] ?? 0;
      const g = image.data[i + 1] ?? 0;
      const bl = image.data[i + 2] ?? 0;
      const key = (r << 16) | (g << 8) | bl;
      let distance = cache.get(key);
      if (distance === undefined) {
        const lab = rgbToLab({ r, g, b: bl });
        const roughlyFar =
          Math.abs(lab.l - target.l) > CHANNEL_GUARD ||
          Math.abs(lab.a - target.a) > CHANNEL_GUARD ||
          Math.abs(lab.b - target.b) > CHANNEL_GUARD;
        distance = roughlyFar ? Number.POSITIVE_INFINITY : deltaE2000(lab, target);
        cache.set(key, distance);
      }
      if (distance <= tolerance) {
        mask[y * width + x] = 1;
        matched += 1;
      }
    }
  }
  return { mask, width, height, matched };
}
