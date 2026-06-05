# Content Quality Audit

Date: 2026-06-05

## Summary

The published archive data is structurally healthy: 140 figures load, all figure IDs are unique, every published figure resolves to a work, every published thumbnail/view path exists, and every figure has OCR text available either in `ocr.json` or the figure record.

The main content risks are editorial completeness and asset hygiene:

- Figure descriptions are almost entirely absent from the data used by the app.
- Themes are empty for every published figure.
- Figure dimensions are absent for every published figure.
- One work record has no published figures.
- There are unreferenced WebP assets that look like page-level or pre-split images.

## Findings

### P1: Decide What To Publish

- `w0012` / `Volume IV. Transformation` exists in `works.json` with 0 figures. This makes the publication count/data model look incomplete. Decide whether to hide works with no figures, add its figures, or mark it as intentionally pending.
- There are 17 unreferenced view assets and 17 unreferenced thumbnail assets. Many correspond to page-level IDs that have figure-level descendants, for example:
  - `w0009-p0093-f00` has published `w0009-p0093-f01` and `w0009-p0093-f02`.
  - `w0011-p0010-f00` has published `w0011-p0010-f01` and `w0011-p0010-f02`.
  - `w0011-p0048-f00` has published `w0011-p0048-f01` and `w0011-p0048-f02`.
- One OCR extra, `w0007-p0068-f99`, has matching orphan assets while the published figure is `w0007-p0068-f00`. Decide whether this is an ID mismatch or a deliberately excluded alternate crop.

### P1: Fill Description Coverage

- `public/data/descriptions.json` has 6 descriptions for 140 published figures.
- Every figure has `aiDescription: null` in `figures.json`, so the app currently has no populated AI description blocks despite the UI supporting them.
- Existing descriptions include prompt boilerplate such as "Here is a concise description..." and should be normalized before being displayed.

Recommended approach:

- Treat descriptions as accessibility/editorial metadata, not raw AI output.
- Regenerate or revise descriptions for all published figures with a consistent schema and tone.
- Update the data build so generated descriptions become `aiDescription` in `figures.json` or the app explicitly joins `descriptions.json`.

### P2: Add Searchable Themes

- All 140 figures have `themes: []`.
- Search already indexes `themes`, and the lightbox can render them, so this is latent functionality with no content.

Recommended first theme vocabulary:

- labor/work
- gender
- health
- education
- government/civics
- leisure
- industry
- agriculture/food
- international trade
- energy
- urban planning

Keep themes broad and editorially useful; do not duplicate chart types or features.

### P2: Add Image Dimensions

- All 140 figures are missing `width` and `height` in `figures.json`.
- The app currently lays out images with CSS heights, so this is not breaking rendering.
- Dimensions would still help future layout stability, aspect-ratio placeholders, and auditability.

Recommended approach:

- Add a small build step that reads each referenced WebP and records intrinsic dimensions.
- Prefer deriving this during `scripts/build_data.py` or a companion script rather than hand-entering dimensions.

## Current Coverage Snapshot

- Works: 12
- Published figures: 140
- OCR keys: 141
- Description keys: 6
- View WebP files: 157
- Thumbnail WebP files: 157
- Figures with titles: 140 / 140
- Figures with OCR coverage: 140 / 140
- Figures with original captions: 17 / 140
- Figures with AI descriptions in `figures.json`: 0 / 140
- Figures with themes: 0 / 140
- Figures with dimensions: 0 / 140

## Recommended Next Work

1. Resolve publication/asset scope:
   - Decide the status of `w0012`.
   - Classify orphan assets as `keep as source/intermediate`, `publish as figures`, or `delete`.
   - Resolve `w0007-p0068-f99` vs `w0007-p0068-f00`.

2. Normalize description pipeline:
   - Decide whether `descriptions.json` is source data or generated output.
   - Remove boilerplate from the 6 existing descriptions.
   - Generate/review descriptions for all published figures.
   - Wire descriptions into `figures.json` or into the app data join.

3. Add lightweight content tests after editorial decisions:
   - Fail on unreviewed orphan assets.
   - Fail on unreviewed works with no figures.
   - Track description/theme coverage thresholds without requiring immediate 100% coverage.

4. Add dimensions:
   - Derive dimensions automatically from WebP files.
   - Use dimensions later for aspect-ratio placeholders if image layout becomes a performance issue.
