import { useId } from 'react';
import type { AxisProblem } from '../core/calibrate';
import type { AxisValues, PlotBox, SurvivalUnit } from '../core/types';
import { FigureScroll } from './FigureScroll';
import { en } from '../i18n/en';
import { FigureCanvas } from './FigureCanvas';
import type { LoadedFigure } from './decode';

export interface AxesPanelProps {
  readonly figure: LoadedFigure;
  readonly zoom: number;
  readonly box: PlotBox;
  readonly confident: boolean;
  readonly axes: AxisValues;
  readonly rawValues: Record<'tMin' | 'tMax' | 'yMin' | 'yMax', string>;
  readonly problems: readonly AxisProblem[];
  readonly onBoxChange: (box: PlotBox) => void;
  readonly onValueChange: (field: 'tMin' | 'tMax' | 'yMin' | 'yMax', value: string) => void;
  readonly onUnitChange: (unit: SurvivalUnit) => void;
  readonly onRedetect: () => void;
}

const FIELDS = [
  { key: 'tMin', label: en.axesTimeFirst },
  { key: 'tMax', label: en.axesTimeLast },
  { key: 'yMin', label: en.axesSurvivalBottom },
  { key: 'yMax', label: en.axesSurvivalTop },
] as const;

/**
 * Calibration. The plot frame was detected on upload, so most figures need four numbers typed and
 * no dragging at all; the handles are there for the ones where detection missed.
 */
export function AxesPanel({
  figure,
  zoom,
  box,
  confident,
  axes,
  rawValues,
  problems,
  onBoxChange,
  onValueChange,
  onUnitChange,
  onRedetect,
}: AxesPanelProps) {
  const headingId = useId();
  const unitName = useId();
  const problemFor = (field: string) => problems.find((problem) => problem.field === field);
  const boxProblem = problemFor('box');

  return (
    <section id="axes" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.axesHeading}</h2>
      <p>{confident ? en.axesLead : en.axesLeadUnsure}</p>
      <p className="hint">{en.axesCropHint}</p>
      <p className="hint">{en.axesHandleHelp}</p>
      <FigureScroll label={en.figureScrollAxes}>
        <FigureCanvas
          image={figure.image}
          raster={figure.raster}
          zoom={zoom}
          box={box}
          showBox
          onBoxChange={onBoxChange}
        />
      </FigureScroll>
      {boxProblem !== undefined && (
        <p className="error" role="alert">
          {boxProblem.message}
        </p>
      )}
      <button type="button" onClick={onRedetect}>
        {en.axesReset}
      </button>
      <div className="field-grid">
        {FIELDS.map(({ key, label }) => {
          const problem = problemFor(key);
          return (
            <p key={key} className="field">
              <label htmlFor={`axis-${key}`}>{label}</label>
              <input
                id={`axis-${key}`}
                type="text"
                inputMode="decimal"
                value={rawValues[key]}
                aria-invalid={problem !== undefined}
                aria-describedby={problem === undefined ? undefined : `axis-${key}-error`}
                onChange={(event) => onValueChange(key, event.target.value)}
              />
              {problem !== undefined && (
                <span className="error" id={`axis-${key}-error`}>
                  {problem.message}
                </span>
              )}
            </p>
          );
        })}
      </div>
      <fieldset className="unit-choice">
        <legend>{en.axesUnit}</legend>
        {(
          [
            ['probability', en.axesUnitProbability],
            ['percent', en.axesUnitPercent],
          ] as const
        ).map(([unit, label]) => (
          <label key={unit}>
            <input
              type="radio"
              name={unitName}
              value={unit}
              checked={axes.unit === unit}
              onChange={() => onUnitChange(unit)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
