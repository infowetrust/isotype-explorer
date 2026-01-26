import { useEffect } from "react";
import type { ChartTypeConfig, ColorConfig, FigureWithWork, WorkRecord } from "../lib/types";

type LightboxProps = {
  figure: FigureWithWork | null;
  work: WorkRecord | undefined;
  chartTypes: ChartTypeConfig[];
  colors: ColorConfig[];
  onClose: () => void;
};

const Lightbox = ({ figure, work, chartTypes, colors, onClose }: LightboxProps) => {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!figure) {
    return null;
  }

  const chartTypeLabels = new Map(chartTypes.map((type) => [type.id, type.label]));
  const colorLabels = new Map(colors.map((color) => [color.id, color.label]));

  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <button type="button" className="lightbox-close" onClick={onClose}>
        Close
      </button>
      <div className="lightbox-inner">
        <div className="lightbox-media">
          <img src={figure.view} alt={figure.title ?? figure.id} />
        </div>
        <div className="lightbox-meta">
          <h2 className="lightbox-title">
            {figure.title ?? work?.title ?? "Untitled figure"}
          </h2>
          <div className="meta-section">
            <strong>Work</strong>
            <span>
              {work?.title ?? figure.workTitle ?? "Unknown work"}
              {work?.year ? ` (${work.year})` : ""}
            </span>
            {work?.authors?.length ? <span>{work.authors.join(", ")}</span> : null}
            {work?.publisher ? (
              <span>
                {work.publisher}
                {work.publisherCity ? `, ${work.publisherCity}` : ""}
              </span>
            ) : null}
          </div>
          <div className="meta-section">
            <strong>Chart types</strong>
            <div className="meta-chips">
              {(figure.chartTypes ?? []).map((type) => (
                <span key={type} className="meta-chip">
                  {chartTypeLabels.get(type) ?? type}
                </span>
              ))}
            </div>
          </div>
          <div className="meta-section">
            <strong>Colors</strong>
            <div className="meta-chips">
              {figure.onlyBlack ? (
                <span className="meta-chip">Only black</span>
              ) : (
                (figure.colors ?? []).map((color) => (
                  <span key={color} className="meta-chip">
                    {colorLabels.get(color) ?? color}
                  </span>
                ))
              )}
            </div>
          </div>
          {figure.themes?.length ? (
            <div className="meta-section">
              <strong>Themes</strong>
              <span>{figure.themes.join(", ")}</span>
            </div>
          ) : null}
          {figure.aiDescription ? (
            <div className="meta-section">
              <strong>AI description</strong>
              <span>{figure.aiDescription}</span>
            </div>
          ) : null}
          {figure.ocrText ? (
            <div className="meta-section">
              <strong>OCR text</strong>
              <div className="ocr-box">{figure.ocrText}</div>
            </div>
          ) : null}
          <div className="meta-section">
            <strong>Downloads</strong>
            <div className="meta-chips">
              <a className="meta-chip" href={figure.thumb} download>
                Thumbnail
              </a>
              <a className="meta-chip" href={figure.view} download>
                Full view
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;
