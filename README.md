# News Fuse

A lightweight desktop RSS/Atom reader built with [Tauri 2](https://v2.tauri.app/), React 19, TypeScript and Vite. Feeds are fetched natively through `tauri-plugin-http`, parsed in the frontend, and articles are rendered with Mozilla Readability + DOMPurify. State lives in a Zustand store persisted locally; there is no backend.

## Project layout

```
src/                  React frontend
  components/         Sidebar, ArticleList, ReaderPane, ManageSourcesDialog, ...
  data/               Default feed sources
  services/           Feed fetching (Tauri HTTP) and RSS/Atom parsing
  store/              Zustand app store
src-tauri/            Rust shell, Tauri config and capabilities
scripts/              Dev utilities (feed health checks, probing)
.github/workflows/    Release workflow (auto-versioned GitHub Releases)
```

## Prerequisites

- Node.js 22+ and npm
- Rust (stable) via [rustup](https://rustup.rs/)
- Platform dependencies for Tauri — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
  - Linux: `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio C++ Build Tools and WebView2

## Development

```sh
npm install
npm run tauri dev
```

This starts Vite on `http://localhost:1420` and launches the Tauri window with hot reload. To work on the frontend only (without the native shell), run `npm run dev`; note that feed fetching requires the Tauri runtime.

Useful scripts:

```sh
npm run build                  # type-check and build the frontend into dist/
node scripts/check-feeds.mjs   # verify all default feed sources respond with valid feeds
node scripts/probe.mjs         # ad-hoc feed probing
```

## Building a release

```sh
npm run tauri build
```

Bundles are written to `src-tauri/target/release/bundle/` (`.dmg`/`.app` on macOS, `.deb`/`.AppImage`/`.rpm` on Linux, `.msi`/`.exe` on Windows). To build for a specific target, e.g. an Intel Mac from Apple Silicon:

```sh
rustup target add x86_64-apple-darwin
npm run tauri build -- --target x86_64-apple-darwin
```

### CI releases

Every push to `master` runs `.github/workflows/release.yml`, which builds for macOS (arm64 + x64), Linux and Windows and publishes a GitHub Release. The version is derived automatically from the number of files changed since the last `v*` tag:

| Files changed | Bump  |
| ------------- | ----- |
| > 50          | major |
| > 10          | minor |
| otherwise     | patch |

The first release starts at `1.0.0`. The computed version is injected into `package.json` and `src-tauri/tauri.conf.json` at build time, so the versions committed in the repo are not authoritative.

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) with the [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extensions.

## License

This project is licensed under the GNU Lesser General Public License v3.0 (LGPL-3.0). See [LICENSE](LICENSE) for the full text.
