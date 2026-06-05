import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ChartTypeConfig, ColorConfig, FeatureConfig } from "../src/lib/types";
import { figures, ocrById, publicDir, readJson, works } from "./testData";

const chartTypes = readJson<ChartTypeConfig[]>("public/data/chartTypes.json");
const features = readJson<FeatureConfig[]>("public/data/features.json");
const colors = readJson<ColorConfig[]>("public/data/colors.json");

const ids = (items: Array<{ id: string }>) => new Set(items.map((item) => item.id));

describe("data integrity", () => {
  it("uses unique figure IDs", () => {
    const figureIds = figures.map((figure) => figure.id);
    expect(new Set(figureIds).size).toBe(figureIds.length);
  });

  it("resolves every figure work reference", () => {
    const workIds = new Set(works.map((work) => work.workId));
    const missing = figures
      .filter((figure) => !workIds.has(figure.workId))
      .map((figure) => `${figure.id} -> ${figure.workId}`);

    expect(missing).toEqual([]);
  });

  it("resolves every type, feature, and color reference", () => {
    const typeIds = ids(chartTypes);
    const featureIds = ids(features);
    const colorIds = ids(colors);

    const missingTypes = new Set<string>();
    const missingFeatures = new Set<string>();
    const missingColors = new Set<string>();

    figures.forEach((figure) => {
      (figure.types ?? []).forEach((type) => {
        if (!typeIds.has(type)) {
          missingTypes.add(`${figure.id} -> ${type}`);
        }
      });
      Object.entries(figure.featuresByType ?? {}).forEach(([type, featureList]) => {
        if (!typeIds.has(type)) {
          missingTypes.add(`${figure.id} featuresByType -> ${type}`);
        }
        featureList.forEach((feature) => {
          if (!featureIds.has(feature)) {
            missingFeatures.add(`${figure.id} -> ${feature}`);
          }
        });
      });
      (figure.featuresFlat ?? []).forEach((feature) => {
        if (!featureIds.has(feature)) {
          missingFeatures.add(`${figure.id} -> ${feature}`);
        }
      });
      (figure.colors ?? []).forEach((color) => {
        if (!colorIds.has(color)) {
          missingColors.add(`${figure.id} -> ${color}`);
        }
      });
    });

    expect(Array.from(missingTypes).sort()).toEqual([]);
    expect(Array.from(missingFeatures).sort()).toEqual([]);
    expect(Array.from(missingColors).sort()).toEqual([]);
  });

  it("points every thumbnail and full-size view at an existing public asset", () => {
    const missingAssets = figures.flatMap((figure) =>
      [figure.thumb, figure.view]
        .filter((assetPath) => !fs.existsSync(path.join(publicDir, assetPath)))
        .map((assetPath) => `${figure.id} -> ${assetPath}`)
    );

    expect(missingAssets).toEqual([]);
  });

  it("has enough display content for cards and lightbox headings", () => {
    const workTitles = new Map(works.map((work) => [work.workId, work.title]));
    const missingDisplayContent = figures
      .filter((figure) => {
        const title = figure.title?.trim();
        const workTitle = workTitles.get(figure.workId)?.trim();
        return !title && !workTitle && !figure.id;
      })
      .map((figure) => figure.id);

    expect(missingDisplayContent).toEqual([]);
  });

  it("keeps OCR extras explicit and reviewed", () => {
    const knownFigureIds = new Set(figures.map((figure) => figure.id));
    const knownReviewedExtras = new Set(["w0007-p0068-f99"]);
    const unreviewedExtras = Object.keys(ocrById).filter(
      (id) => !knownFigureIds.has(id) && !knownReviewedExtras.has(id)
    );

    expect(unreviewedExtras).toEqual([]);
  });
});
