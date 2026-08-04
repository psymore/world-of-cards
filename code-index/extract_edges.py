"""
Phase 4 — Extract file-level import edges
Reads .cs files, parses `using` directives, maps namespaces → files via the DB,
and populates the file_edges table.

Usage: python extract_edges.py [repo_root] [code_index.db]
"""

import re
import sqlite3
import sys
from pathlib import Path
from collections import defaultdict

# ── Args ──────────────────────────────────────────────────────────────────────
repo_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
db_file   = sys.argv[2] if len(sys.argv) > 2 else "code_index.db"

# ── Connect ───────────────────────────────────────────────────────────────────
con = sqlite3.connect(db_file)
con.row_factory = sqlite3.Row
cur = con.cursor()

# ── Build namespace → file_ids map from DB ────────────────────────────────────
# A file "owns" a namespace if it contains at least one symbol in that namespace.
# We also index on namespace prefixes so that:
#   using Arcelik.Oliz.Member.Domain.Entities  →  matches files whose namespace
#   starts with that string (exact match preferred, prefix as fallback).
print("[edges] Building namespace → file map from DB ...")

ns_to_files: dict[str, set[int]] = defaultdict(set)

for row in cur.execute("SELECT DISTINCT file_id, namespace FROM symbols WHERE namespace IS NOT NULL"):
    ns_to_files[row["namespace"]].add(row["file_id"])

print(f"[edges] {len(ns_to_files)} distinct namespaces indexed")

# ── Build file path → file_id map from DB ─────────────────────────────────────
path_to_id: dict[str, int] = {}
for row in cur.execute("SELECT id, path FROM files"):
    path_to_id[row["path"]] = row["id"]

# ── Regex for using directives ────────────────────────────────────────────────
# Matches: using Foo.Bar.Baz;  (static and alias forms are ignored — they don't
# represent file dependencies in the way we care about)
USING_RE = re.compile(r"^\s*using\s+((?!static\s)(?!\w+\s*=))([\w.]+)\s*;", re.MULTILINE)

# ── Process each file ─────────────────────────────────────────────────────────
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
            continue

        usings_matched += 1
        for to_id in targets:
            if to_id != from_id:          # skip self-loops
                edges.add((from_id, to_id))

print(f"[edges] Scanned {files_scanned} files")
print(f"[edges] {usings_found} using directives found, {usings_matched} matched to internal namespaces")
print(f"[edges] {len(edges)} unique directed file edges")

# ── Insert edges ──────────────────────────────────────────────────────────────
cur.execute("DELETE FROM file_edges")   # clean slate if re-running

cur.executemany(
    "INSERT OR IGNORE INTO file_edges (from_file_id, to_file_id) VALUES (?, ?)",
    edges
)
con.commit()
print(f"[edges] file_edges table populated")

# ── Sanity report ─────────────────────────────────────────────────────────────
print("\n── Edges by source module ───────────────────────────")
for row in cur.execute("""
    SELECT f.module, COUNT(*) as cnt
    FROM file_edges fe
    JOIN files f ON f.id = fe.from_file_id
    GROUP BY f.module
    ORDER BY cnt DESC
"""):
    print(f"  {row['module']:<16} {row['cnt']:>5} outgoing edges")

print("\n── Cross-module edge summary ─────────────────────────")
for row in cur.execute("""
    SELECT f.module as src, t.module as dst, COUNT(*) as cnt
    FROM file_edges fe
    JOIN files f ON f.id = fe.from_file_id
    JOIN files t ON t.id = fe.to_file_id
    WHERE f.module != t.module
    GROUP BY src, dst
    ORDER BY cnt DESC
"""):
    print(f"  {row['src']:<16} → {row['dst']:<16} {row['cnt']:>4}")

print("\n── Top 10 most-imported files ───────────────────────")
for row in cur.execute("""
    SELECT f.path, f.module, COUNT(*) as cnt
    FROM file_edges fe
    JOIN files f ON f.id = fe.to_file_id
    GROUP BY fe.to_file_id
    ORDER BY cnt DESC
    LIMIT 10
"""):
    print(f"  [{row['module']:<14}] {row['cnt']:>4}x  {row['path']}")

con.close()
print("\n[edges] Phase 4 complete")
