import { describe, expect, it } from "vitest";
import { matchesFilters } from "../src/lib/filters";
import { findFigure } from "./testData";

describe("filter matching", () => {
  it("matches selected type and feature filters", () => {
    const figure = findFigure("w0001-p0038-f99");

    expect(
      matchesFilters(figure, {
        selectedTypes: ["bar"],
        selectedFeatures: ["pictorial"],
        selectedColors: [],
        onlyBlack: false,
        workId: null
      })
    ).toBe(true);
  });

  it("normalizes map symbol feature selections", () => {
    const figure = findFigure("w0001-p0067-f00");

    expect(
      matchesFilters(figure, {
        selectedTypes: ["map"],
        selectedFeatures: ["symbol"],
        selectedColors: [],
        onlyBlack: false,
        workId: null
      })
    ).toBe(true);
  });

  it("requires all selected colors", () => {
    const figure = findFigure("w0001-p0038-f99");

    expect(
      matchesFilters(figure, {
        selectedTypes: [],
        selectedFeatures: [],
        selectedColors: ["red", "blue"],
        onlyBlack: false,
        workId: null
      })
    ).toBe(true);
    expect(
      matchesFilters(figure, {
        selectedTypes: [],
        selectedFeatures: [],
        selectedColors: ["red", "orange"],
        onlyBlack: false,
        workId: null
      })
    ).toBe(false);
  });

  it("matches only-black figures separately from color filters", () => {
    expect(
      matchesFilters(findFigure("w0004-p0091-f00"), {
        selectedTypes: [],
        selectedFeatures: [],
        selectedColors: [],
        onlyBlack: true,
        workId: null
      })
    ).toBe(true);
    expect(
      matchesFilters(findFigure("w0001-p0038-f99"), {
        selectedTypes: [],
        selectedFeatures: [],
        selectedColors: [],
        onlyBlack: true,
        workId: null
      })
    ).toBe(false);
  });

  it("matches combo and work filters", () => {
    expect(
      matchesFilters(findFigure("w0001-p0078-f99"), {
        selectedTypes: ["combo"],
        selectedFeatures: [],
        selectedColors: [],
        onlyBlack: false,
        workId: "w0001"
      })
    ).toBe(true);
    expect(
      matchesFilters(findFigure("w0001-p0078-f99"), {
        selectedTypes: ["combo"],
        selectedFeatures: [],
        selectedColors: [],
        onlyBlack: false,
        workId: "w0002"
      })
    ).toBe(false);
  });
});
