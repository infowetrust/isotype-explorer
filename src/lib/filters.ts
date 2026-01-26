import type { FigureWithWork } from "./types";

export type FiltersState = {
  selectedTypes: string[];
  selectedFeatures: string[];
  selectedColors: string[];
  onlyBlack: boolean;
  workId: string | null;
};

const hasAny = (source: string[], target: string[]): boolean =>
  source.some((item) => target.includes(item));

const hasAll = (source: string[], target: string[]): boolean =>
  target.every((item) => source.includes(item));

export const extractFeatures = (figure: FigureWithWork): string[] => {
  const raw: string[] = [];
  if (Array.isArray(figure.chartType)) {
    raw.push(...figure.chartType);
  } else if (typeof figure.chartType === "string") {
    raw.push(figure.chartType);
  }
  if (Array.isArray(figure.chartTypes)) {
    raw.push(...figure.chartTypes);
  }
  return raw.map((item) => item.trim()).filter(Boolean);
};

export const matchesFilters = (
  figure: FigureWithWork,
  filters: FiltersState
): boolean => {
  if (filters.workId && figure.workId !== filters.workId) {
    return false;
  }

  if (filters.selectedTypes.length > 0) {
    const primary = figure.chartTypePrimary ?? "";
    if (!filters.selectedTypes.includes(primary)) {
      return false;
    }
  }

  if (filters.selectedFeatures.length > 0) {
    const primary = figure.chartTypePrimary ?? "";
    const features = extractFeatures(figure).filter((item) => item !== primary);
    if (!hasAny(features, filters.selectedFeatures)) {
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
