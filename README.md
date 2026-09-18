# DrillCanvas

DrillCanvas is an open-source web application for designing, visualizing, and animating marching band drill.

The editor supports performer placement and metadata, formations, drill sets, transition and full-production playback, zoom, box selection, and undo/redo.

Projects autosave to the current browser's local storage. Use **Save** to mark the current project as an explicit baseline, **New** to start over, and **Export**/**Import** to move human-readable schema-versioned JSON project files between browsers or devices. No project data is sent to a backend.

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