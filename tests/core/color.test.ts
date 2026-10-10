import { describe, expect, it } from 'vitest';
import {
  deltaE2000,
  deltaE76,
  fromHex,
  pixelAt,
  rgbToLab,
  samplePatch,
  toHex,
} from '../../src/core/color';
import type { Raster } from '../../src/core/types';

/** A raster filled with one colour, with optional per-pixel overrides. */
function raster(
  width: number,
  height: number,
  fill: [number, number, number, number],
  overrides: Record<string, [number, number, number, number]> = {},
): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  for (const [key, value] of Object.entries(overrides)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const i = (y * width + x) * 4;
    data[i] = value[0];
    data[i + 1] = value[1];
    data[i + 2] = value[2];
    data[i + 3] = value[3];
  }
  return { data, width, height };
}

describe('rgbToLab', () => {
  // Reference values for the sRGB primaries under D65.
  const cases: ReadonlyArray<[string, [number, number, number], [number, number, number]]> = [
    ['white', [255, 255, 255], [100, 0, 0]],
    ['black', [0, 0, 0], [0, 0, 0]],
    ['red', [255, 0, 0], [53.2408, 80.0925, 67.2032]],
    ['green', [0, 255, 0], [87.7347, -86.1827, 83.1793]],
    ['blue', [0, 0, 255], [32.297, 79.1875, -107.8602]],
    ['mid grey', [128, 128, 128], [53.5851, 0, 0]],
  ];
  for (const [name, [r, g, b], [l, a, bb]] of cases) {
    it(`matches the published Lab value for ${name}`, () => {
      const lab = rgbToLab({ r, g, b });
      expect(lab.l).toBeCloseTo(l, 3);
      expect(lab.a).toBeCloseTo(a, 3);
      expect(lab.b).toBeCloseTo(bb, 3);
    });
  }
});

describe('deltaE2000', () => {
  // Sharma, Wu & Dalal (2005) CIEDE2000 test data, the set used to verify implementations.
  const cases: ReadonlyArray<[[number, number, number], [number, number, number], number]> = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, -1, 2], [50, 0, 0], 2.3669],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [[l1, a1, b1], [l2, a2, b2], expected] of cases) {
    it(`gives ${expected} for (${l1}, ${a1}, ${b1}) against (${l2}, ${a2}, ${b2})`, () => {
      expect(deltaE2000({ l: l1, a: a1, b: b1 }, { l: l2, a: a2, b: b2 })).toBeCloseTo(
        expected,
        3,
      );
    });
  }

  it('is zero for a colour against itself', () => {
    const lab = rgbToLab({ r: 31, g: 119, b: 180 });
    expect(deltaE2000(lab, lab)).toBe(0);
  });

  it('separates two arms a figure would actually use', () => {
    // matplotlib tab10 blue against tab10 orange: far above any sensible tolerance.
    const blue = rgbToLab({ r: 31, g: 119, b: 180 });
    const orange = rgbToLab({ r: 255, g: 127, b: 14 });
    expect(deltaE2000(blue, orange)).toBeGreaterThan(40);
  });
});

describe('deltaE76', () => {
  it('is the euclidean distance in Lab', () => {
    expect(deltaE76({ l: 50, a: 0, b: 0 }, { l: 50, a: 3, b: 4 })).toBeCloseTo(5, 10);
  });
});

describe('pixelAt', () => {
  const image = raster(3, 2, [10, 20, 30, 255], { '2,1': [200, 100, 50, 255] });

  it('reads a pixel', () => {
    expect(pixelAt(image, 2, 1)).toEqual({ r: 200, g: 100, b: 50 });
  });

  it('returns null outside the raster', () => {
    expect(pixelAt(image, 3, 1)).toBeNull();
    expect(pixelAt(image, -1, 0)).toBeNull();
    expect(pixelAt(image, 0, 2)).toBeNull();
  });
});

describe('samplePatch', () => {
  it('averages the 3 by 3 neighbourhood', () => {
    // A single bright pixel in a dark field: the patch average pulls it back towards the field.
    const image = raster(3, 3, [0, 0, 0, 255], { '1,1': [90, 90, 90, 255] });
    expect(samplePatch(image, 1, 1)).toEqual({ r: 10, g: 10, b: 10 });
  });

  it('clips the patch at the edge instead of reading outside', () => {
    const image = raster(2, 2, [40, 40, 40, 255]);
    expect(samplePatch(image, 0, 0)).toEqual({ r: 40, g: 40, b: 40 });
  });

  it('skips transparent pixels so a cut-out background does not count', () => {
    const image = raster(3, 3, [0, 0, 0, 0], { '1,1': [60, 120, 180, 255] });
    expect(samplePatch(image, 1, 1)).toEqual({ r: 60, g: 120, b: 180 });
  });

  it('returns null when nothing in range is opaque', () => {
    expect(samplePatch(raster(3, 3, [0, 0, 0, 0]), 1, 1)).toBeNull();
  });
});

describe('hex', () => {
  it('round-trips', () => {
    expect(toHex({ r: 31, g: 119, b: 180 })).toBe('#1f77b4');
    expect(fromHex('#1f77b4')).toEqual({ r: 31, g: 119, b: 180 });
  });

  it('accepts the short form and a missing hash', () => {
    expect(fromHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(fromHex('1f77b4')).toEqual({ r: 31, g: 119, b: 180 });
  });

  it('rejects anything else', () => {
    expect(fromHex('')).toBeNull();
    expect(fromHex('#12345')).toBeNull();
    expect(fromHex('nope')).toBeNull();
  });
});
