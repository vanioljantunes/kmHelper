// Build a Kaplan-Meier figure from patient data we generate ourselves, and write the figure, the
// data behind it and the numbers at risk. Because the truth is known, the tests can measure how
// accurately the tool reads the picture instead of only checking that it runs. Drawing our own
// figure also keeps any journal screenshot out of the repository.
//
//   node scripts/make-fixture.mjs
//
// Writes tests/fixtures/km-two-arms.png and tests/fixtures/km-two-arms.json.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');

/** mulberry32: a small seeded generator, so the fixture is identical on every machine. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exponential survival with independent exponential censoring, then administrative cut-off. */
function makeArm({ n, hazard, censorHazard, horizon, seed }) {
  const random = rng(seed);
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const event = -Math.log(1 - random()) / hazard;
    const censor = -Math.log(1 - random()) / censorHazard;
    const observed = Math.min(event, censor, horizon);
    const status = event <= censor && event <= horizon ? 1 : 0;
    rows.push({ time: Math.round(observed * 100) / 100, status });
  }
  return rows.sort((a, b) => a.time - b.time);
}

/** Kaplan-Meier step corners from patient data. */
function kaplanMeier(rows) {
  const times = [...new Set(rows.filter((r) => r.status === 1).map((r) => r.time))].sort(
    (a, b) => a - b,
  );
  const points = [{ t: 0, s: 1 }];
  let s = 1;
  for (const t of times) {
    const atRisk = rows.filter((r) => r.time >= t).length;
    const events = rows.filter((r) => r.time === t && r.status === 1).length;
    if (atRisk === 0) break;
    s *= 1 - events / atRisk;
    points.push({ t, s });
  }
  return points;
}

/** Numbers still at risk at each of the given times. */
function riskTable(rows, times) {
  return times.map((t) => ({ time: t, atRisk: rows.filter((r) => r.time >= t).length }));
}

const HORIZON = 60;
const RISK_TIMES = [0, 12, 24, 36, 48, 60];
const ARMS = [
  {
    name: 'Treatment',
    colour: [31, 119, 180],
    rows: makeArm({ n: 120, hazard: 0.011, censorHazard: 0.004, horizon: HORIZON, seed: 20261010 }),
  },
  {
    name: 'Control',
    colour: [214, 39, 40],
    rows: makeArm({ n: 120, hazard: 0.022, censorHazard: 0.004, horizon: HORIZON, seed: 77001 }),
  },
].map((arm) => ({
  ...arm,
  curve: kaplanMeier(arm.rows),
  risk: riskTable(arm.rows, RISK_TIMES),
  events: arm.rows.filter((r) => r.status === 1).length,
  censorTimes: arm.rows.filter((r) => r.status === 0).map((r) => r.time),
}));

// ---------------------------------------------------------------- drawing

const WIDTH = 760;
const HEIGHT = 520;
const BOX = { left: 80, right: 720, top: 30, bottom: 430 };
const AXES = { tMin: 0, tMax: HORIZON, yMin: 0, yMax: 1 };

const pixels = new Uint8Array(WIDTH * HEIGHT * 3).fill(255);

function put(x, y, [r, g, b]) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) return;
  const i = (py * WIDTH + px) * 3;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
}

const toX = (t) => BOX.left + ((t - AXES.tMin) / (AXES.tMax - AXES.tMin)) * (BOX.right - BOX.left);
const toY = (s) => BOX.top + ((AXES.yMax - s) / (AXES.yMax - AXES.yMin)) * (BOX.bottom - BOX.top);

function hline(y, x0, x1, colour, thickness = 1) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
    for (let k = 0; k < thickness; k += 1) put(x, y + k, colour);
  }
}

function vline(x, y0, y1, colour, thickness = 1) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
    for (let k = 0; k < thickness; k += 1) put(x + k, y, colour);
  }
}

const AXIS_COLOUR = [26, 26, 26];
vline(BOX.left, BOX.top, BOX.bottom, AXIS_COLOUR);
hline(BOX.bottom, BOX.left, BOX.right, AXIS_COLOUR);

// Tick marks outside the plot, where a real figure puts them.
for (const t of RISK_TIMES) vline(toX(t), BOX.bottom + 1, BOX.bottom + 6, AXIS_COLOUR);
for (const s of [0, 0.25, 0.5, 0.75, 1]) hline(toY(s), BOX.left - 6, BOX.left - 1, AXIS_COLOUR);

/** A step curve with censoring marks, drawn the way a plotting library draws one. */
function drawCurve(curve, colour, censorTimes, thickness = 2) {
  for (let i = 0; i < curve.length; i += 1) {
    const point = curve[i];
    const next = curve[i + 1];
    const y = toY(point.s);
    const xEnd = next === undefined ? BOX.right : toX(next.t);
    for (let x = Math.round(toX(point.t)); x <= Math.round(xEnd); x += 1) {
      for (let k = 0; k < thickness; k += 1) put(x, y - (thickness - 1) / 2 + k, colour);
    }
    if (next !== undefined) vline(Math.round(toX(next.t)), y, toY(next.s), colour, thickness);
  }
  // Censoring marks: short vertical strokes through the line, as survminer prints them.
  for (const t of censorTimes) {
    if (t > AXES.tMax) continue;
    let s = 1;
    for (const point of curve) if (point.t <= t) s = point.s;
    vline(Math.round(toX(t)), toY(s) - 4, toY(s) + 4, colour, 1);
  }
}

for (const arm of ARMS) drawCurve(arm.curve, arm.colour, arm.censorTimes);

// A legend inside the plot, in the arm colours: the thing a naive scan trips over.
ARMS.forEach((arm, index) => {
  hline(70 + index * 18, 560, 600, arm.colour, 2);
});

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgb, width, height) {
  const stride = width * 3;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, y * stride, stride).copy(rows, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/km-two-arms.png`, encodePng(pixels, WIDTH, HEIGHT));
writeFileSync(
  `${OUT}/km-two-arms.json`,
  `${JSON.stringify(
    {
      note: 'Generated by scripts/make-fixture.mjs. The figure is drawn from this data, so the truth is known.',
      image: { width: WIDTH, height: HEIGHT },
      box: BOX,
      axes: { ...AXES, unit: 'probability' },
      riskTimes: RISK_TIMES,
      arms: ARMS.map((arm) => ({
        name: arm.name,
        colour: arm.colour,
        hex: `#${arm.colour.map((c) => c.toString(16).padStart(2, '0')).join('')}`,
        total: arm.rows.length,
        events: arm.events,
        risk: arm.risk,
        curve: arm.curve,
        ipd: arm.rows,
      })),
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${OUT}/km-two-arms.png and .json`);
for (const arm of ARMS) {
  const median = arm.curve.find((p) => p.s <= 0.5);
  console.log(
    `${arm.name}: n=${arm.rows.length} events=${arm.events} median=${median ? median.t : 'not reached'} atRisk=${arm.risk.map((r) => r.atRisk).join(',')}`,
  );
}
