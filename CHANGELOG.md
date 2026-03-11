# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added
- PocketBase collections and import tooling for the 2023 FIPI grammar bank: `oge_grammar_variants` and `oge_grammar_tasks`.
- Individual `Grammar Boost` generation for each student with `DOCX` handouts and a shared teacher answer-key document.
- PocketBase collection `student_grammar_boosts` for assigned boost variants, weak topics, answer keys, and future result masks.
- Text-based grammar boost result importer that accepts lines like `Безбородкин Дмитрий 11100100` and updates `answerMask` plus `correctCount`.
- Source files for the 2023 grammar bank under `oge files/23 gram/`.

### Changed
- Student report boost planning now has backing database records for all current students, each with an 8-task individual grammar variant.
- Project documentation/assets are synchronized with the new grammar-bank-driven remediation workflow.

## [1.0.1c] - 2026-03-11

### Changed
- Recommendation block now ignores empty task cells when reanalyzing solved variants, so missing data is no longer treated as an error.
- Variant-based recommendations are now prioritized over generic section advice and ranked by repeated deficit severity across all solved workbook tests.
- Standalone exported HTML was strengthened for tablet and mobile layouts, including better sticky navigation wrapping, one-column insights, and safer long-text overflow handling.
- Mobile dashboard insight cards received stronger responsive rules so strengths, growth areas, trend, and recommendation blocks stay visible and readable on narrow screens.

## [1.0.1b] - 2026-03-11

### Added
- PocketBase collections and importer for OGE variant materials from the attached workbook PDF: `oge_variants` and `oge_variant_answers`.
- Project folders for long-term source assets:
  - `md/` for reporting instructions
  - `oge files/` for books, collections, and supporting OGE materials
- Variant-aware analysis rule in the project instruction: any sheet named `N TEST ...` maps to variant `N` from the workbook.

### Changed
- Reanalyzed all already solved workbook variants, not only `8 TEST`: current sheets `1 TEST` through `7 TEST` now participate in report insights.
- Report analysis now uses task-level workbook mapping for reading, grammar, and word formation, so recommendations reference concrete weak tasks from matching variants.
- Future workbook imports now automatically apply the same `N TEST -> variant N` rule and rerun variant-based analysis.

### Fixed
- Corrected Excel section slicing for task blocks:
  - grammar now uses tasks `20-28`
  - word formation now uses tasks `29-34`
- Synchronized PocketBase import and generated frontend data so both use the same updated variant-analysis logic.

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
