import { useId } from 'react';
import { ipdCsv, pointsCsv, rScript, type ExportArm } from '../core/export';
import { en } from '../i18n/en';

export interface ExportPanelProps {
  readonly arms: readonly ExportArm[];
  readonly hasIpd: boolean;
}

const IPD_FILE = 'kmhelper-ipd.csv';

/** Hand the work over in forms that can be checked elsewhere. */
export function ExportPanel({ arms, hasIpd }: ExportPanelProps) {
  const headingId = useId();

  const download = (name: string, text: string, type: string): void => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="export" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.exportHeading}</h2>
      <p>{en.exportLead}</p>
      <p className="export-buttons">
        <button
          type="button"
          disabled={!hasIpd}
          onClick={() => download(IPD_FILE, ipdCsv(arms), 'text/csv')}
        >
          {en.exportIpd}
        </button>
        <button
          type="button"
          disabled={arms.length === 0}
          onClick={() => download('kmhelper-points.csv', pointsCsv(arms), 'text/csv')}
        >
          {en.exportPoints}
        </button>
        <button
          type="button"
          disabled={!hasIpd}
          onClick={() => download('kmhelper-analysis.R', rScript(arms, IPD_FILE), 'text/plain')}
        >
          {en.exportScript}
        </button>
      </p>
      {!hasIpd && <p className="hint">{en.exportNeedIpd}</p>}
      <p className="hint">{en.exportCheckHint}</p>
    </section>
  );
}
