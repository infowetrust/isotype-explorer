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
  if (Array.isArray(figure.featuresFlat)) {
    raw.push(...figure.featuresFlat);
  }
  return raw.map((item) => item.trim()).filter(Boolean);
};

const getSelectedBaseTypes = (selectedTypes: string[]): string[] =>
  selectedTypes.filter((type) => type !== "combo");

export const matchesFilters = (
  figure: FigureWithWork,
  filters: FiltersState
): boolean => {
  if (filters.workId && figure.workId !== filters.workId) {
    return false;
  }

  if (filters.selectedTypes.length > 0) {
    const types = Array.isArray(figure.types) ? figure.types : [];
    const baseTypes = getSelectedBaseTypes(filters.selectedTypes);
    const wantsCombo = filters.selectedTypes.includes("combo");
    const matchesBase = baseTypes.length ? hasAny(types, baseTypes) : true;
    const matchesCombo = wantsCombo ? figure.isCombo === true : true;
    if (!matchesBase || !matchesCombo) {
      return false;
    }
  }

  if (filters.selectedFeatures.length > 0) {
    const baseTypes = getSelectedBaseTypes(filters.selectedTypes);
    const selectedType = baseTypes.length === 1 ? baseTypes[0] : null;
    if (!selectedType) {
      return false;
    }
    const byType = figure.featuresByType ?? {};
    const features = byType[selectedType] ?? [];
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
