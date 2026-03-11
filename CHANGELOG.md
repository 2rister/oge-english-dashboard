# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [1.0.1] - 2026-03-11

### Changed
- Source refresh now uses the newest `xlsx` file in the project root.
- `npm run refresh:reports` reimports PocketBase data and regenerates reports from the latest root Excel file.
- `npm start` now launches only PocketBase and Vite.
- Running stack now also watches the project root and auto-refreshes when a newer `xlsx` appears.

### Removed
- Browser-based Excel upload UI from the React interface.
- Local upload API and its startup wiring.

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
