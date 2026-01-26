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
          Isotype Explorer
        </button>
        <input
          className="search-input"
          type="search"
          placeholder="Search OCR text, themes, descriptions..."
          value={query}
          onChange={handleChange}
          aria-label="Search charts"
        />
        <button type="button" className="header-link" onClick={onAboutClick}>
          About
        </button>
      </div>
    </header>
  );
};

export default Header;
