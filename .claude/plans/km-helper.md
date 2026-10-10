# kmHelper — KM curve to IPD
Progress: 29/34 (85%)
Started: 2026-10-10 08:40 BRT   Updated: 2026-10-10 10:05 BRT

## Goal
A tool at /tools/kmHelper/ that takes a screenshot of a Kaplan-Meier figure, one colour pick per
arm, four axis values, and produces reconstructed individual patient data checkable against
IPDfromKM in R. Done when typecheck, lint, unit tests and the Playwright/axe walk are green, the
Guyot reconstruction reproduces the embedded published fixture, and the page answers at
https://vanioantunes.com/tools/kmHelper/.

## Steps
### Phase 1 — scaffold and digitize
- [x] 1. repo scaffold: package.json, tsconfig, eslint boundary, prettier, vite config, index.html
- [x] 2. core/color.ts (sRGB -> Lab, dE76, dE2000, samplePatch)
- [x] 3. tests/core/color.test.ts against published Lab values
- [x] 4. core/types.ts shared shapes
- [x] 5. core/plotbox.ts detectPlotBox with Otsu + ink profiles
- [x] 6. tests/core/plotbox.test.ts on synthetic frames
- [x] 7. core/calibrate.ts toData/toPixel, percent and probability units
- [x] 8. tests/core/calibrate.test.ts
- [x] 9. core/mask.ts buildMask + matched count
- [x] 10. core/trace.ts column trace, risers, ticks, gaps, monotone, thinning
- [x] 11. tests/core/trace.test.ts (clean step, tick, crossing arm, antialias, gap, legend swatch)
- [x] 12. scripts/make-fixture.mjs synthetic KM figure PNGs from known IPD
- [x] 13. ui: SiteBar, SectionNav, useActiveSection, useMediaQuery, app.css adapted from ssHelper
- [x] 14. ui: i18n/en.ts copy for every section
- [x] 15. ui: ImagePanel (drop, file, Ctrl+V paste, zoom, pan)
- [x] 16. ui: AxesPanel (auto box, four draggable handles, axis values, y unit)
- [x] 17. ui: ArmsPanel (eyedropper, hex field, tolerance slider, mask overlay, loupe, dE warning)
- [x] 18. ui: ExtractPanel (extract, overlay, point table, tick count, sliders)
- [x] 19. App wiring + storage/localStore for the draft
- [x] 20. phase 1 gate: typecheck, lint, test; screenshots at 1536 and 390; commit and push

### Phase 2 — reconstruct
- [x] 21. core/preprocess.ts risk-table reconciliation
- [x] 22. core/guyot.ts Guyot 2012 iterative reconstruction
- [x] 23. tests/core/guyot.test.ts against IPDfromKM 0.1.10 run on the same digitized curve
- [x] 24. core/km.ts KM, Greenwood, log-log band, median with Brookmeyer-Crowley CI, S(t)
- [x] 25. tests/core/km.test.ts against survfit with a log-log band
- [x] 26. core/fit.ts RMSE and max deviation
- [x] 27. core/export.ts IPD CSV, points CSV, R snippet
- [ ] 28. ui: RiskPanel, IpdPanel, ExportPanel
- [ ] 29. phase 2 gate: typecheck, lint, test; commit and push

### Phase 3 — compare and ship
- [x] 30. core/compare.ts log-rank and Cox HR by Newton-Raphson
- [x] 31. compare tests against survdiff and coxph (folded into km.test.ts)
- [ ] 32. ui: ComparePanel SVG overlay plot, HistoryTable
- [ ] 33. tests/e2e: full walk fixture -> CSV, axe on every section
- [ ] 34. ship: GitHub repo, Vercel project, vanioAntunes vercel.json + tools card + subnav + docs

## Notes
Phase 1 gate passed: typecheck, lint, 78 unit tests, 4 Playwright checks (walk plus axe at 1536
and 390 px). The accuracy test reads the generated fixture PNG back through the whole pipeline and
holds both arms within 1 percentage point of survival at every checked time, RMSE under 0.005.

Four defects found and fixed while testing the trace, each now covered: a thick riser's trailing
column was reported as a censoring mark; the look-ahead took the nearest run in the first column
that had one, letting a legend swatch hijack a descent; a riser could descend to a level outside
its own run; and a break straddling a step could never be re-acquired. A fifth was found from the
screenshots: small events were being read as censoring marks, because in a trial of 120 an event
drops the curve no further than a mark displaces it. Marks are now told from risers by whether the
run reaches above the current level, which is what a mark does and a riser never does.

Mark detection is a floor, not a census: marks sharing a pixel column, or sitting on a step, are
not separable. The UI says so. Guyot does not use mark positions, so this does not affect the
reconstruction.

No remote yet: the GitHub repository and the Vercel project are created in step 34.

Phase 2: the statistics are checked against R, not against hand arithmetic. IPDfromKM 0.1.10 was
installed (operator approved) and scripts/compare-ipdfromkm.R puts the curve kmHelper digitized
through the reference package; our port reproduces it patient for patient, every event and every
censoring at the same time. survfit, survdiff and coxph give the expectations for the
Kaplan-Meier band, the log-rank test and the hazard ratio, and all of them agree.

The reference run is itself the strongest statement about the digitizing: fed our colour-pick
points, IPDfromKM recovers 77 events and 43 censored for Control against a truth of 77 and 43,
and 51 and 69 for Treatment against 52 and 68.

Two defects found by the comparison: patients still at risk after the last digitized point were
not being censored there, and the median confidence limits were the wrong way round.

Decisions recorded in the approved plan: own repo, full IPDfromKM parity, optional risk table with
a low-confidence label, auto-detected plot box with four draggable handles.
