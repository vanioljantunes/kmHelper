import type { AxisValues, CurvePoint, PlotBox } from './types';

export interface Calibration {
  /** Pixel coordinates to data coordinates. Survival always comes back as a probability. */
  readonly toData: (px: number, py: number) => CurvePoint;
  /** Data coordinates to pixel coordinates. */
  readonly toPixel: (point: CurvePoint) => { x: number; y: number };
}

export interface AxisProblem {
  readonly field: 'tMin' | 'tMax' | 'yMin' | 'yMax' | 'box';
  readonly message: string;
}

/** The divisor that turns the figure y numbers into a probability. */
export const unitScale = (axes: AxisValues): number => (axes.unit === 'percent' ? 100 : 1);

/**
 * What is wrong with the axis values, if anything. Checked before calibration so the UI can
 * explain the problem instead of producing silently wrong points.
 */
export function validateAxes(box: PlotBox, axes: AxisValues): AxisProblem[] {
  const problems: AxisProblem[] = [];
  for (const field of ['tMin', 'tMax', 'yMin', 'yMax'] as const) {
    if (!Number.isFinite(axes[field])) problems.push({ field, message: 'Enter a number.' });
  }
  if (problems.length > 0) return problems;
  if (axes.tMax <= axes.tMin) {
    problems.push({ field: 'tMax', message: 'The last time must be greater than the first.' });
  }
  if (axes.yMax <= axes.yMin) {
    problems.push({ field: 'yMax', message: 'The top of the y axis must be above the bottom.' });
  }
  const scale = unitScale(axes);
  if (axes.yMin / scale < -0.001 || axes.yMax / scale > 1.001) {
    problems.push({
      field: 'yMax',
      message:
        axes.unit === 'percent'
          ? 'Survival runs from 0 to 100 percent.'
          : 'Survival runs from 0 to 1. Switch the unit to percent for a 0 to 100 axis.',
    });
  }
  if (box.right <= box.left || box.bottom <= box.top) {
    problems.push({ field: 'box', message: 'Drag the handles so the plot area has a size.' });
  }
  return problems;
}

/**
 * Linear maps between pixels and data. Linear axes only: a log time axis would need its own
 * mapping and is out of scope, which the About section states.
 */
export function createCalibration(box: PlotBox, axes: AxisValues): Calibration {
  const scale = unitScale(axes);
  const sMin = axes.yMin / scale;
  const sMax = axes.yMax / scale;
  const spanX = box.right - box.left;
  const spanY = box.bottom - box.top;
  return {
    toData: (px, py) => ({
      t: axes.tMin + ((px - box.left) / spanX) * (axes.tMax - axes.tMin),
      s: sMax - ((py - box.top) / spanY) * (sMax - sMin),
    }),
    toPixel: ({ t, s }) => ({
      x: box.left + ((t - axes.tMin) / (axes.tMax - axes.tMin)) * spanX,
      y: box.top + ((sMax - s) / (sMax - sMin)) * spanY,
    }),
  };
}
