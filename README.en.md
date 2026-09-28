# Weasel Skin Studio

A visual skin / theme studio for the **Weasel** input method (小狼毫).  
Built with **Tauri 2 + Vue 3 + Element Plus + Vite**. Preview skins in real time and write them back to your local `weasel.yaml`.

- Chinese docs: [README.md](./README.md)
- License: [GPL-3.0](./LICENSE)

---

## For Users

### What it is

Edit Weasel skins without hand-writing YAML: colors, fonts, layout, and candidate styling — with a live preview.

### Get the app

Download from this repo’s **Releases** (or build your own into `release/`):

| File | Description |
|------|-------------|
| `Weasel-Skin-Studio-x.y.z-setup.exe` | Windows installer (recommended) |
| `Weasel-Skin-Studio-x.y.z-portable.exe` | Portable / no-install build |

Use `SHA256SUMS.txt` in the same folder to verify downloads.

### Features

- **Live preview** for candidate window, preedit, labels, comments, highlights, and shadows
- **Color editing** covering `preset_color_schemes` fields (window / preedit / candidates / comments / highlights / paging)
- **Layout & typography**: borders, radius, spacing, font size, label format, mark characters
- **color_format** conversion between `abgr` / `rgba` / `argb`
- **Studio mode**: bind a local `weasel.yaml`, preview writes, upsert schemes, update `style`, delete schemes
- **Import / Export**: load `weasel.yaml`, export paste-ready YAML snippets
- **Built-in presets**: Nord, Ink Pool, Dark Hall, Xiaohe Feiyang, Metro Blue, and more

### How to use

1. Open Weasel Skin Studio
2. Start from a preset, or **Import YAML** from your current `weasel.yaml`
3. Tweak colors, fonts, and layout — the right panel previews live
4. Apply to Weasel:
   - **Studio mode (recommended)**: use **Open weasel.yaml** in the top bar and write back
   - **Manual**: **Export YAML**, then paste into the matching sections of your user `weasel.yaml`
5. Redeploy or restart Weasel to apply

Typical `weasel.yaml` locations:

- `%APPDATA%\Rime\weasel.yaml` (Weasel user directory)
- `data\weasel.yaml` under the Weasel install directory

> File-system scan is limited by security models. Pick the file with the file dialog. If opened read-only, use **Download current file** and copy it yourself.

---

## For Developers

### Requirements

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [Rust](https://www.rust-lang.org/) with `cargo` on PATH
- Windows 10/11 (primary target for desktop packaging)

### Quick start

```bash
npm install
npm run tauri:dev    # desktop app (recommended)
# or frontend only
npm run dev          # http://localhost:5173
```

### Build & package

```bash
# frontend bundle
npm run build

# Tauri desktop build
npm run tauri:build

# one-shot release packaging into release/ (recommended for publishing)
build-release.bat
```

`build-release.bat` will:

1. Check Node / npm / Rust
2. Install dependencies if needed
3. Run `npm run tauri:build`
4. Collect and rename artifacts into root `release/`:
   - `Weasel-Skin-Studio-<version>-setup.exe` (NSIS installer)
   - `Weasel-Skin-Studio-<version>-portable.exe` (portable main exe)
   - `SHA256SUMS.txt` (checksums)

Optional flag:

```bat
build-release.bat --skip-build
```

Skips compilation and only re-collects existing build outputs (useful for naming/debug).

Version is read from the `version` field in root `package.json`.

### Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri 2 |
| Frontend | Vue 3 SFC |
| UI | Element Plus |
| Bundler | Vite 6 |
| YAML | js-yaml |
| System APIs | `@tauri-apps/plugin-fs` / `plugin-dialog` |

### Project layout

```
weasel-skin-studio/
├── build-release.bat          # one-click packaging script
├── package.json
├── vite.config.js
├── index.html
├── src/                       # Vue frontend
│   ├── App.vue
│   ├── components/            # SkinStudio · LivePreview · ColorField
│   ├── composables/           # useSkinStore
│   ├── data/presets.js        # built-in color presets
│   ├── styles/main.css
│   └── utils/                 # color · weaselYaml · weaselFileEdit · fileAccess
└── src-tauri/                 # Tauri / Rust
    ├── tauri.conf.json
    ├── icons/                 # icon.svg + PNG / ICO derivatives
    └── src/                   # main.rs · lib.rs
```

### Icons

Vector source: `src-tauri/icons/icon.svg` (flat palette, black & yellow).  
Derived assets: `icon.png`, `icon.ico`, `32x32.png`, `128x128.png`.  
After changing the icon, refresh those files and keep `bundle.icon` / `bundle.windows.nsis` in `src-tauri/tauri.conf.json` in sync.

### Repo & GitHub Releases

- `.gitignore` excludes `node_modules/`, `dist`, `src-tauri/target/`, `/release/`, etc., so the repo is GitHub-ready
- Do **not** commit installers from `release/`; attach `setup` / `portable` and `SHA256SUMS.txt` on **GitHub Releases** instead
- If the build breaks after moving the project (stale absolute paths in Cargo cache), delete `src-tauri/target/` and package again

### Debugging

```bash
npm run tauri:dev      # desktop window with hot reload
npm run preview        # preview production frontend build
```

---

## License

GNU General Public License v3.0 — see [LICENSE](./LICENSE).
