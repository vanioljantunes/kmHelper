/** Every string the interface shows, in one place. */
export const en = {
  // The site bar, shared with vanioantunes.com.
  siteBarHome: 'Vanio Antunes',
  siteBarLabel: 'Site',
  siteBarProfiles: 'Profiles',
  siteBarProfileLink: '{network} (opens in a new tab)',
  siteBarAbout: 'Who am I',
  siteBarTools: 'Tools',
  siteBarPackages: 'R packages',
  siteBarImaging: 'Imaging projects',
  networkScholar: 'Google Scholar',
  networkLinkedin: 'LinkedIn',
  networkX: 'X',
  toolsNavLabel: 'Tools',
  toolsNavAll: 'All tools',
  toolsNavKmHelper: 'kmHelper',
  toolsNavSsHelper: 'ssHelper',
  toolsNavTriageHelper: 'triageHelper',
  toolsNavDiagnostic: 'Diagnostic calculator',
  toolsNavCombine: 'Combine means and SDs',
  toolsNavMedian: 'Median to mean',
  toolsNavBeta: 'beta',

  // The hero and the section navigation.
  appName: 'kmHelper',
  appTagline: 'Individual patient data from a published Kaplan-Meier figure',
  sectionNavLabel: 'Sections',
  sectionNavAbout: 'About',

  aboutHeading: 'What this does',
  aboutLead:
    'Paste a screenshot of a Kaplan-Meier figure, name each arm by its colour, and read back the survival curve as numbers. With the numbers at risk from under the figure, the curve is turned into individual patient data by the method of Guyot and colleagues, which is what a survival meta-analysis needs.',
  aboutNoClickHeading: 'No clicking along the curve',
  aboutNoClick:
    'The usual way to digitize a curve is to click on it forty or fifty times. That is slow, and two people never produce the same points. Here the arm is named once by its colour and every matching pixel is read, so the same figure and the same colour always give the same numbers.',
  aboutLimitsHeading: 'When it will not work',
  aboutLimitGrey:
    'Figures printed in grey, where the arms differ by dashes rather than by colour. A colour pick cannot separate them.',
  aboutLimitScale: 'Log or otherwise non-linear axes. Only linear axes are read.',
  aboutLimitClose:
    'Two arms in colours close enough to be confused. The tool says so instead of guessing.',
  aboutLimitJpeg:
    'Heavy JPEG artefacts around thin lines. A PNG screenshot traces much more cleanly.',
  aboutPrivacyHeading: 'Where the image goes',
  aboutPrivacy:
    'Nowhere. Everything runs in this browser; the figure is never uploaded and the tool makes no network requests at all.',
  aboutCitationsHeading: 'Method and credit',
  aboutCitationGuyot:
    'Guyot P, Ades AE, Ouwens MJNM, Welton NJ. Enhanced secondary analysis of survival data: reconstructing the data from published Kaplan-Meier survival curves. BMC Med Res Methodol 2012;12:9.',
  aboutCitationLiu:
    'Liu N, Zhou Y, Lee JJ. IPDfromKM: reconstruct individual patient data from published Kaplan-Meier survival curves. BMC Med Res Methodol 2021;21:111.',
  aboutCredit:
    'The reconstruction follows the same method as the IPDfromKM R package and Shiny app; the digitizing step is different, and results from both should agree.',

  imageHeading: 'The figure',
  imageDrop: 'Drop a screenshot here, paste one with Ctrl+V, or',
  imagePick: 'choose a file',
  imageFileLabel: 'Choose a figure file',
  figureScrollImage: 'The figure, scrollable',
  figureScrollAxes: 'The figure with the plot area marked, scrollable',
  figureScrollArms: 'The figure with matching pixels marked, scrollable',
  figureScrollExtract: 'The figure with the traced curves drawn over it, scrollable',
  imageHint: 'PNG traces best. A screenshot of the figure alone works better than a whole page.',
  imageLoaded: '{width} by {height} pixels.',
  imageReplace: 'Use another figure',
  imageZoomIn: 'Zoom in',
  imageZoomOut: 'Zoom out',
  imageZoomReset: 'Fit',
  imageZoomLevel: 'Zoom {percent}%',
  imageError: 'That file could not be read as an image.',
  imagePasteHint: 'Paste a screenshot with Ctrl+V anywhere on this page.',

  axesHeading: 'The axes',
  axesLead:
    'The plot frame was found for you. Check the four handles, drag any that sit in the wrong place, and type the axis values as the figure prints them.',
  axesLeadUnsure:
    'The plot frame could not be found in this image, so the handles are only a guess. Drag all four onto the axes before going on.',
  axesCropHint:
    'Drag the handles inward to leave out anything drawn inside the plot that should not be traced, such as a legend.',
  axesHandleLabel: '{edge} edge of the plot area, at {value} pixels',
  axesEdgeLeft: 'Left',
  axesEdgeRight: 'Right',
  axesEdgeTop: 'Top',
  axesEdgeBottom: 'Bottom',
  axesHandleHelp: 'Arrow keys move the handle one pixel, shift and arrow ten.',
  axesTimeFirst: 'Time at the left edge',
  axesTimeLast: 'Time at the right edge',
  axesSurvivalBottom: 'Survival at the bottom',
  axesSurvivalTop: 'Survival at the top',
  axesUnit: 'The y axis is printed as',
  axesUnitProbability: '0 to 1',
  axesUnitPercent: '0 to 100 percent',
  axesReset: 'Detect the frame again',

  armsHeading: 'The arms',
  armsLead:
    'One arm per curve. Press Pick, then click the arm anywhere on its line; the colour under the cursor names it.',
  armsAdd: 'Add an arm',
  armsRemove: 'Remove {name}',
  armsName: 'Name',
  armsNameDefault: 'Arm {number}',
  armsPick: 'Pick the colour',
  armsPicking: 'Click the line on the figure',
  armsPickCancel: 'Cancel',
  armsColour: 'Colour',
  armsTolerance: 'Tolerance',
  armsToleranceHelp:
    'How different from the picked colour a pixel may be and still count. Raise it if the line comes out broken, lower it if another arm bleeds in.',
  armsMatched: '{count} pixels match.',
  armsMatchedNone: 'No pixel matches this colour inside the plot area.',
  armsShowMask: 'Show what matches',
  armsCloseWarning:
    '{first} and {second} are close enough in colour to be confused. Pick a point further along each line, or raise the tolerance on neither.',
  armsNoneYet: 'Add an arm to begin.',

  extractHeading: 'The points',
  extractLead:
    'Every column of the plot is read in the arm colour, horizontal strokes are taken as the survival level, vertical risers as events, and short marks printed through the line as censoring.',
  extractRun: 'Read the curves',
  extractRerun: 'Read them again',
  extractPoints: '{count} points',
  extractStroke: 'line {width} px thick',
  extractTicks: '{count} censoring marks found',
  extractTicksHint:
    'Marks that share a pixel column with another, or that sit on a step, are not separable from it. Treat the count as a floor, not as the number of censored patients.',
  extractTicksNone: 'no censoring marks found',
  extractBridged: '{count} columns of the line were broken and were bridged',
  extractEndedEarly:
    'The line could not be followed past {time}; the curve stops there. Raise the tolerance or check that nothing covers the line.',
  extractEmpty: 'Nothing was traced for {name}. Check its colour and tolerance.',
  extractMaxGap: 'Bridge breaks up to',
  extractMaxGapUnit: 'px',
  extractShowOverlay: 'Show the traced curve on the figure',
  extractTableTime: 'Time',
  extractTableSurvival: 'Survival',
  extractTableCaption: 'The first and last ten points of {name}.',
  extractTableMore: '{count} more points between.',
  extractSanity:
    'Read the overlay, not the table: if the drawn curve sits on the printed one, the numbers are right.',
} as const;

/** Fill {name} placeholders. */
export function t(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
