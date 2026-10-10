# kmHelper, product notes

## Who it is for

Researchers doing survival meta-analysis who have a published figure and no patient data. They are
comfortable with R and with survival methods; they are not looking for a black box, and they will
not use numbers they cannot check.

## What it must get right

1. **Reproducibility.** The same figure and the same colour must always give the same numbers.
   This is the whole reason the tool exists, and it is why digitizing is done by colour rather
   than by clicking.
2. **Checkability.** Every number must be reproducible in R from what the tool exports. The R
   script is not a convenience, it is the argument for trusting the output.
3. **Honesty about weakness.** A reconstruction without numbers at risk is labelled weak wherever
   it appears, including inside the exported CSV. A censoring-mark count that is a floor is called
   a floor. A fit that departs from the curve says so.

## What it deliberately does not do

- Grey figures separated by line style. Out of scope rather than guessed at.
- Non-linear axes.
- Any network request. The figure is the researcher's unpublished working material; it stays in
  the browser.

## Design

Warm Editorial, the same system as vanioantunes.com, shared with ssHelper down to the stylesheet.
Progressive sections: each one is usable before the next is reached, and the tool is worth opening
just to digitize a curve even if the reconstruction is never run.

WCAG 2.2 AA throughout: the plot-box handles are keyboard operable, the scrollable figure panes
take focus and carry names, and axe runs over every section at both desktop and phone width.
