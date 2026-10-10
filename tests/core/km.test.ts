import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coxHazardRatio, logRank, normalCdf } from '../../src/core/compare';
import { reconstructIpd, type IpdRow } from '../../src/core/guyot';
import { kaplanMeier, survivalAt } from '../../src/core/km';
import { preprocess, type RiskPoint } from '../../src/core/preprocess';

const DIR = resolve(__dirname, '../fixtures');

interface Digitized {
  readonly arms: ReadonlyArray<{
    readonly name: string;
    readonly total: number;
    readonly risk: readonly RiskPoint[];
    readonly points: ReadonlyArray<{ readonly t: number; readonly s: number }>;
  }>;
}

interface SurvivalExpected {
  readonly km: ReadonlyArray<{
    readonly time: readonly number[];
    readonly nrisk: readonly number[];
    readonly nevent: readonly number[];
    readonly ncensor: readonly number[];
    readonly surv: readonly number[];
    readonly lower: readonly number[];
    readonly upper: readonly number[];
    readonly median: number | null;
    readonly medianLower: number | null;
    readonly medianUpper: number | null;
  }>;
  readonly comparison: {
    readonly logrankChisq: number;
    readonly logrankObserved: readonly number[];
    readonly logrankExpected: readonly number[];
    readonly beta: number;
    readonly se: number;
    readonly hr: number;
    readonly hrLower: number;
    readonly hrUpper: number;
  };
}

const digitized = JSON.parse(readFileSync(`${DIR}/digitized.json`, 'utf8')) as Digitized;
const gold = JSON.parse(readFileSync(`${DIR}/survival-expected.json`, 'utf8')) as SurvivalExpected;

const reconstructed: IpdRow[][] = digitized.arms.map((arm) => {
  const prepared = preprocess(
    arm.points.map((point) => ({ t: point.t, s: point.s })),
    arm.risk,
    arm.total,
  );
  return [...reconstructIpd(prepared, arm.name).ipd];
});

/**
 * Checked against R's survival package rather than against hand arithmetic: the expectations in
 * tests/fixtures/survival-expected.json come from survfit, survdiff and coxph run on the very
 * same reconstructed patients. Regenerate with scripts/compare-ipdfromkm.R.
 */
describe('Kaplan-Meier against survfit', () => {
  digitized.arms.forEach((arm, index) => {
    const expected = gold.km[index];
    const rows = reconstructed[index];
    if (expected === undefined || rows === undefined) throw new Error('fixture mismatch');
    const fit = kaplanMeier(rows);

    describe(arm.name, () => {
      it('has a row at every distinct observed time', () => {
        expect(fit.steps.map((step) => Number(step.time.toFixed(6)))).toEqual([...expected.time]);
      });

      it('agrees on the risk set, events and censorings at each time', () => {
        expect(fit.steps.map((step) => step.atRisk)).toEqual([...expected.nrisk]);
        expect(fit.steps.map((step) => step.events)).toEqual([...expected.nevent]);
        expect(fit.steps.map((step) => step.censored)).toEqual([...expected.ncensor]);
      });

      it('agrees on survival at each time', () => {
        fit.steps.forEach((step, i) => {
          expect(step.surv).toBeCloseTo(expected.surv[i] ?? 0, 9);
        });
      });

      it('agrees on the log-log confidence band', () => {
        fit.steps.forEach((step, i) => {
          expect(step.lower).toBeCloseTo(expected.lower[i] ?? 0, 7);
          expect(step.upper).toBeCloseTo(expected.upper[i] ?? 0, 7);
        });
      });

      it('agrees on the median and its interval', () => {
        expect(fit.median).toBe(expected.median);
        expect(fit.medianLower).toBe(expected.medianLower);
        expect(fit.medianUpper).toBe(expected.medianUpper);
      });

      it('reads survival at a time off the step function', () => {
        const at = survivalAt(fit, 24);
        const step = [...fit.steps].filter((row) => row.time <= 24).pop();
        expect(at.surv).toBe(step?.surv);
      });
    });
  });
});

describe('comparing the two arms against survdiff and coxph', () => {
  const first = reconstructed[0];
  const second = reconstructed[1];
  if (first === undefined || second === undefined) throw new Error('fixture mismatch');

  it('matches the log-rank statistic', () => {
    const result = logRank(first, second);
    expect(result.chiSquare).toBeCloseTo(gold.comparison.logrankChisq, 6);
    expect(result.observed[0]).toBe(gold.comparison.logrankObserved[0]);
    expect(result.observed[1]).toBe(gold.comparison.logrankObserved[1]);
    expect(result.expected[0]).toBeCloseTo(gold.comparison.logrankExpected[0] ?? 0, 6);
  });

  it('matches the Cox hazard ratio and its interval', () => {
    const result = coxHazardRatio(first, second);
    expect(result.converged).toBe(true);
    expect(result.beta).toBeCloseTo(gold.comparison.beta, 8);
    expect(result.se).toBeCloseTo(gold.comparison.se, 8);
    expect(result.hazardRatio).toBeCloseTo(gold.comparison.hr, 7);
    expect(result.lower).toBeCloseTo(gold.comparison.hrLower, 7);
    expect(result.upper).toBeCloseTo(gold.comparison.hrUpper, 7);
  });

  it('gives a p value consistent with the statistic', () => {
    const result = logRank(first, second);
    expect(result.p).toBeLessThan(0.001);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
});
