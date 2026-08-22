# Queryable Code Index

A lightweight SQLite-based code index that lets Claude Code query symbols and file dependencies on demand — without loading raw source files into context. The extraction layer is per-language (`extractor/csharp/`, `extractor/typescript/`); everything downstream (`ingest.py`, `ingest_edges.py`, `aggregate_edges.py`, `generate_layouts.py`) is language-neutral — see `extractor/CONTRACT.md` and `extractor/CONTRACT_EDGES.md`.

## How it works

| Always loaded | Cost |
|---|---|
| `CLAUDE.md` + `.codeindex/LAYOUT.md` | ~800–1000 tokens/session |

| On demand | Cost |
|---|---|
| `.codeindex/LAYOUT_<module>.md` | ~500 tokens each |
| SQLite queries via MCP | ~200–500 tokens per query |

Raw source files are **never** loaded speculatively.

---

## Repository layout

```
<repo-root>/
├── .claude/
│   └── settings.local.json      # Permissions only (MCP is registered separately — see setup)
├── .codeindex/
│   ├── extractor/
│   │   ├── CONTRACT.md          # Symbol extractor <-> ingest.py data contract
│   │   ├── CONTRACT_EDGES.md    # Edge extractor <-> ingest_edges.py data contract
│   │   ├── csharp/
│   │   │   ├── extract_symbols.csx      # Roslyn symbol extractor
│   │   │   └── extract_edges.py         # using-directive edge extractor (emits JSONL)
│   │   └── typescript/
│   │       ├── extract_symbols.js       # TS/TSX symbol extractor (TS Compiler API)
│   │       ├── extract_edges.js         # TS/TSX import/export edge extractor (emits JSONL)
│   │       └── LIMITATIONS.md           # Known gaps — read before relying on its output
│   ├── ingest.py                # Phase 3: SQLite ingest (symbols)
│   ├── ingest_edges.py          # Ingest edge JSONL into file_edges
│   ├── aggregate_edges.py       # Phase 5: Module-level edges
│   ├── generate_layouts.py      # Phase 7: Generate LAYOUT*.md files
│   ├── find_violations.py       # Utility: find architecture violations
│   ├── ctags_raw.json           # Generated — symbol dump
│   ├── edges_raw.jsonl          # Generated — edge dump
│   ├── code_index.db            # Generated — SQLite database
│   ├── LAYOUT.md                # Generated — global layout (always loaded)
│   └── LAYOUT_<module>.md       # Generated — one per module
├── CLAUDE.md                    # Navigation protocol — read by Claude Code on startup
└── update_index.ps1             # One-command full rebuild
```

---

## One-time setup

### Prerequisites

Install these once. Skip anything already present.

```powershell
# 1. dotnet-script (Roslyn extractor)
dotnet tool install -g dotnet-script

# 2. uv (SQLite MCP server runner) — restart PowerShell after
winget install astral-sh.uv

# 3. Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

---

### Full setup sequence

Run all commands from the **repo root**.

```powershell
# Step 1 — Discover projects and write module config
#   Answer 'y' when prompted.
#   This patches ingest.py (get_module) and generate_layouts.py
#   (MODULES + MODULE_DESC) in place using marker comments.
python .codeindex\discover_projects.py

# Step 2 — Extract symbols (first run downloads Roslyn NuGet, ~30s)
dotnet script .codeindex\extractor\csharp\extract_symbols.csx . .codeindex\ctags_raw.json

# Step 3 — Ingest symbols into SQLite
python .codeindex\ingest.py .codeindex\ctags_raw.json .codeindex\code_index.db

# Step 4 — Extract file-level dependency edges (C#), then ingest them
python .codeindex\extractor\csharp\extract_edges.py . .codeindex\code_index.db .codeindex\edges_raw.jsonl
python .codeindex\ingest_edges.py .codeindex\edges_raw.jsonl .codeindex\code_index.db

# Step 5 — Roll up to module-level edges
python .codeindex\aggregate_edges.py .codeindex\code_index.db

# Step 6 — Generate LAYOUT.md and LAYOUT_<module>.md files
python .codeindex\generate_layouts.py .codeindex\code_index.db .codeindex

# Step 7 — Register MCP server (once; persists across sessions)
#   Run from the repo root. Resolve-Path expands to the correct absolute path.
claude mcp add code-index --scope local -- uvx mcp-server-sqlite --db-path "$((Resolve-Path .codeindex\code_index.db).Path)"

# Verify
claude mcp list   # code-index should appear
```

After Step 3, check the printed symbol counts per module. If any module shows 0, fix `get_module()` in `ingest.py` and re-run Step 3 only (no need to re-extract):

```powershell
python .codeindex\ingest.py .codeindex\ctags_raw.json .codeindex\code_index.db
```

---

### Verify inside Claude Code

```powershell
# Open Claude Code from the repo root
claude
```

Then inside Claude Code:

```
/mcp
# Expected: code-index listed as connected

Run this SQL against code-index: SELECT COUNT(*) as total FROM symbols
# Result should match symbol count printed during Step 3
```

---

### Subsequent rebuilds

Run whenever files or projects are added/removed:

```powershell
.\update_codeindex.ps1
```

No need to re-register the MCP server after a rebuild.

---

## Rebuilding the index

Run whenever you add, remove, or significantly rename files or projects:

```powershell
.\update_codeindex.ps1
```

You do **not** need to re-register the MCP server after a rebuild — the DB path stays the same.

---

## Database schema

```sql
symbols      -- name, kind, scope, namespace, signature, access, path, line, module
files        -- path, module
file_edges   -- from_file_id → to_file_id  (using-directive relationships)
module_edges -- from_module → to_module, edge_count
reachability -- from_module → to_module, hops  (reserved for future use)
```

### Symbol kinds

This repo's extractor is TypeScript-based (`extractor/typescript/`), so the kinds actually
present in `code_index.db` are `function` · `interface` · `component` (React components) ·
`type` (type aliases). The C#-flavored kinds below (`class`, `struct`, `delegate`,
`constructor`, `event`, etc.) belong to the C# extractor (`extractor/csharp/`) and would only
appear if that extractor were run against a C# codebase — this repo doesn't use it.

Full set across both extractors: `class` · `interface` · `struct` · `record` · `record_struct` ·
`enum` · `delegate` · `method` · `constructor` · `property` · `field` · `event` · `enumMember` ·
`function` · `component` · `type`

### Useful queries

```sql
-- Find a type by name
SELECT name, kind, namespace, path, line FROM symbols WHERE name = 'MyClass';

-- All public methods on a type
SELECT name, signature, line FROM symbols
WHERE scope = 'MyClass' AND kind = 'method' AND access = 'public';

-- Find by partial name
SELECT name, kind, namespace, path, line FROM symbols
WHERE name LIKE '%Keyword%' ORDER BY module, namespace, name;

-- All public surface of a module
SELECT name, kind, scope, namespace, path, line FROM symbols
WHERE module = 'application' AND access = 'public'
ORDER BY namespace, scope, name;

-- What does file X depend on?
SELECT t.path, t.module FROM file_edges fe
JOIN files f ON f.id = fe.from_file_id
JOIN files t ON t.id = fe.to_file_id
WHERE f.path LIKE '%FileName%';

-- What files import file X?
SELECT f.path, f.module FROM file_edges fe
JOIN files f ON f.id = fe.from_file_id
JOIN files t ON t.id = fe.to_file_id
WHERE t.path LIKE '%FileName%';

-- Full module dependency graph
SELECT from_module, to_module, edge_count FROM module_edges ORDER BY edge_count DESC;

-- Find architecture violations (e.g. domain importing infrastructure)
SELECT f.path, t.path FROM file_edges fe
JOIN files f ON f.id = fe.from_file_id
JOIN files t ON t.id = fe.to_file_id
WHERE f.module = 'domain' AND t.module = 'infrastructure';
```

---

## Adapting for a new service

1. Copy the entire `.codeindex/` folder and `CLAUDE.md` and `update_index.ps1` into the new repo root.
2. Edit `get_module()` in `ingest.py` to match the new solution's project folder names.
3. Edit `MODULE_DESC` in `generate_layouts.py` with accurate descriptions.
4. Run `.\update_codeindex.ps1` from the new repo root.
5. Register the MCP server with the new absolute DB path via `claude mcp add`.

The scripts have no hardcoded paths — everything is passed as arguments by `update_index.ps1`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/mcp` shows "No MCP servers configured" | Re-run the `claude mcp add` command from Step 7. Verify with `claude mcp list`. |
| `code-index` connected but `symbols` table missing | The `--db-path` points to a non-existent or wrong file (sqlite creates an empty DB). Re-register using `$((Resolve-Path .codeindex\code_index.db).Path)`. |
| A module shows 0 symbols after ingest | Path rules in `get_module()` don't match the folder name. Fix and re-run `ingest.py`. |
| `dotnet-script` not found | Run `dotnet tool install -g dotnet-script` and restart the terminal. |
| `uvx` not found | Restart PowerShell after installing `uv` so the PATH update takes effect. |
| Symbol count drops unexpectedly | Check that `obj/` and `bin/` folders are excluded — the extractor skips them automatically. |