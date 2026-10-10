import { describe, expect, it } from 'vitest';
import { ipdCsv, pointsCsv, rScript, type ExportArm } from '../../src/core/export';

const ARM: ExportArm = {
  name: 'Treatment',
  points: [
    { t: 0, s: 1 },
    { t: 12.5, s: 0.8 },
  ],
  ipd: [
    { time: 12.5, status: 1, arm: 'Treatment' },
    { time: 18, status: 0, arm: 'Treatment' },
  ],
  lowConfidence: false,
};

const AWKWARD: ExportArm = { ...ARM, name: 'Arm A, "high dose"' };

describe('ipdCsv', () => {
  it('writes one row per patient', () => {
    expect(ipdCsv([ARM])).toBe('arm,time,status\nTreatment,12.5,1\nTreatment,18,0\n');
  });

  it('quotes a name with a comma or a quotation mark in it', () => {
    expect(ipdCsv([AWKWARD])).toContain('"Arm A, ""high dose""",12.5,1');
  });

  it('marks a reconstruction made without numbers at risk, in the file itself', () => {
    const csv = ipdCsv([{ ...ARM, lowConfidence: true }]);
    expect(csv.startsWith('# Reconstructed without numbers at risk')).toBe(true);
  });

  it('says nothing when every arm had a risk table', () => {
    expect(ipdCsv([ARM]).startsWith('#')).toBe(false);
  });
});

describe('pointsCsv', () => {
  it('writes the digitized curve', () => {
    expect(pointsCsv([ARM])).toBe('arm,time,survival\nTreatment,0,1\nTreatment,12.5,0.8\n');
  });
});

describe('rScript', () => {
  it('reads the exported file and refits the model', () => {
    const script = rScript([ARM, { ...ARM, name: 'Control' }]);
    expect(script).toContain('library(survival)');
    expect(script).toContain('read.csv("kmhelper-ipd.csv")');
    expect(script).toContain('survfit(Surv(time, status) ~ arm');
    expect(script).toContain('coxph(Surv(time, status) ~ arm');
    expect(script).toContain('relevel(factor(ipd$arm), ref = "Treatment")');
  });

  it('leaves out the two-arm tests when there is only one arm', () => {
    const script = rScript([ARM]);
    expect(script).not.toContain('coxph');
    expect(script).not.toContain('survdiff');
    expect(script).not.toContain('relevel');
  });

  it('carries the warning into the script when an arm is weak', () => {
    expect(rScript([{ ...ARM, lowConfidence: true }])).toContain('without numbers at risk');
  });
});
