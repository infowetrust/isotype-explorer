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

  it("finds figures by original caption text", () => {
    expect(searchIds("Danube Valley")).toContain("w0009-p0092-f00");
  });

  it("finds figures by OCR text", () => {
    expect(searchIds("pitchblende uranium")).toContain("w0010-p0026-01");
  });

  it("expands British and American spelling variants", () => {
    expect(searchIds("colored areas")).toContain("w0001-p0067-f00");
  });
});
