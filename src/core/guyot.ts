import type { Prepared } from './preprocess';

/** One reconstructed patient. */
export interface IpdRow {
  readonly time: number;
  /** 1 for an event, 0 for censored. */
  readonly status: 0 | 1;
  readonly arm: string;
}

export interface Reconstruction {
  readonly ipd: readonly IpdRow[];
  /** Events placed at each digitized point, in the order the prepared points are in. */
  readonly events: readonly number[];
  readonly censored: readonly number[];
  /** Number at risk the reconstruction implies at each digitized point. */
  readonly atRisk: readonly number[];
  readonly totalEvents: number;
  readonly totalCensored: number;
}

/**
 * Spread `count` censorings evenly across one risk interval and return how many fall at each
 * digitized point. This is the reference est_cen(): the censoring times are laid out evenly
 * between the first and last point of the interval, then counted into the gaps between points.
 */
function spreadCensoring(
  count: number,
  lower: number,
  upper: number,
  time: readonly number[],
  total: number,
): number[] {
  const width = upper - lower + 1;
  if (width < 0) throw new Error('A risk interval ended before it began.');
  if (width === 0) return count > 0 ? [count] : [0];
  const cen = new Array<number>(width).fill(0);
  if (count <= 0) return cen;
  const from = time[lower] ?? 0;
  const to = time[upper] ?? from;
  const at: number[] = [];
  for (let j = 1; j <= count; j += 1) at.push(from + (j * (to - from)) / (count + 1));
  for (let j = lower; j <= upper; j += 1) {
    const here = time[j] ?? 0;
    const next = j + 1 > total ? null : (time[j + 1] ?? null);
    let found = 0;
    for (const t of at) {
      if (next === null ? here <= t : here <= t && t < next) found += 1;
    }
    cen[j - lower] = found;
  }
  return cen;
}

/**
 * Reconstruct individual patient data from a digitized Kaplan-Meier curve and the numbers at
 * risk, by the method of Guyot and colleagues (BMC Med Res Methodol 2012;12:9).
 *
 * This is a port of IPDfromKM's getIPD(), step for step, so the numbers can be checked against
 * the R package. The idea is a fixed point: guess how many patients were censored in a risk
 * interval, work out how many events that implies at each step of the curve, see whether the
 * number still at risk at the end of the interval comes out as published, and nudge the
 * censoring until it does.
 */
export function reconstructIpd(
  prepared: Prepared,
  arm: string,
  totalEvents: number | null = null,
): Reconstruction {
  const total = prepared.points.length;
  // One-based arrays throughout, index 0 unused, to stay line for line with the reference.
  const TT: number[] = [0];
  const SS: number[] = [0];
  for (const point of prepared.points) {
    TT.push(point.time);
    SS.push(point.surv);
  }
  const rows = prepared.intervals;
  const nInterval = rows.length;
  if (nInterval === 0) throw new Error('There are no risk intervals to work from.');
  const lower = [0, ...rows.map((row) => row.lower)];
  const upper = [0, ...rows.map((row) => row.upper)];
  const tRisk = [0, ...rows.map((row) => row.tRisk)];
  const nRisk = [0, ...rows.map((row) => row.nRisk)];

  const nCensor = new Array<number>(nInterval + 1).fill(0);
  const lastIndex = new Array<number>(nInterval + 2).fill(1);
  const cen = new Array<number>(total + 2).fill(0);
  const nHat = new Array<number>(total + 2).fill((nRisk[1] ?? 0) + 1);
  const d = new Array<number>(total + 2).fill(0);
  const kmHat = new Array<number>(total + 2).fill(1);
  let las = 1;

  /** Walk one interval, filling events, the running Kaplan-Meier and the numbers at risk. */
  const walk = (i: number, isLast: boolean): void => {
    const lo = lower[i] ?? 1;
    const up = upper[i] ?? 1;
    nHat[lo] = nRisk[i] ?? 0;
    las = lastIndex[i] ?? 1;
    for (let k = lo; k <= up; k += 1) {
      if (k === 1) {
        d[1] = 0;
        kmHat[1] = 1;
      } else {
        const reference = kmHat[las] ?? 1;
        d[k] = reference !== 0 ? Math.round((nHat[k] ?? 0) * (1 - (SS[k] ?? 0) / reference)) : 0;
        kmHat[k] = reference * (1 - (d[k] ?? 0) / (nHat[k] ?? 1));
      }
      nHat[k + 1] = (nHat[k] ?? 0) - (d[k] ?? 0) - (cen[k] ?? 0);
      if (isLast) {
        // In the last interval anyone the arithmetic would push below zero is censored instead.
        if ((nHat[k + 1] ?? 0) < 0) {
          nHat[k + 1] = 0;
          cen[k] = (nHat[k] ?? 0) - (d[k] ?? 0);
        }
        if ((d[k] ?? 0) !== 0) las = k;
      } else {
        if ((d[k] ?? 0) !== 0) las = k;
        if ((nHat[k + 1] ?? 0) < 0) nHat[k + 1] = 0;
      }
    }
  };

  for (let i = 1; i <= nInterval - 1; i += 1) {
    const lo = lower[i] ?? 1;
    const loNext = lower[i + 1] ?? 1;
    const sHere = SS[lo] ?? 1;
    nCensor[i] = Math.round(
      ((nRisk[i] ?? 0) * (SS[loNext] ?? 0)) / (sHere === 0 ? 1 : sHere) - (nRisk[i + 1] ?? 0),
    );
    let guard = 0;
    while (
      (((nHat[loNext] ?? 0) > (nRisk[i + 1] ?? 0) &&
        (nCensor[i] ?? 0) < (nRisk[i] ?? 0) - (nRisk[i + 1] ?? 0) + 1) ||
        ((nHat[loNext] ?? 0) < (nRisk[i + 1] ?? 0) && (nCensor[i] ?? 0) > 0)) &&
      guard < 10000
    ) {
      guard += 1;
      const spread = spreadCensoring(nCensor[i] ?? 0, lo, upper[i] ?? lo, TT, total);
      for (let k = lo; k <= (upper[i] ?? lo); k += 1) cen[k] = spread[k - lo] ?? 0;
      nCensor[i] = spread.reduce((sum, value) => sum + value, 0);
      walk(i, false);
      nCensor[i] = (nCensor[i] ?? 0) + ((nHat[loNext] ?? 0) - (nRisk[i + 1] ?? 0));
    }
    nRisk[i + 1] = nHat[loNext] ?? 0;
    lastIndex[i + 1] = las;
  }

  // The last interval has no published risk number after it to pin the censoring down, so it is
  // set by how fast censoring ran earlier, capped by how many patients are left.
  if (nInterval > 1) {
    let leftd = 0;
    if (totalEvents !== null) {
      let placed = 0;
      for (let k = 1; k <= (upper[nInterval - 1] ?? 0); k += 1) placed += d[k] ?? 0;
      leftd = Math.max(0, totalEvents - placed);
    }
    const mm = prepared.endpts ?? 0;
    let earlier = 0;
    for (let i = 1; i <= nInterval - 1; i += 1) earlier += nCensor[i] ?? 0;
    const meanCensor = earlier / (nInterval - 1);
    const spanOut = (TT[total] ?? 0) - (tRisk[nInterval] ?? 0);
    const spanIn = (tRisk[nInterval] ?? 0) - (tRisk[nInterval - 1] ?? 0);
    nCensor[nInterval] = Math.min(
      spanIn === 0 ? 0 : (meanCensor * spanOut) / spanIn,
      (nRisk[nInterval] ?? 0) - mm - leftd,
    );
  } else {
    nCensor[nInterval] = totalEvents === null ? 0 : (nRisk[nInterval] ?? 0) - totalEvents;
  }

  const lastLower = lower[nInterval] ?? 1;
  const lastUpper = upper[nInterval] ?? 1;
  const spread = spreadCensoring(nCensor[nInterval] ?? 0, lastLower, lastUpper, TT, total);
  for (let k = lastLower; k <= lastUpper; k += 1) cen[k] = spread[k - lastLower] ?? 0;
  nCensor[nInterval] = spread.reduce((sum, value) => sum + value, 0);
  walk(nInterval, true);

  const ipd: IpdRow[] = [];
  for (let i = 1; i <= total; i += 1) {
    const events = d[i] ?? 0;
    for (let j = 0; j < events; j += 1) ipd.push({ time: TT[i] ?? 0, status: 1, arm });
    const censored = cen[i] ?? 0;
    if (censored > 0) {
      const at = i < total ? ((TT[i] ?? 0) + (TT[i + 1] ?? 0)) / 2 : (TT[i] ?? 0);
      for (let j = 0; j < censored; j += 1) ipd.push({ time: at, status: 0, arm });
    }
  }
  // Whoever is still at risk after the last digitized point is censored there: the figure says
  // nothing about them beyond the end of the curve.
  const leftOver = nHat[total + 1] ?? 0;
  for (let j = 0; j < leftOver; j += 1) {
    ipd.push({ time: TT[total] ?? 0, status: 0, arm });
  }
  ipd.sort((a, b) => a.time - b.time || b.status - a.status);

  const events = d.slice(1, total + 1);
  const censored = cen.slice(1, total + 1);
  return {
    ipd,
    events,
    censored,
    atRisk: nHat.slice(1, total + 1),
    totalEvents: events.reduce((sum, value) => sum + value, 0),
    totalCensored: censored.reduce((sum, value) => sum + value, 0) + leftOver,
  };
}
