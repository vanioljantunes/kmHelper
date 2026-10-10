# Put the curve kmHelper digitized through IPDfromKM, and write what the R package makes of it.
# The TypeScript port is then asserted against this file, so the two cannot drift apart.
#
#   npx vite-node scripts/digitize-fixture.ts
#   Rscript scripts/compare-ipdfromkm.R
#
# Writes tests/fixtures/ipdfromkm-expected.json.

suppressMessages(library(IPDfromKM))
suppressMessages(library(jsonlite))
suppressMessages(library(survival))

# Run from the repository root.
fixtures <- file.path("tests", "fixtures")
if (!dir.exists(fixtures)) stop("Run this from the kmHelper repository root.")

input <- fromJSON(file.path(fixtures, "digitized.json"), simplifyVector = TRUE)

out <- list()
ipds <- list()
for (i in seq_len(nrow(input$arms))) {
  arm <- input$arms[i, ]
  points <- input$arms$points[[i]]
  risk <- input$arms$risk[[i]]

  prep <- preprocess(
    dat = data.frame(time = points$t, surv = points$s),
    trisk = risk$time,
    nrisk = risk$atRisk,
    maxy = 1
  )
  ipd <- getIPD(prep = prep, armID = i, tot.events = NULL)
  d <- ipd$IPD
  fit <- survfit(Surv(time, status) ~ 1, data = d)
  med <- unname(summary(fit)$table["median"])

  out[[length(out) + 1]] <- list(
    name = arm$name,
    preparedPoints = nrow(prep$preprocessdat),
    intervals = nrow(prep$intervalIndex),
    lower = prep$intervalIndex$lower,
    upper = prep$intervalIndex$upper,
    nRisk = prep$intervalIndex$n.risk,
    patients = nrow(d),
    events = sum(d$status == 1),
    censored = sum(d$status == 0),
    median = if (is.na(med)) NULL else med,
    eventTimes = round(d$time[d$status == 1], 6),
    censorTimes = round(d$time[d$status == 0], 6)
  )
  ipds[[i]] <- d
}

# Kaplan-Meier with a log-log band, and the median interval, for each reconstructed arm.
kmout <- list()
for (i in seq_along(ipds)) {
  d <- ipds[[i]]
  fit <- survfit(Surv(time, status) ~ 1, data = d, conf.type = "log-log")
  tab <- summary(fit)$table
  kmout[[i]] <- list(
    time = round(fit$time, 6),
    nrisk = fit$n.risk,
    nevent = fit$n.event,
    ncensor = fit$n.censor,
    surv = round(fit$surv, 10),
    lower = round(ifelse(is.na(fit$lower), fit$surv, fit$lower), 10),
    upper = round(ifelse(is.na(fit$upper), fit$surv, fit$upper), 10),
    median = if (is.na(unname(tab["median"]))) NULL else unname(tab["median"]),
    medianLower = if (is.na(unname(tab["0.95LCL"]))) NULL else unname(tab["0.95LCL"]),
    medianUpper = if (is.na(unname(tab["0.95UCL"]))) NULL else unname(tab["0.95UCL"])
  )
}

# The two arms against each other: log-rank and a Cox model with Efron ties (coxph defaults).
both <- rbind(
  data.frame(time = ipds[[1]]$time, status = ipds[[1]]$status, arm = 0),
  data.frame(time = ipds[[2]]$time, status = ipds[[2]]$status, arm = 1)
)
sd <- survdiff(Surv(time, status) ~ arm, data = both)
cx <- coxph(Surv(time, status) ~ arm, data = both)
cs <- summary(cx)
comparison <- list(
  logrankChisq = round(unname(sd$chisq), 8),
  logrankObserved = unname(sd$obs),
  logrankExpected = round(unname(sd$exp), 8),
  beta = round(unname(coef(cx)), 10),
  se = round(unname(sqrt(diag(vcov(cx)))), 10),
  hr = round(unname(cs$conf.int[1, 1]), 10),
  hrLower = round(unname(cs$conf.int[1, 3]), 10),
  hrUpper = round(unname(cs$conf.int[1, 4]), 10)
)

write(toJSON(list(km = kmout, comparison = comparison), auto_unbox = TRUE, digits = 10, null = "null"),
      file.path(fixtures, "survival-expected.json"))
cat(sprintf("log-rank chisq=%.4f  HR=%.4f (%.4f to %.4f)
",
            comparison$logrankChisq, comparison$hr, comparison$hrLower, comparison$hrUpper))

write(toJSON(out, auto_unbox = TRUE, digits = 8, null = "null"),
      file.path(fixtures, "ipdfromkm-expected.json"))

for (row in out) {
  cat(sprintf(
    "%s: prepared=%d intervals=%d patients=%d events=%d censored=%d median=%s\n",
    row$name, row$preparedPoints, row$intervals, row$patients, row$events, row$censored,
    if (is.null(row$median)) "not reached" else format(row$median)
  ))
}
