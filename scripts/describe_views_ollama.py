#!/usr/bin/env python3
"""
Generate accessibility descriptions for WEBP view images using Ollama.

Defaults:
  figures: public/data/figures.json
  works: public/data/works.json
  ocr: public/data/ocr.json
  chart types: public/data/chartTypes.json
  features: public/data/features.json
  colors: public/data/colors.json
  output: public/data/descriptions.json

Requires:
  - Ollama running locally (default: http://localhost:11434)
  - A vision model pulled (default: llava)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import tempfile
import subprocess
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload: Dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def encode_image(path: Path, max_size: int) -> str:
    image_path = path
    temp_path: Optional[Path] = None

    target_size = max_size if max_size > 0 else None

    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            temp_path = Path(tmp.name)
        cmd = ["sips"]
        if target_size:
            cmd += ["-Z", str(target_size)]
        cmd += ["-s", "format", "png", str(path), "--out", str(temp_path)]
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        image_path = temp_path
    except Exception:
        image_path = path

    data = image_path.read_bytes()
    if temp_path and temp_path.exists():
        try:
            temp_path.unlink()
        except Exception:
            pass
    return base64.b64encode(data).decode("utf-8")


def request_ollama(host: str, model: str, prompt: str, image_b64: str) -> str:
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [image_b64],
            }
        ],
        "stream": False,
        "options": {
            "temperature": 0.2,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{host}/api/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Ollama HTTP {err.code}: {body}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Ollama connection error: {err.reason}") from err
    parsed = json.loads(raw)
    message = parsed.get("message", {})
    content = message.get("content", "")
    return content.strip()


def check_ollama(host: str) -> None:
    req = urllib.request.Request(f"{host}/api/tags", method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
    except Exception as exc:
        raise RuntimeError(
            "Ollama server is not reachable. Start it with `ollama serve` "
            "or `brew services start ollama`."
        ) from exc


def normalize_ws(text: str) -> str:
    return " ".join(text.split())


def truncate_text(text: str, max_chars: int) -> str:
    if max_chars <= 0:
        return text
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


def build_label_map(items: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for item in items:
        item_id = str(item.get("id", "")).strip()
        label = str(item.get("label", "")).strip()
        if item_id:
            out[item_id] = label or item_id
    return out


def pick_image_path(figure: Dict[str, Any], input_dir: Path) -> Optional[Path]:
    view = str(figure.get("view", "")).strip()
    if view.startswith("/"):
        candidate = input_dir.parent.parent / view.lstrip("/")
        if candidate.exists():
            return candidate
    figure_id = str(figure.get("id", "")).strip()
    if not figure_id:
        return None
    candidates = [
        input_dir / f"{figure_id}_h2400.webp",
        input_dir / f"{figure_id}.webp",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def build_prompt(
    figure: Dict[str, Any],
    work: Optional[Dict[str, Any]],
    ocr_text: str,
    max_ocr_chars: int,
    include_ocr: bool,
    chart_type_labels: Dict[str, str],
    feature_labels: Dict[str, str],
    color_labels: Dict[str, str],
) -> str:
    types = figure.get("types") or []
    types = [chart_type_labels.get(t, t) for t in types if t]
    if figure.get("isCombo"):
        if "Combo" not in types:
            types.append("Combo")

    by_type = figure.get("featuresByType") or {}
    feature_lines: List[str] = []
    if isinstance(by_type, dict) and by_type:
        for type_id, feats in by_type.items():
            if not feats:
                continue
            label = chart_type_labels.get(type_id, type_id)
            feat_labels = [feature_labels.get(f, f) for f in feats]
            feature_lines.append(f"{label}: {', '.join(feat_labels)}")
    else:
        flat = figure.get("featuresFlat") or []
        if flat:
            feat_labels = [feature_labels.get(f, f) for f in flat]
            feature_lines.append(", ".join(feat_labels))

    colors = figure.get("colors") or []
    color_names = [color_labels.get(c, c) for c in colors]
    if figure.get("onlyBlack"):
        color_names = ["Only black"]

    work_title = work.get("title") if work else None
    work_year = work.get("year") if work else None
    work_series = work.get("series") if work else None

    lines = [
        "Write a concise, accessibility-focused description in 2–3 sentences.",
        "Sentence 1: topic + what is being compared or shown.",
        "Sentence 2: how the data is encoded (bars, pictograms, maps, etc.) and any distinctive symbols or layout.",
        "Use plain language; avoid decorative phrasing and boilerplate.",
        "Do not mention that it is an Isotype chart or repeat generic facts shared by all items.",
        "Avoid framing like 'page/spread/book' unless it is essential to understanding the graphic.",
        "Prefer what you see in the image. OCR text may be noisy and should not override the image.",
        "Do not quote long OCR passages; summarize any text you use.",
    ]

    meta_parts = []
    if work_title:
        meta_parts.append(f"Work title: {work_title}")
    if work_series:
        meta_parts.append(f"Series: {work_series}")
    if work_year:
        meta_parts.append(f"Year: {work_year}")
    if types:
        meta_parts.append(f"Chart type(s): {', '.join(types)}")
    if feature_lines:
        meta_parts.append(f"Features: {'; '.join(feature_lines)}")
    if color_names:
        meta_parts.append(f"Colors: {', '.join(color_names)}")

    if meta_parts:
        lines.append("Metadata: " + " | ".join(meta_parts))

    if include_ocr and ocr_text:
        ocr_clean = normalize_ws(ocr_text)
        ocr_trimmed = truncate_text(ocr_clean, max_ocr_chars)
        lines.append("OCR (noisy, for reference): " + ocr_trimmed)

    return "\n".join(lines).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate descriptions via Ollama.")
    parser.add_argument("--model", default="llava", help="Ollama vision model name.")
    parser.add_argument("--host", default="http://localhost:11434", help="Ollama host.")
    parser.add_argument("--figures", default="public/data/figures.json")
    parser.add_argument("--works", default="public/data/works.json")
    parser.add_argument("--ocr", default="public/data/ocr.json")
    parser.add_argument("--chart-types", default="public/data/chartTypes.json")
    parser.add_argument("--features", default="public/data/features.json")
    parser.add_argument("--colors", default="public/data/colors.json")
    parser.add_argument("--input-dir", default="public/webp/views")
    parser.add_argument("--output", default="public/data/descriptions.json")
    parser.add_argument("--force", action="store_true", help="Rebuild existing entries.")
    parser.add_argument("--limit", type=int, default=0, help="Limit processed images.")
    parser.add_argument("--sleep", type=float, default=0.0, help="Sleep between calls.")
    parser.add_argument(
        "--max-image-size",
        type=int,
        default=768,
        help="Resize longest image edge before sending (0 disables).",
    )
    parser.add_argument(
        "--max-ocr-chars",
        type=int,
        default=1200,
        help="Limit OCR text length in prompt (0 disables).",
    )
    parser.add_argument(
        "--no-ocr",
        action="store_true",
        help="Do not include OCR text in the prompt.",
    )
    args = parser.parse_args()

    check_ollama(args.host)

    figures = load_json(Path(args.figures))
    works = load_json(Path(args.works))
    ocr_data = load_json(Path(args.ocr)) if Path(args.ocr).exists() else {}
    chart_types = load_json(Path(args.chart_types))
    features = load_json(Path(args.features))
    colors = load_json(Path(args.colors))

    output_path = Path(args.output)
    existing: Dict[str, str] = {}
    if output_path.exists():
        existing_raw = load_json(output_path)
        if isinstance(existing_raw, dict):
            existing = {str(k): str(v) for k, v in existing_raw.items()}

    chart_type_labels = build_label_map(chart_types)
    feature_labels = build_label_map(features)
    color_labels = build_label_map(colors)

    work_by_id = {work["workId"]: work for work in works if work.get("workId")}

    input_dir = Path(args.input_dir)
    processed = 0
    updated: Dict[str, str] = {}

    for figure in figures:
        figure_id = str(figure.get("id", "")).strip()
        if not figure_id:
            continue
        if not args.force and figure_id in existing:
            continue

        image_path = pick_image_path(figure, input_dir)
        if not image_path:
            print(f"Skipping {figure_id}: image not found", file=sys.stderr)
            continue

        ocr_text = str(ocr_data.get(figure_id, "")).strip()
        work = work_by_id.get(figure.get("workId"))

        prompt = build_prompt(
            figure,
            work,
            ocr_text,
            args.max_ocr_chars,
            not args.no_ocr,
            chart_type_labels,
            feature_labels,
            color_labels,
        )
        image_b64 = encode_image(image_path, args.max_image_size)

        try:
            description = request_ollama(args.host, args.model, prompt, image_b64)
        except Exception as exc:
            print(f"Failed {figure_id}: {exc}", file=sys.stderr)
            break

        updated[figure_id] = normalize_ws(description)
        processed += 1
        print(f"{figure_id}: ok")

        if args.sleep > 0:
            time.sleep(args.sleep)

        if args.limit and processed >= args.limit:
            break

    if updated:
        existing.update(updated)
        save_json(output_path, existing)

    print(f"Processed {processed} figure(s). Updated {len(updated)} record(s).")
    print(f"Output: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
