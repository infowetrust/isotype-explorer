import type { FigureWithWork } from "./types";

export type FiltersState = {
  selectedTypes: string[];
  selectedColors: string[];
  onlyBlack: boolean;
  workId: string | null;
};

const hasAny = (source: string[], target: string[]): boolean =>
  source.some((item) => target.includes(item));

const hasAll = (source: string[], target: string[]): boolean =>
  target.every((item) => source.includes(item));

export const matchesFilters = (
  figure: FigureWithWork,
  filters: FiltersState
): boolean => {
  if (filters.workId && figure.workId !== filters.workId) {
    return false;
  }

  if (filters.selectedTypes.length > 0) {
    if (!hasAny(figure.chartTypes ?? [], filters.selectedTypes)) {
      return false;
    }
  }

  if (filters.onlyBlack) {
    return figure.onlyBlack === true;
  }

  if (filters.selectedColors.length > 0) {
    if (!hasAll(figure.colors ?? [], filters.selectedColors)) {
      return false;
    }
  }

  return true;
};
