#!/usr/bin/env python3
"""
Tone-match WEBP derivatives for one work to reference works.

This is intended for local image correction after WEBP generation. It measures
the brightest 10% of pixels as a paper/background proxy, computes a per-channel
gain against reference works, and overwrites the target WEBPs.

Requires Pillow and NumPy.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from PIL import Image


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def image_array(path: Path, sample_size: int | None = None) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    if sample_size:
        image.thumbnail((sample_size, sample_size), Image.Resampling.LANCZOS)
    return np.asarray(image).astype(np.float32)


def luminance(arr: np.ndarray) -> np.ndarray:
    return 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]


def top_light_rgb(path: Path, top_percent: float, sample_size: int) -> np.ndarray:
    arr = image_array(path, sample_size)
    y = luminance(arr)
    threshold = np.percentile(y, 100 - top_percent)
    mask = y >= threshold
    if not mask.any():
        return arr.reshape(-1, 3).mean(axis=0)
    return arr[mask].mean(axis=0)


def average_top_light_rgb(
    paths: Iterable[Path],
    top_percent: float,
    sample_size: int,
) -> np.ndarray:
    rgbs = [top_light_rgb(path, top_percent, sample_size) for path in paths]
    return np.vstack(rgbs).mean(axis=0)


def save_webp(path: Path, arr: np.ndarray, quality: int) -> None:
    clipped = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(clipped, mode="RGB").save(
        path,
        format="WEBP",
        quality=quality,
        method=6,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Tone-match work WEBPs.")
    parser.add_argument("--figures", default="public/data/figures.json")
    parser.add_argument("--work-id", required=True)
    parser.add_argument(
        "--target-work-ids",
        default="w0010,w0011",
        help="Comma-separated work ids used as the tone reference.",
    )
    parser.add_argument("--top-percent", type=float, default=10.0)
    parser.add_argument("--sample-size", type=int, default=900)
    parser.add_argument("--min-gain", type=float, default=0.95)
    parser.add_argument("--max-gain", type=float, default=1.25)
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    figures = load_json(Path(args.figures))
    target_work_ids = {
        item.strip() for item in args.target_work_ids.split(",") if item.strip()
    }

    reference_paths = [
        Path("public") / figure["view"].lstrip("/")
        for figure in figures
        if figure.get("workId") in target_work_ids
    ]
    work_figures = [
        figure for figure in figures if figure.get("workId") == args.work_id
    ]
    work_paths = [
        Path("public") / figure[key].lstrip("/")
        for figure in work_figures
        for key in ("thumb", "view")
    ]

    if not reference_paths:
        raise SystemExit("No reference paths found.")
    if not work_paths:
        raise SystemExit("No target paths found.")

    target_rgb = average_top_light_rgb(
        reference_paths,
        top_percent=args.top_percent,
        sample_size=args.sample_size,
    )
    print(
        "Reference top-light RGB:",
        ", ".join(f"{channel:.1f}" for channel in target_rgb),
    )

    for path in work_paths:
        current_rgb = top_light_rgb(path, args.top_percent, args.sample_size)
        gain = target_rgb / np.maximum(current_rgb, 1.0)
        gain = np.clip(gain, args.min_gain, args.max_gain)
        print(
            f"{path}: current="
            + ",".join(f"{channel:.1f}" for channel in current_rgb)
            + " gain="
            + ",".join(f"{channel:.3f}" for channel in gain)
        )
        if args.dry_run:
            continue
        arr = image_array(path)
        save_webp(path, arr * gain, quality=args.quality)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
