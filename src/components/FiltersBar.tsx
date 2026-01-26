import clsx from "clsx";
import type { ChartTypeConfig, ColorConfig, WorkRecord } from "../lib/types";
import type { SortKey } from "../lib/sort";

type FiltersBarProps = {
  chartTypes: ChartTypeConfig[];
  availableFeatures: string[];
  colors: ColorConfig[];
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
  colors,
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
  return (
    <div className="filters-bar">
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
          </button>
        ))}
        <span className="filter-helper">Select a type to see feature refinements.</span>
      </div>
      {showFeatures ? (
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
      ) : null}
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
            </button>
          );
        })}
      </div>
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
  );
};

export default FiltersBar;
