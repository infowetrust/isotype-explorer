import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "./components/Header";
import FiltersBar from "./components/FiltersBar";
import Gallery from "./components/Gallery";
import Lightbox from "./components/Lightbox";
import Footer from "./components/Footer";
import { buildSearchIndex, runSearch } from "./lib/search";
import { extractFeatures, matchesFilters } from "./lib/filters";
import { sortFigures, type SortKey } from "./lib/sort";
import type {
  ChartTypeConfig,
  ColorConfig,
  FigureRecord,
  FigureWithWork,
  WorkRecord
} from "./lib/types";

const splitParam = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [works, setWorks] = useState<WorkRecord[]>([]);
  const [figures, setFigures] = useState<FigureRecord[]>([]);
  const [chartTypes, setChartTypes] = useState<ChartTypeConfig[]>([]);
  const [colors, setColors] = useState<ColorConfig[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [worksRes, figuresRes, chartTypesRes, colorsRes] = await Promise.all([
        fetch("/data/works.json"),
        fetch("/data/figures.json"),
        fetch("/data/chartTypes.json"),
        fetch("/data/colors.json")
      ]);

      if (worksRes.ok) {
        setWorks(await worksRes.json());
      }
      if (figuresRes.ok) {
        setFigures(await figuresRes.json());
      }
      if (chartTypesRes.ok) {
        setChartTypes(await chartTypesRes.json());
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
        workPublisherCity: work?.publisherCity
      };
    });
  }, [figures, workMap]);

  const figureMap = useMemo(() => {
    const map = new Map<string, FigureWithWork>();
    figuresWithWork.forEach((figure) => map.set(figure.id, figure));
    return map;
  }, [figuresWithWork]);

  const searchIndex = useMemo(() => buildSearchIndex(figuresWithWork), [figuresWithWork]);

  const query = searchParams.get("q") ?? "";
  const selectedTypes = splitParam(searchParams.get("types"));
  const selectedFeatures = splitParam(searchParams.get("features"));
  const colorParam = splitParam(searchParams.get("colors"));
  const onlyBlack = colorParam.includes("only-black");
  const selectedColors = colorParam.filter((color) => color !== "only-black");
  const selectedWorkId = searchParams.get("work");
  const sortKey = (searchParams.get("sort") as SortKey) || "relevance";
  const lightboxId = searchParams.get("id");
  const selectedPrimaryType = selectedTypes.length === 1 ? selectedTypes[0] : null;
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

  const handleReset = () => {
    setSearchParams(new URLSearchParams());
  };
  const handleAboutOpen = () => {
    setAboutOpen(true);
  };
  const handleAboutClose = () => {
    setAboutOpen(false);
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

  const handleWorkChange = (id: string | null) => {
    updateParams({ work: id });
  };

  const handleToggleFeature = (id: string) => {
    if (!selectedPrimaryType) {
      return;
    }
    const next = new Set(selectedFeatures);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    updateParams({ features: next.size ? Array.from(next).join(",") : null });
  };

  const handleClearFeatures = () => {
    updateParams({ features: null });
  };

  const handleSortChange = (sort: SortKey) => {
    updateParams({ sort });
  };

  const handleSelectFigure = (id: string) => {
    updateParams({ id });
  };

  const handleCloseLightbox = () => {
    updateParams({ id: null });
  };

  useEffect(() => {
    const prevPrimary = prevPrimaryTypeRef.current;
    if (!selectedPrimaryType) {
      if (selectedFeatures.length) {
        updateParams({ features: null });
      }
      prevPrimaryTypeRef.current = null;
      return;
    }
    if (prevPrimary && prevPrimary !== selectedPrimaryType && selectedFeatures.length) {
      updateParams({ features: null });
    }
    prevPrimaryTypeRef.current = selectedPrimaryType;
  }, [selectedPrimaryType, selectedFeatures.length, updateParams]);

  const chartTypeLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    chartTypes.forEach((type) => {
      labels[type.id] = type.label;
    });
    return labels;
  }, [chartTypes]);

  const availableFeatures = useMemo(() => {
    if (!selectedPrimaryType) {
      return [];
    }
    const set = new Set<string>();
    figuresWithWork.forEach((figure) => {
      if (figure.chartTypePrimary !== selectedPrimaryType) {
        return;
      }
      extractFeatures(figure)
        .filter((item) => item !== selectedPrimaryType)
        .forEach((item) => set.add(item));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [figuresWithWork, selectedPrimaryType]);

  const { ids: searchIds, scoreById } = useMemo(
    () => runSearch(searchIndex, query),
    [searchIndex, query]
  );

  const searchBase = useMemo(() => {
    if (!query.trim()) {
      return figuresWithWork;
    }

    return searchIds
      .map((id) => figureMap.get(id))
      .filter((figure): figure is FigureWithWork => Boolean(figure));
  }, [figuresWithWork, figureMap, query, searchIds]);

  const filterBase = useCallback(
    ({
      useTypes,
      useColors,
      useFeatures
    }: {
      useTypes: boolean;
      useColors: boolean;
      useFeatures: boolean;
    }) =>
      searchBase.filter((figure) =>
        matchesFilters(figure, {
          selectedTypes: useTypes ? selectedTypes : [],
          selectedFeatures: useFeatures ? selectedFeatures : [],
          selectedColors: useColors ? selectedColors : [],
          onlyBlack: useColors ? onlyBlack : false,
          workId: selectedWorkId
        })
      ),
    [searchBase, selectedTypes, selectedFeatures, selectedColors, onlyBlack, selectedWorkId]
  );

  const filteredFigures = useMemo(() => {
    return searchBase.filter((figure) =>
      matchesFilters(figure, {
        selectedTypes,
        selectedFeatures,
        selectedColors,
        onlyBlack,
        workId: selectedWorkId
      })
    );
  }, [searchBase, selectedTypes, selectedFeatures, selectedColors, onlyBlack, selectedWorkId]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const base = filterBase({ useTypes: false, useColors: true, useFeatures: false });
    base.forEach((figure) => {
      const primary = figure.chartTypePrimary;
      if (!primary) {
        return;
      }
      counts[primary] = (counts[primary] ?? 0) + 1;
    });
    return counts;
  }, [filterBase]);

  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const base = filterBase({ useTypes: true, useColors: false, useFeatures: true });
    base.forEach((figure) => {
      if (figure.onlyBlack) {
        counts["only-black"] = (counts["only-black"] ?? 0) + 1;
      }
      (figure.colors ?? []).forEach((color) => {
        counts[color] = (counts[color] ?? 0) + 1;
      });
    });
    return counts;
  }, [filterBase]);

  const sortedFigures = useMemo(
    () => sortFigures(filteredFigures, sortKey, scoreById, chartTypeLabels),
    [filteredFigures, sortKey, scoreById, chartTypeLabels]
  );

  const hasActiveFilters = Boolean(
    query.trim() ||
      selectedTypes.length ||
      selectedFeatures.length ||
      selectedColors.length ||
      onlyBlack ||
      selectedWorkId
  );

  const activeFigure = lightboxId ? figureMap.get(lightboxId) ?? null : null;
  const activeWork = activeFigure ? workMap.get(activeFigure.workId) : undefined;

  return (
    <div className="app">
      <Header
        query={query}
        onQueryChange={handleQueryChange}
        onReset={handleReset}
        onAboutClick={handleAboutOpen}
      />
      <FiltersBar
        chartTypes={chartTypes}
        availableFeatures={availableFeatures}
        typeCounts={typeCounts}
        colors={colors}
        colorCounts={colorCounts}
        works={works}
        selectedTypes={selectedTypes}
        selectedFeatures={selectedFeatures}
        selectedColors={selectedColors}
        onlyBlack={onlyBlack}
        selectedWorkId={selectedWorkId}
        sortKey={sortKey}
        onToggleType={handleToggleType}
        onToggleFeature={handleToggleFeature}
        onClearFeatures={handleClearFeatures}
        onToggleColor={handleToggleColor}
        onWorkChange={handleWorkChange}
        onSortChange={handleSortChange}
      />
      <main className="gallery-wrap">
        <div className="results-meta">
          <span>{sortedFigures.length} figures</span>
          {hasActiveFilters ? (
            <button type="button" className="results-reset" onClick={handleReset}>
              {`Show all ${figuresWithWork.length} figures`}
            </button>
          ) : (
            <span>All figures</span>
          )}
        </div>
        <Gallery figures={sortedFigures} onSelect={handleSelectFigure} />
      </main>
      {activeFigure ? (
        <Lightbox
          figure={activeFigure}
          work={activeWork}
          chartTypes={chartTypes}
          colors={colors}
          onClose={handleCloseLightbox}
        />
      ) : null}
      {aboutOpen ? (
        <div className="about-modal" role="dialog" aria-modal="true">
          <button type="button" className="about-close" onClick={handleAboutClose}>
            Close
          </button>
          <div className="about-card">
            <h2>About</h2>
            <p>
              The Isotype Institute advances the original mission of ISOTYPE: turning complex
              information into clear, human-scaled visuals. Its work highlights the social and
              educational impact of pictorial statistics and the legacy of Otto and Marie Neurath.
              Today the institute supports research, preservation, and new applications of the
              visual language.
            </p>
            <p>
              RJ Andrews is a writer, researcher, and designer focused on the history of information
              graphics. He curates and produces the Isotype Chart Explorer to make rare chart
              collections accessible for study and public appreciation.
            </p>
          </div>
        </div>
      ) : null}
      <Footer />
    </div>
  );
};

export default App;
