import type { IpdRow } from './guyot';
import { inverseNormal } from './km';

export interface LogRank {
  readonly chiSquare: number;
  readonly df: number;
  readonly p: number;
  readonly observed: readonly [number, number];
  readonly expected: readonly [number, number];
}

export interface CoxFit {
  /** log hazard ratio for the second arm against the first. */
  readonly beta: number;
  readonly se: number;
  readonly hazardRatio: number;
  readonly lower: number;
  readonly upper: number;
  readonly p: number;
  readonly converged: boolean;
}

/** Survival function of the chi-square distribution with one degree of freedom. */
export function chiSquareP(x: number, df = 1): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  if (df === 1) return 2 * (1 - normalCdf(Math.sqrt(x)));
  // Only one degree of freedom is needed here; anything else is a programming error.
  throw new Error('Only one degree of freedom is supported.');
}

/** Standard normal CDF by Abramowitz and Stegun 7.1.26, good to about 1e-7. */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

interface TimeBlock {
  readonly time: number;
  readonly atRisk: readonly [number, number];
  readonly events: readonly [number, number];
}

/** Risk sets and events at every distinct event time, split by arm. */
function blocks(first: readonly IpdRow[], second: readonly IpdRow[]): TimeBlock[] {
  const all = [...first, ...second];
  const eventTimes = [...new Set(all.filter((row) => row.status === 1).map((row) => row.time))].sort(
    (a, b) => a - b,
  );
  return eventTimes.map((time) => ({
    time,
    atRisk: [
      first.filter((row) => row.time >= time).length,
      second.filter((row) => row.time >= time).length,
    ] as const,
    events: [
      first.filter((row) => row.time === time && row.status === 1).length,
      second.filter((row) => row.time === time && row.status === 1).length,
    ] as const,
  }));
}

/**
 * The log-rank test. Observed against expected events in the first arm, pooled over event times,
 * with the hypergeometric variance; the same quantity survdiff() reports.
 */
export function logRank(first: readonly IpdRow[], second: readonly IpdRow[]): LogRank {
  let observed = 0;
  let expected = 0;
  let variance = 0;
  let observedSecond = 0;
  let expectedSecond = 0;
  for (const block of blocks(first, second)) {
    const n1 = block.atRisk[0];
    const n2 = block.atRisk[1];
    const n = n1 + n2;
    const d = block.events[0] + block.events[1];
    if (n < 2 || d === 0) continue;
    const e1 = (d * n1) / n;
    observed += block.events[0];
    expected += e1;
    observedSecond += block.events[1];
    expectedSecond += d - e1;
    variance += (d * (n1 / n) * (n2 / n) * (n - d)) / (n - 1);
  }
  const chiSquare = variance > 0 ? ((observed - expected) * (observed - expected)) / variance : 0;
  return {
    chiSquare,
    df: 1,
    p: chiSquareP(chiSquare),
    observed: [observed, observedSecond],
    expected: [expected, expectedSecond],
  };
}

/**
 * A Cox model with one binary covariate, fitted by Newton-Raphson on Efron's partial likelihood.
 *
 * Efron rather than Breslow because reconstructed data is full of ties: every event placed at a
 * digitized time lands on the same value, so the tie correction is not a detail here. It is also
 * what coxph() uses by default, which is what anyone checking this in R will compare against.
 */
export function coxHazardRatio(
  first: readonly IpdRow[],
  second: readonly IpdRow[],
  level = 0.95,
): CoxFit {
  const rows = [
    ...first.map((row) => ({ ...row, x: 0 })),
    ...second.map((row) => ({ ...row, x: 1 })),
  ];
  const eventTimes = [...new Set(rows.filter((row) => row.status === 1).map((row) => row.time))]
    .sort((a, b) => a - b);

  let beta = 0;
  let converged = false;
  let information = 0;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    let gradient = 0;
    information = 0;
    for (const time of eventTimes) {
      const atRisk = rows.filter((row) => row.time >= time);
      const dying = rows.filter((row) => row.time === time && row.status === 1);
      const d = dying.length;
      if (d === 0) continue;
      const w = (x: number): number => Math.exp(beta * x);
      const s0 = atRisk.reduce((sum, row) => sum + w(row.x), 0);
      const s1 = atRisk.reduce((sum, row) => sum + row.x * w(row.x), 0);
      const s2 = atRisk.reduce((sum, row) => sum + row.x * row.x * w(row.x), 0);
      const d0 = dying.reduce((sum, row) => sum + w(row.x), 0);
      const d1 = dying.reduce((sum, row) => sum + row.x * w(row.x), 0);
      const d2 = dying.reduce((sum, row) => sum + row.x * row.x * w(row.x), 0);
      gradient += dying.reduce((sum, row) => sum + row.x, 0);
      for (let l = 0; l < d; l += 1) {
        const share = l / d;
        const denominator = s0 - share * d0;
        if (denominator <= 0) continue;
        const mean = (s1 - share * d1) / denominator;
        gradient -= mean;
        information += (s2 - share * d2) / denominator - mean * mean;
      }
    }
    if (information <= 0) break;
    const step = gradient / information;
    beta += step;
    if (Math.abs(step) < 1e-10) {
      converged = true;
      break;
    }
  }

  const se = information > 0 ? Math.sqrt(1 / information) : Number.NaN;
  const z = inverseNormal(1 - (1 - level) / 2);
  return {
    beta,
    se,
    hazardRatio: Math.exp(beta),
    lower: Math.exp(beta - z * se),
    upper: Math.exp(beta + z * se),
    p: chiSquareP((beta / se) * (beta / se)),
    converged,
  };
}
