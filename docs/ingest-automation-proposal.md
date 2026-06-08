# Ingest Automation Proposal

This proposal captures a future improvement for adding a new work-full of images to the site. The current process works, but it has many manual handoffs: original photography, Camera Raw edits, Bridge export, figure cropping, spread stitching, metadata entry, WEBP generation, OCR, descriptions, tests, and visual QA.

The goal is not to automate away visual/editorial judgment. The goal is to automate the handoff and validation layer so a new work can move from local source folders to tested site data with fewer repetitive steps.

## Keep Human-Guided

- Photography quality decisions.
- Camera Raw exposure, white balance, and Calibrite profile choices.
- Figure identification.
- Cropping judgment.
- Photoshop stitching for `f99` spread-gutter figures.
- Metadata correctness.
- Final approval of OCR and image descriptions.

## Automate

- Create the standard work folder structure.
- Validate filenames in `03-charts-png/`.
- Generate `04-webp/thumbs/` and `04-webp/views/`.
- Tone-check or tone-match a new work against reference works.
- Copy WEBPs into `public/webp/`.
- Validate CSV data against generated assets.
- Run `scripts/build_data.py`.
- Run OCR for new/missing figures.
- Run OpenAI image descriptions for new/missing figures.
- Run tests and build checks.
- Produce a human-readable ingest report.

## Proposed Command

```sh
python3 scripts/ingest_work.py \
  --work-id w0013 \
  --source /Users/rja19/Documents/PROJECTS/2026-book_explorer/w0013 \
  --csv-source data-source \
  --tone-reference w0010,w0011 \
  --run-ocr \
  --run-descriptions
```

The script should encode the current ingestion guide, not replace it.

## Proposed Config

For repeatability, each ingest could use a small local config file:

```yaml
workId: w0013
sourceDir: /Users/rja19/Documents/PROJECTS/2026-book_explorer/w0013
toneReference:
  - w0010
  - w0011
runOcr: true
runDescriptions: true
```

## First-Version Scope

### 1. Preflight Source Folder

- Check for `01-raw-iphone/`, `02-pages-png/`, `03-charts-png/`, and `04-webp/`.
- Accept older raw folder naming where needed, but prefer `01-raw-iphone/` for new works.
- Validate `03-charts-png/` filename patterns.
- List detected figure ids.
- Flag unexpected file extensions and missing folders.

### 2. Generate Or Verify WEBPs

- Run `/Users/rja19/Documents/PROJECTS/2026-book_explorer/make_webp_derivatives.py`.
- Or verify expected WEBPs already exist.
- Confirm every cropped PNG has:
  - `04-webp/thumbs/<figure_id>_h0500.webp`
  - `04-webp/views/<figure_id>_h2400.webp`

### 3. Copy Assets Into The Site

- Copy thumbs to `public/webp/thumbs/`.
- Copy views to `public/webp/views/`.
- Avoid deleting unrelated existing assets.
- Report all copied, skipped, and overwritten files.

### 4. Validate Data

- Confirm every new `figure_id` has a row in `data-source/figures.csv`.
- Confirm every new figure row has matching thumb and view assets.
- Confirm each new figure references an existing work.
- Catch bad chart type, feature, and color references before tests fail.
- Detect orphan assets and orphan caption rows.

### 5. Build And Enrich

- Run `python3 scripts/build_data.py`.
- Run OCR only for missing/new figure ids.
- Optionally run OpenAI descriptions only for missing/new figure ids.
- Leave generated descriptions `approved: false` unless explicitly approved later.

### 6. Visual QA

- Generate a contact sheet for the new work.
- Generate a comparison contact sheet against related/reference works.
- Compute luminance and top-light RGB stats.
- Flag likely tone issues, such as too-dark paper white, too-bright output, or strong color cast.

### 7. Final Checks

- Run `npm run test`.
- Run `npm run build`.
- Run `npm run test:e2e` when image paths, layout, or lightbox behavior changed.

## Ingest Report

The script should write a report such as:

```text
docs/ingest-reports/w0013.md
```

The report should include:

- Work id and source path.
- Detected figure ids.
- Asset copy summary.
- Missing or orphaned files.
- CSV validation warnings.
- OCR coverage.
- Description coverage.
- Tone stats against reference works.
- Contact sheet paths.
- Commands run.
- Test results.
- Suggested direct preview links, such as `/#/?id=w0013-p0001-f00`.

## Recommended Build Order

1. Implement preflight and report generation.
2. Add WEBP generation/copy support.
3. Add CSV/data validation.
4. Add tone-check contact sheets.
5. Add OCR and description hooks.
6. Add optional one-command full ingest.

This sequence gives value early without making the script too large or brittle.
