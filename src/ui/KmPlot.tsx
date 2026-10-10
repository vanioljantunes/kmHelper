import type { KmFit } from '../core/km';
import type { Rgb } from '../core/types';
import { en } from '../i18n/en';

export interface KmPlotSeries {
  readonly name: string;
  readonly fit: KmFit;
  readonly colour: Rgb | null;
}

export interface KmPlotProps {
  readonly series: readonly KmPlotSeries[];
  readonly maxTime: number;
}

const WIDTH = 640;
const HEIGHT = 380;
const PAD = { left: 56, right: 16, top: 16, bottom: 44 };

const FALLBACK: readonly string[] = ['#1d5fb8', '#b3261e', '#1b6e2a', '#7a4800'];

/** The reconstructed curves, drawn as the step functions they are. */
export function KmPlot({ series, maxTime }: KmPlotProps) {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (time: number): number => PAD.left + (maxTime === 0 ? 0 : (time / maxTime) * plotW);
  const y = (surv: number): number => PAD.top + (1 - surv) * plotH;

  const pathFor = (fit: KmFit): string => {
    const parts: string[] = [`M ${String(x(0))} ${String(y(1))}`];
    let last = 1;
    for (const step of fit.steps) {
      if (step.time > maxTime) break;
      parts.push(`L ${String(x(step.time))} ${String(y(last))}`);
      parts.push(`L ${String(x(step.time))} ${String(y(step.surv))}`);
      last = step.surv;
    }
    parts.push(`L ${String(x(maxTime))} ${String(y(last))}`);
    return parts.join(' ');
  };

  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * maxTime);
  const survTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="km-plot">
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={en.comparePlotAlt}
      >
        {survTicks.map((value) => (
          <g key={`s${String(value)}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className="km-plot__grid"
            />
            <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="km-plot__label">
              {value.toFixed(2)}
            </text>
          </g>
        ))}
        {timeTicks.map((value) => (
          <text
            key={`t${String(value)}`}
            x={x(value)}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            className="km-plot__label"
          >
            {value.toFixed(0)}
          </text>
        ))}
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={HEIGHT - PAD.bottom}
          className="km-plot__axis"
        />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          className="km-plot__axis"
        />
        {series.map((row, index) => (
          <path
            key={row.name}
            d={pathFor(row.fit)}
            fill="none"
            strokeWidth={2}
            stroke={
              row.colour === null
                ? (FALLBACK[index % FALLBACK.length] ?? '#1d5fb8')
                : `rgb(${String(row.colour.r)}, ${String(row.colour.g)}, ${String(row.colour.b)})`
            }
          />
        ))}
        <text
          x={PAD.left + plotW / 2}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="km-plot__label"
        >
          {en.compareAxisTime}
        </text>
        <text
          x={14}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${String(PAD.top + plotH / 2)})`}
          className="km-plot__label"
        >
          {en.compareAxisSurvival}
        </text>
      </svg>
      <figcaption>
        <ul className="km-plot__legend">
          {series.map((row, index) => (
            <li key={row.name}>
              <span
                className="km-plot__swatch"
                aria-hidden="true"
                style={{
                  background:
                    row.colour === null
                      ? (FALLBACK[index % FALLBACK.length] ?? '#1d5fb8')
                      : `rgb(${String(row.colour.r)}, ${String(row.colour.g)}, ${String(row.colour.b)})`,
                }}
              />
              {row.name}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
