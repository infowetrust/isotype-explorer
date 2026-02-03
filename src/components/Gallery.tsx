import { useEffect, useState } from "react";
import type { FigureWithWork } from "../lib/types";
import type { SortKey } from "../lib/sort";

const MOBILE_ROW_HEIGHT = 120;

type GalleryProps = {
  figures: FigureWithWork[];
  allFigures: FigureWithWork[];
  sortKey: SortKey;
  viewMode: "figures" | "publications";
  onSelect: (id: string) => void;
};

const Gallery = ({
  figures,
  allFigures,
  sortKey,
  viewMode,
  onSelect
}: GalleryProps) => {
  const [rowHeight, setRowHeight] = useState(() => {
    if (window.matchMedia("(max-width: 600px)").matches) {
      return MOBILE_ROW_HEIGHT;
    }
    return window.innerWidth < 700 ? 210 : 260;
  });
  const [isMobile, setIsMobile] = useState(
    window.matchMedia("(max-width: 600px)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const handleResize = () => {
      if (media.matches) {
        setRowHeight(MOBILE_ROW_HEIGHT);
      } else {
        setRowHeight(window.innerWidth < 700 ? 210 : 260);
      }
      setIsMobile(media.matches);
    };
    handleResize();
    media.addEventListener("change", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      media.removeEventListener("change", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (figures.length === 0) {
    return <div className="empty-state">No figures match this view.</div>;
  }

  if (viewMode === "publications") {
    const visibleIds = new Set(figures.map((figure) => figure.id));
    const visibleWorkIds = new Set(figures.map((figure) => figure.workId ?? "unknown"));
    const grouped = groupByWork(
      allFigures.filter((figure) => visibleWorkIds.has(figure.workId ?? "unknown"))
    );
    const rows = Array.from(grouped.entries())
      .map(([workId, items]) => {
        const sorted = sortFiguresByPage(items);
        const first = sorted[0];
        const visibleCount = sorted.reduce(
          (count, figure) => count + (visibleIds.has(figure.id) ? 1 : 0),
          0
        );
        return {
          workId,
          workTitle: first?.workTitle ?? "Unknown work",
          workYear: first?.workYear ?? null,
          figures: sorted,
          count: visibleCount
        };
      })
      .filter((row) => row.count > 0);

    if (sortKey === "random") {
      for (let i = rows.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    } else {
      rows.sort((a, b) => {
        if (sortKey === "oldest" || sortKey === "newest") {
          const yearA = a.workYear ?? Number.POSITIVE_INFINITY;
          const yearB = b.workYear ?? Number.POSITIVE_INFINITY;
          if (yearA !== yearB) {
            return sortKey === "newest" ? yearB - yearA : yearA - yearB;
          }
        }
        const diff = b.count - a.count;
        if (diff !== 0) {
          return diff;
        }
        return a.workTitle.localeCompare(b.workTitle);
      });
    }

    return (
      <div className="gallery-work-rows">
        {rows.map((row) => (
          <div key={row.workId} className="gallery-work-row">
            <div className="lightbox-carousel-title">
              <em>{row.workTitle}</em>
              {row.workYear ? ` (${row.workYear})` : ""}
            </div>
            <div className="lightbox-carousel-row">
              {row.figures.map((figure) => (
                <button
                  key={figure.id}
                  type="button"
                  className={`lightbox-thumb${visibleIds.has(figure.id) ? "" : " is-muted"
                    }`}
                  onClick={() => onSelect(figure.id)}
                >
                  <img
                    src={figure.thumb}
                    alt={figure.title ?? figure.workTitle ?? figure.id}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
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
            style={
              isMobile
                ? { height: rowHeight, width: "100%", maxWidth: "100%", objectFit: "contain" }
                : { height: rowHeight }
            }
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

const sortFiguresByPage = (figures: FigureWithWork[]): FigureWithWork[] => {
  const sorted = [...figures];
  sorted.sort((a, b) => a.id.localeCompare(b.id));
  return sorted;
};

const groupByWork = (figures: FigureWithWork[]): Map<string, FigureWithWork[]> => {
  const map = new Map<string, FigureWithWork[]>();
  figures.forEach((figure) => {
    const workId = figure.workId ?? "unknown";
    const existing = map.get(workId);
    if (existing) {
      existing.push(figure);
    } else {
      map.set(workId, [figure]);
    }
  });
  return map;
};
