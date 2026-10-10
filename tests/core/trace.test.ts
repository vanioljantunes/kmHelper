import { describe, expect, it } from 'vitest';
import { createCalibration } from '../../src/core/calibrate';
import { rgbToLab } from '../../src/core/color';
import { buildMask } from '../../src/core/mask';
import { traceCurve } from '../../src/core/trace';
import type { AxisValues, CurvePoint, PlotBox } from '../../src/core/types';
import { createCanvas, drawAxes, drawHLine, drawStepCurve, type Canvas, type Rgb } from '../helpers/draw';

const BOX: PlotBox = { left: 70, right: 670, top: 30, bottom: 430 };
const AXES: AxisValues = { tMin: 0, tMax: 60, yMin: 0, yMax: 1, unit: 'probability' };
const BLUE: Rgb = [31, 119, 180];
const ORANGE: Rgb = [255, 127, 14];

/** The step corners of a Kaplan-Meier curve, time ascending. */
const TRUTH: readonly CurvePoint[] = [
  { t: 0, s: 1 },
  { t: 6, s: 0.9 },
  { t: 13, s: 0.78 },
  { t: 21, s: 0.64 },
  { t: 30, s: 0.5 },
  { t: 41, s: 0.37 },
  { t: 52, s: 0.26 },
];

/** Survival read off a step function at one time. */
function survivalAt(points: readonly CurvePoint[], t: number): number {
  let s = points[0]?.s ?? 1;
  for (const point of points) {
    if (point.t <= t) s = point.s;
    else break;
  }
  return s;
}

/** The truth read at the same times, for comparison. */
function truthAt(t: number): number {
  return survivalAt(TRUTH, t);
}

interface FigureOptions {
  readonly thickness?: number;
  readonly antialias?: boolean;
  readonly tickTimes?: readonly number[];
  readonly skipColumns?: readonly number[];
  readonly secondArm?: boolean;
  readonly legendSwatch?: boolean;
}

function figure(options: FigureOptions = {}): Canvas {
  const c = createCanvas(700, 460);
  drawAxes(c, BOX);
  if (options.secondArm) {
    drawStepCurve(
      c,
      BOX,
      AXES,
      [
        { t: 0, s: 1 },
        { t: 8, s: 0.82 },
        { t: 19, s: 0.6 },
        { t: 33, s: 0.34 },
        { t: 48, s: 0.15 },
      ],
      ORANGE,
      { thickness: 2 },
    );
  }
  if (options.legendSwatch) {
    // A legend line in the arm colour, drawn inside the plot well below the curve.
    drawHLine(c, 410, 480, 520, BLUE, 2);
  }
  drawStepCurve(c, BOX, AXES, TRUTH, BLUE, {
    thickness: options.thickness ?? 2,
    antialias: options.antialias ?? false,
    tickTimes: options.tickTimes ?? [],
    skipColumns: options.skipColumns ?? [],
  });
  return c;
}

function trace(c: Canvas, tolerance = 12, target: Rgb = BLUE) {
  const mask = buildMask(c, BOX, rgbToLab({ r: target[0], g: target[1], b: target[2] }), tolerance);
  return traceCurve(mask, { left: BOX.left, top: BOX.top }, createCalibration(BOX, AXES));
}

const SAMPLE_TIMES = [1, 5, 7, 12, 15, 20, 25, 29, 35, 40, 45, 50, 55];

describe('traceCurve', () => {
  it('recovers a clean step curve to within a hundredth of survival', () => {
    const result = trace(figure());
    expect(result.points.length).toBeGreaterThan(20);
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(result.points, t)).toBeCloseTo(truthAt(t), 2);
    }
  });

  it('reports the stroke width it measured', () => {
    expect(trace(figure({ thickness: 2 })).strokeWidth).toBe(2);
    expect(trace(figure({ thickness: 4 })).strokeWidth).toBe(4);
  });

  it('never lets survival rise', () => {
    const { points } = trace(figure({ thickness: 3, antialias: true }));
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]?.s).toBeLessThanOrEqual((points[i - 1]?.s ?? 1) + 1e-12);
    }
  });

  it('keeps survival inside zero and one', () => {
    for (const point of trace(figure()).points) {
      expect(point.s).toBeGreaterThanOrEqual(0);
      expect(point.s).toBeLessThanOrEqual(1);
    }
  });

  it('traces an anti-aliased stroke as accurately as a hard-edged one', () => {
    const result = trace(figure({ thickness: 3, antialias: true }));
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(result.points, t)).toBeCloseTo(truthAt(t), 2);
    }
  });
});

describe('traceCurve against the things that break a naive scan', () => {
  it('treats censoring marks as marks, not as events', () => {
    const tickTimes = [3, 10, 17, 25, 36, 47];
    const marked = trace(figure({ tickTimes }));
    const plain = trace(figure());
    // The curve is unchanged: a mark printed through the line must not become a drop.
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(marked.points, t)).toBeCloseTo(truthAt(t), 2);
      expect(survivalAt(marked.points, t)).toBeCloseTo(survivalAt(plain.points, t), 3);
    }
    // And each mark is reported, within a time step of where it was printed.
    expect(marked.tickTimes.length).toBeGreaterThanOrEqual(tickTimes.length);
    for (const t of tickTimes) {
      const nearest = Math.min(...marked.tickTimes.map((found) => Math.abs(found - t)));
      expect(nearest).toBeLessThan(0.4);
    }
  });

  it('finds no censoring marks when none are printed', () => {
    expect(trace(figure()).tickTimes).toEqual([]);
  });

  it('bridges a short break in the line', () => {
    // Columns 200 to 202 sit on the step at t = 13, which is the case that matters: the break
    // hides the riser, so the curve has to be picked up again at the lower level.
    const result = trace(figure({ skipColumns: [200, 201, 202, 300] }));
    expect(result.bridgedColumns).toBeGreaterThan(0);
    expect(result.endedEarlyAt).toBeNull();
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(result.points, t)).toBeCloseTo(truthAt(t), 2);
    }
  });

  it('stops and says where when the break is too wide to bridge', () => {
    const wide: number[] = [];
    for (let x = 400; x <= 440; x += 1) wide.push(x);
    const result = trace(figure({ skipColumns: wide }));
    expect(result.endedEarlyAt).not.toBeNull();
    // Column 400 sits at (400 - 70) / 600 of a 0 to 60 axis.
    expect(result.endedEarlyAt ?? 0).toBeCloseTo(33, 0);
  });

  it('ignores a second arm drawn in another colour', () => {
    const result = trace(figure({ secondArm: true }));
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(result.points, t)).toBeCloseTo(truthAt(t), 2);
    }
  });

  it('ignores a legend line in the arm colour drawn inside the plot', () => {
    const result = trace(figure({ legendSwatch: true }));
    for (const t of SAMPLE_TIMES) {
      expect(survivalAt(result.points, t)).toBeCloseTo(truthAt(t), 2);
    }
  });

  it('returns nothing when no pixel matches the colour', () => {
    const result = trace(figure(), 5, [0, 200, 0]);
    expect(result.points).toEqual([]);
    expect(result.strokeWidth).toBe(0);
  });

  it('thins the trace to a manageable number of points', () => {
    const { points } = trace(figure());
    expect(points.length).toBeLessThan(300);
  });
});
