import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCalibration, validateAxes } from '../core/calibrate';
import { coxHazardRatio, logRank, type CoxFit, type LogRank } from '../core/compare';
import type { ExportArm } from '../core/export';
import { fitQuality, type FitQuality } from '../core/fit';
import { reconstructIpd, type IpdRow } from '../core/guyot';
import { kaplanMeier, survivalAt, type KmFit } from '../core/km';
import { preprocess, type RiskPoint } from '../core/preprocess';
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
import { ComparePanel } from './ComparePanel';
import { ExportPanel } from './ExportPanel';
import { ExtractPanel, type TraceView } from './ExtractPanel';
import { IpdPanel, type IpdArmView } from './IpdPanel';
import { RiskPanel, type RiskArmView } from './RiskPanel';
import { parseNumber, parseNumberList } from './numbers';
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
  /** Numbers at risk, typed as they are printed under the figure. */
  readonly riskNumbers: string;
  readonly total: string;
  readonly totalEvents: string;
}

/** Everything the reconstruction produced for one arm, or why it could not run. */
interface ArmResult {
  readonly ipd: readonly IpdRow[];
  readonly events: number;
  readonly censored: number;
  readonly fit: KmFit;
  readonly quality: FitQuality;
  readonly lowConfidence: boolean;
  readonly failed: string | null;
}

type AxisField = 'tMin' | 'tMax' | 'yMin' | 'yMax';

/** A result that only carries the reason it could not be produced. */
function emptyResult(reason: string): ArmResult {
  return {
    ipd: [],
    events: 0,
    censored: 0,
    fit: { steps: [], n: 0, events: 0, median: null, medianLower: null, medianUpper: null },
    quality: { rmse: Number.NaN, meanAbsError: Number.NaN, maxError: Number.NaN, maxAbsError: Number.NaN, points: 0 },
    lowConfidence: false,
    failed: reason,
  };
}

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
    riskNumbers: '',
    total: '',
    totalEvents: '',
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
        riskNumbers: arm.riskNumbers,
        total: arm.total,
        totalEvents: arm.totalEvents,
      })) ?? [makeArm(1)],
  );
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [traces, setTraces] = useState<Record<string, TraceResult>>({});
  const [maxGap, setMaxGap] = useState(initial?.maxGap ?? 5);
  const [showOverlay, setShowOverlay] = useState(true);
  const [riskTimes, setRiskTimes] = useState(initial?.riskTimes ?? '');
  const [atTimes, setAtTimes] = useState(initial?.atTimes ?? '12, 24, 36');
  const [results, setResults] = useState<Record<string, ArmResult>>({});
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
        riskNumbers: arm.riskNumbers,
        total: arm.total,
        totalEvents: arm.totalEvents,
      })),
      maxGap,
      riskTimes,
      atTimes,
    });
  }, [arms, atTimes, axes, box, drafts, maxGap, riskTimes]);

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


  const riskTimeList = useMemo(() => parseNumberList(riskTimes), [riskTimes]);

  /** The risk table for one arm, and what is wrong with it if anything. */
  const riskFor = (arm: Arm): { risk: RiskPoint[]; problem: string | null } => {
    const numbers = parseNumberList(arm.riskNumbers);
    if (riskTimeList.length === 0 || numbers.length === 0) return { risk: [], problem: null };
    if (numbers.length !== riskTimeList.length) {
      return {
        risk: [],
        problem: t(en.riskMismatch, {
          times: riskTimeList.length,
          numbers: numbers.length,
          name: arm.name,
        }),
      };
    }
    return {
      risk: riskTimeList.map((time, index) => ({ time, atRisk: numbers[index] ?? 0 })),
      problem: null,
    };
  };

  const atTimeList = useMemo(() => parseNumberList(atTimes), [atTimes]);

  const runReconstruction = () => {
    const next: Record<string, ArmResult> = {};
    for (const arm of arms) {
      const trace = traces[arm.id];
      if (trace === undefined || trace.points.length === 0) continue;
      const { risk, problem } = riskFor(arm);
      const total = parseNumber(arm.total);
      if (problem !== null) {
        next[arm.id] = emptyResult(problem);
        continue;
      }
      if (risk.length === 0 && total === null) {
        next[arm.id] = emptyResult(en.riskNeedTotal);
        continue;
      }
      try {
        const prepared = preprocess(trace.points, risk, total);
        const reconstruction = reconstructIpd(prepared, arm.name, parseNumber(arm.totalEvents));
        next[arm.id] = {
          ipd: reconstruction.ipd,
          events: reconstruction.totalEvents,
          censored: reconstruction.ipd.length - reconstruction.totalEvents,
          fit: kaplanMeier(reconstruction.ipd),
          quality: fitQuality(prepared, reconstruction.ipd),
          lowConfidence: prepared.confidence === 'total-only',
          failed: null,
        };
      } catch (error) {
        next[arm.id] = emptyResult(error instanceof Error ? error.message : String(error));
      }
    }
    setResults(next);
  };

  const withIpd = arms
    .map((arm) => ({ arm, result: results[arm.id] }))
    .filter((row): row is { arm: Arm; result: ArmResult } =>
      row.result !== undefined && row.result.failed === null && row.result.ipd.length > 0,
    );

  const firstTwo = withIpd.slice(0, 2);
  let cox: CoxFit | null = null;
  let test: LogRank | null = null;
  let names: readonly [string, string] | null = null;
  if (firstTwo.length === 2) {
    const a = firstTwo[0];
    const b = firstTwo[1];
    if (a !== undefined && b !== undefined) {
      cox = coxHazardRatio(a.result.ipd, b.result.ipd);
      test = logRank(a.result.ipd, b.result.ipd);
      names = [a.arm.name, b.arm.name];
    }
  }

  const maxTime = Math.max(
    0,
    ...withIpd.map((row) => row.result.ipd[row.result.ipd.length - 1]?.time ?? 0),
  );

  const riskViews: RiskArmView[] = arms.map((arm) => ({
    id: arm.id,
    name: arm.name,
    numbers: arm.riskNumbers,
    total: arm.total,
    events: arm.totalEvents,
    problem: riskFor(arm).problem,
  }));

  const ipdViews: IpdArmView[] = arms
    .map((arm) => ({ arm, result: results[arm.id] }))
    .filter((row) => row.result !== undefined)
    .map(({ arm, result }) => {
      const value = result as ArmResult;
      return {
        id: arm.id,
        name: arm.name,
        patients: value.ipd.length,
        events: value.events,
        censored: value.censored,
        fit: value.fit,
        quality: value.quality,
        lowConfidence: value.lowConfidence,
        failed: value.failed,
        survivalAt: atTimeList.map((time) => ({ time, ...survivalAt(value.fit, time) })),
      };
    });

  const exportArms: ExportArm[] = arms
    .filter((arm) => (traces[arm.id]?.points.length ?? 0) > 0)
    .map((arm) => ({
      name: arm.name,
      points: traces[arm.id]?.points ?? [],
      ipd: results[arm.id]?.ipd ?? [],
      lowConfidence: results[arm.id]?.lowConfidence ?? false,
    }));

  const canReconstruct = Object.values(traces).some((trace) => trace.points.length > 0);

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
              <RiskPanel
                times={riskTimes}
                arms={riskViews}
                onTimes={setRiskTimes}
                onNumbers={(id, riskNumbers) => updateArm(id, { riskNumbers })}
                onTotal={(id, total) => updateArm(id, { total })}
                onEvents={(id, totalEvents) => updateArm(id, { totalEvents })}
              />
              <IpdPanel
                arms={ipdViews}
                canRun={canReconstruct}
                hasRun={Object.keys(results).length > 0}
                atTimes={atTimes}
                onRun={runReconstruction}
                onAtTimes={setAtTimes}
              />
              <ComparePanel
                series={withIpd.map((row) => ({
                  name: row.arm.name,
                  fit: row.result.fit,
                  colour: row.arm.colour,
                }))}
                maxTime={maxTime}
                names={names}
                cox={cox}
                test={test}
              />
              <ExportPanel arms={exportArms} hasIpd={withIpd.length > 0} />
            </>
          )}
          </main>
        </div>
      </div>
    </>
  );
}
