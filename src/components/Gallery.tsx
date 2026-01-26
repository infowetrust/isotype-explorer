import { useEffect, useState } from "react";
import type { FigureWithWork } from "../lib/types";

type GalleryProps = {
  figures: FigureWithWork[];
  onSelect: (id: string) => void;
};

const Gallery = ({ figures, onSelect }: GalleryProps) => {
  const [rowHeight, setRowHeight] = useState(
    window.innerWidth < 700 ? 210 : 260
  );

  useEffect(() => {
    const handleResize = () => {
      setRowHeight(window.innerWidth < 700 ? 210 : 260);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (figures.length === 0) {
    return <div className="empty-state">No figures match this view.</div>;
  }

  return (
    <div className="gallery-grid">
      {figures.map((figure) => (
        <button
          key={figure.id}
          type="button"
          className="gallery-item"
          onClick={() => onSelect(figure.id)}
        >
          <img
            src={figure.thumb}
            alt={figure.title ?? figure.workTitle ?? figure.id}
            loading="lazy"
            style={{ height: rowHeight }}
          />
          <div className="gallery-overlay">
            <div className="gallery-overlay-title">
              {figure.title ?? "Untitled figure"}
            </div>
            <div className="gallery-overlay-work">
              {figure.workTitle ?? "Unknown work"}
            </div>
            <div className="gallery-overlay-year">
              {figure.workYear ?? ""}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default Gallery;
