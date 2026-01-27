import clsx from "clsx";
import type {
  ChartTypeConfig,
  ColorConfig,
  FeatureConfig,
  WorkRecord
} from "../lib/types";
import type { SortKey } from "../lib/sort";

type FiltersBarProps = {
  chartTypes: ChartTypeConfig[];
  availableFeatures: FeatureConfig[];
  typeCounts: Record<string, number>;
  typeSortCounts: Record<string, number>;
  colors: ColorConfig[];
  colorCounts: Record<string, number>;
  colorSortCounts: Record<string, number>;
  works: WorkRecord[];
  selectedTypes: string[];
  selectedFeatures: string[];
  selectedColors: string[];
  onlyBlack: boolean;
  selectedWorkId: string | null;
  sortKey: SortKey;
  viewMode: "figures" | "publications";
  viewCounts: { figures: number; publications: number };
  onToggleType: (id: string) => void;
  onToggleFeature: (id: string) => void;
  onClearFeatures: () => void;
  onToggleColor: (id: string) => void;
  onWorkChange: (id: string | null) => void;
  onSortChange: (sort: SortKey) => void;
  onViewChange: (view: "figures" | "publications") => void;
  onClearAll: () => void;
};

const FiltersBar = ({
  chartTypes,
  availableFeatures,
  typeCounts,
  typeSortCounts,
  colors,
  colorCounts,
  colorSortCounts,
  works,
  selectedTypes,
  selectedFeatures,
  selectedColors,
  onlyBlack,
  selectedWorkId,
  sortKey,
  viewMode,
  viewCounts,
  onToggleType,
  onToggleFeature,
  onClearFeatures,
  onToggleColor,
  onWorkChange,
  onSortChange,
  onViewChange,
  onClearAll
}: FiltersBarProps) => {
  const showFeatures = selectedTypes.length === 1;
  const showWork = false;
  const helperText =
    selectedTypes.length === 0
      ? "Select a type to see feature refinements."
      : selectedTypes.length > 1
        ? "Select a single type to see feature refinements."
        : "";
  const hasFeatures = showFeatures && availableFeatures.length > 0;
  const sortedChartTypes = [...chartTypes].sort((a, b) => {
    const diff = (typeSortCounts[b.id] ?? 0) - (typeSortCounts[a.id] ?? 0);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
  const sortedColors = [...colors].sort((a, b) => {
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
            >
              <span className="chip-label">{type.label}</span>
              <sup className="chip-count">
                <span className="count-num">{typeCounts[type.id] ?? 0}</span>
              </sup>
            </button>
          ))}
        </div>
        <div className="filter-group colors-group">
          <span className="filter-label">Colors</span>
          {sortedColors.map((color) => {
            const isOnlyBlack = color.id === "only-black";
            const selected = isOnlyBlack ? onlyBlack : selectedColors.includes(color.id);
            const count = colorCounts[color.id] ?? 0;
            return (
              <button
                key={color.id}
                type="button"
                className={clsx("color-chip", selected && "selected")}
                onClick={() => onToggleColor(color.id)}
                aria-label={color.label}
              >
                <span
                  aria-hidden="true"
                  className="color-chip-dot"
                  style={{ ["--chip-color" as string]: color.hex }}
                >
                  <span className="count-num">{count}</span>
                </span>
              </button>
            );
          })}
        </div>
        {showWork ? (
          <div className="filter-group">
            <span className="filter-label">Work</span>
            <select
              className="select"
              value={selectedWorkId ?? ""}
              onChange={(event) => onWorkChange(event.target.value || null)}
            >
              <option value="">All works</option>
              {works.map((work) => (
                <option key={work.workId} value={work.workId}>
                  {work.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
                  <span>{feature.label}</span>
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
            className={clsx("chip", "chip-compact")}
            onClick={onClearAll}
          >
            <span>Clear filters</span>
          </button>
        </div>
        <div className="filter-group">
          <span className="filter-label">Sort</span>
          {(["relevance", "oldest", "newest"] as const).map((value) => (
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
                    : "Newest"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FiltersBar;
