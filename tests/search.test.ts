import { describe, expect, it } from "vitest";
import { buildSearchIndex, runSearch } from "../src/lib/search";
import { figuresWithWork } from "./testData";

const index = buildSearchIndex(figuresWithWork);

const searchIds = (query: string): string[] => runSearch(index, query).ids;

describe("search", () => {
  it("finds figures by title", () => {
    expect(searchIds("Family Sizes")).toContain("w0001-p0098-f99");
  });

  it("finds figures by work title", () => {
    expect(searchIds("Women and work")).toContain("w0001-p0038-f99");
  });

  it("finds figures by figure and work identifiers", () => {
    expect(searchIds("w0012-p0003-f00")[0]).toBe("w0012-p0003-f00");
    expect(searchIds("w0012")).toContain("w0012-p0003-f00");
  });

  it("finds figures by work metadata", () => {
    expect(searchIds("Gertrude Williams")).toContain("w0001-p0038-f99");
    expect(searchIds("Nicholson Watson")).toContain("w0001-p0038-f99");
    expect(searchIds("1945")).toContain("w0001-p0038-f99");
  });

  it("finds figures by original caption text", () => {
    expect(searchIds("Danube Valley")).toContain("w0009-p0092-f00");
  });

  it("finds figures by OCR text", () => {
    expect(searchIds("pitchblende uranium")).toContain("w0010-p0026-01");
  });

  it("finds figures by approved image descriptions", () => {
    expect(searchIds("settlement population growth Australia")).toContain(
      "w0012-p0003-f00"
    );
  });

  it("expands British and American spelling variants", () => {
    expect(searchIds("colored areas")).toContain("w0001-p0067-f00");
  });
});
