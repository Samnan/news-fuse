import { useEffect, useState } from "react";
import { ArticleList } from "./components/ArticleList";
import { ManageSourcesDialog } from "./components/ManageSourcesDialog";
import { ReaderPane } from "./components/ReaderPane";
import { ResizeHandle } from "./components/ResizeHandle";
import { Sidebar } from "./components/Sidebar";
import { BOOKMARKS_ID, PANE_LIMITS, useAppStore } from "./store/useAppStore";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const paneWidths = useAppStore((s) => s.paneWidths);
  const setPaneWidth = useAppStore((s) => s.setPaneWidth);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Re-fetch the previously selected source on startup (store rehydrates fetchState as idle).
  useEffect(() => {
    const { selectedSourceId, loadSource } = useAppStore.getState();
    if (selectedSourceId && selectedSourceId !== BOOKMARKS_ID) void loadSource(selectedSourceId);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="h-full shrink-0 overflow-hidden" style={{ width: paneWidths.sidebar }}>
        <Sidebar onManageSources={() => setManageOpen(true)} />
      </div>
      <ResizeHandle
        onResize={(d) => setPaneWidth("sidebar", useAppStore.getState().paneWidths.sidebar + d)}
        onDoubleClick={() => setPaneWidth("sidebar", PANE_LIMITS.sidebar.default)}
      />
      <div className="h-full shrink-0 overflow-hidden" style={{ width: paneWidths.list }}>
        <ArticleList />
      </div>
      <ResizeHandle
        onResize={(d) => setPaneWidth("list", useAppStore.getState().paneWidths.list + d)}
        onDoubleClick={() => setPaneWidth("list", PANE_LIMITS.list.default)}
      />
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <ReaderPane />
      </div>
      <ManageSourcesDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
