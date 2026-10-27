import { formatDistanceToNowStrict } from "date-fns";
import { AlertCircle, Bookmark, CheckCheck, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { BOOKMARKS_ID, useAppStore } from "../store/useAppStore";
import type { Article } from "../types";

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

function relTime(ts: number | undefined): string {
  if (!ts) return "";
  return formatDistanceToNowStrict(ts, { addSuffix: false })
    .replace(/ seconds?/, "s")
    .replace(/ minutes?/, "m")
    .replace(/ hours?/, "h")
    .replace(/ days?/, "d")
    .replace(/ months?/, "mo")
    .replace(/ years?/, "y");
}

export function ArticleList() {
  const selectedSourceId = useAppStore((s) => s.selectedSourceId);
  const selectedArticleId = useAppStore((s) => s.selectedArticleId);
  const selectArticle = useAppStore((s) => s.selectArticle);
  const loadSource = useAppStore((s) => s.loadSource);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const source = useAppStore((s) => s.sources().find((x) => x.id === selectedSourceId));
  const fetchState = useAppStore((s) => (selectedSourceId ? s.fetchState[selectedSourceId] : undefined));
  const bookmarks = useAppStore((s) => s.bookmarks);
  const articles = useAppStore((s) => (selectedSourceId ? s.articlesBySource[selectedSourceId] : undefined));
  const readIds = useAppStore((s) => s.readIds);

  const isBookmarks = selectedSourceId === BOOKMARKS_ID;
  const items: Article[] = useMemo(() => (isBookmarks ? bookmarks : (articles ?? [])), [isBookmarks, bookmarks, articles]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [selectedSourceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "j" && e.key !== "k") return;
      if (items.length === 0) return;
      const idx = items.findIndex((a) => a.id === selectedArticleId);
      const next = e.key === "j" ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
      selectArticle(items[next].id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(items[next].id)}"]`)?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedArticleId, selectArticle]);

  if (!selectedSourceId) {
    return (
      <section className="flex h-full items-center justify-center border-r border-neutral-200 text-sm text-neutral-400 dark:border-neutral-800">
        Select a source
      </section>
    );
  }

  const title = isBookmarks ? "Bookmarks" : (source?.name ?? "Unknown source");
  const loading = fetchState?.status === "loading";

  return (
    <section className="flex h-full flex-col border-r border-neutral-200 dark:border-neutral-800">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800">
        {isBookmarks && <Bookmark size={14} className="text-amber-500" />}
        <h2 className="flex-1 truncate text-[13px] font-semibold">{title}</h2>
        {!isBookmarks && (
          <>
            <button
              title="Mark all as read"
              onClick={() => markAllRead(selectedSourceId)}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <CheckCheck size={15} />
            </button>
            <button
              title="Refresh"
              disabled={loading}
              onClick={() => void loadSource(selectedSourceId, true)}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </>
        )}
      </header>

      {fetchState?.status === "error" && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">Failed to load: {fetchState.error}</span>
        </div>
      )}

      <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-400">
            {loading ? "Loading…" : isBookmarks ? "No bookmarks yet" : fetchState?.status === "error" ? "Nothing cached" : "No articles"}
          </div>
        )}
        {items.map((a) => {
          const active = a.id === selectedArticleId;
          const unread = !readIds[a.id];
          return (
            <button
              key={a.id}
              data-id={a.id}
              onClick={() => selectArticle(a.id)}
              className={`block w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800/70 ${
                active ? "bg-neutral-100 dark:bg-neutral-800/70" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${unread ? "bg-sky-500" : "bg-transparent"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`line-clamp-2 text-[15px] leading-snug ${unread ? "font-semibold text-sky-800 dark:text-sky-300" : "font-medium text-sky-700/80 dark:text-sky-400/80"}`}>
                    {a.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-700 dark:text-neutral-300">{stripHtml(a.summaryHtml ?? a.contentHtml).slice(0, 200)}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-400">
                    {isBookmarks && <SourceName id={a.sourceId} />}
                    {a.author && <span className="truncate">{a.author}</span>}
                    <span className="ml-auto shrink-0 tabular-nums">{relTime(a.published)}</span>
                  </div>
                </div>
                {a.imageUrl && (
                  <img src={a.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover bg-neutral-100 dark:bg-neutral-800" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SourceName({ id }: { id: string }) {
  const name = useAppStore((s) => s.sources().find((x) => x.id === id)?.name);
  return name ? <span className="truncate font-medium text-neutral-500">{name}</span> : null;
}
