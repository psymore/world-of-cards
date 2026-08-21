# 3D code-index viewer

Interactive 3D force graph of the modules, files, and dependencies stored in `../code_index.db`. Project-agnostic: module colors/labels are derived from whatever modules `graph.json` actually contains (see `js/config.js`), not hardcoded per project.

## Files

- `export_graph.py` - reads `../code_index.db` and writes `graph.json` in this folder.
- `index.html` - viewer markup; loads `styles.css` and the `js/*.js` modules.
- `styles.css` - all viewer styles.
- `js/config.js` - module colors and labels.
- `js/state.js` - shared `state` object.
- `js/legend.js` - legend rendering.
- `js/detail.js` - detail panel rendering.
- `js/graph.js` - ForceGraph3D setup and `rebuild()`.
- `js/main.js` - fetches `graph.json` and wires DOM events.
- `serve.ps1` - starts `python -m http.server` against this folder.
- `graph.json` - generated, gitignored.

## Use

```powershell
# 1. (re)generate the data file
python code-index\viewer\export_graph.py

# 2. open the viewer
#    Browsers block fetch() over file:// for security, so serve the folder over HTTP:
python -m http.server 8000 --directory code-index\viewer
# then visit http://localhost:8000
```

Any static server works (`npx serve`, IIS, etc.). The viewer is fully client-side.

## Controls

- Drag = rotate, scroll = zoom, right-drag = pan.
- Click a module sphere or file node to open the detail panel.
- Toggle "Show files" to collapse to module-only view.
- Toggle "Show file-level edges" to overlay the full import-edge graph (heavy on larger codebases - keep off unless investigating coupling).
- Search box filters file nodes by path or filename in real time.
- Node size / link distance sliders tune the layout.

## Color legend

Each module gets a color assigned at load time from a fixed palette (`js/config.js`, `initModuleColors()`), in sorted module-id order — so it's stable across reloads without per-project configuration. The in-app legend (bottom panel) is always the source of truth for which color maps to which module in the current dataset.

Symbol access values are extractor-defined and differ per language (see `code-index/extractor/CONTRACT.md`) - e.g. C# emits `public`/`private`/`protected`, TypeScript top-level declarations emit `exported`/`module-private`. The detail panel colors by substring-matching `"private"`/`"protected"` in the raw value (`js/detail.js`'s `accessClass()`), the same convention `generate_layouts.py` uses, so it renders sensibly regardless of which extractor produced the data.

## Refreshing after an index rebuild

```powershell
.\code-index\update_codeindex.ps1                # regenerate the DB
python code-index\viewer\export_graph.py         # regenerate graph.json
```

No need to restart the static server; just reload the page.
