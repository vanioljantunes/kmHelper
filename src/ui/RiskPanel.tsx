import { useId } from 'react';
import { en, t } from '../i18n/en';

export interface RiskArmView {
  readonly id: string;
  readonly name: string;
  readonly numbers: string;
  readonly total: string;
  readonly events: string;
  readonly problem: string | null;
}

export interface RiskPanelProps {
  readonly times: string;
  readonly arms: readonly RiskArmView[];
  readonly onTimes: (value: string) => void;
  readonly onNumbers: (id: string, value: string) => void;
  readonly onTotal: (id: string, value: string) => void;
  readonly onEvents: (id: string, value: string) => void;
}

/** Numbers at risk. Optional, with the cost of leaving it out stated rather than implied. */
export function RiskPanel({
  times,
  arms,
  onTimes,
  onNumbers,
  onTotal,
  onEvents,
}: RiskPanelProps) {
  const headingId = useId();
  return (
    <section id="risk" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.riskHeading}</h2>
      <p>{en.riskLead}</p>
      <p className="warning">{en.riskOptional}</p>
      <p className="field">
        <label htmlFor="risk-times">{en.riskTimes}</label>
        <input
          id="risk-times"
          type="text"
          value={times}
          aria-describedby="risk-times-hint"
          onChange={(event) => onTimes(event.target.value)}
        />
      </p>
      <p className="hint" id="risk-times-hint">
        {en.riskTimesHint}
      </p>
      {arms.map((arm) => (
        <div className="arm" key={arm.id}>
          <h3>{arm.name}</h3>
          <p className="field">
            <label htmlFor={`risk-n-${arm.id}`}>{t(en.riskNumbers, { name: arm.name })}</label>
            <input
              id={`risk-n-${arm.id}`}
              type="text"
              value={arm.numbers}
              aria-invalid={arm.problem !== null}
              aria-describedby={arm.problem === null ? undefined : `risk-n-${arm.id}-error`}
              onChange={(event) => onNumbers(arm.id, event.target.value)}
            />
          </p>
          {arm.problem !== null && (
            <p className="error" id={`risk-n-${arm.id}-error`}>
              {arm.problem}
            </p>
          )}
          <p className="field">
            <label htmlFor={`risk-total-${arm.id}`}>{t(en.riskTotal, { name: arm.name })}</label>
            <input
              id={`risk-total-${arm.id}`}
              type="text"
              inputMode="numeric"
              value={arm.total}
              onChange={(event) => onTotal(arm.id, event.target.value)}
            />
          </p>
          <p className="field">
            <label htmlFor={`risk-events-${arm.id}`}>{t(en.riskEvents, { name: arm.name })}</label>
            <input
              id={`risk-events-${arm.id}`}
              type="text"
              inputMode="numeric"
              value={arm.events}
              aria-describedby={`risk-events-${arm.id}-hint`}
              onChange={(event) => onEvents(arm.id, event.target.value)}
            />
          </p>
          <p className="hint" id={`risk-events-${arm.id}-hint`}>
            {en.riskEventsHint}
          </p>
        </div>
      ))}
    </section>
  );
}
