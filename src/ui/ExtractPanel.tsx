import { useId } from 'react';
import type { Calibration } from '../core/calibrate';
import type { PlotBox, Rgb, TraceResult } from '../core/types';
import { FigureScroll } from './FigureScroll';
import { en, t } from '../i18n/en';
import { FigureCanvas } from './FigureCanvas';
import type { LoadedFigure } from './decode';

export interface TraceView {
  readonly id: string;
  readonly name: string;
  readonly colour: Rgb | null;
  readonly trace: TraceResult | null;
}

export interface ExtractPanelProps {
  readonly figure: LoadedFigure;
  readonly zoom: number;
  readonly box: PlotBox;
  readonly calibration: Calibration | null;
  readonly traces: readonly TraceView[];
  readonly maxGap: number;
  readonly showOverlay: boolean;
  readonly canRun: boolean;
  readonly hasRun: boolean;
  readonly onRun: () => void;
  readonly onMaxGap: (value: number) => void;
  readonly onShowOverlay: (show: boolean) => void;
}

const HEAD_TAIL = 10;

function round(value: number, places: number): string {
  return value.toFixed(places);
}

/** The traced points, with the overlay that is the real check on whether they are right. */
export function ExtractPanel({
  figure,
  zoom,
  box,
  calibration,
  traces,
  maxGap,
  showOverlay,
  canRun,
  hasRun,
  onRun,
  onMaxGap,
  onShowOverlay,
}: ExtractPanelProps) {
  const headingId = useId();
  const curves =
    calibration === null || !showOverlay
      ? []
      : traces
          .filter((view) => view.trace !== null && view.trace.points.length > 0)
          .map((view) => ({ points: (view.trace as TraceResult).points, calibration }));

  return (
    <section id="extract" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.extractHeading}</h2>
      <p>{en.extractLead}</p>
      <button type="button" onClick={onRun} disabled={!canRun}>
        {hasRun ? en.extractRerun : en.extractRun}
      </button>
      <p className="field">
        <label htmlFor="max-gap">{en.extractMaxGap}</label>
        <input
          id="max-gap"
          type="range"
          min={0}
          max={30}
          step={1}
          value={maxGap}
          onChange={(event) => onMaxGap(Number(event.target.value))}
        />
        <output htmlFor="max-gap">
          {maxGap} {en.extractMaxGapUnit}
        </output>
      </p>
      <p className="field field--inline">
        <label htmlFor="show-overlay">{en.extractShowOverlay}</label>
        <input
          id="show-overlay"
          type="checkbox"
          checked={showOverlay}
          onChange={(event) => onShowOverlay(event.target.checked)}
        />
      </p>
      {hasRun && <p className="hint">{en.extractSanity}</p>}
      <FigureScroll label={en.figureScrollExtract}>
        <FigureCanvas
          image={figure.image}
          raster={figure.raster}
          zoom={zoom}
          box={box}
          showBox={false}
          curves={curves}
        />
      </FigureScroll>
      {traces.map(({ id, name, trace }) => {
        if (trace === null) return null;
        if (trace.points.length === 0) {
          return (
            <p className="error" role="alert" key={id}>
              {t(en.extractEmpty, { name })}
            </p>
          );
        }
        const head = trace.points.slice(0, HEAD_TAIL);
        const tail = trace.points.slice(-HEAD_TAIL);
        const hidden = Math.max(0, trace.points.length - head.length - tail.length);
        return (
          <div className="trace-summary" key={id}>
            <h3>{name}</h3>
            <p>
              {t(en.extractPoints, { count: trace.points.length })}
              {', '}
              {t(en.extractStroke, { width: trace.strokeWidth })}
              {', '}
              {trace.tickTimes.length === 0
                ? en.extractTicksNone
                : t(en.extractTicks, { count: trace.tickTimes.length })}
              {trace.bridgedColumns > 0 && (
                <>
                  {', '}
                  {t(en.extractBridged, { count: trace.bridgedColumns })}
                </>
              )}
            </p>
            {trace.tickTimes.length > 0 && <p className="hint">{en.extractTicksHint}</p>}
            {trace.endedEarlyAt !== null && (
              <p className="warning">
                {t(en.extractEndedEarly, { time: round(trace.endedEarlyAt, 2) })}
              </p>
            )}
            <table className="point-table">
              <caption>{t(en.extractTableCaption, { name })}</caption>
              <thead>
                <tr>
                  <th scope="col">{en.extractTableTime}</th>
                  <th scope="col">{en.extractTableSurvival}</th>
                </tr>
              </thead>
              <tbody>
                {head.map((point, index) => (
                  <tr key={`h${index}`}>
                    <td>{round(point.t, 3)}</td>
                    <td>{round(point.s, 4)}</td>
                  </tr>
                ))}
                {hidden > 0 && (
                  <tr>
                    <td colSpan={2}>{t(en.extractTableMore, { count: hidden })}</td>
                  </tr>
                )}
                {hidden > 0 &&
                  tail.map((point, index) => (
                    <tr key={`t${index}`}>
                      <td>{round(point.t, 3)}</td>
                      <td>{round(point.s, 4)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
