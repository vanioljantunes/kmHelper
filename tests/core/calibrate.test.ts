import { describe, expect, it } from 'vitest';
import { createCalibration, unitScale, validateAxes } from '../../src/core/calibrate';
import type { AxisValues, PlotBox } from '../../src/core/types';

const BOX: PlotBox = { left: 100, right: 500, top: 50, bottom: 450 };
const PROB: AxisValues = { tMin: 0, tMax: 40, yMin: 0, yMax: 1, unit: 'probability' };
const PERCENT: AxisValues = { tMin: 0, tMax: 40, yMin: 0, yMax: 100, unit: 'percent' };

describe('unitScale', () => {
  it('is 1 for a probability axis and 100 for a percent axis', () => {
    expect(unitScale(PROB)).toBe(1);
    expect(unitScale(PERCENT)).toBe(100);
  });
});

describe('createCalibration', () => {
  it('maps the corners of the box to the ends of the axes', () => {
    const { toData } = createCalibration(BOX, PROB);
    expect(toData(100, 450)).toEqual({ t: 0, s: 0 });
    expect(toData(500, 50)).toEqual({ t: 40, s: 1 });
  });

  it('reads a percent axis back as a probability', () => {
    const { toData } = createCalibration(BOX, PERCENT);
    expect(toData(300, 250).s).toBeCloseTo(0.5, 12);
    expect(toData(100, 50).s).toBeCloseTo(1, 12);
  });

  it('round-trips pixels through data and back', () => {
    const { toData, toPixel } = createCalibration(BOX, PERCENT);
    const back = toPixel(toData(321, 187));
    expect(back.x).toBeCloseTo(321, 9);
    expect(back.y).toBeCloseTo(187, 9);
  });

  it('handles a y axis that does not start at zero', () => {
    const axes: AxisValues = { tMin: 0, tMax: 40, yMin: 50, yMax: 100, unit: 'percent' };
    const { toData } = createCalibration(BOX, axes);
    expect(toData(100, 450).s).toBeCloseTo(0.5, 12);
    expect(toData(100, 250).s).toBeCloseTo(0.75, 12);
  });

  it('handles a time axis that does not start at zero', () => {
    const axes: AxisValues = { tMin: 6, tMax: 66, yMin: 0, yMax: 1, unit: 'probability' };
    const { toData } = createCalibration(BOX, axes);
    expect(toData(100, 450).t).toBeCloseTo(6, 12);
    expect(toData(300, 450).t).toBeCloseTo(36, 12);
  });
});

describe('validateAxes', () => {
  it('accepts sensible values', () => {
    expect(validateAxes(BOX, PROB)).toEqual([]);
    expect(validateAxes(BOX, PERCENT)).toEqual([]);
  });

  it('rejects a blank field', () => {
    const axes = { ...PROB, tMax: Number.NaN };
    expect(validateAxes(BOX, axes)).toEqual([{ field: 'tMax', message: 'Enter a number.' }]);
  });

  it('rejects a reversed time axis', () => {
    expect(validateAxes(BOX, { ...PROB, tMin: 40, tMax: 0 })).toMatchObject([{ field: 'tMax' }]);
  });

  it('rejects a reversed y axis', () => {
    expect(validateAxes(BOX, { ...PROB, yMin: 1, yMax: 0 })).toMatchObject([{ field: 'yMax' }]);
  });

  it('catches a 0 to 100 axis left on the probability unit', () => {
    const problems = validateAxes(BOX, { ...PROB, yMax: 100 });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('Switch the unit to percent');
  });

  it('catches a plot area with no size', () => {
    const flat = { left: 100, right: 100, top: 50, bottom: 450 };
    expect(validateAxes(flat, PROB)).toMatchObject([{ field: 'box' }]);
  });
});
