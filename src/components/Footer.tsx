type FooterProps = {
  onTermsClick: () => void;
};

const Footer = ({ onTermsClick }: FooterProps) => (
  <footer className="footer">
    <div>
      Isotype Atlas v0.9 — RJ Andrews. Images presented for research and educational
      purposes under fair use/fair dealing. Photography and metadata © Andrews
      Collection of Information Graphics. No automated scraping or AI/ML training.{" "}
      <button type="button" className="footer-link" onClick={onTermsClick}>
        Terms
      </button>
      .
    </div>
  </footer>
);

export default Footer;
