# Isotype Explorer Audit Baseline

Date: 2026-06-05

## Summary

This baseline focuses on the two highest-risk areas for continued development:

- Interaction regressions: search, filters, URL state, view switching, modals, and lightbox navigation.
- Content rendering regressions: missing data, missing metadata labels, broken thumbnail/full-size image paths, and blank image renders.

The site is a static React/Vite app deployed through GitHub Pages. The current data set is small enough to validate all figure records and referenced assets on every local or CI run.

## Current Findings

### P0: Fix before feature work

- No current P0 issues found by the baseline data/unit test pass.

### P1: Fix soon

- Playwright browser coverage is intentionally smoke-level. It verifies major interaction paths and image loading, but it does not yet enforce visual diff baselines.

### P2: Improve later

- `src/App.tsx` owns data loading, URL state, search/filter composition, responsive filter behavior, about modal state, and lightbox selection. This is workable today, but future feature work may benefit from extracting pure query/filter helpers so more behavior can be unit-tested without browser setup.
- `src/lib/filters.ts` and `src/App.tsx` contain overlapping filter logic. The current tests cover both the exported helper and browser behavior, but shared logic would reduce drift risk.
- OCR has one reviewed extra key, `w0007-p0068-f99`, that does not currently map to a published figure record. The data integrity test keeps this explicit.

## Follow-Up Fixes Completed

- Dependency advisories were cleared by updating `react-router-dom` within v6 and upgrading Vite/plugin-react to their current compatible releases.
- CI now uses Node 22, and `package.json` records the Node engine range required by Vite 8.
- About and lightbox dialogs now have accessible labels, move focus to their close controls on open, trap Tab within the active dialog, restore previous focus on close, and lock background page scrolling while open.

## Guardrails Added

- Data integrity tests validate unique figure IDs, work references, type/feature/color references, public image assets, displayable card/lightbox content, and reviewed OCR extras.
- Unit tests cover search, advanced query parsing, advanced filter matching, regular filter matching, and sorting.
- Playwright smoke tests cover:
  - Home page load, count text, gallery text, visible image dimensions, and page/console/network failures.
  - Search URL state and visible results.
  - Type/color filters and clear behavior.
  - Publications view rows and thumbnail opening.
  - Direct lightbox links, full-size image rendering, arrow navigation, Escape close.
  - About/Terms modal content and image rendering.
  - Mobile filters drawer and mobile lightbox previous/next controls.
- CI now runs build, unit tests, and Playwright smoke tests on pushes and pull requests. GitHub Pages deploys from `main` only after checks pass.

## Metadata Fixes Made During Baseline

The data integrity pass exposed lookup gaps where figures referenced values missing from config JSON. These labels were added so records resolve cleanly instead of relying on fallback IDs:

- Color: `process`
- Chart type: `volume`
- Features: `abstract`, `building`, `cross-section`, `cube`, `elevation`, `flow`, `isarithmic`, `org`, `rectangle`, `semi-circle`, `square`, `temperature`, `timeline-snake`, `triangle`

## Test-Run Strategy

During normal coding:

- Run `npm run test:watch` while editing search, filter, sort, data parsing, or query behavior.
- Run a targeted Vitest file first when touching a narrow area.

After changing data or images:

- Run `npm run test` at minimum.
- Run `npm run test:e2e` if image paths, image dimensions, gallery layout, or lightbox behavior changed.

After changing UI interaction:

- Run `npm run test:e2e` locally before considering the change done.
- Review Playwright screenshots/traces on failures or when intentionally changing layout.

Before pushing or opening a PR:

- Run `npm run check`.
- CI runs the same build/unit/browser checks.

Before publishing from `main`:

- Require passing CI.
- If deployment, asset paths, routing, or GitHub Pages config changed, manually verify the preview or deployed URL and a direct hash-route lightbox link such as `/#/?id=w0001-p0038-f99`.
