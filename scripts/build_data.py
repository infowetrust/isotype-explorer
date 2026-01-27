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
- Supports newer figure CSV headers:
    types, features, figure_title
  and older ones:
    figure_type, basic chart, chart facets, etc.
- Normalizes work ids: 1 -> w0001, w1 -> w0001, w0001 -> w0001
- Parses page + fcode from figure_id: w0001-p0038-f99
- Auto-generates image paths:
    /webp/thumbs/<id>_h0500.webp
    /webp/views/<id>_h2400.webp
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# -------------------- helpers --------------------

def norm_key(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("\ufeff", "")  # BOM
    s = re.sub(r"[\s\-\/\(\)\.]+", "_", s)
    s = re.sub(r"[^a-z0-9_]", "", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def clean_cell(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()

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
    raw = clean_cell(raw).lower().replace(" ", "")
    if not raw:
        return ""
    m = re.match(r"^w(\d+)$", raw)
    if m:
        return "w" + m.group(1).zfill(4)
    if raw.isdigit():
        return "w" + raw.zfill(4)
    return raw

def normalize_figure_id(raw: str) -> str:
    raw = clean_cell(raw).strip()
    raw = re.sub(r"\.(png|webp|jpg|jpeg|tif|tiff)$", "", raw, flags=re.I)
    return raw.lower()

def get_first(row: Dict[str, str], *keys: str, default: str = "") -> str:
    for k in keys:
        nk = norm_key(k)
        if nk in row:
            v = clean_cell(row[nk])
            if v != "":
                return v
    return default

def split_csvish(s: str) -> List[str]:
    """Split on comma or semicolon for fields like features/colors/themes."""
    s = clean_cell(s)
    if not s:
        return []
    parts = [p.strip() for p in re.split(r"[;,]+", s) if p.strip()]
    return parts

def split_semicolon_only(s: str) -> List[str]:
    """Split ONLY on semicolons (for author lists where commas are name format)."""
    s = clean_cell(s)
    if not s:
        return []
    return [p.strip() for p in s.split(";") if p.strip()]

def flip_last_first(name: str) -> str:
    """
    Convert 'Last, First Middle' -> 'First Middle Last'.
    If no comma, returns unchanged.
    """
    name = clean_cell(name)
    if "," not in name:
        return name
    last, rest = name.split(",", 1)
    last = last.strip()
    rest = rest.strip()
    if not rest:
        return last
    return f"{rest} {last}".strip()

FIGURE_ID_RE = re.compile(r"^(w\d{4})-p(\d{3,4})-f(\d{2})$", re.I)

def parse_figure_components(figure_id: str) -> Tuple[str, Optional[int], Optional[int]]:
    m = FIGURE_ID_RE.match(figure_id)
    if not m:
        return ("", None, None)
    work = normalize_work_id(m.group(1))
    page = parse_int(m.group(2))
    fcode = parse_int(m.group(3))
    return (work, page, fcode)

def parse_types(raw: str) -> List[str]:
    tokens = [slugify(t) for t in split_csvish(raw)]
    tokens = [t for t in tokens if t and t != "combo"]
    return tokens

def parse_features_list(raw: str) -> List[str]:
    tokens = [slugify(t) for t in split_csvish(raw)]
    return [t for t in tokens if t]

def parse_features_by_type(raw: str, types: List[str], fig_id: str) -> Dict[str, List[str]]:
    features_by_type: Dict[str, List[str]] = {}
    if not raw.strip():
        return features_by_type

    groups = [g.strip() for g in raw.split(";") if g.strip()]
    if not any(":" in g for g in groups):
        print(f"WARNING: multi-type figure without scoped features: {fig_id}")
        return features_by_type

    for group in groups:
        if ":" not in group:
            print(f"WARNING: invalid scoped features (missing ':') for {fig_id}: {group}")
            continue
        type_key_raw, feature_list_raw = group.split(":", 1)
        type_key = slugify(type_key_raw)
        if not type_key:
            continue
        if type_key not in types:
            print(
                f"WARNING: scoped features type not in types for {fig_id}: {type_key}"
            )
            continue
        features = parse_features_list(feature_list_raw)
        features_by_type[type_key] = features
    return features_by_type

def normalize_color_token(tok: str) -> str:
    t = clean_cell(tok).lower()
    t = t.replace("_", "-").replace(" ", "-")
    if t == "grey":
        t = "gray"
    if t in {"onlyblack", "only-black", "only"}:
        t = "only-black"
    return t

def parse_colors(raw: str) -> Tuple[List[str], bool]:
    """
    Returns (colors_list, onlyBlack)
    - colors_list excludes 'black'
    - onlyBlack True if explicitly only-black OR only black present
    """
    toks = [normalize_color_token(x) for x in split_csvish(raw)]
    if "only-black" in toks:
        return ([], True)

    toks_wo_black = [t for t in toks if t and t not in {"black"}]

    if not toks_wo_black and toks:
        # they provided only 'black'
        return ([], True)

    # de-dup preserve order
    seen = set()
    out: List[str] = []
    for c in toks_wo_black:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return (out, False)


# -------------------- IO --------------------

def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for r in reader:
            nr = {norm_key(k): clean_cell(v) for k, v in (r or {}).items() if k is not None}
            if any(v.strip() for v in nr.values()):
                rows.append(nr)
        return rows

def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


# -------------------- builders --------------------

def build_works(rows: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    works: List[Dict[str, Any]] = []
    for r in rows:
        work_id = normalize_work_id(get_first(r, "work_id", "work", "workid", "work key", "work_key"))
        title = get_first(r, "title")
        if not work_id or not title:
            continue

        year = parse_int(get_first(r, "pub year", "year", "publication year", "pub_year"))
        series = get_first(r, "series", default="") or None
        language = get_first(r, "language", default="") or None

        # Authors: semicolon-separated list; commas inside names are part of "Last, First"
        authors_raw = get_first(r, "author(s)", "authors", "author", default="")
        authors_list = [flip_last_first(a) for a in split_semicolon_only(authors_raw)]

        info_designers = split_semicolon_only(get_first(r, "information designers", "information_designers", "designers", default=""))
        publisher = get_first(r, "publisher", default="") or None
        publisher_city = get_first(r, "publisher city", "publisher_city", "city", default="") or None
        height_cm = parse_int(get_first(r, "height (cm)", "height_cm", "height", default=""))

        # extra fields (safe to include; UI may ignore)
        oclc = get_first(r, "oclc_number", "oclc", default="") or None
        isbn = get_first(r, "isbn", default="") or None
        scan_source = get_first(r, "scan_source", default="") or None
        first_ed = get_first(r, "1st ed.", "1st_ed", "first_edition", default="") or None

        works.append({
            "workId": work_id,
            "year": year,
            "title": title,
            "series": series,
            "language": language,
            "authors": authors_list,
            "informationDesigners": info_designers,
            "publisher": publisher,
            "publisherCity": publisher_city,
            "heightCm": height_cm,
            "oclcNumber": oclc,
            "isbn": isbn,
            "scanSource": scan_source,
            "firstEdition": first_ed,
        })

    works.sort(key=lambda w: w.get("workId", ""))
    return works


def build_figures(rows: List[Dict[str, str]], works_by_id: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    figures: List[Dict[str, Any]] = []

    for r in rows:
        fig_id = normalize_figure_id(get_first(r, "figure_id", "id", "figure", "filename"))
        if not fig_id:
            continue

        work_from_id, page_from_id, fcode_from_id = parse_figure_components(fig_id)
        work_col = normalize_work_id(get_first(r, "work_id", "work", "workid", default=""))
        if work_from_id and work_col and work_from_id != work_col:
            print(
                f"WARNING: work mismatch for {fig_id}: figure_id={work_from_id} "
                f"csv={work_col}"
            )
        work_id = work_from_id or work_col or None

        page = page_from_id if page_from_id is not None else parse_int(get_first(r, "page", "page_number", default=""))
        fcode = fcode_from_id if fcode_from_id is not None else parse_int(get_first(r, "figure_code", "fig_code", "f", default=""))

        title = get_first(r, "figure_title", "title", default="") or None

        # Types (new: types; fallback to older columns)
        types_raw = get_first(
            r,
            "types",
            "figure_type",
            "basic chart",
            "chart_type",
            "chart type",
            "type",
            default="",
        )
        types = parse_types(types_raw)
        is_combo = len(types) > 1

        # Features (new: features; fallback to older columns)
        features_raw = get_first(
            r,
            "features",
            "chart facets",
            "facets",
            "chart_types",
            "chart types",
            default="",
        )
        features_by_type: Dict[str, List[str]] = {}
        if len(types) == 1:
            if types:
                features_by_type[types[0]] = parse_features_list(features_raw)
        elif len(types) > 1:
            features_by_type = parse_features_by_type(features_raw, types, fig_id)
            for t in types:
                if t not in features_by_type:
                    print(
                        f"WARNING: missing scoped features for type '{t}' in {fig_id}"
                    )

        features_flat: List[str] = []
        seen_features: set[str] = set()
        for t in types:
            for feat in features_by_type.get(t, []):
                if feat not in seen_features:
                    seen_features.add(feat)
                    features_flat.append(feat)

        # Colors
        colors_raw = get_first(r, "colors", "color", "palette", default="")
        colors, only_black = parse_colors(colors_raw)

        # Optional long text columns (if you add later)
        ocr_text = get_first(r, "ocr_text", "ocr", "figure_text", "figure text", default="") or None
        ai_description = get_first(r, "ai_description", "ai description", default="") or None
        themes_raw = get_first(r, "themes", "topic themes", "topic_themes", default="")
        themes = [clean_cell(x) for x in split_csvish(themes_raw)]

        thumb = f"/webp/thumbs/{fig_id}_h0500.webp"
        view = f"/webp/views/{fig_id}_h2400.webp"

        work_meta = works_by_id.get(work_id, {}) if work_id else {}
        work_year = work_meta.get("year")

        figures.append({
            "id": fig_id,
            "workId": work_id,
            "page": page,
            "figureCode": fcode,
            "thumb": thumb,
            "view": view,

            "title": title,

            # types + features
            "types": types,
            "typesFlat": types,
            "isCombo": is_combo,
            "featuresByType": features_by_type,
            "featuresFlat": features_flat,

            "colors": colors,
            "onlyBlack": only_black,

            "themes": themes,
            "aiDescription": ai_description,
            "ocrText": ocr_text,

            # useful for sorting without extra join
            "workYear": work_year,

            # optional: keep the full type tokens for future work (UI can ignore)
            "typeTokens": types,
        })

    figures.sort(key=lambda f: f.get("id", ""))
    return figures


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

    # warnings: figures referencing unknown works
    missing_works = sorted({f["workId"] for f in figures if f.get("workId") and f["workId"] not in works_by_id})
    if missing_works:
        print("WARNING: figures reference workIds not present in works.json:")
        for wid in missing_works:
            print("  -", wid)

    write_json(out_dir / "works.json", works)
    write_json(out_dir / "figures.json", figures)

    print(f"Wrote {len(works)} works -> {out_dir/'works.json'}")
    print(f"Wrote {len(figures)} figures -> {out_dir/'figures.json'}")


if __name__ == "__main__":
    main()
