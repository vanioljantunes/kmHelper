import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reconstructIpd } from '../../src/core/guyot';
import { preprocess, type RiskPoint } from '../../src/core/preprocess';
import type { CurvePoint } from '../../src/core/types';

const DIR = resolve(__dirname, '../fixtures');

interface Digitized {
  readonly arms: ReadonlyArray<{
    readonly name: string;
    readonly total: number;
    readonly trueEvents: number;
    readonly risk: readonly RiskPoint[];
    readonly points: ReadonlyArray<{ readonly t: number; readonly s: number }>;
  }>;
}

interface Expected {
  readonly name: string;
  readonly preparedPoints: number;
  readonly intervals: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  readonly nRisk: readonly number[];
  readonly patients: number;
  readonly events: number;
  readonly censored: number;
  readonly median: number | null;
  readonly eventTimes: readonly number[];
  readonly censorTimes: readonly number[];
}

const digitized = JSON.parse(readFileSync(`${DIR}/digitized.json`, 'utf8')) as Digitized;
const expected = JSON.parse(readFileSync(`${DIR}/ipdfromkm-expected.json`, 'utf8')) as Expected[];

/**
 * The reconstruction is a port of IPDfromKM's getIPD(), so the only check worth making is against
 * the R package itself. scripts/compare-ipdfromkm.R puts the very same digitized curve through
 * IPDfromKM 0.1.10 and writes what it produced; these tests assert that our port agrees patient
 * for patient. Regenerate with:
 *
 *   npx vite-node scripts/digitize-fixture.ts && Rscript scripts/compare-ipdfromkm.R
 */
describe('against IPDfromKM 0.1.10', () => {
  for (const [index, arm] of digitized.arms.entries()) {
    const gold = expected[index];
    if (gold === undefined) throw new Error('The expected file does not cover every arm.');

    describe(arm.name, () => {
      const points: CurvePoint[] = arm.points.map((point) => ({ t: point.t, s: point.s }));
      const prepared = preprocess(points, arm.risk, arm.total);
      const result = reconstructIpd(prepared, arm.name);

      it('cleans the curve to the same points', () => {
        expect(prepared.points.length).toBe(gold.preparedPoints);
      });

      it('builds the same risk intervals', () => {
        expect(prepared.intervals.length).toBe(gold.intervals);
        expect(prepared.intervals.map((row) => row.lower)).toEqual([...gold.lower]);
        expect(prepared.intervals.map((row) => row.upper)).toEqual([...gold.upper]);
      });

      it('reconstructs the same number of patients, events and censorings', () => {
        expect(result.ipd.length).toBe(gold.patients);
        expect(result.totalEvents).toBe(gold.events);
        expect(result.totalCensored).toBe(gold.censored);
      });

      it('places every event at the same time', () => {
        const ours = result.ipd
          .filter((row) => row.status === 1)
          .map((row) => Number(row.time.toFixed(6)));
        expect(ours).toEqual([...gold.eventTimes].sort((a, b) => a - b));
      });

      it('places every censoring at the same time', () => {
        const ours = result.ipd
          .filter((row) => row.status === 0)
          .map((row) => Number(row.time.toFixed(6)));
        expect(ours).toEqual([...gold.censorTimes].sort((a, b) => a - b));
      });

      it('recovers close to the number of events the patients actually had', () => {
        // The figure was drawn from known data, so this is the end-to-end claim: read the
        // picture, reconstruct, and land on the trial that produced it.
        expect(Math.abs(result.totalEvents - arm.trueEvents)).toBeLessThanOrEqual(2);
      });
    });
  }
});
