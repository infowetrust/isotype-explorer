import type { FigureWithWork } from "./types";

export type SortKey = "relevance" | "work" | "year" | "type";

const compareStrings = (a?: string, b?: string): number =>
  (a ?? "").localeCompare(b ?? "");

const compareNumbers = (a?: number, b?: number): number =>
  (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);

export const sortFigures = (
  figures: FigureWithWork[],
  sortKey: SortKey,
  scoreById: Map<string, number>,
  chartTypeLabels: Record<string, string>
): FigureWithWork[] => {
  const sorted = [...figures];

  sorted.sort((a, b) => {
    if (sortKey === "relevance") {
      const scoreA = scoreById.get(a.id) ?? 0;
      const scoreB = scoreById.get(b.id) ?? 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }

    if (sortKey === "year") {
      const yearCompare = compareNumbers(a.workYear, b.workYear);
      if (yearCompare !== 0) {
        return yearCompare;
      }
    }

    if (sortKey === "type") {
      const labelA = chartTypeLabels[a.chartTypePrimary ?? ""] ?? a.chartTypePrimary;
      const labelB = chartTypeLabels[b.chartTypePrimary ?? ""] ?? b.chartTypePrimary;
      const typeCompare = compareStrings(labelA, labelB);
      if (typeCompare !== 0) {
        return typeCompare;
      }
    }

    if (sortKey === "work" || sortKey === "relevance") {
      const workCompare = compareStrings(a.workTitle ?? a.workId, b.workTitle ?? b.workId);
      if (workCompare !== 0) {
        return workCompare;
      }
    }

    return compareNumbers(a.page, b.page);
  });

  return sorted;
};
