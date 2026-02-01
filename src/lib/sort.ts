import type { FigureWithWork } from "./types";

export type SortKey = "relevance" | "oldest" | "newest" | "random";

const compareStrings = (a?: string, b?: string): number =>
  (a ?? "").localeCompare(b ?? "");

const compareNumbers = (a?: number, b?: number): number =>
  (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);

export const sortFigures = (
  figures: FigureWithWork[],
  sortKey: SortKey,
  scoreById: Map<string, number>
): FigureWithWork[] => {
  const sorted = [...figures];

  if (sortKey === "random") {
    for (let i = sorted.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
    return sorted;
  }

  sorted.sort((a, b) => {
    if (sortKey === "relevance") {
      const scoreA = scoreById.get(a.id) ?? 0;
      const scoreB = scoreById.get(b.id) ?? 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }

    if (sortKey === "oldest" || sortKey === "newest") {
      const yearCompare = compareNumbers(a.workYear, b.workYear);
      if (yearCompare !== 0) {
        return sortKey === "newest" ? -yearCompare : yearCompare;
      }
    }

    if (sortKey === "relevance" || sortKey === "oldest" || sortKey === "newest") {
      const workCompare = compareStrings(a.workTitle ?? a.workId, b.workTitle ?? b.workId);
      if (workCompare !== 0) {
        return workCompare;
      }
    }

    return compareNumbers(a.page, b.page);
  });

  return sorted;
};
