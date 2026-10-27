export interface Section {
  id: string;
  name: string;
}

export interface Source {
  id: string;
  sectionId: string;
  name: string;
  url: string;
  siteUrl?: string;
  custom?: boolean;
}

export interface Article {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  author?: string;
  published?: number;
  summaryHtml?: string;
  contentHtml?: string;
  imageUrl?: string;
}

export interface SourceFetchState {
  status: "idle" | "loading" | "ok" | "error";
  fetchedAt?: number;
  error?: string;
}

export type Theme = "light" | "dark";
