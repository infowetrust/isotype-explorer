import clsx from "clsx";
import type { ChartTypeConfig, ColorConfig, FeatureConfig } from "../lib/types";
import type { SortKey } from "../lib/sort";

type FiltersBarProps = {
  chartTypes: ChartTypeConfig[];
  availableFeatures: FeatureConfig[];
  typeCounts: Record<string, number>;
  typeSortCounts: Record<string, number>;
  colors: ColorConfig[];
  colorCounts: Record<string, number>;
  colorSortCounts: Record<string, number>;
  selectedTypes: string[];
  selectedFeatures: string[];
  selectedColors: string[];
  onlyBlack: boolean;
  sortKey: SortKey;
  hasQuery: boolean;
  viewMode: "figures" | "publications";
  viewCounts: { figures: number; publications: number };
  hideView?: boolean;
  onToggleType: (id: string) => void;
  onToggleFeature: (id: string) => void;
  onToggleColor: (id: string) => void;
  onSortChange: (sort: SortKey) => void;
  onViewChange: (view: "figures" | "publications") => void;
  onClearAll: () => void;
};

const toSentenceCase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  return lower[0].toUpperCase() + lower.slice(1);
};

const PROCESS_COLOR_ID = "process";
const ONLY_BLACK_ID = "only-black";

const FiltersBar = ({
  chartTypes,
  availableFeatures,
  typeCounts,
  typeSortCounts,
  colors,
  colorCounts,
  colorSortCounts,
  selectedTypes,
  selectedFeatures,
  selectedColors,
  onlyBlack,
  sortKey,
  hasQuery,
  viewMode,
  viewCounts,
  hideView,
  onToggleType,
  onToggleFeature,
  onToggleColor,
  onSortChange,
  onViewChange,
  onClearAll
}: FiltersBarProps) => {
  const selectedBaseTypes = selectedTypes.filter((type) => type !== "combo");
  const showFeatures = selectedBaseTypes.length === 1;
  const helperText =
    selectedBaseTypes.length === 0
      ? "Select a type to see feature refinements."
      : selectedBaseTypes.length > 1
        ? "Select a single type to see feature refinements."
        : "";
  const hasFeatures = showFeatures && availableFeatures.length > 0;
  const sortedChartTypes = [...chartTypes].sort((a, b) => {
    if (a.id === "combo") {
      return 1;
    }
    if (b.id === "combo") {
      return -1;
    }
    const diff = (typeSortCounts[b.id] ?? 0) - (typeSortCounts[a.id] ?? 0);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
  const shortTypeLabel = (value: string) =>
    value.replace(/\s*chart$/i, "");
  const sortedColors = [...colors].sort((a, b) => {
    if (a.id === PROCESS_COLOR_ID) {
      return 1;
    }
    if (b.id === PROCESS_COLOR_ID) {
      return -1;
    }
    if (a.id === ONLY_BLACK_ID) {
      return 1;
    }
    if (b.id === ONLY_BLACK_ID) {
      return -1;
    }
    const diff = (colorSortCounts[b.id] ?? 0) - (colorSortCounts[a.id] ?? 0);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
  return (
    <div className="filters-bar">
      <div className="filters-row filters-row-secondary">
        <div className="filter-group type-group">
          <span className="filter-label">Type</span>
          {sortedChartTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              className={clsx(
                "chip",
                "chip-type",
                selectedTypes.includes(type.id) && "selected"
              )}
              onClick={() => onToggleType(type.id)}
              disabled={(typeCounts[type.id] ?? 0) === 0}
              aria-disabled={(typeCounts[type.id] ?? 0) === 0}
            >
              <span className="chip-label">{shortTypeLabel(type.label)}</span>
              {selectedTypes.includes(type.id) ? null : (
                <sup className="chip-count">
                  <span className="count-num">
                    {selectedTypes.length > 0 ? "+" : ""}
                    {typeCounts[type.id] ?? 0}
                  </span>
                </sup>
              )}
            </button>
          ))}
        </div>
        <div className="filter-group colors-group">
          <span className="filter-label">Colors</span>
          {sortedColors.map((color) => {
            const isOnlyBlack = color.id === ONLY_BLACK_ID;
            const isProcessMode = color.id === PROCESS_COLOR_ID;
            const selected = isOnlyBlack ? onlyBlack : selectedColors.includes(color.id);
            const count = colorCounts[color.id] ?? 0;
            const isDisabled = count === 0;
            return (
              <button
                key={color.id}
                type="button"
                className={clsx("color-chip", selected && "selected")}
                onClick={() => onToggleColor(color.id)}
                aria-label={color.label}
                disabled={isDisabled}
                aria-disabled={isDisabled}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "color-chip-dot",
                    isProcessMode && "color-chip-dot-process"
                  )}
                  style={
                    isProcessMode
                      ? undefined
                      : { ["--chip-color" as string]: color.hex }
                  }
                >
                  {selected ? null : <span className="count-num">{count}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="filters-row filters-row-features">
        {hasFeatures ? (
          <div className="filter-group features-row">
            <span className="filter-label">Features</span>
            <div className="features-scroll">
              {availableFeatures.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  className={clsx(
                    "chip",
                    "chip-feature",
                    selectedFeatures.includes(feature.id) && "selected"
                  )}
                  onClick={() => onToggleFeature(feature.id)}
                >
                  <span>{toSentenceCase(feature.label)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : showFeatures ? (
          <div className="filter-group">
            <span className="filter-label">Features</span>
            <div className="filter-helper">
              No feature refinements available for this type.
            </div>
          </div>
        ) : helperText ? (
          <div className="filter-group">
            <span className="filter-label">Features</span>
            <div className="filter-helper">{helperText}</div>
          </div>
        ) : null}
      </div>
      <div className="filters-row filters-row-spacer" aria-hidden="true" />
      <div className="filters-row filters-row-tertiary">
        {hideView ? null : (
          <div className="filter-group">
            <span className="filter-label">View</span>
            {(["figures", "publications"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  "chip",
                  viewMode === value && "selected",
                  "chip-compact",
                  "chip-sup"
                )}
                onClick={() => onViewChange(value)}
              >
                <span>{value === "figures" ? "Figures" : "Publications"}</span>
                <sup className="chip-count">
                  <span className="count-num">
                    {value === "figures"
                      ? viewCounts.figures
                      : viewCounts.publications}
                  </span>
                </sup>
              </button>
            ))}
            <button
              type="button"
              className={clsx("chip", "chip-compact", "chip-clear")}
              onClick={onClearAll}
            >
              <span>Clear filters</span>
            </button>
          </div>
        )}
        <div className="filter-group">
          <span className="filter-label">Sort</span>
          {(hasQuery
            ? (["relevance", "oldest", "newest", "random"] as SortKey[])
            : (["oldest", "newest", "random"] as SortKey[])).map((value) => (
            <button
              key={value}
              type="button"
              className={clsx("chip", sortKey === value && "selected", "chip-compact")}
              onClick={() => onSortChange(value)}
            >
              <span>
                {value === "relevance"
                  ? "Relevance"
                  : value === "oldest"
                    ? "Oldest"
                    : value === "newest"
                      ? "Newest"
                      : "Random"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FiltersBar;
