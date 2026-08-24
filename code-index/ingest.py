"""
Phase 3 — Ingest symbols into SQLite
Usage: python ingest.py [ctags_raw.json] [code_index.db] [module_map.json]
"""

import json
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODULE_MAP_PATH = SCRIPT_DIR / "module_map.json"

# ── Args ──────────────────────────────────────────────────────────────────────
input_file      = sys.argv[1] if len(sys.argv) > 1 else "ctags_raw.json"
db_file         = sys.argv[2] if len(sys.argv) > 2 else "code_index.db"
module_map_file = sys.argv[3] if len(sys.argv) > 3 else str(DEFAULT_MODULE_MAP_PATH)


def load_module_map(path):
    """Loads module_map.json and returns a get_module(namespace, path) resolver.

    Matching is prefix-anchored (the path must start with pathPrefix + "/",
    or equal it exactly) on the lowercased file path — a plain substring
    check previously matched e.g. "apps/mobile" against
    "worktrees/other-checkout/apps/mobile/x.ts" too, silently merging an
    unrelated checkout's files into this repo's own module. Ties (a path
    matching more than one prefix) go to the longest — i.e. most specific —
    matching prefix, not array order.
    """
    map_path = Path(path)
    if not map_path.exists():
        sys.exit(f"[ingest] module_map.json not found at {map_path} — run discover_projects.py first")

    data = json.loads(map_path.read_text(encoding="utf-8"))
    modules = data.get("modules", [])
    default_key = data.get("defaultKey", "api")

    def get_module(namespace, path):
        p = path.lower()
        best = None
        for m in modules:
            prefix = m["pathPrefix"]
            if p == prefix or p.startswith(prefix + "/"):
                if best is None or len(prefix) > len(best["pathPrefix"]):
                    best = m
        return best["key"] if best else default_key

    return get_module


get_module = load_module_map(module_map_file)

# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS files (
    id      INTEGER PRIMARY KEY,
    path    TEXT NOT NULL UNIQUE,
    module  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    kind      TEXT NOT NULL,
    scope     TEXT,
    namespace TEXT,
    signature TEXT,
    access    TEXT NOT NULL,
    file_id   INTEGER NOT NULL REFERENCES files(id),
    line      INTEGER NOT NULL,
    module    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_edges (
    from_file_id  INTEGER NOT NULL REFERENCES files(id),
    to_file_id    INTEGER NOT NULL REFERENCES files(id),
    PRIMARY KEY (from_file_id, to_file_id)
);

CREATE TABLE IF NOT EXISTS module_edges (
    from_module  TEXT NOT NULL,
    to_module    TEXT NOT NULL,
    edge_count   INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (from_module, to_module)
);

CREATE TABLE IF NOT EXISTS reachability (
    from_module  TEXT NOT NULL,
    to_module    TEXT NOT NULL,
    hops         INTEGER NOT NULL,
    PRIMARY KEY (from_module, to_module)
);

CREATE INDEX IF NOT EXISTS idx_symbols_name      ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind      ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_module    ON symbols(module);
CREATE INDEX IF NOT EXISTS idx_symbols_scope     ON symbols(scope);
CREATE INDEX IF NOT EXISTS idx_symbols_namespace ON symbols(namespace);
CREATE INDEX IF NOT EXISTS idx_symbols_file      ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_file_edges_from   ON file_edges(from_file_id);
CREATE INDEX IF NOT EXISTS idx_file_edges_to     ON file_edges(to_file_id);
"""

# ── Load JSON ─────────────────────────────────────────────────────────────────
print(f"[ingest] Reading {input_file} ...")
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

print(f"[ingest] {len(records)} records loaded")

# ── Build file registry ───────────────────────────────────────────────────────
# Collect unique paths and assign module
file_map: dict[str, dict] = {}   # path -> {module}
for r in records:
    path = r.get("path", "")
    if path and path not in file_map:
        file_map[path] = {"module": get_module(r.get("namespace"), path)}

print(f"[ingest] {len(file_map)} unique files")

# ── Write to DB ───────────────────────────────────────────────────────────────
if Path(db_file).exists():
    Path(db_file).unlink()
    print(f"[ingest] Removed existing {db_file}")

con = sqlite3.connect(db_file)
cur = con.cursor()

# Apply schema (statement by statement)
for stmt in SCHEMA.strip().split(";"):
    stmt = stmt.strip()
    if stmt:
        cur.execute(stmt)
con.commit()
print("[ingest] Schema created")

# Insert files
file_id_map: dict[str, int] = {}
for path, meta in file_map.items():
    cur.execute(
        "INSERT INTO files (path, module) VALUES (?, ?)",
        (path, meta["module"])
    )
    file_id_map[path] = cur.lastrowid

con.commit()
print(f"[ingest] {len(file_id_map)} files inserted")

# Insert symbols
symbol_rows = []
skipped = 0
for r in records:
    path = r.get("path", "")
    file_id = file_id_map.get(path)
    if file_id is None:
        skipped += 1
        continue

    symbol_rows.append((
        r.get("name", ""),
        r.get("kind", ""),
        r.get("scope"),
        r.get("namespace"),
        r.get("signature"),
        # "unspecified", not "private" — an extractor for a language with no
        # access-modifier concept shouldn't have a false claim fabricated for it
        r.get("access", "unspecified"),
        file_id,
        r.get("line", 0),
        file_map[path]["module"],
    ))

cur.executemany(
    """INSERT INTO symbols
       (name, kind, scope, namespace, signature, access, file_id, line, module)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    symbol_rows
)
con.commit()

print(f"[ingest] {len(symbol_rows)} symbols inserted  ({skipped} skipped)")

# -- Sanity report ---------------------------------------------------------
# Plain ASCII on purpose: Windows' default console codepage (cp1252) can't
# encode box-drawing characters and print() crashes with UnicodeEncodeError
# on some terminals - same pitfall update_codeindex.ps1 already avoids.
print("\n-- Symbol counts by module --------------------------")
for row in cur.execute(
    "SELECT module, COUNT(*) FROM symbols GROUP BY module ORDER BY COUNT(*) DESC"
):
    print(f"  {row[0]:<16} {row[1]:>5}")

print("\n-- Symbol counts by kind -----------------------------")
for row in cur.execute(
    "SELECT kind, COUNT(*) FROM symbols GROUP BY kind ORDER BY COUNT(*) DESC"
):
    print(f"  {row[0]:<16} {row[1]:>5}")

print("\n-- Files per module ----------------------------------")
for row in cur.execute(
    "SELECT module, COUNT(*) FROM files GROUP BY module ORDER BY COUNT(*) DESC"
):
    print(f"  {row[0]:<16} {row[1]:>5}")

con.close()
print(f"\n[ingest] Done — {db_file} ready")
