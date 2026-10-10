import { useId, useRef, useState, type DragEvent } from 'react';
import { FigureScroll } from './FigureScroll';
import { en, t } from '../i18n/en';
import { firstImage } from './decode';
import type { LoadedFigure } from './decode';

export interface ImagePanelProps {
  readonly figure: LoadedFigure | null;
  readonly error: string | null;
  readonly zoom: number;
  readonly onFile: (file: File) => void;
  readonly onZoom: (zoom: number) => void;
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

function nextZoom(zoom: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex((step) => step >= zoom - 1e-9);
  const target = (index === -1 ? ZOOM_STEPS.length - 1 : index) + direction;
  return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, target))] ?? 1;
}

/** The first section: get a figure in. Drop, paste or choose; nothing is uploaded. */
export function ImagePanel({ figure, error, zoom, onFile, onZoom }: ImagePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const headingId = useId();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    const file = firstImage(event.dataTransfer.items) ?? firstImage(event.dataTransfer.files);
    if (file !== null) onFile(file);
  };

  return (
    <section id="image" tabIndex={-1} aria-labelledby={headingId} className="panel">
      <h2 id={headingId}>{en.imageHeading}</h2>
      <div
        className={over ? 'dropzone dropzone--over' : 'dropzone'}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        <p>
          {en.imageDrop}{' '}
          <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
            {en.imagePick}
          </button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label={en.imageFileLabel}
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onFile(file);
            event.target.value = '';
          }}
        />
        <p className="hint">{en.imageHint}</p>
        <p className="hint">{en.imagePasteHint}</p>
      </div>
      {error !== null && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {figure !== null && (
        <>
          <p className="hint">
            {t(en.imageLoaded, { width: figure.raster.width, height: figure.raster.height })}
          </p>
          <div className="zoom-bar">
            <button type="button" onClick={() => onZoom(nextZoom(zoom, -1))}>
              {en.imageZoomOut}
            </button>
            <button type="button" onClick={() => onZoom(1)}>
              {en.imageZoomReset}
            </button>
            <button type="button" onClick={() => onZoom(nextZoom(zoom, 1))}>
              {en.imageZoomIn}
            </button>
            <span aria-live="polite">{t(en.imageZoomLevel, { percent: Math.round(zoom * 100) })}</span>
          </div>
          <FigureScroll label={en.figureScrollImage}>
            <img
              src={figure.url}
              alt=""
              width={Math.round(figure.raster.width * zoom)}
              height={Math.round(figure.raster.height * zoom)}
            />
          </FigureScroll>
        </>
      )}
    </section>
  );
}
