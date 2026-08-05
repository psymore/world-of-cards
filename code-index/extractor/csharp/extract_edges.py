"""
Extract file-level import edges (C#) — emits the edge JSONL contract
(extractor/CONTRACT_EDGES.md) instead of writing SQLite directly.

Reads .cs files, parses `using` directives, and resolves each to the
file(s) that own a symbol in the matching namespace — exactly the same
namespace-based resolution this extractor has always used. That
resolution is read from the already-ingested `symbols`/`files` tables in
code_index.db: unlike extract_symbols.csx, this extractor is not purely
syntactic. A C# namespace is a many-to-many grouping decoupled from file
identity, so resolving `using Foo.Bar;` to a specific file requires
knowing which files declare symbols in that namespace — information only
available after ingest.py has already run once. This DB read is a real,
language-specific input dependency, not something this boundary hides
(see CONTRACT_EDGES.md's "Semantics are language-specific" section).

This script never writes to code_index.db — ingest_edges.py is the only
thing that writes file_edges now.

Usage: python extract_edges.py [repo_root] [code_index.db] [output_file]
"""

import json
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

# ── Args ──────────────────────────────────────────────────────────────────────
repo_root   = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
db_file     = sys.argv[2] if len(sys.argv) > 2 else "code_index.db"
output_file = sys.argv[3] if len(sys.argv) > 3 else "edges_raw.jsonl"

# ── Connect (read-only use — never writes to code_index.db) ───────────────────
con = sqlite3.connect(db_file)
con.row_factory = sqlite3.Row
cur = con.cursor()

# ── Build namespace → file map from DB ─────────────────────────────────────────
print("[edges] Building namespace -> file map from DB ...")

ns_to_files: dict[str, set[int]] = defaultdict(set)
for row in cur.execute("SELECT DISTINCT file_id, namespace FROM symbols WHERE namespace IS NOT NULL"):
    ns_to_files[row["namespace"]].add(row["file_id"])

print(f"[edges] {len(ns_to_files)} distinct namespaces indexed")

# ── Build file id <-> path maps from DB ────────────────────────────────────────
path_to_id: dict[str, int] = {}
id_to_path: dict[int, str] = {}
for row in cur.execute("SELECT id, path FROM files"):
    path_to_id[row["path"]] = row["id"]
    id_to_path[row["id"]] = row["path"]

con.close()

# ── Regex for using directives (unchanged) ─────────────────────────────────────
# Matches: using Foo.Bar.Baz;  (static and alias forms are ignored — they don't
# represent file dependencies in the way we care about)
USING_RE = re.compile(r"^\s*using\s+((?!static\s)(?!\w+\s*=))([\w.]+)\s*;", re.MULTILINE)

# ── Process each file (unchanged resolution logic) ─────────────────────────────
print("[edges] Scanning .cs files for using directives ...")

edges: set[tuple[int, int]] = set()   # (from_file_id, to_file_id)
files_scanned  = 0
usings_found   = 0
usings_matched = 0

for db_path, from_id in path_to_id.items():
    abs_path = repo_root / db_path
    try:
        code = abs_path.read_text(encoding="utf-8-sig", errors="replace")
    except FileNotFoundError:
        continue

    files_scanned += 1
    found_namespaces = USING_RE.findall(code)   # list of (_, namespace) tuples
    namespaces = [ns for _, ns in found_namespaces]
    usings_found += len(namespaces)

    for ns in namespaces:
        # 1. Exact match
        targets = ns_to_files.get(ns)

        # 2. Prefix match — using Foo.Bar might be satisfied by files in Foo.Bar.Baz
        if not targets:
            targets = set()
            for known_ns, fids in ns_to_files.items():
                if known_ns.startswith(ns):
                    targets |= fids

        if not targets:
            continue  # unresolved/external namespace — no edge emitted

        usings_matched += 1
        for to_id in targets:
            if to_id != from_id:          # skip self-loops
                edges.add((from_id, to_id))

print(f"[edges] Scanned {files_scanned} files")
print(f"[edges] {usings_found} using directives found, {usings_matched} matched to internal namespaces")
print(f"[edges] {len(edges)} unique directed file edges")

# ── Emit edge JSONL (extractor/CONTRACT_EDGES.md) ──────────────────────────────
seen_pairs: set[tuple[str, str]] = set()
with open(output_file, "w", encoding="utf-8") as out:
    for from_id, to_id in edges:
        pair = (id_to_path[from_id], id_to_path[to_id])
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        out.write(json.dumps({"from": pair[0], "to": pair[1]}) + "\n")

print(f"[edges] {len(seen_pairs)} edges written to {output_file}")
print("\n[edges] Extraction complete")
