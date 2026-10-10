import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCalibration } from '../../src/core/calibrate';
import { rgbToLab } from '../../src/core/color';
import { buildMask } from '../../src/core/mask';
import { detectPlotBox } from '../../src/core/plotbox';
import { traceCurve } from '../../src/core/trace';
import type { AxisValues, CurvePoint } from '../../src/core/types';
import { decodePng } from '../helpers/png';

interface Truth {
  readonly image: { readonly width: number; readonly height: number };
  readonly box: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly axes: AxisValues;
  readonly arms: ReadonlyArray<{
    readonly name: string;
    readonly colour: [number, number, number];
    readonly total: number;
    readonly events: number;
    readonly curve: readonly CurvePoint[];
    readonly ipd: ReadonlyArray<{ readonly time: number; readonly status: number }>;
  }>;
}

const DIR = resolve(__dirname, '../fixtures');
const image = decodePng(readFileSync(`${DIR}/km-two-arms.png`));
const truth = JSON.parse(readFileSync(`${DIR}/km-two-arms.json`, 'utf8')) as Truth;

function survivalAt(points: readonly CurvePoint[], t: number): number {
  let s = points[0]?.s ?? 1;
  for (const point of points) {
    if (point.t <= t) s = point.s;
    else break;
  }
  return s;
}

/**
 * The figure in tests/fixtures was drawn from patient data we generated, so the curve printed in
 * it is known exactly. This reads the picture back through the whole pipeline and measures the
 * error, which is the only check that matters: a trace that runs but is a percentage point off
 * would push every reconstruction off with it.
 */
describe('reading a figure back', () => {
  const detected = detectPlotBox(image);

  it('decodes the fixture at the size it was written', () => {
    expect(image.width).toBe(truth.image.width);
    expect(image.height).toBe(truth.image.height);
  });

  it('finds the plot box the figure was drawn with', () => {
    expect(detected.confident).toBe(true);
    expect(detected.left).toBe(truth.box.left);
    expect(detected.right).toBe(truth.box.right);
    expect(detected.bottom).toBe(truth.box.bottom);
    // The top of the frame is where the first curve sits, since the fixture draws no top rule.
    expect(detected.top).toBeLessThanOrEqual(truth.box.top + 2);
  });

  for (const arm of truth.arms) {
    describe(arm.name, () => {
      const calibration = createCalibration(detected, truth.axes);
      const mask = buildMask(
        image,
        detected,
        rgbToLab({ r: arm.colour[0], g: arm.colour[1], b: arm.colour[2] }),
      );
      const result = traceCurve(mask, { left: detected.left, top: detected.top }, calibration);
      const times = [1, 6, 12, 18, 24, 30, 36, 42, 48, 54, 59];
      const errors = times.map((t) =>
        Math.abs(survivalAt(result.points, t) - survivalAt(arm.curve, t)),
      );

      it('traces the whole width of the figure', () => {
        expect(result.endedEarlyAt).toBeNull();
        expect(result.points.length).toBeGreaterThan(30);
        expect(result.points[result.points.length - 1]?.t ?? 0).toBeGreaterThan(58);
      });

      it('reads survival to within one percentage point at every checked time', () => {
        for (const [index, error] of errors.entries()) {
          expect(error, `t = ${String(times[index])}`).toBeLessThan(0.01);
        }
      });

      it('has a root mean squared error under half a percentage point', () => {
        const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
        expect(rmse).toBeLessThan(0.005);
      });

      it('never rises', () => {
        for (let i = 1; i < result.points.length; i += 1) {
          expect(result.points[i]?.s).toBeLessThanOrEqual((result.points[i - 1]?.s ?? 1) + 1e-12);
        }
      });

      it('finds censoring marks without turning them into events', () => {
        // Marks that fall in the same pixel column, or on a step, cannot be separated, so the
        // count is a floor. What must not happen is the opposite: reporting more marks than
        // there were censored patients would mean events had been swallowed as marks.
        const censored = arm.ipd.filter((row) => row.status === 0).length;
        const distinctColumns = new Set(
          arm.ipd
            .filter((row) => row.status === 0)
            .map((row) => Math.round((row.time / 60) * (detected.right - detected.left))),
        ).size;
        expect(result.tickTimes.length).toBeGreaterThan(5);
        expect(result.tickTimes.length).toBeLessThanOrEqual(distinctColumns);
        expect(result.tickTimes.length).toBeLessThanOrEqual(censored);
      });
    });
  }
});
