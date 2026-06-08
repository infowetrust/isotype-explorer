#!/usr/bin/env python3
"""
Generate reviewable accessibility descriptions for figure view images with OpenAI.

Defaults:
  figures: public/data/figures.json
  works: public/data/works.json
  ocr: public/data/ocr.json
  output: public/data/descriptions.json

Generated records are marked approved=false by default. `scripts/build_data.py`
only merges approved records into `figures.json` unless explicitly overridden.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PROMPT_VERSION = "2026-06-08-v1"


DESCRIPTION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "description": {
            "type": "string",
            "description": "Exactly two concise sentences describing the figure.",
        },
        "visibleTextSummary": {
            "type": "string",
            "description": "Brief summary of important visible text used in the description.",
        },
        "needsReview": {
            "type": "boolean",
            "description": "True when OCR/image ambiguity or uncertainty needs human review.",
        },
        "confidence": {
            "type": "string",
            "enum": ["low", "medium", "high"],
        },
        "notes": {
            "type": "string",
            "description": "Short internal note about uncertainty; empty string if none.",
        },
    },
    "required": [
        "description",
        "visibleTextSummary",
        "needsReview",
        "confidence",
        "notes",
    ],
}


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalize_ws(text: str) -> str:
    return " ".join(str(text or "").split())


def truncate_text(text: str, max_chars: int) -> str:
    text = normalize_ws(text)
    if max_chars <= 0 or len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "..."


def build_label_map(items: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for item in items:
        item_id = str(item.get("id", "")).strip()
        label = str(item.get("label", "")).strip()
        if item_id:
            out[item_id] = label or item_id
    return out


def pick_image_path(
    figure: Dict[str, Any],
    input_dir: Path,
    png_root: Optional[Path],
) -> Tuple[Optional[Path], Optional[Path]]:
    png_path: Optional[Path] = None
    work_id = str(figure.get("workId", "")).strip()
    figure_id = str(figure.get("id", "")).strip()

    if png_root and work_id and figure_id:
        candidate = png_root / work_id / "03-charts-png" / f"{figure_id}.png"
        if candidate.exists():
            png_path = candidate

    view = str(figure.get("view", "")).strip()
    if view.startswith("/"):
        candidate = input_dir.parent.parent / view.lstrip("/")
        if candidate.exists():
            return png_path, candidate

    if not figure_id:
        return png_path, None

    for candidate in (
        input_dir / f"{figure_id}_h2400.webp",
        input_dir / f"{figure_id}.webp",
    ):
        if candidate.exists():
            return png_path, candidate
    return png_path, None


def resized_image_data_url(path: Path, max_size: int) -> Tuple[str, str]:
    image_path = path
    temp_path: Optional[Path] = None

    if max_size > 0:
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                temp_path = Path(tmp.name)
            cmd = [
                "sips",
                "-Z",
                str(max_size),
                "-s",
                "format",
                "jpeg",
                str(path),
                "--out",
                str(temp_path),
            ]
            subprocess.run(
                cmd,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            image_path = temp_path
        except Exception:
            image_path = path

    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/webp"
    data = image_path.read_bytes()
    if temp_path and temp_path.exists():
        try:
            temp_path.unlink()
        except Exception:
            pass

    encoded = base64.b64encode(data).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}", image_path.name


def response_text(payload: Dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct

    parts: List[str] = []
    for output in payload.get("output", []) or []:
        for content in output.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def request_openai(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    image_data_url: str,
    detail: str,
    max_output_tokens: int,
    timeout: int,
) -> Dict[str, Any]:
    body = {
        "model": model,
        "instructions": (
            "You write concise accessibility metadata for historical charts. "
            "Return JSON only. Do not include boilerplate, labels, or markdown."
        ),
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {
                        "type": "input_image",
                        "image_url": image_data_url,
                        "detail": detail,
                    },
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "figure_accessibility_description",
                "strict": True,
                "schema": DESCRIPTION_SCHEMA,
            }
        },
        "max_output_tokens": max_output_tokens,
    }

    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        base_url.rstrip("/") + "/responses",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP {exc.code}: {body_text}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI connection error: {exc.reason}") from exc


def build_prompt(
    figure: Dict[str, Any],
    work: Optional[Dict[str, Any]],
    ocr_text: str,
    chart_type_labels: Dict[str, str],
    feature_labels: Dict[str, str],
    color_labels: Dict[str, str],
    max_ocr_chars: int,
) -> str:
    type_ids = figure.get("types") or []
    type_labels = [chart_type_labels.get(t, t) for t in type_ids if t]

    feature_lines: List[str] = []
    by_type = figure.get("featuresByType") or {}
    if isinstance(by_type, dict) and by_type:
        for type_id, feature_ids in by_type.items():
            if not feature_ids:
                continue
            label = chart_type_labels.get(type_id, type_id)
            feature_names = [feature_labels.get(f, f) for f in feature_ids]
            feature_lines.append(f"{label}: {', '.join(feature_names)}")
    else:
        feature_ids = figure.get("featuresFlat") or []
        if feature_ids:
            feature_lines.append(
                ", ".join(feature_labels.get(f, f) for f in feature_ids)
            )

    colors = figure.get("colors") or []
    color_names = [color_labels.get(c, c) for c in colors]
    if figure.get("onlyBlack"):
        color_names = ["Only black"]

    metadata = {
        "figureId": figure.get("id"),
        "figureTitle": figure.get("title"),
        "caption": figure.get("originalCaption"),
        "workTitle": work.get("title") if work else None,
        "workYear": work.get("year") if work else None,
        "workSeries": work.get("series") if work else None,
        "chartTypes": type_labels,
        "features": feature_lines,
        "colors": color_names,
        "ocrText": truncate_text(ocr_text, max_ocr_chars),
    }

    return "\n".join(
        [
            "Generate JSON for this figure.",
            "description: exactly two sentences. Sentence 1 says what topic, comparison, or quantity is shown. Sentence 2 says how the information is visually encoded, including chart form, symbols, colors, layout, or map treatment when visible.",
            "visibleTextSummary: brief summary of important visible labels or title text; do not quote long passages.",
            "needsReview: true if the image or OCR is ambiguous, cropped awkwardly, hard to read, or if you are uncertain.",
            "confidence: low, medium, or high.",
            "notes: short internal note for reviewers; empty string if none.",
            "Avoid boilerplate like 'Here is...' or 'The image shows a page'.",
            "Do not mention that it is an Isotype chart.",
            "Do not mention book/page/spread unless the page object itself is relevant to the content.",
            "Prefer what is visible in the image. OCR is noisy context, not ground truth.",
            "Metadata:",
            json.dumps(metadata, ensure_ascii=False, indent=2),
        ]
    )


def has_description(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, dict):
        return bool(str(value.get("description", "")).strip())
    return False


def make_record(
    parsed: Dict[str, Any],
    *,
    model: str,
    detail: str,
    image_path: Path,
    approved: bool,
) -> Dict[str, Any]:
    return {
        "description": normalize_ws(parsed.get("description", "")),
        "visibleTextSummary": normalize_ws(parsed.get("visibleTextSummary", "")),
        "needsReview": bool(parsed.get("needsReview")),
        "confidence": str(parsed.get("confidence", "low")),
        "notes": normalize_ws(parsed.get("notes", "")),
        "approved": approved,
        "source": "openai",
        "model": model,
        "detail": detail,
        "imagePath": str(image_path),
        "promptVersion": PROMPT_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate descriptions via OpenAI.")
    parser.add_argument("--model", default=os.getenv("OPENAI_DESCRIPTION_MODEL", "gpt-5.4-mini"))
    parser.add_argument("--base-url", default=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    parser.add_argument("--figures", default="public/data/figures.json")
    parser.add_argument("--works", default="public/data/works.json")
    parser.add_argument("--ocr", default="public/data/ocr.json")
    parser.add_argument("--chart-types", default="public/data/chartTypes.json")
    parser.add_argument("--features", default="public/data/features.json")
    parser.add_argument("--colors", default="public/data/colors.json")
    parser.add_argument("--input-dir", default="public/webp/views")
    parser.add_argument(
        "--png-root",
        default="",
        help="Root folder containing <workId>/03-charts-png/<figureId>.png.",
    )
    parser.add_argument("--output", default="public/data/descriptions.json")
    parser.add_argument("--ids", default="", help="Comma-separated figure ids to process.")
    parser.add_argument("--limit", type=int, default=0, help="Limit processed images.")
    parser.add_argument("--force", action="store_true", help="Rebuild existing records.")
    parser.add_argument("--approved", action="store_true", help="Mark generated records approved.")
    parser.add_argument("--dry-run", action="store_true", help="Print selected figures without calling the API.")
    parser.add_argument("--sleep", type=float, default=0.0, help="Sleep between requests.")
    parser.add_argument("--detail", choices=["low", "high", "auto"], default="low")
    parser.add_argument("--max-image-size", type=int, default=1024)
    parser.add_argument("--max-ocr-chars", type=int, default=1200)
    parser.add_argument("--max-output-tokens", type=int, default=550)
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    figures = load_json(Path(args.figures), [])
    works = load_json(Path(args.works), [])
    ocr_data = load_json(Path(args.ocr), {})
    chart_types = load_json(Path(args.chart_types), [])
    features = load_json(Path(args.features), [])
    colors = load_json(Path(args.colors), [])
    existing = load_json(Path(args.output), {}) or {}

    if not isinstance(existing, dict):
        raise SystemExit("Descriptions output must be a JSON object keyed by figure id.")

    selected_ids = {
        item.strip() for item in args.ids.split(",") if item.strip()
    }
    work_by_id = {work["workId"]: work for work in works if work.get("workId")}
    chart_type_labels = build_label_map(chart_types)
    feature_labels = build_label_map(features)
    color_labels = build_label_map(colors)
    input_dir = Path(args.input_dir)
    png_root = Path(args.png_root).expanduser().resolve() if args.png_root else None

    candidates: List[Dict[str, Any]] = []
    for figure in figures:
        figure_id = str(figure.get("id", "")).strip()
        if not figure_id:
            continue
        if selected_ids and figure_id not in selected_ids:
            continue
        if not args.force and has_description(existing.get(figure_id)):
            continue
        candidates.append(figure)

    if args.limit:
        candidates = candidates[: args.limit]

    print(f"Selected {len(candidates)} figure(s).")
    for figure in candidates:
        print(f"  - {figure.get('id')}")

    if args.dry_run:
        return 0

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Missing OPENAI_API_KEY. Set it before running this script.")

    updated = 0
    for figure in candidates:
        figure_id = str(figure.get("id", "")).strip()
        png_path, webp_path = pick_image_path(figure, input_dir, png_root)
        image_path = png_path or webp_path
        if not image_path:
            print(f"Skipping {figure_id}: image not found", file=sys.stderr)
            continue

        image_data_url, _encoded_name = resized_image_data_url(image_path, args.max_image_size)
        prompt = build_prompt(
            figure,
            work_by_id.get(figure.get("workId")),
            str(ocr_data.get(figure_id, "")).strip(),
            chart_type_labels,
            feature_labels,
            color_labels,
            args.max_ocr_chars,
        )

        try:
            response = request_openai(
                api_key=api_key,
                base_url=args.base_url,
                model=args.model,
                prompt=prompt,
                image_data_url=image_data_url,
                detail=args.detail,
                max_output_tokens=args.max_output_tokens,
                timeout=args.timeout,
            )
            parsed = json.loads(response_text(response))
        except Exception as exc:
            print(f"Failed {figure_id}: {exc}", file=sys.stderr)
            break

        record = make_record(
            parsed,
            model=args.model,
            detail=args.detail,
            image_path=image_path,
            approved=args.approved,
        )
        existing[figure_id] = record
        updated += 1
        print(f"{figure_id}: ok")

        if args.sleep > 0:
            time.sleep(args.sleep)

    if updated:
        save_json(Path(args.output), existing)

    print(f"Updated {updated} record(s).")
    print(f"Output: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
