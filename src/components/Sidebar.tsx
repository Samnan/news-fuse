import { Bookmark, ChevronRight, Moon, Plus, Star, Sun, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SECTIONS } from "../data/defaultSources";
import { BOOKMARKS_ID, useAppStore } from "../store/useAppStore";
import type { Source } from "../types";

interface Props {
  onManageSources: () => void;
}

interface MenuState {
  source: Source;
  x: number;
  y: number;
}

export function Sidebar({ onManageSources }: Props) {
  const sources = useAppStore((s) => s.sources());
  const selectedSourceId = useAppStore((s) => s.selectedSourceId);
  const selectSource = useAppStore((s) => s.selectSource);
  const expanded = useAppStore((s) => s.expandedSections);
  const toggleSection = useAppStore((s) => s.toggleSection);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const bookmarkCount = useAppStore((s) => s.bookmarks.length);
  const favouriteIds = useAppStore((s) => s.favouriteSourceIds);
  const toggleFavourite = useAppStore((s) => s.toggleFavourite);
  const removeSource = useAppStore((s) => s.removeSource);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Source | null>(null);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPendingDelete(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openMenu = (source: Source, e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ source, x: e.clientX, y: e.clientY });
  };

  const bySection = new Map<string, Source[]>();
  for (const src of sources) {
    const list = bySection.get(src.sectionId) ?? [];
    list.push(src);
    bySection.set(src.sectionId, list);
  }
  const customSections = [...bySection.keys()].filter((id) => !SECTIONS.some((s) => s.id === id));
  const favourites = favouriteIds.map((id) => sources.find((s) => s.id === id)).filter((s): s is Source => !!s);
  const isFavourite = menu ? favouriteIds.includes(menu.source.id) : false;

  return (
    <aside className="flex h-full flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-[15px] font-semibold tracking-tight">News Fuse</h1>
        <button
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => selectSource(BOOKMARKS_ID)}
          className={rowClass(selectedSourceId === BOOKMARKS_ID)}
        >
          <Bookmark size={14} className="shrink-0 text-amber-500" />
          <span className="flex-1 truncate">Bookmarks</span>
          {bookmarkCount > 0 && <span className="text-[11px] text-neutral-400">{bookmarkCount}</span>}
        </button>

        <div className="mt-3">
          <div className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Star size={12} className="fill-current" />
            <span className="truncate">Favourites</span>
            {favourites.length > 0 && <span className="ml-auto font-normal text-neutral-400">{favourites.length}</span>}
          </div>
          <div className="mt-0.5">
            {favourites.length === 0 ? (
              <p className="px-2 py-1 text-xs text-neutral-400">Right-click a source to add it here.</p>
            ) : (
              favourites.map((src) => (
                <SourceRow
                  key={src.id}
                  source={src}
                  active={selectedSourceId === src.id}
                  onSelect={selectSource}
                  onContextMenu={openMenu}
                />
              ))
            )}
          </div>
        </div>

        {[...SECTIONS, ...customSections.map((id) => ({ id, name: id }))].map((section) => {
          const list = bySection.get(section.id) ?? [];
          if (list.length === 0) return null;
          const open = expanded[section.id] ?? false;
          return (
            <div key={section.id} className="mt-3">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
              >
                <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                <span className="truncate">{section.name}</span>
                <span className="ml-auto font-normal text-neutral-400">{list.length}</span>
              </button>
              {open && (
                <div className="mt-0.5">
                  {list.map((src) => (
                    <SourceRow
                      key={src.id}
                      source={src}
                      active={selectedSourceId === src.id}
                      onSelect={selectSource}
                      onContextMenu={openMenu}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
        <button
          onClick={onManageSources}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <Plus size={14} />
          Manage sources
        </button>
      </div>

      {menu && (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-50 min-w-[180px] rounded-md border border-neutral-200 bg-white p-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
        >
          <button
            role="menuitem"
            onClick={() => {
              toggleFavourite(menu.source.id);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <Star size={14} className={isFavourite ? "fill-amber-500 text-amber-500" : ""} />
            {isFavourite ? "Remove from Favourites" : "Add to Favourites"}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setPendingDelete(menu.source);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 size={14} />
            Delete source
          </button>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onMouseDown={(e) => e.target === e.currentTarget && setPendingDelete(null)}
        >
          <div role="alertdialog" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
            <h2 className="text-[14px] font-semibold">Delete source?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Remove <span className="font-medium text-neutral-900 dark:text-neutral-100">{pendingDelete.name}</span> and its cached
              articles from the sidebar?{" "}
              {!pendingDelete.custom && "You can bring it back via Manage sources → Restore defaults."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => {
                  removeSource(pendingDelete.id);
                  setPendingDelete(null);
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function rowClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
    active
      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
      : "text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
  }`;
}

function SourceRow({
  source,
  active,
  onSelect,
  onContextMenu,
}: {
  source: Source;
  active: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (source: Source, e: React.MouseEvent) => void;
}) {
  const unread = useAppStore((s) => {
    const items = s.articlesBySource[source.id];
    if (!items) return 0;
    return items.reduce((n, a) => n + (s.readIds[a.id] ? 0 : 1), 0);
  });
  const status = useAppStore((s) => s.fetchState[source.id]?.status);

  return (
    <button
      onClick={() => onSelect(source.id)}
      onContextMenu={(e) => onContextMenu(source, e)}
      className={rowClass(active)}
      title={source.url}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          status === "error" ? "bg-red-500" : status === "loading" ? "animate-pulse bg-sky-500" : unread > 0 ? "bg-sky-500" : "bg-transparent"
        }`}
      />
      <span className="flex-1 truncate">{source.name}</span>
      {unread > 0 && (
        <span className={`text-[11px] tabular-nums ${active ? "opacity-70" : "text-neutral-400"}`}>{unread}</span>
      )}
    </button>
  );
}
