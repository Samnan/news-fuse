import { openUrl } from "@tauri-apps/plugin-opener";
import { format } from "date-fns";
import { Bookmark, Check, ExternalLink, FileText, Link, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReadable, sanitize } from "../services/fetchFeed";
import { BOOKMARKS_ID, useAppStore } from "../store/useAppStore";

type Mode = "summary" | "full";

export function ReaderPane() {
  const article = useAppStore((s) => {
    if (!s.selectedArticleId) return undefined;
    const list = s.selectedSourceId === BOOKMARKS_ID ? s.bookmarks : (s.articlesBySource[s.selectedSourceId ?? ""] ?? []);
    return list.find((a) => a.id === s.selectedArticleId);
  });
  const source = useAppStore((s) => s.sources().find((x) => x.id === article?.sourceId));
  const bookmarked = useAppStore((s) => !!article && s.bookmarks.some((b) => b.id === article.id));
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);

  const [mode, setMode] = useState<Mode>("summary");
  const [full, setFull] = useState<{ html: string; title?: string; byline?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copyLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }, []);

  // Load full content when the selected article changes.
  useEffect(() => {
    setFull(null);
    setError(null);
    setMode("summary");
    scrollRef.current?.scrollTo({ top: 0 });
    if (!article?.link) return;

    let cancelled = false;
    setLoading(true);
    fetchReadable(article.link)
      .then((r) => {
        if (cancelled) return;
        if (r && r.contentHtml.length > 0) {
          setFull({ html: r.contentHtml, title: r.title, byline: r.byline });
          setMode("full");
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [article?.id, article?.link]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!article) return;
      if (e.key === "o") void openUrl(article.link);
      if (e.key === "b") toggleBookmark(article);
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) void copyLink(article.link);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, toggleBookmark, copyLink]);

  if (!article) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-2 text-neutral-400">
        <FileText size={28} strokeWidth={1.25} />
        <p className="text-sm">Select an article to read</p>
        <p className="text-xs text-neutral-400/80">
          <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd> navigate ·{" "}
          <kbd className="rounded border px-1">o</kbd> open in browser · <kbd className="rounded border px-1">c</kbd> copy link ·{" "}
          <kbd className="rounded border px-1">b</kbd> bookmark
        </p>
      </section>
    );
  }

  const summaryHtml = sanitize(article.contentHtml ?? article.summaryHtml ?? "");
  const html = mode === "full" && full ? full.html : summaryHtml;

  return (
    <section className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <span className="flex-1 truncate text-xs text-neutral-500">{source?.name}</span>
        {full && (
          <div className="mr-2 flex rounded-md border border-neutral-200 text-[11px] dark:border-neutral-700">
            <button onClick={() => setMode("summary")} className={segClass(mode === "summary")}>Summary</button>
            <button onClick={() => setMode("full")} className={segClass(mode === "full")}>Full</button>
          </div>
        )}
        {loading && <Loader2 size={14} className="mr-1 animate-spin text-neutral-400" />}
        <button
          title={bookmarked ? "Remove bookmark (b)" : "Bookmark (b)"}
          onClick={() => toggleBookmark(article)}
          className={`rounded-md p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${bookmarked ? "text-amber-500" : "text-neutral-500"}`}
        >
          <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
        </button>
        <button
          title={copied ? "Copied" : "Copy link (c)"}
          onClick={() => void copyLink(article.link)}
          className={`rounded-md p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
            copied ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          {copied ? <Check size={15} /> : <Link size={15} />}
        </button>
        <button
          title="Open in browser (o)"
          onClick={() => void openUrl(article.link)}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <ExternalLink size={15} />
        </button>
      </header>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto">
        <article className="w-full px-10 py-10">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight" style={{ userSelect: "text" }}>
            {article.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
            {(full?.byline || article.author) && <span>{full?.byline || article.author}</span>}
            {article.published && <span>{format(article.published, "PPp")}</span>}
            <button onClick={() => void openUrl(article.link)} className="truncate text-sky-700 hover:underline dark:text-sky-400">
              {hostname(article.link)}
            </button>
          </div>
          {error && <p className="mt-4 text-xs text-red-600 dark:text-red-400">Could not load full article: {error}</p>}
          {html ? (
            <div
              className="reader mt-8"
              onClick={(e) => {
                // Keep in-content links from navigating the webview; open externally instead.
                const a = (e.target as HTMLElement).closest("a");
                if (a?.href && /^https?:/i.test(a.href)) {
                  e.preventDefault();
                  void openUrl(a.href);
                }
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="mt-8 text-sm text-neutral-400">{loading ? "Loading article…" : "No content available. Open in browser to read."}</p>
          )}
        </article>
      </div>
    </section>
  );
}

function segClass(active: boolean) {
  return `px-2 py-0.5 ${active ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"}`;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
