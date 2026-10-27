import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Article, Source, SourceFetchState, Theme } from "../types";
import { DEFAULT_SOURCES, SECTIONS } from "../data/defaultSources";
import { fetchFeed } from "../services/fetchFeed";

export const BOOKMARKS_ID = "__bookmarks__";
const MAX_ARTICLES_PER_SOURCE = 60;
const MAX_READ_IDS = 5000;
const STALE_MS = 10 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const PANE_LIMITS = {
  sidebar: { min: 180, max: 420, default: 230 },
  list: { min: 280, max: 640, default: 360 },
} as const;

interface AppState {
  customSources: Source[];
  removedSourceIds: string[];
  articlesBySource: Record<string, Article[]>;
  fetchState: Record<string, SourceFetchState>;
  readIds: Record<string, number>;
  bookmarks: Article[];
  favouriteSourceIds: string[];
  theme: Theme;
  selectedSourceId: string | null;
  selectedArticleId: string | null;
  expandedSections: Record<string, boolean>;
  paneWidths: { sidebar: number; list: number };

  sources(): Source[];
  selectSource(id: string | null): void;
  selectArticle(id: string | null): void;
  loadSource(sourceId: string, force?: boolean): Promise<void>;
  markRead(id: string): void;
  markAllRead(sourceId: string): void;
  toggleBookmark(article: Article): void;
  toggleFavourite(sourceId: string): void;
  addSource(input: Omit<Source, "id" | "custom">): Source;
  removeSource(id: string): void;
  restoreDefaults(): void;
  setTheme(theme: Theme): void;
  toggleSection(id: string): void;
  setPaneWidth(pane: "sidebar" | "list", width: number): void;
}

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Drop heavy fields before persisting; full content is refetched on demand.
function slimArticle(a: Article): Article {
  const { contentHtml, ...rest } = a;
  const summary = rest.summaryHtml ?? contentHtml;
  return { ...rest, summaryHtml: summary ? summary.slice(0, 4000) : undefined };
}

// Memoized so `useAppStore((s) => s.sources())` returns a stable reference
// between renders (zustand selectors must not return fresh arrays each call).
let sourcesCache: { custom: Source[]; removed: string[]; value: Source[] } | null = null;

// Drops cached articles / read markers older than RETENTION_MS. Bookmarks and their read status are kept.
function housekeep(s: Pick<AppState, "articlesBySource" | "readIds" | "fetchState" | "bookmarks">) {
  const cutoff = Date.now() - RETENTION_MS;
  const bookmarked = new Set(s.bookmarks.map((b) => b.id));
  const articlesBySource: Record<string, Article[]> = {};
  const fetchState: Record<string, SourceFetchState> = {};
  for (const [id, list] of Object.entries(s.articlesBySource)) {
    const kept = list.filter((a) => a.published == null || a.published >= cutoff);
    if (kept.length > 0) articlesBySource[id] = kept;
  }
  for (const [id, st] of Object.entries(s.fetchState)) {
    if (st.fetchedAt == null || st.fetchedAt >= cutoff) fetchState[id] = st;
  }
  const readIds = Object.fromEntries(Object.entries(s.readIds).filter(([id, ts]) => bookmarked.has(id) || ts >= cutoff));
  return { articlesBySource, fetchState, readIds };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      customSources: [],
      removedSourceIds: [],
      articlesBySource: {},
      fetchState: {},
      readIds: {},
      bookmarks: [],
      favouriteSourceIds: [],
      theme: systemTheme(),
      selectedSourceId: null,
      selectedArticleId: null,
      expandedSections: Object.fromEntries(SECTIONS.map((s, i) => [s.id, i === 0])),
      paneWidths: { sidebar: PANE_LIMITS.sidebar.default, list: PANE_LIMITS.list.default },

      sources() {
        const { customSources, removedSourceIds } = get();
        if (sourcesCache && sourcesCache.custom === customSources && sourcesCache.removed === removedSourceIds) {
          return sourcesCache.value;
        }
        const removed = new Set(removedSourceIds);
        const value = [...DEFAULT_SOURCES, ...customSources].filter((s) => !removed.has(s.id));
        sourcesCache = { custom: customSources, removed: removedSourceIds, value };
        return value;
      },

      selectSource(id) {
        set({ selectedSourceId: id, selectedArticleId: null });
        if (id && id !== BOOKMARKS_ID) void get().loadSource(id);
      },

      selectArticle(id) {
        set({ selectedArticleId: id });
        if (id) get().markRead(id);
      },

      async loadSource(sourceId, force = false) {
        const source = get().sources().find((s) => s.id === sourceId);
        if (!source) return;
        const current = get().fetchState[sourceId];
        if (current?.status === "loading") return;
        if (!force && current?.fetchedAt && Date.now() - current.fetchedAt < STALE_MS) return;

        set((s) => ({ fetchState: { ...s.fetchState, [sourceId]: { ...current, status: "loading" } } }));
        try {
          const fetched = await fetchFeed(source);
          fetched.sort((a, b) => (b.published ?? 0) - (a.published ?? 0));
          set((s) => ({
            articlesBySource: { ...s.articlesBySource, [sourceId]: fetched.slice(0, MAX_ARTICLES_PER_SOURCE) },
            fetchState: { ...s.fetchState, [sourceId]: { status: "ok", fetchedAt: Date.now() } },
          }));
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          set((s) => ({
            fetchState: { ...s.fetchState, [sourceId]: { status: "error", fetchedAt: current?.fetchedAt, error } },
          }));
        }
      },

      markRead(id) {
        if (get().readIds[id]) return;
        set((s) => {
          const next = { ...s.readIds, [id]: Date.now() };
          const keys = Object.keys(next);
          if (keys.length > MAX_READ_IDS) {
            const bookmarked = new Set(s.bookmarks.map((b) => b.id));
            keys
              .filter((k) => !bookmarked.has(k))
              .sort((a, b) => next[a] - next[b])
              .slice(0, keys.length - MAX_READ_IDS)
              .forEach((k) => delete next[k]);
          }
          return { readIds: next };
        });
      },

      markAllRead(sourceId) {
        const items = get().articlesBySource[sourceId] ?? [];
        const now = Date.now();
        set((s) => ({ readIds: { ...s.readIds, ...Object.fromEntries(items.map((a) => [a.id, now])) } }));
      },

      toggleBookmark(article) {
        set((s) => {
          const exists = s.bookmarks.some((b) => b.id === article.id);
          return {
            bookmarks: exists ? s.bookmarks.filter((b) => b.id !== article.id) : [slimArticle(article), ...s.bookmarks],
          };
        });
      },

      toggleFavourite(sourceId) {
        set((s) => ({
          favouriteSourceIds: s.favouriteSourceIds.includes(sourceId)
            ? s.favouriteSourceIds.filter((id) => id !== sourceId)
            : [...s.favouriteSourceIds, sourceId],
        }));
      },

      addSource(input) {
        const source: Source = { ...input, id: `custom:${Date.now().toString(36)}`, custom: true };
        set((s) => ({ customSources: [...s.customSources, source] }));
        return source;
      },

      removeSource(id) {
        set((s) => {
          const isCustom = s.customSources.some((c) => c.id === id);
          const { [id]: _a, ...articlesBySource } = s.articlesBySource;
          const { [id]: _f, ...fetchState } = s.fetchState;
          return {
            customSources: isCustom ? s.customSources.filter((c) => c.id !== id) : s.customSources,
            removedSourceIds: isCustom ? s.removedSourceIds : [...s.removedSourceIds, id],
            favouriteSourceIds: s.favouriteSourceIds.filter((f) => f !== id),
            articlesBySource,
            fetchState,
            selectedSourceId: s.selectedSourceId === id ? null : s.selectedSourceId,
            selectedArticleId: s.selectedSourceId === id ? null : s.selectedArticleId,
          };
        });
      },

      restoreDefaults() {
        set({ removedSourceIds: [] });
      },

      setTheme(theme) {
        set({ theme });
      },

      toggleSection(id) {
        set((s) => ({ expandedSections: { ...s.expandedSections, [id]: !s.expandedSections[id] } }));
      },

      setPaneWidth(pane, width) {
        const { min, max } = PANE_LIMITS[pane];
        const clamped = Math.round(Math.min(max, Math.max(min, width)));
        set((s) => (s.paneWidths[pane] === clamped ? s : { paneWidths: { ...s.paneWidths, [pane]: clamped } }));
      },
    }),
    {
      name: "news-fuse",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) useAppStore.setState(housekeep(state));
      },
      partialize: (s) => ({
        customSources: s.customSources,
        removedSourceIds: s.removedSourceIds,
        articlesBySource: Object.fromEntries(
          Object.entries(s.articlesBySource).map(([k, v]) => [k, v.slice(0, 30).map(slimArticle)]),
        ),
        fetchState: Object.fromEntries(
          Object.entries(s.fetchState).map(([k, v]) => [k, { status: "idle" as const, fetchedAt: v.fetchedAt }]),
        ),
        readIds: s.readIds,
        bookmarks: s.bookmarks,
        favouriteSourceIds: s.favouriteSourceIds,
        theme: s.theme,
        selectedSourceId: s.selectedSourceId,
        expandedSections: s.expandedSections,
        paneWidths: s.paneWidths,
      }),
    },
  ),
);
