# kmHelper

kmHelper turns a published Kaplan-Meier figure back into individual patient data, which is what a
survival meta-analysis needs and what papers almost never publish. It is a free web application,
live at [vanioantunes.com/tools/kmHelper](https://vanioantunes.com/tools/kmHelper/).

It does the same job as the
[IPDfromKM Shiny app](https://biostatistics.mdanderson.org/shinyapps/IPDfromKM/), and it uses the
same reconstruction, but it digitizes the curve differently.

## The difference: no clicking along the curve

The usual way to read a curve is to click along it forty or fifty times. That is slow, it is the
largest source of error in the whole pipeline, and two people never produce the same points.

Here each arm is named once by its colour. Every pixel within a perceptual distance of that colour
is found, and the curve is followed column by column: a horizontal stroke is the current survival
level, a tall run whose neighbours sit at two levels is an event, and a small mark that reaches
above the line is censoring. The same figure and the same colour always give the same numbers.

The only clicks are one on each arm's line, and a drag of a plot-box handle when the frame was not
detected correctly.

## What it produces

Reconstructed patients, their Kaplan-Meier curve with a log-log confidence band, median survival
with its interval, survival at times you choose, the hazard ratio between two arms, the log-rank
test, and how closely the reconstruction reproduces the curve it came from. Everything downloads
as CSV, with an R script that redoes the analysis so the numbers can be checked outside the
browser.

Nothing is uploaded. The application makes no network requests at all; the figure never leaves the
browser.

## How the numbers are checked

The statistics are not verified by hand. They are verified against R.

- **The reconstruction** is a port of `IPDfromKM::getIPD()`. `scripts/compare-ipdfromkm.R` runs the
  reference package on the very curve kmHelper digitized, and the test suite asserts that the port
  reproduces it patient for patient, every event and every censoring at the same time.
- **The Kaplan-Meier estimate, its band and the median interval** are checked against
  `survfit(..., conf.type = "log-log")`.
- **The log-rank test and the hazard ratio** are checked against `survdiff()` and `coxph()`, the
  latter with Efron ties, which is what `coxph` does by default and which matters here because
  reconstructed data is full of ties.
- **The digitizing** is checked against known truth. `scripts/make-fixture.mjs` draws a two-arm
  figure from patient data it generates, so the curve printed in the figure is known exactly.
  Reading that figure back recovers survival to within one percentage point at every checked time,
  with a root mean squared error under 0.005. Put through IPDfromKM, those same read-back points
  recover 77 events and 43 censored for one arm against a truth of 77 and 43.

## When it will not work

- Figures printed in grey, where arms differ by dash pattern rather than colour. A colour pick
  cannot separate them.
- Log or otherwise non-linear axes. Only linear axes are read.
- Two arms in colours within about 10 CIEDE2000 units of each other. The tool warns rather than
  guessing.
- Heavy JPEG artefacts around thin lines. A PNG screenshot traces much more cleanly.

Censoring marks are found, but the count is a floor: marks sharing a pixel column, or sitting on a
step, cannot be separated. The reconstruction does not use them.

## Method and credit

- Guyot P, Ades AE, Ouwens MJNM, Welton NJ. Enhanced secondary analysis of survival data:
  reconstructing the data from published Kaplan-Meier survival curves. *BMC Med Res Methodol*
  2012;12:9.
- Liu N, Zhou Y, Lee JJ. IPDfromKM: reconstruct individual patient data from published
  Kaplan-Meier survival curves. *BMC Med Res Methodol* 2021;21:111.

## Development

```bash
npm install
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # http://localhost:5182 (fixed port)
```

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint, including the rule that `src/core` has no UI, storage or browser globals |
| `npm test` | Vitest: colour, plot detection, calibration, tracing, reconstruction, statistics, export |
| `npm run test:e2e` | Playwright at 1536 and 390 px, with axe on every section |
| `npm run fixtures` | Redraw the test figure from its generated patient data |
| `npm run build` | Production build into `dist/` |

Regenerating the expectations that the statistics are tested against needs R with `IPDfromKM`
and `survival` installed:

```bash
npx vite-node scripts/digitize-fixture.ts
Rscript scripts/compare-ipdfromkm.R
```

`src/core` holds the whole algorithm and is pure: no React, no DOM, no network, no storage. That
is what lets every step be tested in plain Node, and it is enforced by a lint rule.
