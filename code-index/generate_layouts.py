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

# Deliberately conditional, not a fixed per-language section: a module
# with no namespace-bearing symbols (e.g. every current TypeScript module —
# extractor/typescript/ never fabricates a namespace, see CONTRACT.md)
# simply yields an empty result, and the caller skips the section entirely
# rather than rendering it empty. This already is the "smallest correct
# solution" for namespace handling — no rename or removal needed, the
# existing IS NOT NULL filter + conditional render was already right.
def module_namespaces(m):
    return q("""
        SELECT namespace, COUNT(*) as cnt
        FROM symbols
        WHERE module=? AND namespace IS NOT NULL
        GROUP BY namespace
        ORDER BY cnt DESC
        LIMIT 12
    """, m)

def pluralize(word):
    if word.endswith(("s", "sh", "ch", "x", "z")):
        return word + "es"
    if word.endswith("y") and word[-2:-1] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"

def kind_heading(kind):
    plural = pluralize(kind)
    return plural[0].upper() + plural[1:]

# Language-neutral "what's here" summary. Every symbol kind actually
# present in the module gets its own group — not a fixed per-language
# list like the old top_classes()/top_public_methods() this replaces, so
# TypeScript's "component"/"function"/"type" and C#'s "class"/"struct"/
# "delegate" are treated identically: whatever kind values the extractor
# used, that's what shows up here.
#
# "access NOT LIKE '%private%'" replaces the old "access='public'" filter.
# access vocabulary is entirely extractor-defined (see extractor/
# CONTRACT.md) — C# uses "public"/"private"/"private protected"/etc.,
# TypeScript uses "exported"/"module-private" for top-level declarations
# and "public"/"private"/"protected" for class members. There is no
# shared "public" value to filter on across languages. A substring check
# for "private" works for both without hardcoding either vocabulary, and
# correctly treats C#'s "private protected" as private-like too. Symbols
# with an unrecognized or missing access value (e.g. ingest.py's
# "unspecified" fallback) are shown, not hidden — surfacing real indexed
# data beats silently dropping it on an unrecognized value.
def symbols_by_kind(m):
    rows = q("""
        SELECT kind, name, scope
        FROM symbols
        WHERE module=? AND access NOT LIKE '%private%'
        ORDER BY kind, (scope IS NOT NULL), scope, name
    """, m)
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["kind"]].append(row)
    return grouped

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

# ── LAYOUT.md (global, always loaded) ────────────────────────────────────────

def generate_global():
    lines = []
    lines.append("# LAYOUT.md — Queryable Code Index")
    lines.append("")
    lines.append("## Codebase")

    total_files   = q1("SELECT COUNT(*) FROM files")
    total_symbols = q1("SELECT COUNT(*) FROM symbols")
    lines.append(f"Scale: {total_files} files · {total_symbols} symbols across {len(MODULES)} modules")
    lines.append("")

    lines.append("## Modules")
    lines.append("| Key            | Project / Role |")
    lines.append("|----------------|----------------|")
    for m in MODULES:
        files, symbols = module_stats(m)
        lines.append(f"| `{m:<14}` | {MODULE_DESC[m]} ({files}f / {symbols}s) |")
    lines.append("")

    lines.append("## Dependency Graph (cross-module edges)")
    edges = q("SELECT from_module, to_module, edge_count FROM module_edges ORDER BY edge_count DESC")
    if edges:
        lines.append("```")
        for row in edges:
            lines.append(f"  {row['from_module']:<16} → {row['to_module']:<16} ({row['edge_count']} file edges)")
        lines.append("```")
    else:
        # Not necessarily zero real dependencies — no edge extractor has
        # run for every language present (extract_edges.py is C#-only,
        # see extractor/typescript/LIMITATIONS.md). Say so explicitly
        # rather than rendering an empty code block, which would look
        # like "checked, found nothing" instead of "not indexed yet".
        lines.append("_(no edge data indexed)_")
    lines.append("")

    lines.append("## Per-module layout files")
    for m in MODULES:
        lines.append(f"- LAYOUT_{m}.md")
    lines.append("")

    lines.append("## Query protocol (CLAUDE.md)")
    lines.append("1. Check this file for module ownership")
    lines.append("2. Load LAYOUT_<module>.md for that module's symbol summary")
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
    lines.append("-- Find a symbol by name")
    lines.append("SELECT name, kind, namespace, path, line FROM symbols WHERE name = 'MySymbol';")
    lines.append("")
    lines.append("-- All methods on a class/type (access vocabulary is extractor-defined —")
    lines.append("-- see extractor/CONTRACT.md before filtering on a specific access value)")
    lines.append("SELECT name, signature, line, access FROM symbols")
    lines.append("WHERE scope = 'MyClass' AND kind = 'method';")
    lines.append("")
    lines.append("-- What files does file X import?")
    lines.append("SELECT t.path FROM file_edges fe")
    lines.append("JOIN files t ON t.id = fe.to_file_id")
    lines.append("JOIN files f ON f.id = fe.from_file_id")
    lines.append("WHERE f.path LIKE '%FileName%';")
    lines.append("")
    lines.append("-- Everything indexed in a module, grouped by kind")
    lines.append("SELECT kind, name, scope, access FROM symbols")
    lines.append("WHERE module = 'application'")
    lines.append("ORDER BY kind, scope, name;")
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

    # Dependencies — always rendered, explicit about absent data rather
    # than silently omitting the line. "No edge data indexed" is true
    # whether a module genuinely has zero dependencies or simply has no
    # edge extractor for its language yet (extract_edges.py is C#-only) —
    # deliberately not distinguishing the two, since that would require
    # this script to branch on which language produced the data, which is
    # exactly the kind of per-language special-casing this phase removes.
    out = outgoing_modules(m)
    inc = incoming_modules(m)
    if out:
        deps = ", ".join(f"`{r['to_module']}` ({r['edge_count']})" for r in out)
        lines.append(f"**Depends on:** {deps}")
    else:
        lines.append("**Depends on:** _(no edge data indexed for this module)_")
    if inc:
        used = ", ".join(f"`{r['from_module']}` ({r['edge_count']})" for r in inc)
        lines.append(f"**Used by:** {used}")
    else:
        lines.append("**Used by:** _(no edge data indexed for this module)_")
    lines.append("")

    # Namespaces — conditional by design, see module_namespaces()'s docstring
    nss = module_namespaces(m)
    if nss:
        lines.append("## Namespaces")
        for row in nss:
            lines.append(f"- `{row['namespace']}` ({row['cnt']} symbols)")
        lines.append("")

    # Symbol summary — one section per kind actually present, alphabetical
    # by kind for determinism (not a fixed per-language priority order).
    # See symbols_by_kind()'s docstring for the access-filtering rationale.
    grouped = symbols_by_kind(m)
    per_kind_limit = 30
    for kind in sorted(grouped.keys()):
        rows = grouped[kind]
        lines.append(f"## {kind_heading(kind)}")
        shown = rows[:per_kind_limit]
        for row in shown:
            label = f"{row['scope']}.{row['name']}" if row["scope"] else row["name"]
            lines.append(f"- `{label}`")
        remaining = len(rows) - len(shown)
        if remaining > 0:
            lines.append(f"- _(+{remaining} more)_")
        lines.append("")

    # Most imported files
    hot = most_imported(m, limit=8)
    lines.append("## Most-imported files (hotspots)")
    if hot:
        for row in hot:
            fname = Path(row['path']).name
            lines.append(f"- `{fname}` — {row['cnt']}x  `{row['path']}`")
    else:
        lines.append("_(no edge data indexed for this module)_")
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
