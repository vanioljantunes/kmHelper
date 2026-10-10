import type { CurvePoint } from './types';

export interface RiskPoint {
  readonly time: number;
  readonly atRisk: number;
}

/** A digitized point after cleaning, numbered from 1 as the reference implementation numbers it. */
export interface PreparedPoint {
  readonly id: number;
  readonly time: number;
  readonly surv: number;
  readonly interval: number;
}

/** One risk interval and the span of digitized points inside it. */
export interface IntervalRow {
  readonly interval: number;
  readonly lower: number;
  readonly upper: number;
  readonly tRisk: number;
  readonly nRisk: number;
}

export interface Prepared {
  readonly points: readonly PreparedPoint[];
  readonly intervals: readonly IntervalRow[];
  /** The smallest published risk number, when the curve runs past the last risk time. */
  readonly endpts: number | null;
  /**
   * 'risk-table' when numbers at risk were given, 'total-only' when the reconstruction has just
   * the arm total to work from. The second is far weaker and is labelled wherever it is shown.
   */
  readonly confidence: 'risk-table' | 'total-only';
  readonly dropped: number;
}

export class PreprocessError extends Error {}

/** R's default quantile (type 7), so the outlier rule below behaves as the reference does. */
export function quantileType7(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0] ?? Number.NaN;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  const low = sorted[lo] ?? Number.NaN;
  const high = sorted[hi] ?? Number.NaN;
  return low + (h - lo) * (high - low);
}

/**
 * Clean the digitized curve and attach it to the risk table, following IPDfromKM's preprocess().
 *
 * The steps are the reference ones, in the reference order: drop a lone spike between two
 * ordinary steps, force the curve non-increasing, keep only the top and bottom reading at each
 * time, clip to a probability, make sure the curve starts at (0, 1), and number the points so
 * each falls in the risk interval that contains it.
 */
export function preprocess(
  rawPoints: readonly CurvePoint[],
  risk: readonly RiskPoint[],
  total: number | null,
): Prepared {
  const clean = rawPoints
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.s))
    .slice()
    .sort((a, b) => a.t - b.t);
  if (clean.length < 5) throw new PreprocessError('Not enough points were read from the curve.');

  // A reading that jumps far further than its neighbours, with ordinary steps before it and an
  // unusual one after, is ink rather than curve; the reference drops exactly that pattern.
  const span = clean.map((point, index) =>
    Math.abs(point.s - (clean[index - 1] ?? clean[0] ?? point).s),
  );
  const q1 = quantileType7(span, 0.25);
  const q3 = quantileType7(span, 0.75);
  const iqr = q3 - q1;
  const isOutlier = span.map((value) => value <= q1 - 0.5 * iqr || value >= q3 + 0.5 * iqr);
  const keep = clean.filter((_, index) => {
    const previous = index === 0 ? false : (isOutlier[index - 1] ?? false);
    const next = index === clean.length - 1 ? true : (isOutlier[index + 1] ?? false);
    const takeaway = (isOutlier[index] ?? false) && !previous && next;
    return !takeaway;
  });

  // Force non-increasing, then keep only the highest and lowest reading at each time: those two
  // are the top and bottom of a step, and everything between them says nothing.
  const monotone: Array<{ time: number; surv: number }> = [];
  let last = Number.POSITIVE_INFINITY;
  for (const point of keep) {
    const surv = Math.min(point.s, last);
    last = surv;
    monotone.push({ time: point.t, surv });
  }
  const byTime = new Map<number, number[]>();
  for (const { time, surv } of monotone) {
    const bucket = byTime.get(time);
    if (bucket === undefined) byTime.set(time, [surv]);
    else bucket.push(surv);
  }
  const reduced: Array<{ time: number; surv: number }> = [];
  for (const [time, survs] of [...byTime.entries()].sort((a, b) => a[0] - b[0])) {
    const high = Math.max(...survs);
    const low = Math.min(...survs);
    if (time < 0) continue;
    for (const surv of high === low ? [high] : [high, low]) {
      if (surv >= 0 && surv <= 1) reduced.push({ time, surv });
    }
  }
  if (reduced.length === 0) throw new PreprocessError('No usable points were left after cleaning.');
  const first = reduced[0];
  if (first === undefined || first.time !== 0 || first.surv !== 1) {
    reduced.unshift({ time: 0, surv: 1 });
  }

  // The risk table, with trailing zeros trimmed as the reference trims them.
  let times: number[];
  let numbers: number[];
  let confidence: Prepared['confidence'];
  if (risk.length > 0) {
    const sorted = [...risk].sort((a, b) => a.time - b.time);
    let n = sorted.length;
    while (n > 1 && (sorted[n - 1]?.atRisk ?? 0) === 0 && (sorted[n - 2]?.atRisk ?? 0) === 0) {
      n -= 1;
    }
    times = sorted.slice(0, n).map((row) => row.time);
    numbers = sorted.slice(0, n).map((row) => row.atRisk);
    confidence = 'risk-table';
  } else if (total !== null && Number.isFinite(total) && total > 0) {
    times = [0];
    numbers = [total];
    confidence = 'total-only';
  } else {
    throw new PreprocessError(
      'Give the numbers at risk, or at least the number of patients in the arm.',
    );
  }

  const intervalOf = (time: number): number => {
    let interval = 1;
    for (let i = 2; i <= times.length; i += 1) if (time >= (times[i - 1] ?? 0)) interval = i;
    return interval;
  };
  const points: PreparedPoint[] = reduced.map((row, index) => ({
    id: index + 1,
    time: row.time,
    surv: row.surv,
    interval: intervalOf(row.time),
  }));

  const intervals: IntervalRow[] = [];
  for (const point of points) {
    const existing = intervals[intervals.length - 1];
    if (existing !== undefined && existing.interval === point.interval) {
      intervals[intervals.length - 1] = { ...existing, upper: point.id };
      continue;
    }
    intervals.push({
      interval: point.interval,
      lower: point.id,
      upper: point.id,
      tRisk: times[point.interval - 1] ?? 0,
      nRisk: numbers[point.interval - 1] ?? 0,
    });
  }

  const maxCovered = Math.max(...intervals.map((row) => row.tRisk));
  const endpts = maxCovered < Math.max(...times) ? Math.min(...numbers) : null;

  return {
    points,
    intervals,
    endpts,
    confidence,
    dropped: clean.length - keep.length,
  };
}
