import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCalibration, validateAxes } from '../core/calibrate';
import { fromHex, rgbToLab, toHex } from '../core/color';
import { buildMask, clampBox, DEFAULT_TOLERANCE } from '../core/mask';
import { detectPlotBox } from '../core/plotbox';
import { traceCurve } from '../core/trace';
import type { AxisValues, PlotBox, Rgb, SurvivalUnit, TraceResult } from '../core/types';
import { en, t } from '../i18n/en';
import { createLocalDraftStore } from '../storage/localStore';
import type { DraftStore } from '../storage/types';
import { ArmsPanel, type ArmView } from './ArmsPanel';
import { AxesPanel } from './AxesPanel';
import { ExtractPanel, type TraceView } from './ExtractPanel';
import { Hero } from './Hero';
import { ImagePanel } from './ImagePanel';
import { SectionNav } from './SectionNav';
import { SiteBar } from './SiteBar';
import { firstImage, loadFigure, type LoadedFigure } from './decode';
import './app.css';

interface Arm {
  readonly id: string;
  readonly name: string;
  readonly colour: Rgb | null;
  readonly tolerance: number;
  readonly showMask: boolean;
}

type AxisField = 'tMin' | 'tMax' | 'yMin' | 'yMax';

const DEFAULT_AXES: AxisValues = { tMin: 0, tMax: 0, yMin: 0, yMax: 1, unit: 'probability' };

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `arm-${Math.random().toString(36).slice(2, 10)}`;

function makeArm(number: number): Arm {
  return {
    id: newId(),
    name: t(en.armsNameDefault, { number }),
    colour: null,
    tolerance: DEFAULT_TOLERANCE,
    showMask: true,
  };
}

export interface AppProps {
  readonly draftStore?: DraftStore;
}

export function App({ draftStore }: AppProps = {}) {
  const [drafts] = useState(() => draftStore ?? createLocalDraftStore());
  const [initial] = useState(() => drafts.load());
  const [figure, setFigure] = useState<LoadedFigure | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState<PlotBox | null>(initial?.box ?? null);
  const [confident, setConfident] = useState(true);
  const [axes, setAxes] = useState<AxisValues>(initial?.axes ?? DEFAULT_AXES);
  const [raw, setRaw] = useState<Record<AxisField, string>>(() => {
    const source = initial?.axes ?? DEFAULT_AXES;
    const show = (value: number): string => (value === 0 ? '' : String(value));
    return {
      tMin: String(source.tMin),
      tMax: show(source.tMax),
      yMin: String(source.yMin),
      yMax: String(source.yMax),
    };
  });
  const [arms, setArms] = useState<readonly Arm[]>(
    () =>
      initial?.arms.map((arm) => ({
        id: arm.id,
        name: arm.name,
        colour: arm.hex === null ? null : fromHex(arm.hex),
        tolerance: arm.tolerance,
        showMask: true,
      })) ?? [makeArm(1)],
  );
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [traces, setTraces] = useState<Record<string, TraceResult>>({});
  const [maxGap, setMaxGap] = useState(initial?.maxGap ?? 5);
  const [showOverlay, setShowOverlay] = useState(true);
  const urlRef = useRef<string | null>(null);

  // Keep the draft, minus the figure itself.
  useEffect(() => {
    drafts.save({
      box,
      axes,
      arms: arms.map((arm) => ({
        id: arm.id,
        name: arm.name,
        hex: arm.colour === null ? null : toHex(arm.colour),
        tolerance: arm.tolerance,
      })),
      maxGap,
    });
  }, [arms, axes, box, drafts, maxGap]);

  const openFile = useCallback(async (file: File) => {
    setImageError(null);
    try {
      const loaded = await loadFigure(file);
      if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current);
      urlRef.current = loaded.url;
      setFigure(loaded);
      const detected = detectPlotBox(loaded.raster);
      setBox({
        left: detected.left,
        right: detected.right,
        top: detected.top,
        bottom: detected.bottom,
      });
      setConfident(detected.confident);
      setTraces({});
    } catch {
      setImageError(en.imageError);
    }
  }, []);

  // A screenshot normally arrives on the clipboard, so paste works anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = firstImage(event.clipboardData?.items ?? null);
      if (file === null) return;
      event.preventDefault();
      void openFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [openFile]);

  useEffect(
    () => () => {
      if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const clamped = useMemo(
    () => (figure === null || box === null ? null : clampBox(box, figure.raster)),
    [box, figure],
  );
  const problems = useMemo(
    () => (clamped === null ? [] : validateAxes(clamped, axes)),
    [axes, clamped],
  );
  const calibration = useMemo(
    () => (clamped === null || problems.length > 0 ? null : createCalibration(clamped, axes)),
    [axes, clamped, problems.length],
  );

  // What matches each arm colour. Recomputed when the colour, the tolerance or the box move, so
  // the overlay always shows what the trace will actually read.
  const masks = useMemo(() => {
    if (figure === null || clamped === null) return {};
    const out: Record<string, ReturnType<typeof buildMask>> = {};
    for (const arm of arms) {
      if (arm.colour === null) continue;
      out[arm.id] = buildMask(figure.raster, clamped, rgbToLab(arm.colour), arm.tolerance);
    }
    return out;
  }, [arms, clamped, figure]);

  const updateArm = (id: string, change: Partial<Arm>) =>
    setArms((current) => current.map((arm) => (arm.id === id ? { ...arm, ...change } : arm)));

  const handleValue = (field: AxisField, value: string) => {
    setRaw((current) => ({ ...current, [field]: value }));
    const parsed = value.trim() === '' ? Number.NaN : Number(value);
    setAxes((current) => ({ ...current, [field]: parsed }));
  };

  const handleUnit = (unit: SurvivalUnit) => {
    setAxes((current) => {
      // Moving between 0-1 and 0-100 keeps the same axis, so rescale the two y values with it.
      const factor = unit === 'percent' ? 100 : 0.01;
      const next = { ...current, unit } as AxisValues;
      if (current.unit === unit) return next;
      const yMin = current.yMin * factor;
      const yMax = current.yMax * factor;
      setRaw((rawValues) => ({ ...rawValues, yMin: String(yMin), yMax: String(yMax) }));
      return { ...next, yMin, yMax };
    });
  };

  const handleRedetect = () => {
    if (figure === null) return;
    const detected = detectPlotBox(figure.raster);
    setBox({
      left: detected.left,
      right: detected.right,
      top: detected.top,
      bottom: detected.bottom,
    });
    setConfident(detected.confident);
  };

  const handlePicked = (rgb: Rgb) => {
    if (pickingId === null) return;
    updateArm(pickingId, { colour: rgb });
    setPickingId(null);
  };

  const runExtraction = () => {
    if (figure === null || clamped === null || calibration === null) return;
    const next: Record<string, TraceResult> = {};
    for (const arm of arms) {
      const mask = masks[arm.id];
      if (mask === undefined) continue;
      next[arm.id] = traceCurve(
        mask,
        { left: clamped.left, top: clamped.top },
        calibration,
        { maxGap },
      );
    }
    setTraces(next);
  };

  const armViews: ArmView[] = arms.map((arm) => ({
    id: arm.id,
    name: arm.name,
    colour: arm.colour,
    tolerance: arm.tolerance,
    mask: masks[arm.id] ?? null,
    showMask: arm.showMask,
  }));

  const traceViews: TraceView[] = arms.map((arm) => ({
    id: arm.id,
    name: arm.name,
    colour: arm.colour,
    trace: traces[arm.id] ?? null,
  }));

  const canRun =
    calibration !== null && arms.some((arm) => (masks[arm.id]?.matched ?? 0) > 0);

  return (
    <>
      <SiteBar />
      <div className="app">
        <Hero />
        <div className="tool">
          <SectionNav />
          <main id="main">
          <ImagePanel
            figure={figure}
            error={imageError}
            zoom={zoom}
            onFile={(file) => void openFile(file)}
            onZoom={setZoom}
          />
          {figure !== null && clamped !== null && (
            <>
              <AxesPanel
                figure={figure}
                zoom={zoom}
                box={clamped}
                confident={confident}
                axes={axes}
                rawValues={raw}
                problems={problems}
                onBoxChange={setBox}
                onValueChange={handleValue}
                onUnitChange={handleUnit}
                onRedetect={handleRedetect}
              />
              <ArmsPanel
                figure={figure}
                zoom={zoom}
                box={clamped}
                arms={armViews}
                pickingId={pickingId}
                onAdd={() => setArms((current) => [...current, makeArm(current.length + 1)])}
                onRemove={(id) => setArms((current) => current.filter((arm) => arm.id !== id))}
                onName={(id, name) => updateArm(id, { name })}
                onHex={(id, hex) => {
                  const rgb = fromHex(hex);
                  if (rgb !== null) updateArm(id, { colour: rgb });
                }}
                onTolerance={(id, tolerance) => updateArm(id, { tolerance })}
                onPickStart={setPickingId}
                onPickCancel={() => setPickingId(null)}
                onPicked={handlePicked}
                onShowMask={(id, showMask) => updateArm(id, { showMask })}
              />
              <ExtractPanel
                figure={figure}
                zoom={zoom}
                box={clamped}
                calibration={calibration}
                traces={traceViews}
                maxGap={maxGap}
                showOverlay={showOverlay}
                canRun={canRun}
                hasRun={Object.keys(traces).length > 0}
                onRun={runExtraction}
                onMaxGap={setMaxGap}
                onShowOverlay={setShowOverlay}
              />
            </>
          )}
          </main>
        </div>
      </div>
    </>
  );
}
