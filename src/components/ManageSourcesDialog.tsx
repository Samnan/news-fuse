import { Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_SOURCES, SECTIONS } from "../data/defaultSources";
import { fetchFeed } from "../services/fetchFeed";
import { useAppStore } from "../store/useAppStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManageSourcesDialog({ open, onClose }: Props) {
  const sources = useAppStore((s) => s.sources());
  const removedCount = useAppStore((s) => s.removedSourceIds.length);
  const addSource = useAppStore((s) => s.addSource);
  const removeSource = useAppStore((s) => s.removeSource);
  const restoreDefaults = useAppStore((s) => s.restoreDefaults);
  const selectSource = useAppStore((s) => s.selectSource);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sectionId, setSectionId] = useState(SECTIONS[0].id);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("Enter a valid http(s) feed URL.");
      return;
    }
    if (sources.some((s) => s.url === trimmed)) {
      setError("That feed is already in your sources.");
      return;
    }
    setTesting(true);
    try {
      const probe = { id: "probe", sectionId, name: name.trim() || trimmed, url: trimmed };
      const items = await fetchFeed(probe);
      if (items.length === 0) throw new Error("Feed parsed but contains no items.");
      const created = addSource({ sectionId, name: name.trim() || hostname(trimmed), url: trimmed, siteUrl: siteFromFeed(trimmed) });
      setName("");
      setUrl("");
      selectSource(created.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2 className="text-[14px] font-semibold">Manage sources</h2>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X size={16} />
          </button>
        </header>

        <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className={inputClass}
          />
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={inputClass}>
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={testing || !url.trim()}
            className="flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {testing && <Loader2 size={14} className="animate-spin" />}
            Add
          </button>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className={`${inputClass} col-span-3`}
            autoFocus
          />
          {error && <p className="col-span-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-3">
          {SECTIONS.map((section) => {
            const list = sources.filter((s) => s.sectionId === section.id);
            if (list.length === 0) return null;
            return (
              <div key={section.id} className="mb-4">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{section.name}</h3>
                {list.map((src) => (
                  <div key={src.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">
                        {src.name}
                        {src.custom && <span className="ml-2 rounded bg-sky-100 px-1 text-[10px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">custom</span>}
                      </div>
                      <div className="truncate text-[11px] text-neutral-400">{src.url}</div>
                    </div>
                    <button
                      title="Remove"
                      onClick={() => removeSource(src.id)}
                      className="rounded-md p-1 text-neutral-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <footer className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800">
          <span>
            {sources.length} sources · {DEFAULT_SOURCES.length - removedCount} of {DEFAULT_SOURCES.length} defaults
          </span>
          {removedCount > 0 && (
            <button onClick={restoreDefaults} className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100">
              <RotateCcw size={12} /> Restore {removedCount} removed default{removedCount === 1 ? "" : "s"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400";

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function siteFromFeed(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
