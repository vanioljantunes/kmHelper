import { describe, expect, it } from 'vitest';
import { rgbToLab } from '../../src/core/color';
import { buildMask, clampBox, DEFAULT_TOLERANCE } from '../../src/core/mask';
import type { PlotBox } from '../../src/core/types';
import { createCanvas, drawHLine, setPixel } from '../helpers/draw';

const BOX: PlotBox = { left: 10, right: 89, top: 10, bottom: 59 };
const BLUE = { r: 31, g: 119, b: 180 };
const ORANGE = { r: 255, g: 127, b: 14 };

describe('clampBox', () => {
  it('keeps a box inside the image', () => {
    const image = createCanvas(50, 40);
    expect(clampBox({ left: -5, right: 200, top: -1, bottom: 99 }, image)).toEqual({
      left: 0,
      right: 49,
      top: 0,
      bottom: 39,
    });
  });
});

describe('buildMask', () => {
  it('marks the matching line and nothing else', () => {
    const c = createCanvas(100, 70);
    drawHLine(c, 30, 20, 69, [BLUE.r, BLUE.g, BLUE.b], 2);
    const { mask, width, height, matched } = buildMask(c, BOX, rgbToLab(BLUE));
    expect(width).toBe(80);
    expect(height).toBe(50);
    expect(matched).toBe(100);
    expect(mask[(30 - BOX.top) * width + (40 - BOX.left)]).toBe(1);
    expect(mask[(35 - BOX.top) * width + (40 - BOX.left)]).toBe(0);
  });

  it('leaves out a second arm in another colour', () => {
    const c = createCanvas(100, 70);
    drawHLine(c, 30, 20, 69, [BLUE.r, BLUE.g, BLUE.b], 2);
    drawHLine(c, 40, 20, 69, [ORANGE.r, ORANGE.g, ORANGE.b], 2);
    expect(buildMask(c, BOX, rgbToLab(BLUE)).matched).toBe(100);
    expect(buildMask(c, BOX, rgbToLab(ORANGE)).matched).toBe(100);
  });

  it('ignores ink outside the plot box', () => {
    const c = createCanvas(100, 70);
    drawHLine(c, 5, 0, 99, [BLUE.r, BLUE.g, BLUE.b], 2);
    expect(buildMask(c, BOX, rgbToLab(BLUE)).matched).toBe(0);
  });

  it('takes in more of an anti-aliased edge as the tolerance rises', () => {
    const c = createCanvas(100, 70);
    drawHLine(c, 30, 20, 69, [BLUE.r, BLUE.g, BLUE.b], 1);
    // One faded edge pixel, the way a real stroke is drawn.
    setPixel(c, 40, 29, [BLUE.r, BLUE.g, BLUE.b], 100);
    const tight = buildMask(c, BOX, rgbToLab(BLUE), 5).matched;
    const loose = buildMask(c, BOX, rgbToLab(BLUE), 35).matched;
    expect(tight).toBe(50);
    expect(loose).toBe(51);
  });

  it('counts nothing for a colour the figure does not use', () => {
    const c = createCanvas(100, 70);
    drawHLine(c, 30, 20, 69, [BLUE.r, BLUE.g, BLUE.b], 2);
    expect(buildMask(c, BOX, rgbToLab({ r: 0, g: 200, b: 0 }), DEFAULT_TOLERANCE).matched).toBe(0);
  });

  it('skips transparent pixels', () => {
    const c = createCanvas(100, 70, [BLUE.r, BLUE.g, BLUE.b]);
    for (let i = 3; i < c.data.length; i += 4) c.data[i] = 0;
    expect(buildMask(c, BOX, rgbToLab(BLUE)).matched).toBe(0);
  });

  it('returns an empty mask for a box with no area', () => {
    const c = createCanvas(100, 70);
    const flat = buildMask(c, { left: 40, right: 40, top: 20, bottom: 20 }, rgbToLab(BLUE));
    expect(flat.width).toBe(1);
    expect(flat.matched).toBe(0);
  });
});
