import clsx from "clsx";
import type { ChartTypeConfig, ColorConfig, WorkRecord } from "../lib/types";
import type { SortKey } from "../lib/sort";

type FiltersBarProps = {
  chartTypes: ChartTypeConfig[];
  availableFeatures: string[];
  typeCounts: Record<string, number>;
  colors: ColorConfig[];
  colorCounts: Record<string, number>;
  works: WorkRecord[];
  selectedTypes: string[];
  selectedFeatures: string[];
  selectedColors: string[];
  onlyBlack: boolean;
  selectedWorkId: string | null;
  sortKey: SortKey;
  onToggleType: (id: string) => void;
  onToggleFeature: (id: string) => void;
  onClearFeatures: () => void;
  onToggleColor: (id: string) => void;
  onWorkChange: (id: string | null) => void;
  onSortChange: (sort: SortKey) => void;
};

const FiltersBar = ({
  chartTypes,
  availableFeatures,
  typeCounts,
  colors,
  colorCounts,
  works,
  selectedTypes,
  selectedFeatures,
  selectedColors,
  onlyBlack,
  selectedWorkId,
  sortKey,
  onToggleType,
  onToggleFeature,
  onClearFeatures,
  onToggleColor,
  onWorkChange,
  onSortChange
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
  return (
    <div className="filters-bar">
      <div className="filters-row filters-row-secondary">
        <div className="filter-group">
          <span className="filter-label">Type</span>
          {chartTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              className={clsx("chip", selectedTypes.includes(type.id) && "selected")}
              onClick={() => onToggleType(type.id)}
            >
              <span>{type.label}</span>
              <span className="chip-count">({typeCounts[type.id] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Colors</span>
          {colors.map((color) => {
            const isOnlyBlack = color.id === "only-black";
            const selected = isOnlyBlack ? onlyBlack : selectedColors.includes(color.id);
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
                  style={{ color: color.hex }}
                />
                <span className="chip-count">({colorCounts[color.id] ?? 0})</span>
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
        <div className="filter-group">
          <span className="filter-label">Sort</span>
          <select
            className="select"
            value={sortKey}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
          >
            <option value="relevance">Relevance</option>
            <option value="work">Source work</option>
            <option value="year">Year</option>
            <option value="type">Chart type</option>
          </select>
        </div>
      </div>
      <div className="filters-row">
        {hasFeatures ? (
          <div className="filter-group features-row">
            <span className="filter-label">Features</span>
            <div className="features-scroll">
              {availableFeatures.map((feature) => (
                <button
                  key={feature}
                  type="button"
                  className={clsx("chip", selectedFeatures.includes(feature) && "selected")}
                  onClick={() => onToggleFeature(feature)}
                >
                  <span>{feature}</span>
                </button>
              ))}
            </div>
            {selectedFeatures.length > 0 ? (
              <button type="button" className="features-clear" onClick={onClearFeatures}>
                Clear
              </button>
            ) : null}
          </div>
        ) : showFeatures ? (
          <div className="filter-helper">No feature refinements available for this type.</div>
        ) : helperText ? (
          <div className="filter-helper">{helperText}</div>
        ) : null}
      </div>
    </div>
  );
};

export default FiltersBar;
