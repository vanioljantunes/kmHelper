// Read the fixture figure with the real pipeline and write what it saw, so the same digitized
// curve can be put through IPDfromKM in R and the two reconstructions compared.
//
//   npx vite-node scripts/digitize-fixture.ts
//
// Writes tests/fixtures/digitized.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCalibration } from '../src/core/calibrate';
import { rgbToLab } from '../src/core/color';
import { buildMask } from '../src/core/mask';
import { detectPlotBox } from '../src/core/plotbox';
import { traceCurve } from '../src/core/trace';
import { decodePng } from '../tests/helpers/png';
import type { AxisValues } from '../src/core/types';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');
const image = decodePng(readFileSync(`${DIR}/km-two-arms.png`));
const truth = JSON.parse(readFileSync(`${DIR}/km-two-arms.json`, 'utf8')) as {
  axes: AxisValues;
  riskTimes: number[];
  arms: Array<{
    name: string;
    colour: [number, number, number];
    total: number;
    events: number;
    risk: Array<{ time: number; atRisk: number }>;
  }>;
};

const box = detectPlotBox(image);
const calibration = createCalibration(box, truth.axes);
const arms = truth.arms.map((arm) => {
  const mask = buildMask(
    image,
    box,
    rgbToLab({ r: arm.colour[0], g: arm.colour[1], b: arm.colour[2] }),
  );
  const traced = traceCurve(mask, { left: box.left, top: box.top }, calibration);
  return {
    name: arm.name,
    total: arm.total,
    trueEvents: arm.events,
    risk: arm.risk,
    points: traced.points.map((point) => ({
      t: Number(point.t.toFixed(6)),
      s: Number(point.s.toFixed(6)),
    })),
  };
});

writeFileSync(
  `${DIR}/digitized.json`,
  `${JSON.stringify({ box, axes: truth.axes, arms }, null, 2)}\n`,
);
for (const arm of arms) {
  console.log(`${arm.name}: ${String(arm.points.length)} points, n=${String(arm.total)}`);
}
