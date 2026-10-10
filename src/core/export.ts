import type { IpdRow } from './guyot';
import type { CurvePoint } from './types';

export interface ExportArm {
  readonly name: string;
  readonly points: readonly CurvePoint[];
  readonly ipd: readonly IpdRow[];
  /** Set when the reconstruction had no numbers at risk to work from. */
  readonly lowConfidence: boolean;
}

const quote = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const WARNING =
  '# Reconstructed without numbers at risk, from the arm total alone. Treat these data as weak.';

/** Reconstructed patients, one row each, ready for survival analysis. */
export function ipdCsv(arms: readonly ExportArm[]): string {
  const lines: string[] = [];
  if (arms.some((arm) => arm.lowConfidence)) lines.push(WARNING);
  lines.push('arm,time,status');
  for (const arm of arms) {
    for (const row of arm.ipd) {
      lines.push(`${quote(arm.name)},${row.time},${row.status}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** The points read off the figure, so the digitizing step can be checked on its own. */
export function pointsCsv(arms: readonly ExportArm[]): string {
  const lines = ['arm,time,survival'];
  for (const arm of arms) {
    for (const point of arm.points) {
      lines.push(`${quote(arm.name)},${point.t},${point.s}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * An R script that reads the exported patients back and redoes the analysis. Anyone can then
 * check this tool against the survival package rather than taking its numbers on trust, which is
 * the point: a reconstruction nobody can verify is not worth publishing.
 */
export function rScript(arms: readonly ExportArm[], fileName = 'kmhelper-ipd.csv'): string {
  const names = arms.map((arm) => arm.name);
  const reference = names.length > 1 ? names[0] : null;
  return [
    '# Reconstructed from a published Kaplan-Meier figure with kmHelper.',
    '# Method: Guyot P, Ades AE, Ouwens MJNM, Welton NJ. BMC Med Res Methodol 2012;12:9.',
    ...(arms.some((arm) => arm.lowConfidence)
      ? ['# At least one arm was reconstructed without numbers at risk. Treat it as weak.']
      : []),
    '',
    'library(survival)',
    '',
    `ipd <- read.csv("${fileName}")`,
    ...(reference === null ? [] : [`ipd$arm <- relevel(factor(ipd$arm), ref = ${JSON.stringify(reference)})`]),
    '',
    'fit <- survfit(Surv(time, status) ~ arm, data = ipd, conf.type = "log-log")',
    'print(summary(fit)$table)',
    'plot(fit, xlab = "Time", ylab = "Survival")',
    ...(names.length > 1
      ? [
          '',
          'print(survdiff(Surv(time, status) ~ arm, data = ipd))',
          'print(summary(coxph(Surv(time, status) ~ arm, data = ipd)))',
        ]
      : []),
    '',
  ].join('\n');
}
