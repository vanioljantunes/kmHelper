import { inflateSync } from 'node:zlib';
import type { Raster } from '../../src/core/types';

/**
 * Decode the PNGs this repository generates: 8-bit truecolour, no interlacing. Enough to read a
 * fixture back through the real pipeline without pulling in an image library. All five filter
 * types are handled, so a PNG from another encoder also reads correctly.
 */
export function decodePng(file: Buffer): Raster {
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG.');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 3;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('Only 8-bit PNGs are read.');
      const colourType = data[9];
      if (colourType === 2) channels = 3;
      else if (colourType === 6) channels = 4;
      else throw new Error(`Colour type ${String(colourType)} is not read.`);
      if (data[12] !== 0) throw new Error('Interlaced PNGs are not read.');
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i += 1) {
      const x = row[i] ?? 0;
      const a = i >= channels ? (current[i - channels] ?? 0) : 0;
      const b = previous[i] ?? 0;
      const c = i >= channels ? (previous[i - channels] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`Filter ${String(filter)} is not read.`);
      }
      current[i] = value & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      out[i] = current[x * channels] ?? 0;
      out[i + 1] = current[x * channels + 1] ?? 0;
      out[i + 2] = current[x * channels + 2] ?? 0;
      out[i + 3] = channels === 4 ? (current[x * channels + 3] ?? 255) : 255;
    }
    previous.set(current);
  }
  return { data: out, width, height };
}
