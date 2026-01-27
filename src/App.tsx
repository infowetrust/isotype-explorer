import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "./components/Header";
import FiltersBar from "./components/FiltersBar";
import Gallery from "./components/Gallery";
import Lightbox from "./components/Lightbox";
import Footer from "./components/Footer";
import { buildSearchIndex, runSearch } from "./lib/search";
import { matchesFilters } from "./lib/filters";
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
  const [features, setFeatures] = useState<FeatureConfig[]>([]);
  const [colors, setColors] = useState<ColorConfig[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [worksRes, figuresRes, chartTypesRes, featuresRes, colorsRes] =
        await Promise.all([
          fetch("/data/works.json"),
          fetch("/data/figures.json"),
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
  const viewMode = (searchParams.get("view") as ViewMode) || "figures";
  const lightboxId = searchParams.get("id");
  const selectedBaseTypes = useMemo(
    () => selectedTypes.filter((type) => type !== "combo"),
    [selectedTypes]
  );
  const selectedFeatureType =
    selectedBaseTypes.length === 1 ? selectedBaseTypes[0] : null;
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
    if (!selectedFeatureType) {
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

  const availableFeatures = useMemo(() => {
    if (!selectedFeatureType) {
      return [];
    }
    const set = new Set<string>();
    const base = filterBase({ useTypes: true, useColors: true, useFeatures: false });
    base.forEach((figure) => {
      const byType = figure.featuresByType ?? {};
      (byType[selectedFeatureType] ?? []).forEach((item) => set.add(item));
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id, label: featureLabels[id] ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [featureLabels, filterBase, selectedFeatureType]);

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
  }, [filterBase]);

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

  const displayTypes = useMemo(() => {
    const ids = Object.keys(typeSortCounts);
    return ids.map((id) => ({
      id,
      label: chartTypeLabels[id] ?? id
    }));
  }, [chartTypeLabels, typeSortCounts]);

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
    () => sortFigures(filteredFigures, sortKey, scoreById),
    [filteredFigures, sortKey, scoreById]
  );

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
      />
      <FiltersBar
        chartTypes={displayTypes}
        availableFeatures={availableFeatures}
        typeCounts={typeCounts}
        typeSortCounts={typeSortCounts}
        colors={colors}
        colorCounts={colorCounts}
        colorSortCounts={colorSortCounts}
        works={works}
        selectedTypes={selectedTypes}
        selectedFeatures={selectedFeatures}
        selectedColors={selectedColors}
        onlyBlack={onlyBlack}
        selectedWorkId={selectedWorkId}
        sortKey={sortKey}
        viewMode={viewMode}
          viewCounts={viewCounts}
          onToggleType={handleToggleType}
          onToggleFeature={handleToggleFeature}
          onToggleColor={handleToggleColor}
          onWorkChange={handleWorkChange}
        onSortChange={handleSortChange}
        onViewChange={handleViewChange}
        onClearAll={handleReset}
      />
      <main className="gallery-wrap">
        <Gallery
          figures={sortedFigures}
          allFigures={figuresWithWork}
          sortKey={sortKey}
          viewMode={viewMode}
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
          colors={colors}
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
              For generations, Isotype charts and diagrams have inspired information designers. Explore a growing collection of Isotype figures using this interactive explorer created by RJ Andrews.
            </p>
          </div>
        </div>
      ) : null}
      <Footer />
    </div>
  );
};

export default App;
