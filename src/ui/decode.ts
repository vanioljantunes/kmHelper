import type { Raster } from '../core/types';

export interface LoadedFigure {
  readonly image: HTMLImageElement;
  readonly raster: Raster;
  readonly url: string;
}

/** Read the pixels of a decoded image through an offscreen canvas. */
function readRaster(image: HTMLImageElement): Raster {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('This browser did not give a 2D canvas.');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: data.data, width: data.width, height: data.height };
}

/**
 * Decode a dropped, pasted or chosen file into an element to draw and a raster to measure. The
 * object URL is handed back so the caller can revoke it when the figure is replaced.
 */
export async function loadFigure(file: Blob): Promise<LoadedFigure> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, raster: readRaster(image), url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** The first image in a paste or drop, if there is one. */
export function firstImage(items: DataTransferItemList | FileList | null): File | null {
  if (items === null) return null;
  const list = Array.from(items as ArrayLike<DataTransferItem | File>);
  for (const item of list) {
    if (item instanceof File) {
      if (item.type.startsWith('image/')) return item;
      continue;
    }
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file !== null) return file;
    }
  }
  return null;
}
