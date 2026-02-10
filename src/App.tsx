import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "./components/Header";
import FiltersBar from "./components/FiltersBar";
import Gallery from "./components/Gallery";
import Lightbox from "./components/Lightbox";
import Footer from "./components/Footer";
import { matchesAdvancedFilters, parseAdvancedQuery } from "./lib/advancedQuery";
import { buildSearchIndex, runSearch } from "./lib/search";
import { sortFigures, type SortKey } from "./lib/sort";
import type {
  ChartTypeConfig,
  ColorConfig,
  FeatureConfig,
  FigureRecord,
  FigureWithWork,
  WorkRecord
} from "./lib/types";

type ViewMode = "figures" | "publications";
const PROCESS_COLOR_ID = "process";
const PROCESS_COLOR_MODE: ColorConfig = {
  id: PROCESS_COLOR_ID,
  label: "Process",
  hex: "#000000"
};

const splitParam = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const toTitleCase = (value: string): string =>
  value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const normalizeFeatureForType = (featureId: string, typeId: string | null): string => {
  if (
    typeId === "map" &&
    (featureId === "symbol" || featureId === "symbol-map")
  ) {
    return "symbol-map";
  }
  return featureId;
};

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [figures, setFigures] = useState<FigureRecord[]>([]);
  const [ocrById, setOcrById] = useState<Record<string, string>>({});
  const [chartTypes, setChartTypes] = useState<ChartTypeConfig[]>([]);
  const [features, setFeatures] = useState<FeatureConfig[]>([]);
  const [colors, setColors] = useState<ColorConfig[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutScrollTarget, setAboutScrollTarget] = useState<null | "terms">(null);
  const termsRef = useRef<HTMLDetailsElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    window.matchMedia("(max-width: 600px)").matches
  );
  const [randomSeed, setRandomSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const prevSortKeyRef = useRef<SortKey | null>(null);

  useEffect(() => {
    const load = async () => {
      const [worksRes, figuresRes, ocrRes, chartTypesRes, featuresRes, colorsRes] =
        await Promise.all([
          fetch("/data/works.json"),
          fetch("/data/figures.json"),
          fetch("/data/ocr.json"),
          fetch("/data/chartTypes.json"),
          fetch("/data/features.json"),
          fetch("/data/colors.json")
        ]);

      if (worksRes.ok) {
        setWorks(await worksRes.json());
      }
      if (figuresRes.ok) {
        setFigures(await figuresRes.json());
      }
      if (ocrRes.ok) {
        setOcrById(await ocrRes.json());
      }
      if (chartTypesRes.ok) {
        setChartTypes(await chartTypesRes.json());
      }
      if (featuresRes.ok) {
        setFeatures(await featuresRes.json());
      }
      if (colorsRes.ok) {
        setColors(await colorsRes.json());
      }
    };

    load();
  }, []);

  const workMap = useMemo(() => {
    const map = new Map<string, WorkRecord>();
    works.forEach((work) => map.set(work.workId, work));
    return map;
  }, [works]);

  const figuresWithWork = useMemo<FigureWithWork[]>(() => {
    return figures.map((figure) => {
      const work = workMap.get(figure.workId);
      return {
        ...figure,
        workTitle: work?.title,
        workYear: work?.year,
        workAuthors: work?.authors,
        workPublisher: work?.publisher,
        workPublisherCity: work?.publisherCity,
        workSeries: work?.series,
        ocrText: ocrById[figure.id] ?? figure.ocrText
      };
    });
  }, [figures, ocrById, workMap]);

  const figureMap = useMemo(() => {
    const map = new Map<string, FigureWithWork>();
    figuresWithWork.forEach((figure) => map.set(figure.id, figure));
    return map;
  }, [figuresWithWork]);

  const searchIndex = useMemo(() => buildSearchIndex(figuresWithWork), [figuresWithWork]);

  const query = searchParams.get("q") ?? "";
  const displayColors = useMemo(() => {
    if (colors.some((color) => color.id === PROCESS_COLOR_ID)) {
      return colors;
    }
    return [...colors, PROCESS_COLOR_MODE];
  }, [colors]);
  const advancedQuery = useMemo(
    () =>
      parseAdvancedQuery(query, {
        colors: displayColors,
        chartTypes,
        features,
        works
      }),
    [chartTypes, displayColors, features, query, works]
  );
  const searchText = advancedQuery.text;
  const hasQuery = searchText.trim().length > 0;
  const selectedTypes = splitParam(searchParams.get("types"));
  const selectedFeatures = splitParam(searchParams.get("features"));
  const colorParam = splitParam(searchParams.get("colors"));
  const onlyBlack = colorParam.includes("only-black");
  const selectedColors = colorParam.filter((color) => color !== "only-black");
  const selectedWorkId = searchParams.get("work");
  const sortKey = (searchParams.get("sort") as SortKey) || "relevance";
  const viewMode = (searchParams.get("view") as ViewMode) || "figures";
  const lightboxId = searchParams.get("id");
  const selectedBaseTypes = useMemo(
    () => selectedTypes.filter((type) => type !== "combo"),
    [selectedTypes]
  );
  const selectedFeatureType =
    selectedBaseTypes.length === 1 ? selectedBaseTypes[0] : null;
  const displaySelectedFeatures = useMemo(() => {
    const normalized = selectedFeatures.map((featureId) =>
      normalizeFeatureForType(featureId, selectedFeatureType)
    );
    return Array.from(new Set(normalized));
  }, [selectedFeatureType, selectedFeatures]);
  const prevPrimaryTypeRef = useRef<string | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const handleQueryChange = (value: string) => {
    updateParams({ q: value.trim() ? value : null });
  };

  useEffect(() => {
    if (!hasQuery && sortKey === "relevance") {
      updateParams({ sort: "oldest" });
    }
  }, [hasQuery, sortKey, updateParams]);

  useEffect(() => {
    if (sortKey === "random" && prevSortKeyRef.current !== "random") {
      setRandomSeed((value) => value + 1);
    }
    prevSortKeyRef.current = sortKey;
  }, [sortKey]);

  const handleReset = () => {
    setSearchParams(new URLSearchParams());
  };
  const handleAboutOpen = () => {
    setAboutOpen(true);
  };
  const handleAboutClose = () => {
    setAboutOpen(false);
  };
  const handleTermsOpen = () => {
    setAboutOpen(true);
    setAboutScrollTarget("terms");
  };
  const handleFiltersToggle = () => {
    setFiltersOpen((prev) => !prev);
  };
  const handleFiltersClose = () => {
    setFiltersOpen(false);
  };

  const handleToggleType = (id: string) => {
    const next = new Set(selectedTypes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    updateParams({ types: next.size ? Array.from(next).join(",") : null });
  };

  const handleToggleColor = (id: string) => {
    const next = new Set(selectedColors);
    if (id === "only-black") {
      updateParams({ colors: onlyBlack ? null : "only-black" });
      return;
    }

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    const joined = Array.from(next).join(",");
    updateParams({ colors: joined || null });
  };

  const handleToggleFeature = (id: string) => {
    if (!selectedFeatureType) {
      return;
    }
    const normalizedId = normalizeFeatureForType(id, selectedFeatureType);
    const normalizedSelected = selectedFeatures.map((featureId) =>
      normalizeFeatureForType(featureId, selectedFeatureType)
    );
    const next = new Set(normalizedSelected);
    if (next.has(normalizedId)) {
      next.delete(normalizedId);
    } else {
      next.add(normalizedId);
    }
    updateParams({ features: next.size ? Array.from(next).join(",") : null });
  };


  const handleSortChange = (sort: SortKey) => {
    updateParams({ sort });
  };

  const handleViewChange = (view: ViewMode) => {
    updateParams({ view: view === "figures" ? null : view });
  };

  const handleSelectFigure = (id: string) => {
    updateParams({ id });
  };

  const handleCloseLightbox = () => {
    updateParams({ id: null });
  };

  useEffect(() => {
    const prevPrimary = prevPrimaryTypeRef.current;
    if (!selectedFeatureType) {
      if (selectedFeatures.length) {
        updateParams({ features: null });
      }
      prevPrimaryTypeRef.current = null;
      return;
    }
    if (prevPrimary && prevPrimary !== selectedFeatureType && selectedFeatures.length) {
      updateParams({ features: null });
    }
    prevPrimaryTypeRef.current = selectedFeatureType;
  }, [selectedFeatureType, selectedFeatures.length, updateParams]);

  useEffect(() => {
    if (!aboutOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleAboutClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [aboutOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const handleResize = () => setIsMobile(media.matches);
    handleResize();
    media.addEventListener("change", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      media.removeEventListener("change", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!filtersOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!aboutOpen || !aboutScrollTarget) {
      return;
    }
    const node = aboutScrollTarget === "terms"
      ? termsRef.current
      : document.getElementById(aboutScrollTarget);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setAboutScrollTarget(null);
  }, [aboutOpen, aboutScrollTarget]);

  const chartTypeLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    chartTypes.forEach((type) => {
      labels[type.id] = type.label;
    });
    return labels;
  }, [chartTypes]);

  const featureLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    features.forEach((feature) => {
      labels[feature.id] = feature.label;
    });
    return labels;
  }, [features]);

  const { ids: searchIds, scoreById } = useMemo(
    () => runSearch(searchIndex, searchText),
    [searchIndex, searchText]
  );

  const searchBase = useMemo(() => {
    if (!searchText.trim()) {
      return figuresWithWork;
    }

    return searchIds
      .map((id) => figureMap.get(id))
      .filter((figure): figure is FigureWithWork => Boolean(figure));
  }, [figuresWithWork, figureMap, searchIds, searchText]);

  const searchBaseAdvanced = useMemo(() => {
    if (!advancedQuery.hasFilters) {
      return searchBase;
    }
    return searchBase.filter((figure) =>
      matchesAdvancedFilters(figure, advancedQuery.filters)
    );
  }, [advancedQuery, searchBase]);

  const typeSortCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    figuresWithWork.forEach((figure) => {
      const types = Array.isArray(figure.types) ? figure.types : [];
      if (!types.length) {
        return;
      }
      const unique = new Set(types);
      unique.forEach((type) => {
        counts[type] = (counts[type] ?? 0) + 1;
      });
      if (figure.isCombo) {
        counts.combo = (counts.combo ?? 0) + 1;
      }
    });
    return counts;
  }, [figuresWithWork]);

  const { filteredFigures, typeCounts, colorCounts, availableFeatures } = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const colorCounts: Record<string, number> = {};
    const filteredFigures: FigureWithWork[] = [];
    const featureSet = new Set<string>();

    const typeIds = Object.keys(typeSortCounts);
    typeIds.forEach((id) => {
      typeCounts[id] = 0;
    });
    const colorIds = displayColors.map((color) => color.id);
    colorIds.forEach((id) => {
      colorCounts[id] = 0;
    });

    const unselectedTypeIds = typeIds.filter((id) => !selectedTypes.includes(id));
    const colorCandidates = colorIds
      .map((colorId) => {
        if (colorId === "only-black") {
          if (onlyBlack) {
            return null;
          }
          return { colorId, onlyBlack: true, selectedColors: [] as string[] };
        }
        const isSelected = !onlyBlack && selectedColors.includes(colorId);
        if (isSelected) {
          return null;
        }
        return {
          colorId,
          onlyBlack: false,
          selectedColors: selectedColors.includes(colorId)
            ? selectedColors
            : [...selectedColors, colorId]
        };
      })
      .filter(
        (item): item is { colorId: string; onlyBlack: boolean; selectedColors: string[] } =>
          Boolean(item)
      );

    const getSelectedBaseTypes = (types: string[]): string[] =>
      types.filter((type) => type !== "combo");
    const hasAny = (source: Set<string>, target: string[]): boolean =>
      target.some((item) => source.has(item));
    const hasAll = (source: Set<string>, target: string[]): boolean =>
      target.every((item) => source.has(item));
    const matchesType = (figure: FigureWithWork, types: string[]): boolean => {
      if (types.length === 0) {
        return true;
      }
      const figureTypes = new Set(Array.isArray(figure.types) ? figure.types : []);
      const baseTypes = getSelectedBaseTypes(types);
      const wantsCombo = types.includes("combo");
      const matchesBase = baseTypes.length ? hasAny(figureTypes, baseTypes) : true;
      const matchesCombo = wantsCombo ? figure.isCombo === true : true;
      return matchesBase && matchesCombo;
    };
    const matchesFeatures = (
      figure: FigureWithWork,
      types: string[],
      features: string[]
    ): boolean => {
      if (features.length === 0) {
        return true;
      }
      const baseTypes = getSelectedBaseTypes(types);
      const selectedType = baseTypes.length === 1 ? baseTypes[0] : null;
      if (!selectedType) {
        return false;
      }
      const byType = figure.featuresByType ?? {};
      const normalizedFeatures = (byType[selectedType] ?? []).map((featureId) =>
        normalizeFeatureForType(featureId, selectedType)
      );
      const normalizedSet = new Set(normalizedFeatures);
      return features.some((featureId) =>
        normalizedSet.has(normalizeFeatureForType(featureId, selectedType))
      );
    };
    const matchesColors = (
      figure: FigureWithWork,
      colorsState: { onlyBlack: boolean; selectedColors: string[] }
    ): boolean => {
      if (colorsState.onlyBlack) {
        return figure.onlyBlack === true;
      }
      if (colorsState.selectedColors.length === 0) {
        return true;
      }
      return hasAll(new Set(figure.colors ?? []), colorsState.selectedColors);
    };
    const baseColorState = { onlyBlack, selectedColors };

    searchBaseAdvanced.forEach((figure) => {
      const matchesWork = !selectedWorkId || figure.workId === selectedWorkId;
      if (!matchesWork) {
        return;
      }

      const matchesBaseType = matchesType(figure, selectedTypes);
      const matchesBaseFeatures = matchesFeatures(
        figure,
        selectedTypes,
        displaySelectedFeatures
      );
      const matchesBaseColors = matchesColors(figure, baseColorState);

      if (matchesBaseType && matchesBaseFeatures && matchesBaseColors) {
        filteredFigures.push(figure);
      }

      if (selectedFeatureType && matchesBaseType && matchesBaseColors) {
        const byType = figure.featuresByType ?? {};
        (byType[selectedFeatureType] ?? []).forEach((item) =>
          featureSet.add(normalizeFeatureForType(item, selectedFeatureType))
        );
      }

      if (matchesBaseColors) {
        unselectedTypeIds.forEach((typeId) => {
          const candidateTypes = [...selectedTypes, typeId];
          if (
            matchesType(figure, candidateTypes) &&
            matchesFeatures(figure, candidateTypes, displaySelectedFeatures)
          ) {
            typeCounts[typeId] = (typeCounts[typeId] ?? 0) + 1;
          }
        });
      }

      if (matchesBaseType && matchesBaseFeatures) {
        colorCandidates.forEach((candidate) => {
          if (
            matchesColors(figure, {
              onlyBlack: candidate.onlyBlack,
              selectedColors: candidate.selectedColors
            })
          ) {
            colorCounts[candidate.colorId] = (colorCounts[candidate.colorId] ?? 0) + 1;
          }
        });
      }
    });

    const currentCount = filteredFigures.length;
    selectedTypes.forEach((typeId) => {
      typeCounts[typeId] = currentCount;
    });
    if (selectedTypes.length > 0) {
      unselectedTypeIds.forEach((typeId) => {
        const addCount = typeCounts[typeId] ?? 0;
        typeCounts[typeId] = Math.max(0, addCount - currentCount);
      });
    }
    if (onlyBlack) {
      colorCounts["only-black"] = currentCount;
    } else {
      selectedColors.forEach((colorId) => {
        colorCounts[colorId] = currentCount;
      });
    }

    const availableFeatures = selectedFeatureType
      ? Array.from(featureSet)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({ id, label: featureLabels[id] ?? id }))
        .sort((a, b) => a.label.localeCompare(b.label))
      : [];

    return { filteredFigures, typeCounts, colorCounts, availableFeatures };
  }, [
    displayColors,
    featureLabels,
    onlyBlack,
    searchBaseAdvanced,
    selectedColors,
    displaySelectedFeatures,
    selectedFeatureType,
    selectedTypes,
    selectedWorkId,
    typeSortCounts
  ]);

  const displayTypes = useMemo(() => {
    const ids = Object.keys(typeSortCounts);
    return ids.map((id) => ({
      id,
      label: toTitleCase(chartTypeLabels[id] ?? id)
    }));
  }, [chartTypeLabels, typeSortCounts]);

  const colorSortCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    figuresWithWork.forEach((figure) => {
      if (figure.onlyBlack) {
        counts["only-black"] = (counts["only-black"] ?? 0) + 1;
      }
      (figure.colors ?? []).forEach((color) => {
        counts[color] = (counts[color] ?? 0) + 1;
      });
    });
    return counts;
  }, [figuresWithWork]);

  const sortedFigures = useMemo(
    () => sortFigures(filteredFigures, sortKey, scoreById, randomSeed),
    [filteredFigures, sortKey, scoreById, randomSeed]
  );

  const activeFilterCount =
    selectedTypes.length +
    displaySelectedFeatures.length +
    selectedColors.length +
    (onlyBlack ? 1 : 0);

  const viewCounts = useMemo(() => {
    const publications = new Set<string>();
    filteredFigures.forEach((figure) => {
      if (figure.workId) {
        publications.add(figure.workId);
      }
    });
    return {
      figures: filteredFigures.length,
      publications: publications.size
    };
  }, [filteredFigures]);

  const activeFigure = lightboxId ? figureMap.get(lightboxId) ?? null : null;
  const activeWork = activeFigure ? workMap.get(activeFigure.workId) : undefined;
  const figuresInWork = useMemo(() => {
    if (!activeFigure) {
      return [];
    }
    return figuresWithWork.filter((figure) => figure.workId === activeFigure.workId);
  }, [activeFigure, figuresWithWork]);

  return (
    <div className="app">
      <Header
        query={query}
        onQueryChange={handleQueryChange}
        onAboutClick={handleAboutOpen}
        onFiltersClick={handleFiltersToggle}
        filtersOpen={filtersOpen}
        activeFilterCount={activeFilterCount}
        gridCount={
          viewMode === "figures"
            ? `${viewCounts.figures} Figures`
            : `${viewCounts.publications} Publications`
        }
      />
      <div className={`filters-panel${filtersOpen ? " is-open" : ""}`}>
        <div className="filters-panel-header">
          <div className="filters-panel-title">
            Filters
            {activeFilterCount > 0 ? (
              <span className="filters-panel-count">{activeFilterCount}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="filters-panel-close"
            onClick={handleFiltersClose}
          >
            Close
          </button>
        </div>
        <FiltersBar
          chartTypes={displayTypes}
          availableFeatures={availableFeatures}
          typeCounts={typeCounts}
          typeSortCounts={typeSortCounts}
          colors={displayColors}
          colorCounts={colorCounts}
          colorSortCounts={colorSortCounts}
          selectedTypes={selectedTypes}
          selectedFeatures={displaySelectedFeatures}
          selectedColors={selectedColors}
          onlyBlack={onlyBlack}
          sortKey={sortKey}
          hasQuery={hasQuery}
          viewMode={viewMode}
          viewCounts={viewCounts}
          hideView={isMobile}
          onToggleType={handleToggleType}
          onToggleFeature={handleToggleFeature}
          onToggleColor={handleToggleColor}
          onSortChange={handleSortChange}
          onViewChange={handleViewChange}
          onClearAll={handleReset}
        />
        <div className="filters-panel-footer">
          <button type="button" className="filters-panel-clear" onClick={handleReset}>
            Clear filters
          </button>
          <button type="button" className="filters-panel-apply" onClick={handleFiltersClose}>
            Done
          </button>
        </div>
      </div>
      <button
        type="button"
        className={`filters-backdrop${filtersOpen ? " is-open" : ""}`}
        onClick={handleFiltersClose}
        aria-label="Close filters panel"
      />
      <main className="gallery-wrap">
        <Gallery
          figures={sortedFigures}
          allFigures={figuresWithWork}
          sortKey={sortKey}
          viewMode={viewMode}
          randomSeed={randomSeed}
          onSelect={handleSelectFigure}
        />
      </main>
      {activeFigure ? (
        <Lightbox
          figure={activeFigure}
          work={activeWork}
          figuresInWork={figuresInWork}
          chartTypes={chartTypes}
          features={features}
          colors={displayColors}
          onClose={handleCloseLightbox}
          onSelect={handleSelectFigure}
        />
      ) : null}
      {aboutOpen ? (
        <div
          className="about-modal"
          role="dialog"
          aria-modal="true"
          onClick={handleAboutClose}
        >
          <div className="about-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="about-close" onClick={handleAboutClose}>
              ×
            </button>
            <h2>About</h2>
            <p>
              Isotype is a method of showing pictorial information. It consists of standardized methods and abstracted symbols to represent social-scientific data. It was first known as the Vienna Method of Pictorial Statistics due to its 1920s origins at the Gesellschafts-und Wirtschaftsmuseum in Wien (Social and Economic Museum of Vienna). The term Isotype was applied to the method in the 1930s, after its key practitioners were forced to leave Vienna by the rise of Austrian fascism.
            </p>
            <p>
              For generations, Isotype charts and diagrams have inspired information designers. Explore a growing collection of Isotype figures using this interactive explorer created by RJ Andrews with original photography and metadata. For inquiries, visit{" "}
              <a href="https://infowetrust.com/contact">infowetrust.com/contact</a>.
            </p>
            <img
              className="about-photo"
              src="/rj-photo-rig.webp"
              alt="RJ Andrews with camera rig."
            />
            <details className="about-details" id="advanced-search">
              <summary>Advanced Search</summary>
              <div className="about-text">
                <p>
                  Use key:value tokens in the search bar to filter results while
                  still searching the remaining text.
                </p>
                <p>
                  Supported keys: <strong>color</strong>, <strong>type</strong>,
                  <strong>work</strong>, <strong>year</strong>, <strong>feature</strong>,
                  <strong>series</strong>.
                </p>
                <p>
                  Values accept either slugs or labels and can be comma-separated
                  for multiple values.
                </p>
                <ul>
                  <li>color:red type:bar accidents</li>
                  <li>color:red,blue work:&quot;Human problems in industry&quot; year:1946</li>
                </ul>
              </div>
            </details>
            <details className="about-details" id="terms" ref={termsRef}>
              <summary>Terms of Use</summary>
              <div className="about-text">
                <p>
                  This site presents historical information graphics for research and
                  educational purposes under fair use/fair dealing.
                </p>
                <p>
                  Photography and curated metadata are © Andrews Collection of
                  Information Graphics (RJ Andrews). All rights reserved unless
                  otherwise noted.
                </p>
                <p>
                  You may browse, search, and share links to this site. Limited
                  quotation of metadata or low-resolution imagery for commentary,
                  scholarship, and teaching is permitted with attribution.
                </p>
                <p>Prohibited without written permission:</p>
                <ul>
                  <li>
                  automated scraping, crawling, bulk downloading, or mirroring of
                  images or metadata
                  </li>
                  <li>
                  building or redistributing a dataset derived from this site (images
                  or metadata)
                  </li>
                  <li>
                  using any images or metadata from this site to train, fine-tune,
                  evaluate, or operate machine learning / AI systems (including
                  embedding generation or dataset construction)
                  </li>
                  <li>
                  commercial reuse or resale of the photography and metadata
                  </li>
                </ul>
                <p>We may block automated access and update these terms over time.</p>
              </div>
            </details>
            <details className="about-details" id="data-license">
              <summary>Data &amp; Content License</summary>
              <div className="about-text">
                <p>
                  The software/code for this website is licensed under the repository
                  LICENSE (MIT).
                </p>
                <p>
                  The photography and metadata published on the site are governed by
                  the project's Data &amp; Content License (see DATA_LICENSE.md) and
                  the Terms above.
                </p>
              </div>
            </details>
          </div>
        </div>
      ) : null}
      <Footer onTermsClick={handleTermsOpen} />
    </div>
  );
};

export default App;
