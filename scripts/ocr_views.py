#!/usr/bin/env python3
"""
Run Tesseract OCR over WEBP view images and write sidecar JSON.

Defaults:
  input:  public/webp/views
  output: public/data/ocr.json

Keying:
  file name format: <figure_id>_h2400.webp (height suffix optional)
  stored key: <figure_id>
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Dict, Optional, Tuple


HEIGHT_SUFFIX_RE = re.compile(r"_h\d+$", re.I)


def extract_figure_id(path: Path) -> str:
    stem = path.stem
    stem = HEIGHT_SUFFIX_RE.sub("", stem)
    return stem


def run_tesseract(
    image_path: Path,
    lang: str,
    psm: int,
    oem: int,
) -> str:
    cmd = [
        "tesseract",
        str(image_path),
        "stdout",
        "-l",
        lang,
        "--oem",
        str(oem),
        "--psm",
        str(psm),
    ]
    result = subprocess.run(
        cmd,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Tesseract failed for {image_path.name}: {result.stderr.strip()}"
        )
    text = result.stdout
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_existing(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Existing OCR file must be a JSON object keyed by figure id.")
    return {str(k): str(v) for k, v in data.items()}


def pick_image_path(
    figure_id: str,
    work_id: str,
    input_dir: Path,
    png_root: Optional[Path],
) -> Tuple[Optional[Path], Optional[Path]]:
    png_path: Optional[Path] = None
    if png_root and work_id and figure_id:
        candidate = png_root / work_id / "03-charts-png" / f"{figure_id}.png"
        if candidate.exists():
            png_path = candidate

    candidates = [
        input_dir / f"{figure_id}_h2400.webp",
        input_dir / f"{figure_id}_h0500.webp",
        input_dir / f"{figure_id}.webp",
    ]
    for candidate in candidates:
        if candidate.exists():
            return png_path, candidate
    return png_path, None


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR WEBP views via Tesseract.")
    parser.add_argument(
        "--input-dir",
        default="public/webp/views",
        help="Directory containing view images.",
    )
    parser.add_argument(
        "--png-root",
        default="",
        help="Root folder containing <workId>/03-charts-png/<figureId>.png.",
    )
    parser.add_argument(
        "--require-png",
        action="store_true",
        help="Skip figures without a PNG in the png-root path.",
    )
    parser.add_argument(
        "--output",
        default="public/data/ocr.json",
        help="Output JSON path.",
    )
    parser.add_argument("--lang", default="eng", help="Tesseract language code.")
    parser.add_argument("--psm", type=int, default=3, help="Tesseract PSM mode.")
    parser.add_argument("--oem", type=int, default=1, help="Tesseract OEM mode.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run OCR even if output key exists.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of images processed (0 = no limit).",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    png_root = Path(args.png_root).expanduser().resolve() if args.png_root else None
    output_path = Path(args.output)

    if not input_dir.exists():
        raise SystemExit(f"Input dir not found: {input_dir}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(output_path)

    figures_path = Path("public/data/figures.json")
    if not figures_path.exists():
        raise SystemExit("Missing public/data/figures.json for workId lookup.")
    with figures_path.open("r", encoding="utf-8") as handle:
        figures = json.load(handle)

    figures_by_id = {
        str(item.get("id")): str(item.get("workId", "")) for item in figures if item.get("id")
    }
    figure_ids = sorted(figures_by_id.keys())
    processed = 0
    updated: Dict[str, str] = {}

    for figure_id in figure_ids:
        work_id = figures_by_id.get(figure_id, "")
        png_path, webp_path = pick_image_path(figure_id, work_id, input_dir, png_root)
        image = png_path or webp_path
        if not image:
            print(f"Skipping {figure_id}: image not found", file=sys.stderr)
            continue
        if png_root and not png_path:
            print(f"PNG missing for {figure_id} at {png_root}", file=sys.stderr)
            if args.require_png:
                continue

        if not args.force and figure_id in existing:
            continue
        text = run_tesseract(image, args.lang, args.psm, args.oem)
        updated[figure_id] = text
        processed += 1
        if args.limit and processed >= args.limit:
            break

    if updated:
        existing.update(updated)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(existing, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

    print(f"Processed {processed} image(s). Updated {len(updated)} record(s).")
    print(f"Output: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
