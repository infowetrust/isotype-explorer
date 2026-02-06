import type { FigureWithWork } from "./types";

export type SortKey = "relevance" | "oldest" | "newest" | "random";

const createSeededRandom = (seed: number) => {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
};

export const seededShuffle = <T>(items: T[], seed: number): T[] => {
  const shuffled = [...items];
  const random = createSeededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const compareStrings = (a?: string, b?: string): number =>
  (a ?? "").localeCompare(b ?? "");

const compareNumbers = (a?: number, b?: number): number =>
  (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);

export const sortFigures = (
  figures: FigureWithWork[],
  sortKey: SortKey,
  scoreById: Map<string, number>,
  randomSeed?: number
): FigureWithWork[] => {
  const sorted = [...figures];

  if (sortKey === "random") {
    return seededShuffle(sorted, typeof randomSeed === "number" ? randomSeed : Date.now());
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
