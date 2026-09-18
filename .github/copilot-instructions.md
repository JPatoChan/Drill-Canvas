# DrillCanvas Copilot Instructions

- Use React, TypeScript, Vite, and SVG for the client-side editor experience.
- Keep the application frontend-only unless a task explicitly requires a backend service.
- Favor small, focused, reusable components with clear responsibilities.
- Maintain strict TypeScript settings and avoid any unless there is a documented reason.
- Add or update Vitest coverage for behavior changes.
- Preserve the editor-first visual language: compact controls, clear hierarchy, minimal visual clutter, and a responsive workspace layout.
- Prefer native browser and React capabilities over additional dependencies.
- Add dependencies only when they solve a concrete requirement that would be unreasonable to implement with the existing stack.
- Keep domain logic separate from presentation logic where practical, especially for coordinates, formations, drill sets, movement, and animation.
- Do not introduce authentication, databases, server APIs, collaboration features, or other major scope expansions unless explicitly requested.
- Do not redesign unrelated parts of the application while completing a focused task.
- Preserve existing behavior unless the task specifically requests a change.
- Run tests and the production build before considering a task complete.
- Keep README documentation current when setup, architecture, or user-facing functionality changes.