import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Calibration } from '../core/calibrate';
import { samplePatch } from '../core/color';
import type { MaskResult } from '../core/mask';
import type { CurvePoint, PlotBox, Raster, Rgb } from '../core/types';
import { en, t } from '../i18n/en';

export interface MaskOverlay {
  readonly mask: MaskResult;
  readonly colour: Rgb;
}

export interface CurveOverlay {
  readonly points: readonly CurvePoint[];
  readonly calibration: Calibration;
}

export interface FigureCanvasProps {
  readonly image: HTMLImageElement;
  readonly raster: Raster;
  readonly zoom: number;
  readonly box: PlotBox;
  readonly showBox: boolean;
  readonly masks?: readonly MaskOverlay[];
  readonly curves?: readonly CurveOverlay[];
  readonly picking?: boolean;
  readonly onPick?: (rgb: Rgb) => void;
  readonly onBoxChange?: (box: PlotBox) => void;
}

type Edge = 'left' | 'right' | 'top' | 'bottom';

const EDGE_LABEL: Record<Edge, string> = {
  left: en.axesEdgeLeft,
  right: en.axesEdgeRight,
  top: en.axesEdgeTop,
  bottom: en.axesEdgeBottom,
};

/** Keep an edge inside the image and on the correct side of its partner. */
function moveEdge(box: PlotBox, edge: Edge, value: number, raster: Raster): PlotBox {
  const v = Math.round(value);
  switch (edge) {
    case 'left':
      return { ...box, left: Math.max(0, Math.min(v, box.right - 2)) };
    case 'right':
      return { ...box, right: Math.min(raster.width - 1, Math.max(v, box.left + 2)) };
    case 'top':
      return { ...box, top: Math.max(0, Math.min(v, box.bottom - 2)) };
    case 'bottom':
      return { ...box, bottom: Math.min(raster.height - 1, Math.max(v, box.top + 2)) };
  }
}

/**
 * The figure with everything drawn over it: the plot box and its four handles, the pixels that
 * match an arm colour, and the traced curves. One canvas does the drawing; the handles are real
 * buttons on top of it, so they can be tabbed to and nudged with the arrow keys.
 */
export function FigureCanvas({
  image,
  raster,
  zoom,
  box,
  showBox,
  masks = [],
  curves = [],
  picking = false,
  onPick,
  onBoxChange,
}: FigureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; rgb: Rgb } | null>(null);
  const width = Math.round(raster.width * zoom);
  const height = Math.round(raster.height * zoom);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.drawImage(image, 0, 0, width, height);

    // Matching pixels, painted as blocks so they stay visible when zoomed out.
    for (const { mask, colour } of masks) {
      ctx.fillStyle = `rgba(${colour.r}, ${colour.g}, ${colour.b}, 0.85)`;
      const size = Math.max(1, zoom);
      for (let y = 0; y < mask.height; y += 1) {
        for (let x = 0; x < mask.width; x += 1) {
          if (mask.mask[y * mask.width + x] !== 1) continue;
          ctx.fillRect((x + box.left) * zoom, (y + box.top) * zoom, size, size);
        }
      }
    }

    // The traced curves, cased in white so they read over any figure.
    for (const { points, calibration } of curves) {
      if (points.length === 0) continue;
      const path = new Path2D();
      points.forEach((point, index) => {
        const at = calibration.toPixel(point);
        const x = at.x * zoom;
        const y = at.y * zoom;
        if (index === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke(path);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#0b0f14';
      ctx.stroke(path);
    }

    if (showBox) {
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#b86e00';
      ctx.strokeRect(
        box.left * zoom + 0.5,
        box.top * zoom + 0.5,
        (box.right - box.left) * zoom,
        (box.bottom - box.top) * zoom,
      );
      ctx.setLineDash([]);
    }
  }, [box, curves, height, image, masks, showBox, width, zoom]);

  useEffect(draw, [draw]);

  /** Image coordinates under a pointer event. */
  const imagePoint = (event: PointerEvent<HTMLElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round((event.clientX - rect.left) / zoom),
      y: Math.round((event.clientY - rect.top) / zoom),
    };
  };

  const handleCanvasMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!picking) return;
    const { x, y } = imagePoint(event);
    const rgb = samplePatch(raster, x, y);
    setLoupe(rgb === null ? null : { x: x * zoom, y: y * zoom, rgb });
  };

  const handleCanvasClick = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!picking || onPick === undefined) return;
    const { x, y } = imagePoint(event);
    const rgb = samplePatch(raster, x, y);
    if (rgb !== null) onPick(rgb);
  };

  const startDrag = (edge: Edge) => (event: PointerEvent<HTMLButtonElement>) => {
    if (onBoxChange === undefined) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const parent = target.parentElement;
    if (parent === null) return;
    const rect = parent.getBoundingClientRect();
    const move = (moveEvent: globalThis.PointerEvent) => {
      const value =
        edge === 'left' || edge === 'right'
          ? (moveEvent.clientX - rect.left) / zoom
          : (moveEvent.clientY - rect.top) / zoom;
      onBoxChange(moveEdge(box, edge, value, raster));
    };
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  };

  const handleKey = (edge: Edge) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (onBoxChange === undefined) return;
    const horizontal = edge === 'left' || edge === 'right';
    const step = event.shiftKey ? 10 : 1;
    const current = box[edge];
    if (horizontal && event.key === 'ArrowLeft') onBoxChange(moveEdge(box, edge, current - step, raster));
    else if (horizontal && event.key === 'ArrowRight') onBoxChange(moveEdge(box, edge, current + step, raster));
    else if (!horizontal && event.key === 'ArrowUp') onBoxChange(moveEdge(box, edge, current - step, raster));
    else if (!horizontal && event.key === 'ArrowDown') onBoxChange(moveEdge(box, edge, current + step, raster));
    else return;
    event.preventDefault();
  };

  const handleStyle = (edge: Edge): React.CSSProperties => {
    switch (edge) {
      case 'left':
        return { left: box.left * zoom, top: box.top * zoom, height: (box.bottom - box.top) * zoom };
      case 'right':
        return {
          left: box.right * zoom,
          top: box.top * zoom,
          height: (box.bottom - box.top) * zoom,
        };
      case 'top':
        return { top: box.top * zoom, left: box.left * zoom, width: (box.right - box.left) * zoom };
      case 'bottom':
        return {
          top: box.bottom * zoom,
          left: box.left * zoom,
          width: (box.right - box.left) * zoom,
        };
    }
  };

  const edges: readonly Edge[] = ['left', 'right', 'top', 'bottom'];

  return (
    <div className="figure" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className={picking ? 'figure__canvas figure__canvas--picking' : 'figure__canvas'}
        style={{ width, height }}
        onPointerMove={handleCanvasMove}
        onPointerLeave={() => setLoupe(null)}
        onPointerDown={handleCanvasClick}
      />
      {onBoxChange !== undefined &&
        edges.map((edge) => (
          <button
            key={edge}
            type="button"
            className={`figure__handle figure__handle--${edge}`}
            style={handleStyle(edge)}
            aria-label={t(en.axesHandleLabel, { edge: EDGE_LABEL[edge], value: box[edge] })}
            onPointerDown={startDrag(edge)}
            onKeyDown={handleKey(edge)}
          />
        ))}
      {loupe !== null && (
        <span
          className="figure__loupe"
          style={{
            left: loupe.x,
            top: loupe.y,
            background: `rgb(${loupe.rgb.r}, ${loupe.rgb.g}, ${loupe.rgb.b})`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
