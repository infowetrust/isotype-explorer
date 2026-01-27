import MiniSearch from "minisearch";
import type { FigureWithWork } from "./types";

export type SearchIndex = MiniSearch<FigureWithWork>;

export const buildSearchIndex = (figures: FigureWithWork[]): SearchIndex => {
  const miniSearch = new MiniSearch<FigureWithWork>({
    fields: ["ocrText", "aiDescription", "themes", "title", "workTitle", "types", "featuresFlat"],
    storeFields: ["id"],
    searchOptions: {
      boost: { title: 2, workTitle: 1.6, themes: 1.2 }
    }
  });

  miniSearch.addAll(figures);
  return miniSearch;
};

export const runSearch = (
  index: SearchIndex | null,
  query: string
): { ids: string[]; scoreById: Map<string, number> } => {
  if (!index || !query.trim()) {
    return { ids: [], scoreById: new Map() };
  }

  const results = index.search(query, { prefix: true });
  const scoreById = new Map<string, number>();
  const ids = results.map((result) => {
    scoreById.set(result.id as string, result.score);
    return result.id as string;
  });

  return { ids, scoreById };
};
