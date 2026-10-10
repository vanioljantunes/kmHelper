import { useId } from 'react';
import { deltaE2000, rgbToLab, toHex } from '../core/color';
import type { MaskResult } from '../core/mask';
import type { PlotBox, Rgb } from '../core/types';
import { FigureScroll } from './FigureScroll';
import { en, t } from '../i18n/en';
import { FigureCanvas } from './FigureCanvas';
import type { LoadedFigure } from './decode';

export interface ArmView {
  readonly id: string;
  readonly name: string;
  readonly colour: Rgb | null;
  readonly tolerance: number;
  readonly mask: MaskResult | null;
  readonly showMask: boolean;
}

export interface ArmsPanelProps {
  readonly figure: LoadedFigure;
  readonly zoom: number;
  readonly box: PlotBox;
  readonly arms: readonly ArmView[];
  readonly pickingId: string | null;
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
  readonly onName: (id: string, name: string) => void;
  readonly onHex: (id: string, hex: string) => void;
  readonly onTolerance: (id: string, tolerance: number) => void;
  readonly onPickStart: (id: string) => void;
  readonly onPickCancel: () => void;
  readonly onPicked: (rgb: Rgb) => void;
  readonly onShowMask: (id: string, show: boolean) => void;
}

/** Two arms this close in colour cannot be told apart by a tolerance that keeps either whole. */
const CLOSE_ENOUGH_TO_CONFUSE = 10;

function closePairs(arms: readonly ArmView[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < arms.length; i += 1) {
    for (let j = i + 1; j < arms.length; j += 1) {
      const a = arms[i];
      const b = arms[j];
      if (a?.colour == null || b?.colour == null) continue;
      if (deltaE2000(rgbToLab(a.colour), rgbToLab(b.colour)) < CLOSE_ENOUGH_TO_CONFUSE) {
        pairs.push([a.name, b.name]);
      }
    }
  }
  return pairs;
}

/** Name each arm by its colour. This is the step that replaces clicking along the curve. */
export function ArmsPanel({
  figure,
  zoom,
  box,
  arms,
  pickingId,
  onAdd,
  onRemove,
  onName,
  onHex,
  onTolerance,
  onPickStart,
  onPickCancel,
  onPicked,
  onShowMask,
}: ArmsPanelProps) {
  const headingId = useId();
  const masks = arms
    .filter((arm) => arm.showMask && arm.mask !== null && arm.colour !== null)
    .map((arm) => ({ mask: arm.mask as MaskResult, colour: arm.colour as Rgb }));

  return (
    <section id="arms" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.armsHeading}</h2>
      <p>{en.armsLead}</p>
      <FigureScroll label={en.figureScrollArms}>
        <FigureCanvas
          image={figure.image}
          raster={figure.raster}
          zoom={zoom}
          box={box}
          showBox
          masks={masks}
          picking={pickingId !== null}
          onPick={onPicked}
        />
      </FigureScroll>
      {closePairs(arms).map(([first, second]) => (
        <p className="warning" role="status" key={`${first}-${second}`}>
          {t(en.armsCloseWarning, { first, second })}
        </p>
      ))}
      {arms.length === 0 && <p className="hint">{en.armsNoneYet}</p>}
      <ul className="arm-list">
        {arms.map((arm) => (
          <li key={arm.id} className="arm">
            <p className="field">
              <label htmlFor={`arm-name-${arm.id}`}>{en.armsName}</label>
              <input
                id={`arm-name-${arm.id}`}
                type="text"
                value={arm.name}
                onChange={(event) => onName(arm.id, event.target.value)}
              />
            </p>
            <p className="field">
              <label htmlFor={`arm-hex-${arm.id}`}>{en.armsColour}</label>
              <span className="arm__swatch-row">
                <span
                  className="arm__swatch"
                  aria-hidden="true"
                  style={{
                    background:
                      arm.colour === null
                        ? 'transparent'
                        : `rgb(${arm.colour.r}, ${arm.colour.g}, ${arm.colour.b})`,
                  }}
                />
                <input
                  id={`arm-hex-${arm.id}`}
                  type="text"
                  className="arm__hex"
                  value={arm.colour === null ? '' : toHex(arm.colour)}
                  placeholder="#1f77b4"
                  onChange={(event) => onHex(arm.id, event.target.value)}
                />
                {pickingId === arm.id ? (
                  <button type="button" onClick={onPickCancel}>
                    {en.armsPickCancel}
                  </button>
                ) : (
                  <button type="button" onClick={() => onPickStart(arm.id)}>
                    {en.armsPick}
                  </button>
                )}
              </span>
            </p>
            {pickingId === arm.id && (
              <p className="hint" role="status">
                {en.armsPicking}
              </p>
            )}
            <p className="field">
              <label htmlFor={`arm-tol-${arm.id}`}>{en.armsTolerance}</label>
              <input
                id={`arm-tol-${arm.id}`}
                type="range"
                min={2}
                max={40}
                step={1}
                value={arm.tolerance}
                onChange={(event) => onTolerance(arm.id, Number(event.target.value))}
              />
              <output htmlFor={`arm-tol-${arm.id}`}>{arm.tolerance}</output>
            </p>
            <p className="hint">{en.armsToleranceHelp}</p>
            <p aria-live="polite">
              {arm.mask === null
                ? ''
                : arm.mask.matched === 0
                  ? en.armsMatchedNone
                  : t(en.armsMatched, { count: arm.mask.matched })}
            </p>
            <p className="field field--inline">
              <label htmlFor={`arm-mask-${arm.id}`}>{en.armsShowMask}</label>
              <input
                id={`arm-mask-${arm.id}`}
                type="checkbox"
                checked={arm.showMask}
                onChange={(event) => onShowMask(arm.id, event.target.checked)}
              />
            </p>
            <button type="button" onClick={() => onRemove(arm.id)}>
              {t(en.armsRemove, { name: arm.name })}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onAdd}>
        {en.armsAdd}
      </button>
    </section>
  );
}
