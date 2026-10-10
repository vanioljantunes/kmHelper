import type { PlotBox, Raster } from './types';

export interface DetectedBox extends PlotBox {
  /**
   * False when no convincing axis pair was found and the box is an 8% inset guess. The UI says
   * the handles need checking in that case rather than pretending the detection worked.
   */
  readonly confident: boolean;
}

export interface DetectOptions {
  /** A run must cover at least this share of the image side to count as an axis. */
  readonly minRunShare?: number;
  /** The y axis is looked for in this left-hand share of the width. */
  readonly leftShare?: number;
  /** The x axis is looked for in this bottom share of the height. */
  readonly bottomShare?: number;
}

/** Luminance 0-255. Transparent pixels read as white so a cut-out background is not ink. */
function grayscale(image: Raster): Uint8Array {
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0; i < gray.length; i += 1) {
    const j = i * 4;
    const alpha = image.data[j + 3] ?? 255;
    if (alpha < 8) {
      gray[i] = 255;
      continue;
    }
    const r = image.data[j] ?? 0;
    const g = image.data[j + 1] ?? 0;
    const b = image.data[j + 2] ?? 0;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/**
 * Otsu threshold: the grey level that splits the histogram into two classes with the largest
 * between-class variance. On a figure it lands between the paper and the ink.
 */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v] = (hist[v] ?? 0) + 1;
  const total = gray.length;
  if (total === 0) return 128;
  let sum = 0;
  for (let v = 0; v < 256; v += 1) sum += v * (hist[v] ?? 0);
  let weightBelow = 0;
  let sumBelow = 0;
  let best = 0;
  let bestVariance = -1;
  for (let t = 0; t < 256; t += 1) {
    weightBelow += hist[t] ?? 0;
    if (weightBelow === 0) continue;
    const weightAbove = total - weightBelow;
    if (weightAbove === 0) break;
    sumBelow += t * (hist[t] ?? 0);
    const meanBelow = sumBelow / weightBelow;
    const meanAbove = (sum - sumBelow) / weightAbove;
    const diff = meanBelow - meanAbove;
    const variance = weightBelow * weightAbove * diff * diff;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

interface Run {
  readonly index: number;
  readonly start: number;
  readonly end: number;
}

const runLength = (run: Run): number => run.end - run.start + 1;

/** The longest unbroken dark run in each row, over the rows given. */
function longestRowRun(ink: Uint8Array, width: number, rows: readonly number[]): Run | null {
  let best: Run | null = null;
  for (const y of rows) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const dark = x < width && ink[y * width + x] === 1;
      if (dark && start === -1) start = x;
      else if (!dark && start !== -1) {
        const run = { index: y, start, end: x - 1 };
        if (best === null || runLength(run) > runLength(best)) best = run;
        start = -1;
      }
    }
  }
  return best;
}

/** The longest unbroken dark run in each column, over the columns given. */
function longestColumnRun(
  ink: Uint8Array,
  width: number,
  height: number,
  columns: readonly number[],
): Run | null {
  let best: Run | null = null;
  for (const x of columns) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const dark = y < height && ink[y * width + x] === 1;
      if (dark && start === -1) start = y;
      else if (!dark && start !== -1) {
        const run = { index: x, start, end: y - 1 };
        if (best === null || runLength(run) > runLength(best)) best = run;
        start = -1;
      }
    }
  }
  return best;
}

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
};

/** The fallback when detection fails: an 8% inset of the whole image. */
function insetBox(image: Raster): DetectedBox {
  const dx = Math.round(image.width * 0.08);
  const dy = Math.round(image.height * 0.08);
  return {
    left: dx,
    right: image.width - 1 - dx,
    top: dy,
    bottom: image.height - 1 - dy,
    confident: false,
  };
}

/**
 * Find the plot frame: the longest dark vertical run in the left part of the image is the y axis,
 * the longest dark horizontal run in the bottom part is the x axis, and their extents give the
 * opposite two edges. Figures that draw a full box and figures that draw only two axes both work,
 * because the two runs are measured independently.
 */
export function detectPlotBox(image: Raster, options: DetectOptions = {}): DetectedBox {
  const { minRunShare = 0.35, leftShare = 0.4, bottomShare = 0.6 } = options;
  if (image.width < 8 || image.height < 8) return insetBox(image);

  const gray = grayscale(image);
  const threshold = otsuThreshold(gray);
  const ink = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) ink[i] = (gray[i] ?? 255) <= threshold ? 1 : 0;

  const yAxis = longestColumnRun(
    ink,
    image.width,
    image.height,
    range(0, Math.max(1, Math.round(image.width * leftShare))),
  );
  const xAxis = longestRowRun(
    ink,
    image.width,
    range(Math.round(image.height * (1 - bottomShare)), image.height - 1),
  );

  const tallEnough = yAxis !== null && runLength(yAxis) >= image.height * minRunShare;
  const wideEnough = xAxis !== null && runLength(xAxis) >= image.width * minRunShare;
  if (!tallEnough || !wideEnough || yAxis === null || xAxis === null) return insetBox(image);

  // The axes themselves are ink; the data area starts just inside them.
  const left = Math.max(yAxis.index, xAxis.start);
  const right = Math.max(left + 1, xAxis.end);
  const top = Math.min(yAxis.start, xAxis.index - 1);
  const bottom = Math.min(Math.max(top + 1, xAxis.index), yAxis.end);
  return { left, right, top, bottom, confident: true };
}
