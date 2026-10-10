import { useId } from 'react';
import type { FitQuality } from '../core/fit';
import type { KmFit } from '../core/km';
import { en, t } from '../i18n/en';

export interface IpdArmView {
  readonly id: string;
  readonly name: string;
  readonly patients: number;
  readonly events: number;
  readonly censored: number;
  readonly fit: KmFit;
  readonly quality: FitQuality;
  readonly lowConfidence: boolean;
  readonly survivalAt: ReadonlyArray<{ time: number; surv: number; lower: number; upper: number }>;
  readonly failed: string | null;
}

export interface IpdPanelProps {
  readonly arms: readonly IpdArmView[];
  readonly canRun: boolean;
  readonly hasRun: boolean;
  readonly atTimes: string;
  readonly onRun: () => void;
  readonly onAtTimes: (value: string) => void;
}

const pc = (value: number): string => `${(value * 100).toFixed(1)}%`;
const n3 = (value: number): string => value.toFixed(3);

/** What the reconstruction produced, and how closely it reproduces the curve it came from. */
export function IpdPanel({ arms, canRun, hasRun, atTimes, onRun, onAtTimes }: IpdPanelProps) {
  const headingId = useId();
  return (
    <section id="ipd" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.ipdHeading}</h2>
      <p>{en.ipdLead}</p>
      <button type="button" onClick={onRun} disabled={!canRun}>
        {hasRun ? en.ipdRerun : en.ipdRun}
      </button>
      {!canRun && <p className="hint">{en.ipdNeedPoints}</p>}
      <p className="field">
        <label htmlFor="survival-at">{en.ipdSurvivalAt}</label>
        <input
          id="survival-at"
          type="text"
          value={atTimes}
          aria-describedby="survival-at-hint"
          onChange={(event) => onAtTimes(event.target.value)}
        />
      </p>
      <p className="hint" id="survival-at-hint">
        {en.ipdSurvivalAtHint}
      </p>
      {arms.map((arm) => {
        if (arm.failed !== null) {
          return (
            <p className="error" role="alert" key={arm.id}>
              {t(en.ipdFailed, { name: arm.name, reason: arm.failed })}
            </p>
          );
        }
        const { median, medianLower, medianUpper } = arm.fit;
        const medianText =
          median === null
            ? en.ipdMedianNotReached
            : medianUpper === null
              ? t(en.ipdMedianOpen, {
                  median: n3(median),
                  lower: medianLower === null ? '?' : n3(medianLower),
                })
              : t(en.ipdMedianValue, {
                  median: n3(median),
                  lower: medianLower === null ? '?' : n3(medianLower),
                  upper: n3(medianUpper),
                });
        return (
          <div className="arm" key={arm.id}>
            <h3>{arm.name}</h3>
            {arm.lowConfidence && <p className="warning">{en.ipdLowConfidence}</p>}
            <p>
              {t(en.ipdPatients, { count: arm.patients })}
              {', '}
              {t(en.ipdEvents, { count: arm.events })}
              {', '}
              {t(en.ipdCensored, { count: arm.censored })}
            </p>
            <p>
              <strong>{en.ipdMedian}:</strong> {medianText}
            </p>
            {arm.survivalAt.length > 0 && (
              <table className="point-table">
                <thead>
                  <tr>
                    <th scope="col">{en.compareAxisTime}</th>
                    <th scope="col">{en.compareAxisSurvival}</th>
                  </tr>
                </thead>
                <tbody>
                  {arm.survivalAt.map((row) => (
                    <tr key={row.time}>
                      <td>{n3(row.time)}</td>
                      <td>
                        {pc(row.surv)} ({pc(row.lower)} to {pc(row.upper)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p>
              <strong>{en.ipdFit}:</strong>{' '}
              {t(en.ipdFitValue, {
                rmse: arm.quality.rmse.toFixed(4),
                mean: arm.quality.meanAbsError.toFixed(4),
                max: arm.quality.maxAbsError.toFixed(4),
              })}
            </p>
            {arm.quality.maxAbsError > 0.02 ? (
              <p className="warning">{en.ipdFitPoor}</p>
            ) : (
              <p className="hint">{en.ipdFitGood}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
