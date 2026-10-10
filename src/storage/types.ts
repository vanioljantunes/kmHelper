import type { AxisValues, PlotBox } from '../core/types';

/** One arm as it is saved: the colour by hex, never the image. */
export interface DraftArm {
  readonly id: string;
  readonly name: string;
  readonly hex: string | null;
  readonly tolerance: number;
}

/**
 * What survives a reload. The figure itself is deliberately left out: a screenshot is large, and
 * keeping someone's figure in browser storage is not this tool's business.
 */
export interface Draft {
  readonly box: PlotBox | null;
  readonly axes: AxisValues;
  readonly arms: readonly DraftArm[];
  readonly maxGap: number;
}

export interface DraftStore {
  load: () => Draft | null;
  save: (draft: Draft) => void;
  clear: () => void;
}
