/** Shared shapes. Nothing here touches the DOM, so every core module runs in plain Node. */

/** A decoded raster, the same field names a browser ImageData has. */
export interface Raster {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** sRGB, 0-255 per channel. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** CIELAB under D65. */
export interface Lab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

/** The plot frame in pixel coordinates: the axes themselves, not the figure margins. */
export interface PlotBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** How the y axis is printed in the figure. */
export type SurvivalUnit = 'probability' | 'percent';

/** The four axis values the researcher reads off the figure. */
export interface AxisValues {
  readonly tMin: number;
  readonly tMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly unit: SurvivalUnit;
}

/** One digitized point on a curve, in data coordinates. Survival is always a probability. */
export interface CurvePoint {
  readonly t: number;
  readonly s: number;
}

/** What tracing one arm produced. */
export interface TraceResult {
  readonly points: readonly CurvePoint[];
  /** Candidate censoring marks: short detached runs in the arm's colour. */
  readonly tickTimes: readonly number[];
  /** Median matched run length in pixels; the line's apparent thickness. */
  readonly strokeWidth: number;
  /** Columns inside the box where no pixel matched and the gap was bridged. */
  readonly bridgedColumns: number;
  /** Set when the curve stopped early because a gap was wider than maxGap. */
  readonly endedEarlyAt: number | null;
}
