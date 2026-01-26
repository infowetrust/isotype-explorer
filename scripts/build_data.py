#!/usr/bin/env python3
"""
Build site JSON from Google Sheets CSV exports.

Inputs (default):
  data-source/works.csv
  data-source/figures.csv

Outputs:
  public/data/works.json
  public/data/figures.json

Notes:
- Tolerant of column name variations (spaces, case, etc.).
- Auto-generates thumb/view paths from figure_id:
    /webp/thumbs/<id>_h0500.webp
    /webp/views/<id>_h2400.webp
- Parses workId/page/figureCode from figure_id if possible.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---- Helpers -------------------------------------------------------------

def norm_key(s: str) -> str:
    s = s.strip().lower()
    s = s.replace("\ufeff", "")  # BOM
    s = re.sub(r"[\s\-\/\(\)\.]+", "_", s)
    s = re.sub(r"[^a-z0-9_]", "", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def clean_cell(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()

def split_list(s: str) -> List[str]:
    s = clean_cell(s)
    if not s:
        return []
    # Prefer semicolon as a "real list" delimiter; fallback to commas.
    if ";" in s:
        parts = [p.strip() for p in s.split(";")]
    else:
        parts = [p.strip() for p in s.split(",")]
    return [p for p in parts if p]

def parse_int(s: str) -> Optional[int]:
    s = clean_cell(s)
    if not s:
        return None
    s = re.sub(r"[^\d\-]", "", s)
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None

def slugify(s: str) -> str:
    s = clean_cell(s).lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s

def normalize_work_id(raw: str) -> str:
    raw = clean_cell(raw).lower()
    raw = raw.replace(" ", "")
    if not raw:
        return ""
    # Accept w0001, W1, 1, 0001, etc.
    m = re.match(r"^w(\d+)$", raw)
    if m:
        n = m.group(1)
        return "w" + n.zfill(4)
    if raw.isdigit():
        return "w" + raw.zfill(4)
    return raw  # fallback

def normalize_figure_id(raw: str) -> str:
    raw = clean_cell(raw)
    raw = raw.strip()
    # strip extension if someone pasted filenames
    raw = re.sub(r"\.(png|webp|jpg|jpeg|tif|tiff)$", "", raw, flags=re.I)
    return raw.lower()

def get_first(row: Dict[str, str], *keys: str, default: str = "") -> str:
    """Return first non-empty value from any of the possible keys."""
    for k in keys:
        nk = norm_key(k)
        if nk in row:
            v = clean_cell(row[nk])
            if v != "":
                return v
    return default

FIGURE_ID_RE = re.compile(r"^(w\d{4})-p(\d{3,4})-f(\d{2})$", re.I)

def parse_figure_components(figure_id: str) -> Tuple[str, Optional[int], Optional[int]]:
    """
    Returns (workId, page, figureCode) parsed from figure_id if possible.
    """
    m = FIGURE_ID_RE.match(figure_id)
    if not m:
        return ("", None, None)
    work = normalize_work_id(m.group(1))
    page = parse_int(m.group(2))
    fig_code = parse_int(m.group(3))
    return (work, page, fig_code)

def normalize_color_token(tok: str) -> str:
    t = clean_cell(tok).lower()
    t = t.replace("_", "-").replace(" ", "-")
    # normalize "only black" variants
    if t in {"onlyblack", "only-black", "only-black,", "onlyblack,", "only"}:
        return "only-black"
    if t in {"only-black"}:
        return "only-black"
    # map common variants
    if t in {"grey"}:
        return "gray"
    return t

def parse_colors(raw: str) -> Tuple[List[str], bool]:
    """
    Returns (colors_list, onlyBlack).
    colors_list excludes black (since black is assumed present in colored charts).
    onlyBlack is True if the figure has no colors other than black.
    """
    toks = [normalize_color_token(x) for x in re.split(r"[;,]+", clean_cell(raw)) if x.strip()]
    toks = [t for t in toks if t]  # drop empties

    if "only-black" in toks:
        return ([], True)

    # remove black if present (because it’s not useful as a filter)
    toks_wo_black = [t for t in toks if t not in {"black", "only-black"}]

    # if user literally provided only "black", treat as onlyBlack
    if not toks_wo_black and toks:
        return ([], True)

    # keep only the allowed color set if present; otherwise pass through
    # (you can tighten this later)
    colors = toks_wo_black

    # de-dup preserving order
    seen = set()
    out = []
    for c in colors:
        if c not in seen:
            seen.add(c)
            out.append(c)

    return (out, False)


# ---- Build steps ---------------------------------------------------------

def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            nr = {norm_key(k): clean_cell(v) for k, v in (r or {}).items() if k is not None}
            # skip fully empty rows
            if any(v.strip() for v in nr.values()):
                rows.append(nr)
        return rows

def build_works(rows: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    works: List[Dict[str, Any]] = []
    for r in rows:
        work_id_raw = get_first(r, "work_id", "work", "workid", "work key", "work_key")
        work_id = normalize_work_id(work_id_raw)

        year = parse_int(get_first(r, "pub year", "year", "publication year", "pub_year"))
        title = get_first(r, "title")
        series = get_first(r, "series")
        authors = split_list(get_first(r, "author(s)", "authors", "author"))
        publisher = get_first(r, "publisher")
        publisher_city = get_first(r, "publisher city", "publisher_city", "city")
        height_cm = parse_int(get_first(r, "height (cm)", "height_cm", "height"))

        info_designers = split_list(get_first(r, "information designers", "information_designers", "designers"))
        language = get_first(r, "language", default="")

        # Keep only meaningful works (must have an id and a title)
        # You can loosen this later if you want.
        if not work_id or not title:
            continue

        works.append({
            "workId": work_id,
            "year": year,
            "title": title,
            "series": series or None,
            "authors": authors,
            "informationDesigners": info_designers,
            "publisher": publisher or None,
            "publisherCity": publisher_city or None,
            "heightCm": height_cm,
            "language": language or None,
        })

    # stable order for diffs
    works.sort(key=lambda w: w.get("workId", ""))
    return works

def build_figures(rows: List[Dict[str, str]], works_by_id: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    figures: List[Dict[str, Any]] = []

    for r in rows:
        fig_id = normalize_figure_id(get_first(r, "figure_id", "id", "figure", "filename"))
        if not fig_id:
            continue

        # WorkId: prefer parsing from figure_id, fallback to column
        work_from_id, page_from_id, fig_code_from_id = parse_figure_components(fig_id)
        work_raw = get_first(r, "work_id", "work", "workid", default="")
        work_id = work_from_id or normalize_work_id(work_raw)

        # Page / fig code: prefer parsed values; fallback to columns if present
        page = page_from_id if page_from_id is not None else parse_int(get_first(r, "page", "page_number"))
        fig_code = fig_code_from_id if fig_code_from_id is not None else parse_int(get_first(r, "figure_code", "fig_code", "f"))

        # Chart types
        primary_type_raw = get_first(r, "basic chart", "chart_type", "chart type", "type", default="")
        facets_raw = get_first(r, "chart facets", "facets", "chart_types", "chart types", default="")

        chart_type_primary = slugify(primary_type_raw) if primary_type_raw else None

        chart_types: List[str] = []
        if chart_type_primary:
            chart_types.append(chart_type_primary)
        for t in split_list(facets_raw):
            st = slugify(t)
            if st and st not in chart_types:
                chart_types.append(st)

        # Colors
        colors_raw = get_first(r, "colors", "color", "palette", default="")
        colors, only_black = parse_colors(colors_raw)

        # Text + AI
        title = get_first(r, "figure_title", "title", default="")
        ocr_text = get_first(r, "figure text", "figure_text", "ocr_text", "ocr", default="")
        ai_description = get_first(r, "ai description", "ai_description", "description_ai", default="")
        themes_raw = get_first(r, "themes", "topic themes", "topic_themes", default="")
        themes = [clean_cell(x) for x in split_list(themes_raw)]

        # Auto image paths (based on your naming convention)
        thumb = f"/webp/thumbs/{fig_id}_h0500.webp"
        view = f"/webp/views/{fig_id}_h2400.webp"

        # Join some work fields for convenience (optional)
        work_meta = works_by_id.get(work_id, {})
        work_year = work_meta.get("year")

        figures.append({
            "id": fig_id,
            "workId": work_id or None,
            "page": page,
            "figureCode": fig_code,
            "thumb": thumb,
            "view": view,

            "chartTypePrimary": chart_type_primary,
            "chartTypes": chart_types,

            "colors": colors,
            "onlyBlack": only_black,

            "themes": themes,
            "aiDescription": ai_description or None,
            "ocrText": ocr_text or None,
            "title": title or None,

            # useful for sorting without extra join
            "workYear": work_year,
        })

    figures.sort(key=lambda f: f.get("id", ""))
    return figures


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build public/data JSON from CSV exports")
    parser.add_argument("--works", default="data-source/works.csv", help="Path to works.csv")
    parser.add_argument("--figures", default="data-source/figures.csv", help="Path to figures.csv")
    parser.add_argument("--out", default="public/data", help="Output folder for JSON files")
    args = parser.parse_args()

    repo_root = Path.cwd()
    works_path = (repo_root / args.works).resolve()
    figures_path = (repo_root / args.figures).resolve()
    out_dir = (repo_root / args.out).resolve()

    if not works_path.exists():
        raise SystemExit(f"Missing works CSV: {works_path}")
    if not figures_path.exists():
        raise SystemExit(f"Missing figures CSV: {figures_path}")

    works_rows = read_csv(works_path)
    fig_rows = read_csv(figures_path)

    works = build_works(works_rows)
    works_by_id = {w["workId"]: w for w in works}

    figures = build_figures(fig_rows, works_by_id)

    # basic validation warnings
    missing_works = sorted({f["workId"] for f in figures if f.get("workId") and f["workId"] not in works_by_id})
    if missing_works:
        print("WARNING: figures reference workIds not present in works.json:")
        for wid in missing_works:
            print("  -", wid)
        print("You can either add those works to works.csv or accept them as 'unknown work'.")

    write_json(out_dir / "works.json", works)
    write_json(out_dir / "figures.json", figures)

    print(f"Wrote {len(works)} works -> {out_dir/'works.json'}")
    print(f"Wrote {len(figures)} figures -> {out_dir/'figures.json'}")


if __name__ == "__main__":
    main()
