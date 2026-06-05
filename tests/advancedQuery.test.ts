import { describe, expect, it } from "vitest";
import { matchesAdvancedFilters, parseAdvancedQuery } from "../src/lib/advancedQuery";
import type { ChartTypeConfig, ColorConfig, FeatureConfig } from "../src/lib/types";
import { figuresWithWork, findFigure, readJson, works } from "./testData";

const context = {
  colors: readJson<ColorConfig[]>("public/data/colors.json"),
  chartTypes: readJson<ChartTypeConfig[]>("public/data/chartTypes.json"),
  features: readJson<FeatureConfig[]>("public/data/features.json"),
  works
};

describe("advanced query parsing", () => {
  it("extracts supported key:value filters and leaves plain text for search", () => {
    const parsed = parseAdvancedQuery(
      'type:bar color:red,blue feature:pictorial work:"Women and work" year:1945 series:"The new democracy" occupations',
      context
    );

    expect(parsed.text).toBe("occupations");
    expect(parsed.hasFilters).toBe(true);
    expect(parsed.filters.types).toEqual(["bar"]);
    expect(parsed.filters.colors).toEqual(["red", "blue"]);
    expect(parsed.filters.features).toEqual(["pictorial"]);
    expect(parsed.filters.workIds).toEqual(["w0001"]);
    expect(parsed.filters.years).toEqual([1945]);
    expect(parsed.filters.series).toEqual(["the new democracy"]);
  });

  it("normalizes work IDs and labels", () => {
    expect(parseAdvancedQuery("work:1", context).filters.workIds).toEqual(["w0001"]);
    expect(parseAdvancedQuery("work:w1", context).filters.workIds).toEqual(["w0001"]);
    expect(parseAdvancedQuery("type:bar-chart", context).filters.types).toEqual(["bar"]);
  });

  it("matches figures against advanced filters", () => {
    const parsed = parseAdvancedQuery(
      'type:map color:red feature:symbol-map work:"Women and work" year:1945 series:"The new democracy"',
      context
    );

    expect(matchesAdvancedFilters(findFigure("w0001-p0067-f00"), parsed.filters)).toBe(true);
    expect(matchesAdvancedFilters(findFigure("w0004-p0091-f00"), parsed.filters)).toBe(false);
  });

  it("leaves unsupported tokens in the search text", () => {
    const parsed = parseAdvancedQuery("artist:neurath color:blue schools", context);

    expect(parsed.text).toBe("artist:neurath schools");
    expect(parsed.filters.colors).toEqual(["blue"]);
    expect(figuresWithWork.length).toBeGreaterThan(100);
  });
});
