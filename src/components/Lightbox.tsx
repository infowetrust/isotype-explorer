import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  ChartTypeConfig,
  ColorConfig,
  FeatureConfig,
  FigureWithWork,
  WorkRecord
} from "../lib/types";

type LightboxProps = {
  figure: FigureWithWork | null;
  work: WorkRecord | undefined;
  figuresInWork: FigureWithWork[];
  chartTypes: ChartTypeConfig[];
  features: FeatureConfig[];
  colors: ColorConfig[];
  onClose: () => void;
  onSelect: (id: string) => void;
};

const Lightbox = ({
  figure,
  work,
  figuresInWork,
  chartTypes,
  features,
  colors,
  onClose,
  onSelect
}: LightboxProps) => {
  const [copied, setCopied] = useState(false);
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(
    window.matchMedia("(max-width: 600px)").matches
  );
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const sortedFigures = useMemo(
    () => sortFiguresByPage(figuresInWork),
    [figuresInWork]
  );

  useEffect(() => {
    setIsFullLoaded(false);
  }, [figure?.view]);

  useEffect(() => {
    if (!isFullLoaded || !figure) {
      return;
    }
    const next = getSiblingFigure(sortedFigures, figure.id, 1);
    const prev = getSiblingFigure(sortedFigures, figure.id, -1);
    [next?.view, prev?.view].filter(Boolean).forEach((src) => {
      const img = new Image();
      img.src = src as string;
    });
  }, [figure, isFullLoaded, sortedFigures]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const handleResize = () => {
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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        const prev = getSiblingFigure(sortedFigures, figure?.id ?? "", -1);
        if (prev) {
          onSelect(prev.id);
        }
      }
      if (event.key === "ArrowRight") {
        const next = getSiblingFigure(sortedFigures, figure?.id ?? "", 1);
        if (next) {
          onSelect(next.id);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [figure?.id, onClose, onSelect, sortedFigures]);

  useEffect(() => {
    if (!activeThumbRef.current) {
      return;
    }
    activeThumbRef.current.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "center"
    });
  }, [figure?.id, sortedFigures]);

  if (!figure) {
    return null;
  }

  const chartTypeLabels = useMemo(
    () => new Map(chartTypes.map((type) => [type.id, type.label])),
    [chartTypes]
  );
  const featureLabels = useMemo(
    () => new Map(features.map((feature) => [feature.id, feature.label])),
    [features]
  );
  const colorLabels = useMemo(
    () => new Map(colors.map((color) => [color.id, color.label])),
    [colors]
  );

  const figureTitle = figure.title?.trim() ? figure.title : figure.id;
  const yearLine = work?.year ? String(work.year) : null;
  const attribution = buildAttribution(work);
  const typeLabelList = Array.from(new Set(normalizeTypes(figure))).map((type) =>
    toTitleCase(chartTypeLabels.get(type) ?? type)
  );
  const featureLabelList = buildFeatureLabelLines(
    figure,
    featureLabels,
    chartTypeLabels
  ).map((line) => toTitleCase(line));
  const colorsLabel = figure.onlyBlack
    ? "Only black"
    : (figure.colors ?? []).map((color) => colorLabels.get(color) ?? color);
  const prevFigure = getSiblingFigure(sortedFigures, figure.id, -1);
  const nextFigure = getSiblingFigure(sortedFigures, figure.id, 1);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox-inner" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="lightbox-meta">
          <div className="lightbox-heading">
            <div>
              <h2 className="lightbox-title">{figureTitle}</h2>
              {yearLine ? <div className="lightbox-year">{yearLine}</div> : null}
            </div>
          </div>
          {isMobile ? (
            <details className="lightbox-meta-details" open>
              <summary>Details</summary>
              {attribution ? <div className="lightbox-attribution">{attribution}</div> : null}
              <div className="meta-table">
                <div className="meta-label">Figure Type</div>
                <div className="meta-value">
                  {typeLabelList.length ? typeLabelList.join(", ") : "Unknown"}
                </div>
                <div className="meta-label">Features</div>
                <div className="meta-value">
                  {featureLabelList.length ? (
                    featureLabelList.map((line) => <div key={line}>{line}</div>)
                  ) : (
                    "None"
                  )}
                </div>
                {figure.onlyBlack || (figure.colors?.length ?? 0) > 0 ? (
                  <>
                    <div className="meta-label">Colors</div>
                    <div className="meta-value">
                      {Array.isArray(colorsLabel) ? colorsLabel.join(", ") : colorsLabel}
                    </div>
                  </>
                ) : null}
              </div>
              {figure.themes?.length ? (
                <div className="meta-block">
                  <div className="meta-label">Themes</div>
                  <div className="meta-value">{figure.themes.join(", ")}</div>
                </div>
              ) : null}
              {figure.aiDescription ? (
                <div className="meta-block">
                  <div className="meta-label">AI description</div>
                  <div className="meta-value">{figure.aiDescription}</div>
                </div>
              ) : null}
              <div className="lightbox-actions">
              <button type="button" className="lightbox-copy" onClick={handleCopy}>
                {copied ? "Copied" : "↗ Copy link"}
              </button>
              </div>
              <div className="lightbox-attribution-footer">
                Andrews Collection of Information Graphics
              </div>
            </details>
          ) : (
            <>
              {attribution ? (
                <div className="lightbox-attribution">{attribution}</div>
              ) : null}
              <div className="meta-table">
                <div className="meta-label">Figure Type</div>
                <div className="meta-value">
                  {typeLabelList.length ? typeLabelList.join(", ") : "Unknown"}
                </div>
                <div className="meta-label">Features</div>
                <div className="meta-value">
                  {featureLabelList.length ? (
                    featureLabelList.map((line) => <div key={line}>{line}</div>)
                  ) : (
                    "None"
                  )}
                </div>
                {figure.onlyBlack || (figure.colors?.length ?? 0) > 0 ? (
                  <>
                    <div className="meta-label">Colors</div>
                    <div className="meta-value">
                      {Array.isArray(colorsLabel) ? colorsLabel.join(", ") : colorsLabel}
                    </div>
                  </>
                ) : null}
              </div>
              {figure.themes?.length ? (
                <div className="meta-block">
                  <div className="meta-label">Themes</div>
                  <div className="meta-value">{figure.themes.join(", ")}</div>
                </div>
              ) : null}
              {figure.aiDescription ? (
                <div className="meta-block">
                  <div className="meta-label">AI description</div>
                  <div className="meta-value">{figure.aiDescription}</div>
                </div>
              ) : null}
              <div className="lightbox-actions">
                <button type="button" className="lightbox-copy" onClick={handleCopy}>
                  {copied ? "Copied" : "↗ Copy link"}
                </button>
              </div>
              <div className="lightbox-attribution-footer">
                Andrews Collection of Information Graphics
              </div>
            </>
          )}
        </div>
        <div className="lightbox-media">
          <div className={`lightbox-stage${isFullLoaded ? " is-loaded" : ""}`}>
            <img
              className="lightbox-stage-thumb"
              src={figure.thumb}
              alt=""
              aria-hidden="true"
            />
            <img
              className="lightbox-stage-full"
              src={figure.view}
              alt={figureTitle}
              onLoad={() => setIsFullLoaded(true)}
            />
          </div>
          {sortedFigures.length > 1 ? (
            <div className="lightbox-carousel" aria-label="Other figures in this work">
              {work?.title ? (
                <div className="lightbox-carousel-title">
                  More figures from <em>{work.title}</em>
                  {work.year ? ` (${work.year})` : ""}
                </div>
              ) : null}
              <div className="lightbox-carousel-row">
                {sortedFigures.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`lightbox-thumb${item.id === figure.id ? " is-active" : ""}`}
                    onClick={() => onSelect(item.id)}
                    ref={item.id === figure.id ? activeThumbRef : null}
                  >
                    <img src={item.thumb} alt={item.title ?? item.id} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {isMobile && sortedFigures.length > 1 ? (
          <div className="lightbox-nav">
            <button
              type="button"
              className="lightbox-nav-btn"
              onClick={() => prevFigure && onSelect(prevFigure.id)}
              disabled={!prevFigure}
            >
              Previous
            </button>
            <button
              type="button"
              className="lightbox-nav-btn"
              onClick={() => nextFigure && onSelect(nextFigure.id)}
              disabled={!nextFigure}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Lightbox;

const normalizeTypes = (figure: FigureWithWork): string[] => {
  if (Array.isArray(figure.types)) {
    return figure.types.filter(Boolean);
  }
  return [];
};

const normalizeFeatures = (figure: FigureWithWork): string[] => {
  if (Array.isArray(figure.featuresFlat)) {
    return figure.featuresFlat.filter(Boolean);
  }
  return [];
};

const buildFeatureLabelLines = (
  figure: FigureWithWork,
  featureLabels: Map<string, string>,
  chartTypeLabels: Map<string, string>
): string[] => {
  const types = normalizeTypes(figure);
  const byType = figure.featuresByType ?? {};
  if (types.length <= 1) {
    const features = normalizeFeatures(figure);
    return features.map((type) =>
      featureLabels.get(type) ?? chartTypeLabels.get(type) ?? type
    );
  }

  const lines: string[] = [];
  types.forEach((type) => {
    const features = byType[type] ?? [];
    if (!features.length) {
      return;
    }
    const typeLabel = chartTypeLabels.get(type) ?? type;
    const featureText = features
      .map((feat) => featureLabels.get(feat) ?? chartTypeLabels.get(feat) ?? feat)
      .join(", ");
    lines.push(`${typeLabel} — ${featureText}`);
  });
  return lines;
};

const toTitleCase = (value: string): string =>
  value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");

const parsePageNumber = (id: string): number | null => {
  const match = id.match(/-p(\d{4})-/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const sortFiguresByPage = (figures: FigureWithWork[]): FigureWithWork[] => {
  const sorted = [...figures];
  sorted.sort((a, b) => {
    const pageA = parsePageNumber(a.id);
    const pageB = parsePageNumber(b.id);
    if (pageA !== null && pageB !== null) {
      return pageA - pageB;
    }
    if (pageA !== null) {
      return -1;
    }
    if (pageB !== null) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted;
};

const getSiblingFigure = (
  figures: FigureWithWork[],
  currentId: string,
  direction: -1 | 1
): FigureWithWork | null => {
  if (!figures.length) {
    return null;
  }
  const index = figures.findIndex((item) => item.id === currentId);
  if (index === -1) {
    return null;
  }
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= figures.length) {
    return null;
  }
  return figures[nextIndex];
};

const formatAuthor = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.includes(",")) {
    return trimmed;
  }
  const [last, rest] = trimmed.split(",").map((part) => part.trim());
  if (!last || !rest) {
    return trimmed;
  }
  return `${rest} ${last}`.trim();
};

const buildAttribution = (work?: WorkRecord): ReactNode | null => {
  if (!work?.title) {
    return null;
  }
  const authors = normalizeAuthors(work);
  const authorsText = authors.length ? authors.join(" and ") : null;
  const pubText = buildPublicationDetails(work);
  const publisherText = pubText ? ` (${pubText})` : "";
  const seriesLink = buildSeriesLink(work.series);
  const seriesSuffix = seriesLink ? (
    <>
      {" "}
      Part of the{" "}
      <Link className="lightbox-series-link" to={seriesLink.href}>
        {seriesLink.label}
      </Link>{" "}
      book series.
    </>
  ) : null;
  if (authorsText) {
    return (
      <>
        Published in <em>{work.title}</em> by {authorsText}
        {publisherText}.{seriesSuffix}
      </>
    );
  }
  return (
    <>
      Published in <em>{work.title}</em>
      {publisherText}.{seriesSuffix}
    </>
  );
};

const formatSeries = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return toTitleCase(trimmed.replace(/^the\s+/i, ""));
};

const buildSeriesLink = (value?: string | null): { label: string; href: string } | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const label = formatSeries(trimmed) ?? trimmed;
  const params = new URLSearchParams();
  params.set("sort", "oldest");
  params.set("view", "publications");
  params.set("q", `series:"${trimmed}"`);
  return { label, href: `/?${params.toString()}` };
};

const buildPublicationDetails = (work: WorkRecord): string | null => {
  const city = work.publisherCity?.trim();
  const publisher = work.publisher?.trim();
  const year = work.year ? String(work.year).trim() : "";
  let base = "";
  if (city && publisher) {
    base = `${city}: ${publisher}`;
  } else if (city) {
    base = city;
  } else if (publisher) {
    base = publisher;
  }
  if (year) {
    base = base ? `${base}, ${year}` : year;
  }
  return base || null;
};

const normalizeAuthors = (work: WorkRecord): string[] => {
  const raw = work.authors?.map((author) => author.trim()).filter(Boolean) ?? [];
  return raw
    .flatMap((author) => author.split(";").map((item) => item.trim()))
    .filter(Boolean)
    .map(formatAuthor);
};
