import type { ChangeEvent } from "react";

type HeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onAboutClick: () => void;
  onFiltersClick: () => void;
  filtersOpen: boolean;
  activeFilterCount: number;
  gridCount: string;
};

const Header = ({
  query,
  onQueryChange,
  onAboutClick,
  onFiltersClick,
  filtersOpen,
  activeFilterCount,
  gridCount
}: HeaderProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  return (
    <header className="header">
      <div className="header-row">
        <input
          className="search-input"
          type="search"
          placeholder="Search Isotype designs . . ."
          value={query}
          onChange={handleChange}
          aria-label="Search charts"
        />
        <div className="header-description-row">
          <div className="header-description">
            A design archive of Isotype Institute
            <br className="header-description-break" />
            charts by RJ Andrews.
          </div>
          <button
            type="button"
            className="header-link header-link-mobile"
            onClick={onAboutClick}
          >
            About
          </button>
        </div>
        <div className="header-actions">
          <div className="header-count">{gridCount}</div>
          <button
            type="button"
            className="header-link header-link-desktop"
            onClick={onAboutClick}
          >
            About
          </button>
          <button
            type="button"
            className="header-filters"
            onClick={onFiltersClick}
            aria-expanded={filtersOpen}
            aria-label="Toggle filters panel"
          >
            <span className="hamburger-icon" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="header-filter-count">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
