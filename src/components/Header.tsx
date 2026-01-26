import type { ChangeEvent } from "react";

type HeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onAboutClick: () => void;
};

const Header = ({ query, onQueryChange, onReset, onAboutClick }: HeaderProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  return (
    <header className="header">
      <div className="header-row">
        <button type="button" className="brand" onClick={onReset}>
          Isotype Atlas
        </button>
        <input
          className="search-input"
          type="search"
          placeholder="Search chart titles, descriptions, publications..."
          value={query}
          onChange={handleChange}
          aria-label="Search charts"
        />
        <div className="header-description">
          A photographic archive of Isotype Institute charts from the Andrews Collection of Information Graphics.
        </div>
        <button type="button" className="header-link" onClick={onAboutClick}>
          About
        </button>
      </div>
    </header>
  );
};

export default Header;
