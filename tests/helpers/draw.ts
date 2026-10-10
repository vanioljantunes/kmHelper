import { createCalibration } from '../../src/core/calibrate';
import type { AxisValues, CurvePoint, PlotBox, Raster } from '../../src/core/types';

export type Rgb = readonly [number, number, number];

export interface Canvas extends Raster {
  readonly data: Uint8ClampedArray;
}

/** A blank raster, white and fully opaque unless told otherwise. */
export function createCanvas(width: number, height: number, bg: Rgb = [255, 255, 255]): Canvas {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

export function setPixel(c: Canvas, x: number, y: number, rgb: Rgb, alpha = 255): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= c.width || py >= c.height) return;
  const i = (py * c.width + px) * 4;
  if (alpha >= 255) {
    c.data[i] = rgb[0];
    c.data[i + 1] = rgb[1];
    c.data[i + 2] = rgb[2];
    c.data[i + 3] = 255;
    return;
  }
  // Blend over whatever is already there, the way an anti-aliased stroke does.
  const a = alpha / 255;
  c.data[i] = Math.round((c.data[i] ?? 255) * (1 - a) + rgb[0] * a);
  c.data[i + 1] = Math.round((c.data[i + 1] ?? 255) * (1 - a) + rgb[1] * a);
  c.data[i + 2] = Math.round((c.data[i + 2] ?? 255) * (1 - a) + rgb[2] * a);
  c.data[i + 3] = 255;
}

export function drawHLine(
  c: Canvas,
  y: number,
  x0: number,
  x1: number,
  rgb: Rgb,
  thickness = 1,
): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
    for (let k = 0; k < thickness; k += 1) setPixel(c, x, y + k, rgb);
  }
}

export function drawVLine(
  c: Canvas,
  x: number,
  y0: number,
  y1: number,
  rgb: Rgb,
  thickness = 1,
): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
    for (let k = 0; k < thickness; k += 1) setPixel(c, x + k, y, rgb);
  }
}

/** The plot frame: a y axis on the left and an x axis along the bottom, both near-black. */
export function drawAxes(c: Canvas, box: PlotBox, rgb: Rgb = [20, 20, 20]): void {
  drawVLine(c, box.left, box.top, box.bottom, rgb);
  drawHLine(c, box.bottom, box.left, box.right, rgb);
}

export interface StepOptions {
  readonly thickness?: number;
  /** Fade the stroke edges, as a real figure does. */
  readonly antialias?: boolean;
  /** Short vertical marks on the curve at these times, the way censoring is printed. */
  readonly tickTimes?: readonly number[];
  readonly tickHalfHeight?: number;
  /** Leave these pixel columns blank, as a dashed line or an overprinted label would. */
  readonly skipColumns?: readonly number[];
}

/**
 * Draw a Kaplan-Meier step function: a horizontal run at each survival level and a vertical riser
 * at each event time. The points are the step corners in data coordinates, time ascending.
 */
export function drawStepCurve(
  c: Canvas,
  box: PlotBox,
  axes: AxisValues,
  points: readonly CurvePoint[],
  rgb: Rgb,
  options: StepOptions = {},
): void {
  const {
    thickness = 2,
    antialias = false,
    tickTimes = [],
    tickHalfHeight = 4,
    skipColumns = [],
  } = options;
  const { toPixel } = createCalibration(box, axes);
  const skip = new Set(skipColumns);
  const half = (thickness - 1) / 2;

  const stroke = (x: number, y: number): void => {
    if (skip.has(Math.round(x))) return;
    for (let k = 0; k < thickness; k += 1) setPixel(c, x, Math.round(y - half + k), rgb);
    if (antialias) {
      setPixel(c, x, Math.round(y - half - 1), rgb, 110);
      setPixel(c, x, Math.round(y - half + thickness), rgb, 110);
    }
  };

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point === undefined) continue;
    const next = points[i + 1];
    const from = toPixel(point);
    const toX = next === undefined ? box.right : toPixel(next).x;
    for (let x = Math.round(from.x); x <= Math.round(toX); x += 1) stroke(x, from.y);
    if (next !== undefined) {
      // The riser down to the next survival level, drawn in the next point's column.
      const to = toPixel({ t: next.t, s: next.s });
      const x = Math.round(to.x);
      if (!skip.has(x)) {
        for (let y = Math.round(from.y); y <= Math.round(to.y); y += 1) {
          for (let k = 0; k < thickness; k += 1) setPixel(c, x + k, y, rgb);
        }
      }
    }
  }

  for (const t of tickTimes) {
    // Survival at t is the level of the last corner at or before t.
    let s = points[0]?.s ?? 1;
    for (const point of points) if (point.t <= t) s = point.s;
    const at = toPixel({ t, s });
    for (let dy = -tickHalfHeight; dy <= tickHalfHeight; dy += 1) {
      setPixel(c, at.x, at.y + dy, rgb);
    }
  }
}
