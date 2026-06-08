import MiniSearch from "minisearch";
import type { FigureWithWork } from "./types";

export type SearchIndex = MiniSearch<FigureWithWork>;

const SPELLING_MAP: Array<[string, string]> = [
  ["colour", "color"],
  ["labour", "labor"],
  ["centre", "center"],
  ["organisation", "organization"],
  ["organise", "organize"],
  ["programme", "program"],
  ["defence", "defense"],
  ["theatre", "theater"],
  ["grey", "gray"],
  ["travelled", "traveled"],
  ["analyse", "analyze"]
];

const expandQuery = (query: string): string[] => {
  const base = query.trim();
  if (!base) {
    return [];
  }
  const lower = base.toLowerCase();
  const variants = new Set<string>([base]);

  SPELLING_MAP.forEach(([british, american]) => {
    const hasBritish = lower.includes(british);
    const hasAmerican = lower.includes(american);
    if (hasBritish) {
      variants.add(base.replace(new RegExp(british, "gi"), american));
    }
    if (hasAmerican) {
      variants.add(base.replace(new RegExp(american, "gi"), british));
    }
  });

  return Array.from(variants);
};

const stringifyField = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

export const buildSearchIndex = (figures: FigureWithWork[]): SearchIndex => {
  const miniSearch = new MiniSearch<FigureWithWork>({
    fields: [
      "id",
      "workId",
      "workYear",
      "workAuthors",
      "workPublisher",
      "workPublisherCity",
      "workSeries",
      "ocrText",
      "originalCaption",
      "aiDescription",
      "themes",
      "title",
      "workTitle",
      "types",
      "featuresFlat"
    ],
    extractField: (figure, fieldName) =>
      stringifyField(figure[fieldName as keyof FigureWithWork]),
    storeFields: ["id"],
    searchOptions: {
      boost: {
        id: 2.4,
        workId: 2,
        title: 2,
        workTitle: 1.6,
        workYear: 1.4,
        workAuthors: 1.3,
        workSeries: 1.3,
        themes: 1.2
      }
    }
  });

  miniSearch.addAll(figures);
  return miniSearch;
};

export const runSearch = (
  index: SearchIndex | null,
  query: string
): { ids: string[]; scoreById: Map<string, number> } => {
  const variants = expandQuery(query);
  if (!index || variants.length === 0) {
    return { ids: [], scoreById: new Map() };
  }

  const scoreById = new Map<string, number>();
  variants.forEach((variant) => {
    const results = index.search(variant, { prefix: true });
    results.forEach((result) => {
      const id = result.id as string;
      const prev = scoreById.get(id) ?? 0;
      scoreById.set(id, Math.max(prev, result.score));
    });
  });

  const ids = Array.from(scoreById.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return { ids, scoreById };
};
