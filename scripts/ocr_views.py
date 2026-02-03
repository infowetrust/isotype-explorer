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
from typing import Dict


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


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR WEBP views via Tesseract.")
    parser.add_argument(
        "--input-dir",
        default="public/webp/views",
        help="Directory containing view images.",
    )
    parser.add_argument(
        "--output",
        default="public/data/ocr.json",
        help="Output JSON path.",
    )
    parser.add_argument("--lang", default="eng", help="Tesseract language code.")
    parser.add_argument("--psm", type=int, default=6, help="Tesseract PSM mode.")
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
    output_path = Path(args.output)

    if not input_dir.exists():
        raise SystemExit(f"Input dir not found: {input_dir}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(output_path)

    images = sorted(input_dir.glob("*.webp"))
    processed = 0
    updated: Dict[str, str] = {}

    for image in images:
        figure_id = extract_figure_id(image)
        if not figure_id:
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
