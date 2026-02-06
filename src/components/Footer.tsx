type FooterProps = {
  onTermsClick: () => void;
};

const Footer = ({ onTermsClick }: FooterProps) => (
  <footer className="footer">
    <div className="footer-inner">
      <a
        className="footer-mark"
        href="https://infowetrust.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="Info We Trust"
      >
        <img
          src="/InfoWeTrust-BigCaslon-black.svg"
          alt="Info We Trust"
          loading="lazy"
        />
      </a>
      <div className="footer-text">
        Isotype Atlas v0.9 — RJ Andrews. Images presented for research and educational
        purposes under fair use/fair dealing. Photography and metadata © Andrews
        Collection of Information Graphics. No automated scraping or AI/ML training.{" "}
        <button type="button" className="footer-link" onClick={onTermsClick}>
          Terms
        </button>
        .
      </div>
    </div>
  </footer>
);

export default Footer;
