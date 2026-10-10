import { useId } from 'react';
import type { CoxFit, LogRank } from '../core/compare';
import { en, t } from '../i18n/en';
import { KmPlot, type KmPlotSeries } from './KmPlot';

export interface ComparePanelProps {
  readonly series: readonly KmPlotSeries[];
  readonly maxTime: number;
  readonly names: readonly [string, string] | null;
  readonly cox: CoxFit | null;
  readonly test: LogRank | null;
}

const n3 = (value: number): string => value.toFixed(3);
const pValue = (p: number): string => (p < 0.001 ? '< 0.001' : p.toFixed(3));

/** The two arms against each other, from the reconstructed patients. */
export function ComparePanel({ series, maxTime, names, cox, test }: ComparePanelProps) {
  const headingId = useId();
  return (
    <section id="compare" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.compareHeading}</h2>
      <p>{en.compareLead}</p>
      {series.length > 0 && <KmPlot series={series} maxTime={maxTime} />}
      {names === null || cox === null || test === null ? (
        <p className="hint">{en.compareNeedTwo}</p>
      ) : (
        <>
          <p>
            <strong>{t(en.compareHazard, { first: names[0], second: names[1] })}:</strong>{' '}
            {t(en.compareHazardValue, {
              hr: n3(cox.hazardRatio),
              lower: n3(cox.lower),
              upper: n3(cox.upper),
            })}
          </p>
          <p>
            <strong>{en.compareLogRank}:</strong>{' '}
            {t(en.compareLogRankValue, {
              chi: n3(test.chiSquare),
              p: pValue(test.p),
            })}
          </p>
        </>
      )}
    </section>
  );
}
