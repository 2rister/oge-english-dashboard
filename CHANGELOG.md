# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [1.0.1] - 2026-03-11

### Added
- Server-side `HTML/PDF` export API with standalone report templates.
- `Save as` export flow in the dashboard UI.
- Root `xlsx` watcher with persisted state to avoid redundant full refreshes after restart.
- `tables/.gitkeep` to preserve the upload/watch folder structure in the repository.

### Changed
- Source refresh now uses the newest `xlsx` file in the project root.
- `npm run refresh:reports` reimports PocketBase data and regenerates reports from the latest root Excel file.
- Running stack now launches PocketBase, Vite, export API, and the root `xlsx` watcher.
- Frontend report loading now paginates PocketBase collections instead of relying on fixed record limits.
- Test ordering in the UI is now derived from imported PocketBase results, so new Excel tests appear automatically.
- Exported HTML now includes a functional sticky navigation bar with anchor links and scroll-hide behavior.
- Export filenames now append save timestamp in `dd-mm_hh-mm` format.
- Local start/stop scripts are aware of the `launchd` agent to reduce conflicts with background autostart.

### Removed
- Browser-based Excel upload UI from the React interface.
- Local upload API and its startup wiring.

### Fixed
- Mobile report cards were no longer hidden behind a desktop-only wrapper.
- PocketBase import cleanup now deletes full collections instead of leaving records beyond the first page.
- Export and watcher services no longer depend on environment-provided `fetch`, which was breaking under `launchd`.
- Export now reads from the same PocketBase-backed dataset as the dashboard, avoiding mismatches with stale JSON snapshots.
- Safari `Save as` flow now uses a form/iframe fallback to avoid duplicate downloads and blocked attachments.

## [1.0.0] - 2026-03-11

### Added
- React + Vite dashboard for OGE English reports with grouped student navigation, charts, tables, and recommendation blocks.
- PocketBase integration with local migrations for `student_summaries` and `student_results`.
- Excel import pipeline for loading normalized results into PocketBase.
- Unified local start/stop scripts for PocketBase and Vite.
- Automatic local report-data generation for fallback/static report workflows.

### Changed
- Frontend switched to PocketBase as the primary runtime data source.
- Top quick-links navigation now auto-hides on downward scroll and reappears on a short upward swipe.
- Project PocketBase was isolated to port `8091` to avoid conflicts with other local instances.

### Removed
- Students excluded from future imports and UI output:
  - `Дугинец`
  - `Выступец Дарья`

### Fixed
- Writing-section parsing from Excel now uses the correct aggregated source column.
- Import/auth flow updated for current PocketBase superuser API.
- Start script now stops conflicting local dev services on `8091` and `5173` before launching.
