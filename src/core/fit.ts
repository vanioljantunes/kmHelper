import type { IpdRow } from './guyot';
import { kaplanMeier, survivalAt } from './km';
import type { Prepared } from './preprocess';

export interface FitQuality {
  readonly rmse: number;
  readonly meanAbsError: number;
  /** The largest signed difference, as IPDfromKM reports it. */
  readonly maxError: number;
  /** The largest difference either way, which is what a reader usually wants. */
  readonly maxAbsError: number;
  readonly points: number;
}

/**
 * How closely the reconstruction reproduces the curve that was read off the figure. This is the
 * number that says whether to trust a run: the reconstruction can only be as good as the
 * digitizing, and a large error here means the colour, the tolerance or the axes are wrong.
 *
 * The three headline figures are defined as IPDfromKM defines them, so they can be compared with
 * what the R package prints for the same data.
 */
export function fitQuality(prepared: Prepared, ipd: readonly IpdRow[]): FitQuality {
  const fit = kaplanMeier(ipd);
  const differences = prepared.points.map(
    (point) => survivalAt(fit, point.time).surv - point.surv,
  );
  const n = differences.length;
  if (n === 0) {
    return { rmse: Number.NaN, meanAbsError: Number.NaN, maxError: Number.NaN, maxAbsError: Number.NaN, points: 0 };
  }
  const sumSquares = differences.reduce((sum, value) => sum + value * value, 0);
  return {
    rmse: Math.sqrt(sumSquares / (n > 1 ? n - 1 : 1)),
    meanAbsError: differences.reduce((sum, value) => sum + Math.abs(value), 0) / n,
    maxError: Math.max(...differences),
    maxAbsError: Math.max(...differences.map((value) => Math.abs(value))),
    points: n,
  };
}
