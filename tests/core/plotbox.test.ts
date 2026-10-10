import { describe, expect, it } from 'vitest';
import { detectPlotBox, otsuThreshold } from '../../src/core/plotbox';
import { createCanvas, drawAxes, drawHLine, drawStepCurve, drawVLine } from '../helpers/draw';
import type { AxisValues } from '../../src/core/types';

const AXES: AxisValues = { tMin: 0, tMax: 60, yMin: 0, yMax: 1, unit: 'probability' };

describe('otsuThreshold', () => {
  it('lands between two well separated grey levels', () => {
    const gray = new Uint8Array([...new Array(50).fill(20), ...new Array(50).fill(220)]);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(20);
    expect(t).toBeLessThan(220);
  });

  it('does not throw on a single-valued image', () => {
    expect(() => otsuThreshold(new Uint8Array(10).fill(128))).not.toThrow();
  });
});

describe('detectPlotBox', () => {
  it('finds a two-axis frame', () => {
    const box = { left: 60, right: 380, top: 20, bottom: 260 };
    const c = createCanvas(400, 300);
    drawAxes(c, box);
    const found = detectPlotBox(c);
    expect(found.confident).toBe(true);
    expect(found.left).toBe(box.left);
    expect(found.right).toBe(box.right);
    expect(found.bottom).toBe(box.bottom);
    expect(found.top).toBe(box.top);
  });

  it('finds a full box frame, ignoring the top and right rules', () => {
    const box = { left: 50, right: 350, top: 25, bottom: 250 };
    const c = createCanvas(400, 300);
    drawAxes(c, box);
    drawHLine(c, box.top, box.left, box.right, [20, 20, 20]);
    drawVLine(c, box.right, box.top, box.bottom, [20, 20, 20]);
    const found = detectPlotBox(c);
    expect(found.confident).toBe(true);
    expect(found.left).toBe(box.left);
    expect(found.right).toBe(box.right);
    expect(found.top).toBe(box.top);
    expect(found.bottom).toBe(box.bottom);
  });

  it('is not fooled by a long flat curve near the top of the plot', () => {
    // A KM curve that stays at S = 1 for a while is a long horizontal dark run too, but it is
    // inside the plot, not in the bottom band where the x axis is looked for.
    const box = { left: 60, right: 380, top: 20, bottom: 260 };
    const c = createCanvas(400, 300);
    drawAxes(c, box);
    drawStepCurve(
      c,
      box,
      AXES,
      [
        { t: 0, s: 1 },
        { t: 50, s: 0.95 },
      ],
      [10, 10, 10],
      { thickness: 3 },
    );
    const found = detectPlotBox(c);
    expect(found.confident).toBe(true);
    expect(found.bottom).toBe(box.bottom);
    expect(found.left).toBe(box.left);
  });

  it('falls back to an inset and says so when there is no frame', () => {
    const found = detectPlotBox(createCanvas(200, 100));
    expect(found.confident).toBe(false);
    expect(found).toMatchObject({ left: 16, top: 8, right: 183, bottom: 91 });
  });

  it('falls back on an image too small to hold a figure', () => {
    expect(detectPlotBox(createCanvas(4, 4)).confident).toBe(false);
  });
});
