# DrillCanvas

DrillCanvas is an open-source web application for designing, editing, and animating marching band drill.

It is built as an editor-first tool for creating performer formations, managing drill sets, previewing transitions, and working with marching-specific field coordinates.

## Features

- Performer placement with marching-step snapping
- Performer labels, names, and section metadata
- Multi-select and box selection
- Group movement
- Formation editing tools
- Drill sets with editable transition counts
- Set-to-set and full-production playback
- Adjustable BPM playback timing
- Field zoom with contained scrolling
- Scrollable set timeline for large productions
- Undo and redo
- Local autosave
- Explicit save-state tracking
- JSON project export and import
- Schema-versioned project files
- Browser-local project storage with no backend required
- MuseScore (.mscx / .mscz) music import with synchronized production playback
- Basic in-browser music synthesis for imported scores

## Saving Projects

DrillCanvas automatically saves the current project to the browser's local storage for recovery.

The **Save** button marks the current project state as the explicit saved baseline. After additional edits, DrillCanvas indicates that the project contains unsaved changes.

Use:

- **Save** to mark the current state as saved
- **New** to start a new production
- **Export** to download a human-readable DrillCanvas JSON project file
- **Import** to open a previously exported DrillCanvas project

Exported project files can be moved between browsers or devices.

DrillCanvas currently runs entirely in the browser. Project data is not sent to a backend.

## Music Import

Use **Import Music** to load a MuseScore `.mscx` or `.mscz` file. `.mscz` archives are decompressed in the browser; no file is uploaded anywhere.

DrillCanvas parses the score's title, tempo map, time signatures, measures, notes, rests, and note durations (including ties) into a normalized music model. That normalized model — not the original MuseScore file — is what gets saved and exported with the project, so a production can be reopened and played on another browser/device without the original MuseScore file.

Once a score is loaded:

- Production playback (Play from start / Pause / Resume / Restart / Stop / scrubbing) drives both drill animation and a first-pass Web Audio synthesizer from one shared clock, so they stay in sync.
- Tempo and elapsed time are derived from the score's tempo map (including tempo changes) instead of the manual BPM control.
- The music panel shows the score title, current measure/beat, and current tempo.

Use **Remove Music** to detach the score and return to manual BPM playback.

## Tech Stack

- React
- TypeScript
- Vite
- SVG
- Web Audio API
- fflate (MuseScore `.mscz` decompression)
- Vitest
- Testing Library

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Preview a production build locally:

```sh
npm run preview
```

Run the test suite:

```sh
npm test
```

## Project Status

DrillCanvas is under active development.

Current development is focused on expanding drill-writing tools, performer movement paths, playback capabilities, and production workflow features.