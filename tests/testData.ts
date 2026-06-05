import fs from "node:fs";
import path from "node:path";
import type { FigureRecord, FigureWithWork, WorkRecord } from "../src/lib/types";

export const repoRoot = process.cwd();
export const publicDir = path.join(repoRoot, "public");

export const readJson = <T>(relativePath: string): T => {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
};

export const works = readJson<WorkRecord[]>("public/data/works.json");
export const figures = readJson<FigureRecord[]>("public/data/figures.json");
export const ocrById = readJson<Record<string, string>>("public/data/ocr.json");

const workMap = new Map(works.map((work) => [work.workId, work]));

export const figuresWithWork: FigureWithWork[] = figures.map((figure) => {
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

export const findFigure = (id: string): FigureWithWork => {
  const figure = figuresWithWork.find((item) => item.id === id);
  if (!figure) {
    throw new Error(`Missing test figure: ${id}`);
  }
  return figure;
};
