import { describe, expect, it } from "vitest";
import { seededShuffle, sortFigures } from "../src/lib/sort";
import type { FigureWithWork } from "../src/lib/types";

const figures = [
  { id: "b", workTitle: "Beta", workYear: 1946, page: 2 },
  { id: "a", workTitle: "Alpha", workYear: 1945, page: 1 },
  { id: "c", workTitle: "Gamma", workYear: 1947, page: 3 }
] as FigureWithWork[];

describe("sorting", () => {
  it("sorts by oldest and newest work year", () => {
    expect(sortFigures(figures, "oldest", new Map()).map((figure) => figure.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(sortFigures(figures, "newest", new Map()).map((figure) => figure.id)).toEqual([
      "c",
      "b",
      "a"
    ]);
  });

  it("sorts by relevance scores before stable tie-breaks", () => {
    const scores = new Map([
      ["b", 1],
      ["a", 10],
      ["c", 1]
    ]);

    expect(sortFigures(figures, "relevance", scores).map((figure) => figure.id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });

  it("uses deterministic seeded random order without mutating inputs", () => {
    const input = ["a", "b", "c", "d", "e"];
    const first = seededShuffle(input, 123);
    const second = seededShuffle(input, 123);

    expect(first).toEqual(second);
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
  });
});
