import type { ChartTypeConfig, ColorConfig, FeatureConfig, FigureWithWork, WorkRecord } from "./types";
import { extractFeatures } from "./filters";

type AdvancedFilters = {
  colors: string[];
  types: string[];
  features: string[];
  workIds: string[];
  years: number[];
  series: string[];
};

export type AdvancedQuery = {
  text: string;
  filters: AdvancedFilters;
  hasFilters: boolean;
};

type AdvancedQueryContext = {
  colors: ColorConfig[];
  chartTypes: ChartTypeConfig[];
  features: FeatureConfig[];
  works: WorkRecord[];
};

const SUPPORTED_KEYS = new Set(["color", "type", "work", "year", "feature", "series"]);

const slugify = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned;
};

const normalizeMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (query: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (const ch of query) {
    if (ch === "\"") {
      inQuote = !inQuote;
      continue;
    }
    if (/\s/.test(ch) && !inQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

const splitValues = (raw: string): string[] =>
  raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const buildLabelMap = (
  items: Array<{ id: string; label?: string }>
): Map<string, string> => {
  const map = new Map<string, string>();
  items.forEach((item) => {
    map.set(item.id.toLowerCase(), item.id);
    if (item.label) {
      map.set(item.label.toLowerCase(), item.id);
      map.set(slugify(item.label), item.id);
    }
  });
  return map;
};

const normalizeWorkId = (raw: string): string => {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    return "";
  }
  if (/^w\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^w\d+$/.test(cleaned)) {
    return `w${cleaned.slice(1).padStart(4, "0")}`;
  }
  if (/^\d+$/.test(cleaned)) {
    return `w${cleaned.padStart(4, "0")}`;
  }
  return cleaned;
};

const resolveWorkIds = (value: string, works: WorkRecord[]): string[] => {
  const normalized = normalizeWorkId(value);
  if (normalized && /^w\d{4}$/.test(normalized)) {
    return [normalized];
  }

  const matchValue = normalizeMatch(value);
  if (!matchValue) {
    return [];
  }

  return works
    .filter((work) => {
      const title = normalizeMatch(work.title);
      const series = normalizeMatch(work.series ?? "");
      return (
        (title && title.includes(matchValue)) ||
        (series && series.includes(matchValue))
      );
    })
    .map((work) => work.workId);
};

export const parseAdvancedQuery = (
  query: string,
  context: AdvancedQueryContext
): AdvancedQuery => {
  const tokens = tokenize(query);
  const textTokens: string[] = [];

  const filters: AdvancedFilters = {
    colors: [],
    types: [],
    features: [],
    workIds: [],
    years: [],
    series: []
  };

  const colorMap = buildLabelMap(context.colors);
  const typeMap = buildLabelMap(context.chartTypes);
  const featureMap = buildLabelMap(context.features);

  tokens.forEach((token) => {
    const colonIndex = token.indexOf(":");
    if (colonIndex <= 0) {
      textTokens.push(token);
      return;
    }
    const key = token.slice(0, colonIndex).toLowerCase();
    if (!SUPPORTED_KEYS.has(key)) {
      textTokens.push(token);
      return;
    }
    const rawValue = token.slice(colonIndex + 1);
    if (!rawValue) {
      return;
    }

    const values = splitValues(rawValue);
    if (values.length === 0) {
      return;
    }

    if (key === "color") {
      values.forEach((value) => {
        const normalized = value.toLowerCase();
        if (normalized === "black" || normalized === "only black") {
          filters.colors.push("only-black");
          return;
        }
        const match = colorMap.get(normalized) ?? colorMap.get(slugify(value));
        filters.colors.push(match ?? slugify(value));
      });
      return;
    }

    if (key === "type") {
      values.forEach((value) => {
        const match = typeMap.get(value.toLowerCase()) ?? typeMap.get(slugify(value));
        filters.types.push(match ?? slugify(value));
      });
      return;
    }

    if (key === "feature") {
      values.forEach((value) => {
        const match =
          featureMap.get(value.toLowerCase()) ?? featureMap.get(slugify(value));
        filters.features.push(match ?? slugify(value));
      });
      return;
    }

    if (key === "work") {
      values.forEach((value) => {
        resolveWorkIds(value, context.works).forEach((workId) => {
          filters.workIds.push(workId);
        });
      });
      return;
    }

    if (key === "year") {
      values.forEach((value) => {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          filters.years.push(parsed);
        }
      });
      return;
    }

    if (key === "series") {
      values.forEach((value) => {
        const normalized = normalizeMatch(value);
        if (normalized) {
          filters.series.push(normalized);
        }
      });
    }
  });

  const dedupe = <T,>(list: T[]): T[] => Array.from(new Set(list));
  filters.colors = dedupe(filters.colors);
  filters.types = dedupe(filters.types);
  filters.features = dedupe(filters.features);
  filters.workIds = dedupe(filters.workIds);
  filters.years = dedupe(filters.years);
  filters.series = dedupe(filters.series);

  const hasFilters = Object.values(filters).some((list) => list.length > 0);

  return {
    text: textTokens.join(" "),
    filters,
    hasFilters
  };
};

export const matchesAdvancedFilters = (
  figure: FigureWithWork,
  filters: AdvancedFilters
): boolean => {
  if (filters.workIds.length > 0 && !filters.workIds.includes(figure.workId)) {
    return false;
  }

  if (
    filters.years.length > 0 &&
    (!figure.workYear || !filters.years.includes(figure.workYear))
  ) {
    return false;
  }

  if (filters.series.length > 0) {
    const series = normalizeMatch(figure.workSeries ?? "");
    if (!filters.series.some((value) => series.includes(value))) {
      return false;
    }
  }

  if (filters.types.length > 0) {
    const types = Array.isArray(figure.types) ? figure.types : [];
    const wantsCombo = filters.types.includes("combo");
    const baseTypes = filters.types.filter((type) => type !== "combo");
    const matchesBase = baseTypes.length
      ? baseTypes.some((type) => types.includes(type))
      : true;
    const matchesCombo = wantsCombo ? figure.isCombo === true : true;
    if (!matchesBase || !matchesCombo) {
      return false;
    }
  }

  if (filters.features.length > 0) {
    const features = extractFeatures(figure);
    if (!filters.features.some((feature) => features.includes(feature))) {
      return false;
    }
  }

  if (filters.colors.length > 0) {
    const wantsOnlyBlack = filters.colors.includes("only-black");
    const baseColors = filters.colors.filter((color) => color !== "only-black");
    const matchesColors = baseColors.length
      ? baseColors.some((color) => (figure.colors ?? []).includes(color))
      : true;
    const matchesBlack = wantsOnlyBlack ? figure.onlyBlack === true : true;
    if (!matchesColors || !matchesBlack) {
      return false;
    }
  }

  return true;
};
