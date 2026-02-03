export type WorkRecord = {
  workId: string;
  year?: number;
  title: string;
  series?: string;
  authors?: string[];
  publisher?: string;
  publisherCity?: string;
  heightCm?: number;
};

export type FigureRecord = {
  id: string;
  workId: string;
  page?: number;
  figureCode?: number;
  width?: number;
  height?: number;
  thumb: string;
  view: string;
  types: string[];
  typesFlat?: string[];
  isCombo?: boolean;
  featuresByType?: Record<string, string[]>;
  featuresFlat?: string[];
  colors: string[];
  onlyBlack?: boolean;
  themes?: string[];
  aiDescription?: string;
  ocrText?: string;
  title?: string;
};

export type ChartTypeConfig = {
  id: string;
  label: string;
  emoji?: string;
};

export type FeatureConfig = {
  id: string;
  label: string;
};

export type ColorConfig = {
  id: string;
  label: string;
  hex: string;
};

export type FigureWithWork = FigureRecord & {
  workTitle?: string;
  workYear?: number;
  workAuthors?: string[];
  workPublisher?: string;
  workPublisherCity?: string;
  workSeries?: string;
};
