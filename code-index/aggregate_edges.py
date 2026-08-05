"""
Phase 4b — Aggregate file_edges into module_edges + reachability
Usage: python aggregate_edges.py [code_index.db]

Reads the already-populated file_edges table, resolves each edge's module
via the files table (module column, already assigned by ingest.py via
module_map.json), and writes:

  module_edges  — cross-module edge counts. Self-loops (from_module ==
                  to_module) are excluded: a module depending on itself
                  isn't a cross-module relationship worth reporting —
                  matches the existing "Cross-module edge summary"
                  convention already used by extract_edges.py's own
                  sanity report (WHERE f.module != t.module).
  reachability  — transitive closure of module_edges: for every module
                  pair (A, B) reachable by following one or more direct
                  module_edges, the shortest hop count.

This script has no knowledge of any language, extractor, or how
file_edges was populated. It only consumes file_edges (joined with
files.module, which is plain database data, not language knowledge). If
file_edges is empty, this produces empty module_edges/reachability, not
an error — "if file_edges exists, aggregation works" holds either way.
"""

import sys
from collections import defaultdict, deque
from pathlib import Path
import sqlite3

db_file = sys.argv[1] if len(sys.argv) > 1 else "code_index.db"

if not Path(db_file).exists():
    sys.exit(f"[aggregate] {db_file} not found — run ingest.py first")

con = sqlite3.connect(db_file)
con.row_factory = sqlite3.Row
cur = con.cursor()

# ── Resolve file_edges to module pairs ─────────────────────────────────────
print("[aggregate] Reading file_edges ...")
rows = cur.execute("""
    SELECT f.module AS from_module, t.module AS to_module
    FROM file_edges fe
    JOIN files f ON f.id = fe.from_file_id
    JOIN files t ON t.id = fe.to_file_id
""").fetchall()
print(f"[aggregate] {len(rows)} file-level edges found")

# ── module_edges: cross-module edge counts ─────────────────────────────────
counts = defaultdict(int)
for row in rows:
    if row["from_module"] == row["to_module"]:
        continue
    counts[(row["from_module"], row["to_module"])] += 1

print(f"[aggregate] {len(counts)} distinct cross-module edges")

cur.execute("DELETE FROM module_edges")
cur.executemany(
    "INSERT INTO module_edges (from_module, to_module, edge_count) VALUES (?, ?, ?)",
    [(fm, tm, cnt) for (fm, tm), cnt in counts.items()],
)
con.commit()
print("[aggregate] module_edges populated")

# ── reachability: transitive closure of module_edges (shortest hops) ───────
adjacency = defaultdict(set)
modules = set()
for fm, tm in counts:
    adjacency[fm].add(tm)
    modules.add(fm)
    modules.add(tm)

reachable = []
for start in modules:
    hops_from_start = {start: 0}
    queue = deque([start])
    while queue:
        current = queue.popleft()
        for neighbor in adjacency.get(current, ()):
            if neighbor not in hops_from_start:
                hops_from_start[neighbor] = hops_from_start[current] + 1
                queue.append(neighbor)
    for target, hops in hops_from_start.items():
        if target != start:
            reachable.append((start, target, hops))

print(f"[aggregate] {len(reachable)} reachable module pairs (transitive closure)")

cur.execute("DELETE FROM reachability")
cur.executemany(
    "INSERT INTO reachability (from_module, to_module, hops) VALUES (?, ?, ?)",
    reachable,
)
con.commit()
print("[aggregate] reachability populated")

con.close()
print("\n[aggregate] Phase 4b complete")
