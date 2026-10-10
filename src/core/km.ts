import type { IpdRow } from './guyot';

export interface KmStep {
  readonly time: number;
  readonly atRisk: number;
  readonly events: number;
  readonly censored: number;
  readonly surv: number;
  readonly lower: number;
  readonly upper: number;
}

export interface KmFit {
  readonly steps: readonly KmStep[];
  readonly n: number;
  readonly events: number;
  /** The first time survival reaches a half, or null when the curve never gets there. */
  readonly median: number | null;
  readonly medianLower: number | null;
  readonly medianUpper: number | null;
}

/** The two-sided normal quantile for the usual confidence levels. */
function zFor(level: number): number {
  if (Math.abs(level - 0.95) < 1e-9) return 1.959963984540054;
  if (Math.abs(level - 0.9) < 1e-9) return 1.6448536269514722;
  if (Math.abs(level - 0.99) < 1e-9) return 2.5758293035489004;
  // Acklam's inverse normal, good to about 1e-9, for any other level.
  return inverseNormal(1 - (1 - level) / 2);
}

/** Inverse standard normal CDF (Acklam), used only for unusual confidence levels. */
export function inverseNormal(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269,
    -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197,
    -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373,
    4.37466414146497, 2.93816398269878];
  const dd = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      ((((((c[0] ?? 0) * q + (c[1] ?? 0)) * q + (c[2] ?? 0)) * q + (c[3] ?? 0)) * q + (c[4] ?? 0)) * q + (c[5] ?? 0)) /
      ((((((dd[0] ?? 0) * q + (dd[1] ?? 0)) * q + (dd[2] ?? 0)) * q + (dd[3] ?? 0)) * q + 1))
    );
  }
  if (p > 1 - pLow) return -inverseNormal(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] ?? 0) * r + (a[1] ?? 0)) * r + (a[2] ?? 0)) * r + (a[3] ?? 0)) * r + (a[4] ?? 0)) * r + (a[5] ?? 0)) * q /
    (((((((b[0] ?? 0) * r + (b[1] ?? 0)) * r + (b[2] ?? 0)) * r + (b[3] ?? 0)) * r + (b[4] ?? 0)) * r + 1))
  );
}

/**
 * The Kaplan-Meier estimate with a log-log confidence band, matching
 * survfit(..., conf.type = "log-log") in R's survival package.
 *
 * A row appears at every distinct observed time, whether an event happened there or only a
 * censoring, which is what survfit prints and what the risk table is read from. The median
 * interval is Brookmeyer and Crowley's: the first time the band itself crosses a half.
 */
export function kaplanMeier(rows: readonly IpdRow[], level = 0.95): KmFit {
  const z = zFor(level);
  const times = [...new Set(rows.map((row) => row.time))].sort((a, b) => a - b);
  const steps: KmStep[] = [];
  let surv = 1;
  let cumulative = 0; // sum of d / (n * (n - d)), the Greenwood term
  let totalEvents = 0;
  for (const time of times) {
    const atRisk = rows.filter((row) => row.time >= time).length;
    const events = rows.filter((row) => row.time === time && row.status === 1).length;
    const censored = rows.filter((row) => row.time === time && row.status === 0).length;
    if (atRisk > 0 && events > 0) {
      surv *= 1 - events / atRisk;
      if (atRisk - events > 0) cumulative += events / (atRisk * (atRisk - events));
      totalEvents += events;
    }
    let lower = surv;
    let upper = surv;
    if (surv > 0 && surv < 1 && cumulative > 0) {
      // On the log(-log) scale, then back. This keeps the band inside 0 and 1.
      const logLog = Math.log(-Math.log(surv));
      const se = Math.sqrt(cumulative) / Math.abs(Math.log(surv));
      lower = Math.exp(-Math.exp(logLog + z * se));
      upper = Math.exp(-Math.exp(logLog - z * se));
    }
    steps.push({ time, atRisk, events, censored, surv, lower, upper });
  }

  const firstBelow = (pick: (step: KmStep) => number): number | null => {
    for (const step of steps) if (pick(step) <= 0.5) return step.time;
    return null;
  };

  return {
    steps,
    n: rows.length,
    events: totalEvents,
    median: firstBelow((step) => step.surv),
    // The interval is the times whose confidence band still covers a half. The lower band falls
    // to a half first, so it gives the lower limit, and the upper band the upper limit.
    medianLower: firstBelow((step) => step.lower),
    medianUpper: firstBelow((step) => step.upper),
  };
}

/** Survival and its band at one time, read off the step function. */
export function survivalAt(fit: KmFit, time: number): { surv: number; lower: number; upper: number } {
  let current = { surv: 1, lower: 1, upper: 1 };
  for (const step of fit.steps) {
    if (step.time > time) break;
    current = { surv: step.surv, lower: step.lower, upper: step.upper };
  }
  return current;
}
