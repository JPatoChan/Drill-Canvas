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

## Tech Stack

- React
- TypeScript
- Vite
- SVG
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