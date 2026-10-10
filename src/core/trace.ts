import type { Calibration } from './calibrate';
import type { MaskResult } from './mask';
import type { CurvePoint, TraceResult } from './types';

export interface TraceOptions {
  /** Blank columns wider than this end the curve instead of being bridged. */
  readonly maxGap?: number;
  /** A matched run longer than this many stroke widths is a riser or a censoring mark. */
  readonly tallFactor?: number;
  /** Keep a point when survival moves by more than this. */
  readonly thinSurvival?: number;
  /** Keep a point when time advances by more than this share of the time axis. */
  readonly thinTimeFraction?: number;
}

interface Run {
  readonly start: number;
  readonly end: number;
}

const length = (run: Run): number => run.end - run.start + 1;
const centre = (run: Run): number => (run.start + run.end) / 2;

/** Distance from y to a run: zero inside it, otherwise the gap to its nearer end. */
function distanceTo(run: Run, y: number): number {
  if (y >= run.start && y <= run.end) return 0;
  return y < run.start ? run.start - y : y - run.end;
}

/** The contiguous matched runs in one column of the mask. */
function columnRuns(mask: MaskResult, x: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let y = 0; y <= mask.height; y += 1) {
    const on = y < mask.height && mask.mask[y * mask.width + x] === 1;
    if (on && start === -1) start = y;
    else if (!on && start !== -1) {
      runs.push({ start, end: y - 1 });
      start = -1;
    }
  }
  return runs;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 1;
  return ((sorted[mid - 1] ?? 1) + (sorted[mid] ?? 1)) / 2;
}

/**
 * Where to start the trace: the topmost run that persists across the following columns, in the
 * earliest column that has one. A Kaplan-Meier curve is non-increasing, so its leftmost point is
 * its highest; requiring persistence keeps a stray mark from becoming the start. A legend drawn
 * inside the plot is excluded by dragging the plot-box handles inward, not by this rule.
 */
function findStart(
  runsByColumn: readonly Run[][],
  maxJump: number,
): { x: number; y: number } | null {
  let fallback: { x: number; y: number } | null = null;
  for (let x = 0; x < runsByColumn.length; x += 1) {
    const runs = runsByColumn[x];
    if (runs === undefined || runs.length === 0) continue;
    for (const run of runs) {
      const y = centre(run);
      if (fallback === null) fallback = { x, y };
      let seen = 0;
      for (let k = 1; k <= 8 && x + k < runsByColumn.length; k += 1) {
        const ahead = runsByColumn[x + k];
        if (ahead === undefined) continue;
        if (ahead.some((candidate) => distanceTo(candidate, y) <= maxJump)) seen += 1;
      }
      if (seen >= 4) return { x, y };
    }
  }
  return fallback;
}

/**
 * Follow one arm across the plot box, column by column, and return its step function in data
 * coordinates.
 *
 * Three things have to be told apart, and all three fall out of the same column scan: a horizontal
 * stroke (a short run, the current survival level), a vertical riser (a tall run whose neighbours
 * sit at two different levels, an event), and a censoring mark (a tall run whose neighbours sit at
 * the same level, printed through the curve). The riser is kept as two points so the step
 * survives; the censoring mark is recorded separately and left out of the curve.
 */
export function traceCurve(
  mask: MaskResult,
  origin: { readonly left: number; readonly top: number },
  calibration: Calibration,
  options: TraceOptions = {},
): TraceResult {
  const { maxGap = 5, tallFactor = 2, thinSurvival = 0.001, thinTimeFraction = 1 / 200 } = options;
  const empty: TraceResult = {
    points: [],
    tickTimes: [],
    strokeWidth: 0,
    bridgedColumns: 0,
    endedEarlyAt: null,
  };
  if (mask.width === 0 || mask.height === 0 || mask.matched === 0) return empty;

  const runsByColumn: Run[][] = [];
  const lengths: number[] = [];
  for (let x = 0; x < mask.width; x += 1) {
    const runs = columnRuns(mask, x);
    runsByColumn.push(runs);
    for (const run of runs) lengths.push(length(run));
  }
  const strokeWidth = Math.max(1, Math.round(median(lengths)));
  const tallMin = Math.max(strokeWidth + 2, Math.ceil(strokeWidth * tallFactor));
  const maxJump = Math.max(3, strokeWidth * 2 + 2);
  /* A level counts as held only within antialiasing distance; see the mark test below. */
  const sameLevel = Math.max(1, Math.round(strokeWidth / 2));
  /** How far the curve may be re-acquired after a bridged break. */
  const reacquireJump = Math.max(maxJump, Math.round(mask.height * 0.25));
  /**
   * A censoring mark is drawn at a fixed small size, so a tall run beyond this height is a step,
   * however its neighbours look.
   */
  const tickMaxHeight = Math.max(strokeWidth * 4 + 2, Math.round(mask.height * 0.06));

  const start = findStart(runsByColumn, maxJump);
  if (start === null) return empty;

  const samples: Array<{ x: number; y: number }> = [];
  const tickColumns: number[] = [];
  let bridgedColumns = 0;
  let endedEarlyColumn: number | null = null;
  let currentY = start.y;
  let gap = 0;
  /** The riser taken most recently, so its trailing columns are not read as a second object. */
  let lastRiser: { column: number; start: number; end: number } | null = null;

  /**
   * The level of the short run nearest the current level, over the next three columns. All three
   * columns are weighed together on purpose: taking the nearest run in the first column that has
   * one lets a legend swatch a column or two ahead hijack the descent.
   */
  const lookAheadLevel = (x: number): number | null => {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let k = 1; k <= 3; k += 1) {
      const runs = runsByColumn[x + k];
      if (runs === undefined) continue;
      for (const run of runs) {
        if (length(run) >= tallMin) continue;
        const d = Math.abs(centre(run) - currentY);
        if (d < bestDistance) {
          bestDistance = d;
          best = centre(run);
        }
      }
    }
    return best;
  };

  samples.push({ x: start.x, y: currentY });
  for (let x = start.x + 1; x < mask.width; x += 1) {
    const runs = runsByColumn[x] ?? [];
    let picked: Run | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const run of runs) {
      const d = distanceTo(run, currentY);
      if (d < bestDistance) {
        bestDistance = d;
        picked = run;
      }
    }
    // After a break in the line the curve may well resume at a lower level, because the break can
    // straddle a step. Re-acquisition is therefore allowed to jump, but only downwards: survival
    // cannot rise, so an upward jump is ink (a legend, an axis label) rather than data.
    const descending = picked !== null && centre(picked) >= currentY - maxJump;
    const jumpLimit = gap > 0 && descending ? reacquireJump : maxJump;
    if (picked === null || bestDistance > jumpLimit) {
      gap += 1;
      if (gap > maxGap) {
        endedEarlyColumn = x - gap + 1;
        break;
      }
      bridgedColumns += 1;
      continue;
    }
    gap = 0;

    if (length(picked) < tallMin) {
      currentY = centre(picked);
      samples.push({ x, y: currentY });
      continue;
    }

    // A thick riser covers more than one column. Its trailing columns are the same riser, not a
    // mark printed through the curve, so they are consumed without emitting anything.
    if (
      lastRiser !== null &&
      x - lastRiser.column <= strokeWidth &&
      picked.start <= lastRiser.end &&
      picked.end >= lastRiser.start
    ) {
      lastRiser = { column: x, start: lastRiser.start, end: lastRiser.end };
      continue;
    }

    // A tall run is either an event or a censoring mark. A mark is drawn at a fixed small size
    // and sits across the line, so it reaches above the current level; a riser only ever goes
    // down from it. That difference is what separates them, because comparing the levels on
    // either side cannot: an event in a large trial drops the curve by only a pixel or two,
    // which is no further than a mark displaces it.
    const nextLevel = lookAheadLevel(x);
    const couldBeMark = length(picked) <= tickMaxHeight;
    const reachesAbove = currentY - picked.start > strokeWidth;
    const levelHeld = nextLevel !== null && Math.abs(nextLevel - currentY) <= sameLevel;
    if (couldBeMark && (reachesAbove || levelHeld)) {
      tickColumns.push(x);
      samples.push({ x, y: currentY });
      continue;
    }
    // The level after the step has to lie on the riser itself; anything else is another object
    // that happens to be in the arm colour.
    const onRun =
      nextLevel !== null && nextLevel >= picked.start - 1 && nextLevel <= picked.end + 1;
    const descended = onRun && nextLevel !== null ? nextLevel : picked.end;
    samples.push({ x, y: currentY });
    samples.push({ x, y: descended });
    currentY = descended;
    lastRiser = { column: x, start: picked.start, end: picked.end };
  }

  // Into data coordinates, clamped to a probability and forced non-increasing: a Kaplan-Meier
  // curve cannot rise, so anything that does is ink, not data.
  const raw: CurvePoint[] = [];
  let runningMin = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const { t, s } = calibration.toData(sample.x + origin.left, sample.y + origin.top);
    const clamped = Math.min(1, Math.max(0, s));
    runningMin = Math.min(runningMin, clamped);
    raw.push({ t, s: runningMin });
  }

  const points = thin(raw, thinSurvival, thinTimeFraction);
  const tickTimes = tickColumns.map((x) => calibration.toData(x + origin.left, origin.top).t);
  const endedEarlyAt =
    endedEarlyColumn === null
      ? null
      : calibration.toData(endedEarlyColumn + origin.left, origin.top).t;

  return { points, tickTimes, strokeWidth, bridgedColumns, endedEarlyAt };
}

/**
 * Drop points that say nothing new. A pixel-by-pixel trace gives one point per column, far more
 * than the reconstruction needs; keeping a point only when survival moves or enough time passes
 * leaves the step corners intact.
 */
export function thin(
  points: readonly CurvePoint[],
  thinSurvival: number,
  thinTimeFraction: number,
): CurvePoint[] {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return [...points];
  const timeStep = Math.abs(last.t - first.t) * thinTimeFraction;
  const kept: CurvePoint[] = [first];
  let anchor = first;
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    if (point === undefined) continue;
    if (Math.abs(point.s - anchor.s) > thinSurvival || point.t - anchor.t > timeStep) {
      kept.push(point);
      anchor = point;
    }
  }
  kept.push(last);
  return kept;
}
