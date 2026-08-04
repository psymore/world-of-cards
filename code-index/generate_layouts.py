"""
Phase 7 — Auto-generate LAYOUT.md and per-module layout files
Usage: python generate_layouts.py [code_index.db] [output_dir] [module_map.json]

Outputs:
  LAYOUT.md               ← always loaded (~50 lines, global nav)
  LAYOUT_<module>.md      ← one per module in module_map.json
"""

import json
import sqlite3
import sys
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODULE_MAP_PATH = SCRIPT_DIR / "module_map.json"

db_file         = sys.argv[1] if len(sys.argv) > 1 else "code_index.db"
output_dir      = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
module_map_file = sys.argv[3] if len(sys.argv) > 3 else str(DEFAULT_MODULE_MAP_PATH)


def load_module_map(path):
    map_path = Path(path)
    if not map_path.exists():
        sys.exit(f"[layout] module_map.json not found at {map_path} — run discover_projects.py first")

    data = json.loads(map_path.read_text(encoding="utf-8"))
    modules = data.get("modules", [])
    keys = [m["key"] for m in modules]
    desc = {m["key"]: m["description"] for m in modules}
    return keys, desc


MODULES, MODULE_DESC = load_module_map(module_map_file)

con = sqlite3.connect(db_file)
con.row_factory = sqlite3.Row
cur = con.cursor()

# ── Helpers ───────────────────────────────────────────────────────────────────

def q(sql, *args):
    return cur.execute(sql, args).fetchall()

def q1(sql, *args):
    row = cur.execute(sql, args).fetchone()
    return row[0] if row else None

def module_stats(m):
    files   = q1("SELECT COUNT(*) FROM files WHERE module=?", m)
    symbols = q1("SELECT COUNT(*) FROM symbols WHERE module=?", m)
    return files, symbols

def module_namespaces(m):
    return q("""
        SELECT namespace, COUNT(*) as cnt
        FROM symbols
        WHERE module=? AND namespace IS NOT NULL
        GROUP BY namespace
        ORDER BY cnt DESC
        LIMIT 12
    """, m)

def top_classes(m, limit=20):
    return q("""
        SELECT s.name, s.namespace, s.kind
        FROM symbols s
        WHERE s.module=? AND s.kind IN ('class','interface','record','enum','struct')
          AND s.access='public' AND s.scope IS NULL
        ORDER BY s.name
        LIMIT ?
    """, m, limit)

def most_imported(m, limit=8):
    return q("""
        SELECT f.path, COUNT(*) as cnt
        FROM file_edges fe
        JOIN files f ON f.id = fe.to_file_id
        WHERE f.module=?
        GROUP BY fe.to_file_id
        ORDER BY cnt DESC
        LIMIT ?
    """, m, limit)

def outgoing_modules(m):
    return q("""
        SELECT to_module, edge_count
        FROM module_edges
        WHERE from_module=?
        ORDER BY edge_count DESC
    """, m)

def incoming_modules(m):
    return q("""
        SELECT from_module, edge_count
        FROM module_edges
        WHERE to_module=?
        ORDER BY edge_count DESC
    """, m)

def top_public_methods(m, limit=15):
    return q("""
        SELECT s.name, s.scope, s.signature
        FROM symbols s
        WHERE s.module=? AND s.kind='method' AND s.access='public'
        ORDER BY s.scope, s.name
        LIMIT ?
    """, m, limit)

# ── LAYOUT.md (global, always loaded) ────────────────────────────────────────

def generate_global():
    lines = []
    lines.append("# LAYOUT.md — Queryable Code Index")
    lines.append("")
    lines.append("## Codebase")
    lines.append("Language: C# / .NET · Architecture: Clean Architecture + DDD + CQRS")

    total_files   = q1("SELECT COUNT(*) FROM files")
    total_symbols = q1("SELECT COUNT(*) FROM symbols")
    lines.append(f"Scale: {total_files} files · {total_symbols} symbols across 5 modules")
    lines.append("")

    lines.append("## Modules")
    lines.append("| Key            | Project / Role |")
    lines.append("|----------------|----------------|")
    for m in MODULES:
        files, symbols = module_stats(m)
        lines.append(f"| `{m:<14}` | {MODULE_DESC[m]} ({files}f / {symbols}s) |")
    lines.append("")

    lines.append("## Dependency Graph (cross-module edges)")
    lines.append("```")
    for row in q("SELECT from_module, to_module, edge_count FROM module_edges ORDER BY edge_count DESC"):
        lines.append(f"  {row['from_module']:<16} → {row['to_module']:<16} ({row['edge_count']} file edges)")
    lines.append("```")
    lines.append("")

    lines.append("## Per-module layout files")
    for m in MODULES:
        lines.append(f"- LAYOUT_{m}.md")
    lines.append("")

    lines.append("## Query protocol (CLAUDE.md)")
    lines.append("1. Check this file for module ownership")
    lines.append("2. Load LAYOUT_<module>.md for namespace/class map")
    lines.append("3. Query DB: `SELECT * FROM symbols WHERE name LIKE ?`")
    lines.append("4. Fetch source only for files you need")
    lines.append("")
    lines.append("## DB location")
    lines.append("`code_index.db` — SQLite, WAL mode")
    lines.append("")
    lines.append("Tables: `symbols` · `files` · `file_edges` · `module_edges` · `reachability`")
    lines.append("")
    lines.append("### Useful queries")
    lines.append("```sql")
    lines.append("-- Find a class")
    lines.append("SELECT name, kind, namespace, path, line FROM symbols WHERE name = 'MyClass';")
    lines.append("")
    lines.append("-- All public methods on a class")
    lines.append("SELECT name, signature, line FROM symbols")
    lines.append("WHERE scope = 'MyClass' AND kind = 'method' AND access = 'public';")
    lines.append("")
    lines.append("-- What files does file X import?")
    lines.append("SELECT t.path FROM file_edges fe")
    lines.append("JOIN files t ON t.id = fe.to_file_id")
    lines.append("JOIN files f ON f.id = fe.from_file_id")
    lines.append("WHERE f.path LIKE '%FileName%';")
    lines.append("")
    lines.append("-- All public surface of a module")
    lines.append("SELECT name, kind, scope, namespace FROM symbols")
    lines.append("WHERE module = 'application' AND access = 'public'")
    lines.append("ORDER BY namespace, scope, name;")
    lines.append("```")

    return "\n".join(lines)

# ── Per-module layout ─────────────────────────────────────────────────────────

def generate_module(m):
    files, symbols = module_stats(m)
    lines = []
    lines.append(f"# LAYOUT_{m}.md")
    lines.append("")
    lines.append(f"**{MODULE_DESC[m]}**")
    lines.append(f"Files: {files} · Symbols: {symbols}")
    lines.append("")

    # Dependencies
    out = outgoing_modules(m)
    inc = incoming_modules(m)
    if out:
        deps = ", ".join(f"`{r['to_module']}` ({r['edge_count']})" for r in out)
        lines.append(f"**Depends on:** {deps}")
    if inc:
        used = ", ".join(f"`{r['from_module']}` ({r['edge_count']})" for r in inc)
        lines.append(f"**Used by:** {used}")
    lines.append("")

    # Namespaces
    nss = module_namespaces(m)
    if nss:
        lines.append("## Namespaces")
        for row in nss:
            lines.append(f"- `{row['namespace']}` ({row['cnt']} symbols)")
        lines.append("")

    # Key types
    classes = top_classes(m, limit=30)
    if classes:
        lines.append("## Key public types (top 30)")
        lines.append("| Name | Kind | Namespace |")
        lines.append("|------|------|-----------|")
        for row in classes:
            ns = row['namespace'] or ""
            lines.append(f"| `{row['name']}` | {row['kind']} | `{ns}` |")
        lines.append("")

    # Most imported files
    hot = most_imported(m, limit=8)
    if hot:
        lines.append("## Most-imported files (hotspots)")
        for row in hot:
            fname = Path(row['path']).name
            lines.append(f"- `{fname}` — {row['cnt']}x  `{row['path']}`")
        lines.append("")

    return "\n".join(lines)

# ── Write files ───────────────────────────────────────────────────────────────

global_md = generate_global()
(output_dir / "LAYOUT.md").write_text(global_md, encoding="utf-8")
print(f"[layout] LAYOUT.md written ({len(global_md.splitlines())} lines)")

for m in MODULES:
    content = generate_module(m)
    fname = f"LAYOUT_{m}.md"
    (output_dir / fname).write_text(content, encoding="utf-8")
    print(f"[layout] {fname} written ({len(content.splitlines())} lines)")

con.close()
print("\n[layout] Phase 7 complete")
