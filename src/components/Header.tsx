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
        <input
          className="search-input"
          type="search"
          placeholder="Search Isotype designs . . ."
          value={query}
          onChange={handleChange}
          aria-label="Search charts"
        />
        <div className="header-description">
          A design archive of Isotype Institute
          <br />
          charts by RJ Andrews.
        </div>
        <button type="button" className="header-link" onClick={onAboutClick}>
          About
        </button>
      </div>
    </header>
  );
};

export default Header;
