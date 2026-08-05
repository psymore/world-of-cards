"""
Ingest edge JSONL (extractor/CONTRACT_EDGES.md) into file_edges.
Usage: python ingest_edges.py [edges.jsonl] [code_index.db] [module_map.json]

Reads the language-neutral edge contract and resolves each {"from", "to"}
path pair against the files table (already populated by ingest.py) to
write file_edges rows. Has no knowledge of any language or how the edge
JSONL was produced — mirrors ingest.py's own separation between "how
symbols were extracted" and "how extracted data is consumed"
(extractor/CONTRACT.md), applied to edges instead of symbols.

Phase 7D found that `files` rows are only ever created by ingest.py for
paths that produced at least one symbol — so a real file with zero
captured symbols (a barrel `index.ts`, a plain data/const module, a test
file) never gets a files row, and every edge pointing at it was silently
dropped here. An edge extractor only ever emits a path after confirming
the file is real on disk (extract_edges.js's isFile() / extract_edges.py's
successful read) — that's strictly stronger evidence than "produced a
symbol". So: if an edge references a path with no existing files row,
this script creates it — path and module only, resolved via the exact
same module_map.json logic ingest.py uses. No symbols are fabricated;
only the file's identity is recovered. This is deliberately narrower than
making ingest.py itself discover every repository file: a file nothing
ever imports stays invisible, same as before — only edge-referenced
files are recovered.

Replaces file_edges wholesale on every run (DELETE then INSERT) — the
same DELETE-before-INSERT pattern the old extract_edges.py used directly
against SQLite, now applied after resolving paths from the JSONL instead
of resolving them from parsed source. Safe to re-run with the same input.
Ingesting a second language's edge JSONL later would overwrite the first
run's edges rather than adding to them — combining multiple extractors'
edges in one ingest isn't addressed yet (see CONTRACT_EDGES.md), since
only one edge extractor (C#) exists today.
"""

import json
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODULE_MAP_PATH = SCRIPT_DIR / "module_map.json"

input_file      = sys.argv[1] if len(sys.argv) > 1 else "edges_raw.jsonl"
db_file         = sys.argv[2] if len(sys.argv) > 2 else "code_index.db"
module_map_file = sys.argv[3] if len(sys.argv) > 3 else str(DEFAULT_MODULE_MAP_PATH)

if not Path(db_file).exists():
    sys.exit(f"[ingest-edges] {db_file} not found — run ingest.py first")
if not Path(input_file).exists():
    sys.exit(f"[ingest-edges] {input_file} not found — run an edge extractor first")


def load_module_map(path):
    """Identical resolution semantics to ingest.py's load_module_map():
    substring containment on the lowercased path, checked in the JSON
    array's declared order (first match wins), falling back to defaultKey.
    Duplicated here rather than imported — ingest.py executes its pipeline
    immediately at import time (reads sys.argv, connects to the DB), so it
    isn't safely importable as a library; this keeps the two in sync by
    construction (word-for-word matching logic), not by shared code.
    """
    map_path = Path(path)
    if not map_path.exists():
        sys.exit(f"[ingest-edges] module_map.json not found at {map_path} — run discover_projects.py first")

    data = json.loads(map_path.read_text(encoding="utf-8"))
    modules = data.get("modules", [])
    default_key = data.get("defaultKey", "api")

    def get_module(path):
        p = path.lower()
        for m in modules:
            if m["pathPrefix"] in p:
                return m["key"]
        return default_key

    return get_module


get_module = load_module_map(module_map_file)

con = sqlite3.connect(db_file)
cur = con.cursor()

# ── Build path -> file_id map from DB ──────────────────────────────────────────
path_to_id: dict[str, int] = {}
for file_id, path in cur.execute("SELECT id, path FROM files"):
    path_to_id[path] = file_id

# ── Load edge JSONL ─────────────────────────────────────────────────────────────
print(f"[ingest-edges] Reading {input_file} ...")
records = []
with open(input_file, encoding="utf-8-sig") as f:
    for i, line in enumerate(f, 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as e:
            print(f"[WARN] Line {i} skipped: {e}")

print(f"[ingest-edges] {len(records)} edge records loaded")

# ── Recover missing file identities (Phase 7E) ──────────────────────────────────
# Path only, module only — no placeholder or synthetic symbol rows.
new_files_created = 0
for r in records:
    for key in ("from", "to"):
        p = r.get(key, "")
        if p and p not in path_to_id:
            module = get_module(p)
            cur.execute("INSERT INTO files (path, module) VALUES (?, ?)", (p, module))
            path_to_id[p] = cur.lastrowid
            new_files_created += 1

con.commit()
print(f"[ingest-edges] {new_files_created} file rows recovered (path + module only, no symbols)")

# ── Resolve paths to file_ids ────────────────────────────────────────────────────
resolved: set[tuple[int, int]] = set()
skipped = 0
for r in records:
    from_id = path_to_id.get(r.get("from", ""))
    to_id = path_to_id.get(r.get("to", ""))
    if from_id is None or to_id is None:
        skipped += 1
        continue
    resolved.add((from_id, to_id))

print(f"[ingest-edges] {len(resolved)} edges resolved ({skipped} skipped — path not in files table)")

# ── Write file_edges ──────────────────────────────────────────────────────────────
cur.execute("DELETE FROM file_edges")
cur.executemany(
    "INSERT OR IGNORE INTO file_edges (from_file_id, to_file_id) VALUES (?, ?)",
    resolved,
)
con.commit()
con.close()

print(f"[ingest-edges] file_edges populated ({len(resolved)} rows)")
