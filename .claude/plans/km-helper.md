# kmHelper — KM curve to IPD
Progress: 11/34 (32%)
Started: 2026-10-10 08:40 BRT   Updated: 2026-10-10 08:52 BRT

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
- [ ] 12. scripts/make-fixture.mjs synthetic KM figure PNGs from known IPD
- [ ] 13. ui: SiteBar, SectionNav, useActiveSection, useMediaQuery, app.css adapted from ssHelper
- [ ] 14. ui: i18n/en.ts copy for every section
- [ ] 15. ui: ImagePanel (drop, file, Ctrl+V paste, zoom, pan)
- [ ] 16. ui: AxesPanel (auto box, four draggable handles, axis values, y unit)
- [ ] 17. ui: ArmsPanel (eyedropper, hex field, tolerance slider, mask overlay, loupe, dE warning)
- [ ] 18. ui: ExtractPanel (extract, overlay, point table, tick count, sliders)
- [ ] 19. App wiring + storage/localStore for the draft
- [ ] 20. phase 1 gate: typecheck, lint, test; screenshots at 1536 and 390; commit and push

### Phase 2 — reconstruct
- [ ] 21. core/preprocess.ts risk-table reconciliation
- [ ] 22. core/guyot.ts Guyot 2012 iterative reconstruction
- [ ] 23. tests/core/guyot.test.ts against Guyot 2012 worked example and an IPDfromKM fixture
- [ ] 24. core/km.ts KM, Greenwood, log-log band, median with Brookmeyer-Crowley CI, S(t)
- [ ] 25. tests/core/km.test.ts against a hand-computed dataset
- [ ] 26. core/fit.ts RMSE and max deviation
- [ ] 27. core/export.ts IPD CSV, points CSV, R snippet
- [ ] 28. ui: RiskPanel, IpdPanel, ExportPanel
- [ ] 29. phase 2 gate: typecheck, lint, test; commit and push

### Phase 3 — compare and ship
- [ ] 30. core/compare.ts log-rank and Cox HR by Newton-Raphson
- [ ] 31. tests/core/compare.test.ts against a known coxph fit
- [ ] 32. ui: ComparePanel SVG overlay plot, HistoryTable
- [ ] 33. tests/e2e: full walk fixture -> CSV, axe on every section
- [ ] 34. ship: GitHub repo, Vercel project, vanioAntunes vercel.json + tools card + subnav + docs

## Notes
Decisions recorded in the approved plan: own repo, full IPDfromKM parity, optional risk table with
a low-confidence label, auto-detected plot box with four draggable handles.
