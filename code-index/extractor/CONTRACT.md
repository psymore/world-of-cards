# Extractor Contract

This document describes the data contract between a language extractor and
`ingest.py`. Any extractor — `extractor/csharp/extract_symbols.csx` today,
a future extractor for another language — must produce output in this shape.
`ingest.py` itself has no knowledge of what language produced its input; it
only knows this contract.

The goal of this contract is not a perfect or complete symbol schema. It is
a stable minimum: the smallest set of fields `ingest.py` genuinely depends
on, plus a documented, honest account of everything else.

## Output format

Newline-delimited JSON (JSON Lines). One JSON object per line, one line per
symbol. `ingest.py` reads the file with `utf-8-sig` (tolerant of a BOM) and
skips/warns on any line that fails to parse — a malformed line does not
abort the run.

## Required fields

Fields every extractor must provide. "Required" here means concretely: if
absent, the record is either dropped or stored with a sentinel value that
signals "unknown" rather than a real value.

| Field | Type | What happens if it's missing |
|---|---|---|
| `path` | string | **The record is silently dropped.** `path` is the join key between a symbol and its file — `ingest.py` groups records by `path` to build the `files` table, and any record whose `path` doesn't resolve to a known file is counted in `skipped` and never reaches the `symbols` table. This is the one field that isn't just "important," it's mechanically load-bearing. Must be relative to the repo root, forward-slash separated. |
| `name` | string | Defaults to `""`. Not mechanically enforced, but a nameless symbol can't be looked up by anything downstream — treat this as required in practice. |
| `kind` | string | Defaults to `""`. See "Opaque fields" below — the *value* is never validated, but the field itself should always be present so downstream grouping (by `generate_layouts.py`, or a direct SQL query) has something to group on. |
| `line` | integer | Defaults to `0`, a sentinel that is never a real line number. Treat as required in practice. |

## Optional fields

Fields that enrich the index but are genuinely safe to omit — `ingest.py`
stores their absence as SQL `NULL` with no loss of correctness and no
fabricated fallback value.

| Field | Type | Notes |
|---|---|---|
| `scope` | string \| null | Enclosing type/definition name(s), dot-joined, or `null` for a top-level symbol. Common in OOP languages (nested classes); less meaningful for languages without nested type declarations — `null` is the correct thing to emit there, not an empty string. |
| `namespace` | string \| null | Enclosing namespace/module path, or `null` if none. **Verified while reviewing `ingest.py`: this field is not actually used by module resolution.** `load_module_map()`'s `get_module(namespace, path)` closure takes a `namespace` parameter but its body only ever inspects `path` — the parameter is vestigial. `namespace` is currently read only by `extractor/csharp/extract_edges.py` (out of scope for this contract — see `extractor/CONTRACT_EDGES.md`) to resolve `using` directives; the TypeScript edge extractor (`extractor/typescript/extract_edges.js`) resolves import specifiers directly and never reads `namespace` at all. A language extractor with no namespace/module-path concept can simply omit this field with zero effect on indexing. |
| `signature` | string \| null | Human-readable parameter/return signature, or `null` when not applicable. Format is entirely extractor-defined — nothing downstream parses it. |

## The `access` field — required by schema, optional in practice

`access` sits between the two categories above, so it gets its own note.
The SQL schema has `access TEXT NOT NULL` — this is a schema-level
constraint on `ingest.py`'s side, not something an extractor needs to
satisfy directly. If an extractor omits `access` entirely, `ingest.py`
substitutes `"unspecified"` (not `"private"` — see below), and the record
is stored normally.

**Why `"unspecified"` and not `"private"`:** the C# extractor calls
`GetAccess()` unconditionally for every symbol, and that function always
returns a real value — even its own internal fallback (`"private"`, when
no explicit modifier is present) is a correct C# language fact, not a
gap. So the C# extractor's output is unaffected either way. But a language
with no access-modifier concept at all (a TypeScript top-level function,
a Python module-level function) has nothing accurate to report — defaulting
to `"private"` would fabricate a specific, meaningful, and potentially
wrong claim about visibility. `"unspecified"` records "this extractor
didn't say" instead of asserting something false.

**`access` is per-language visibility/export semantics — values are not
comparable across extractors, and must not be interpreted as C#'s
public/private.** Confirmed with a second real extractor
(`extractor/typescript/`), which emits two genuinely different vocabularies
depending on what kind of symbol it's describing, neither of which maps
onto C#'s:

- **Top-level declarations** (functions, consts, classes, interfaces,
  types): `"exported"` or `"module-private"` — TypeScript's real concept
  here is module export, not member visibility. There is no C#-style
  `public`/`private` axis for a top-level declaration in TS.
- **Class members** (methods, properties, constructor): `"public"`,
  `"private"`, or `"protected"` — these happen to share English words with
  C#'s vocabulary, but they describe TypeScript's own class-member
  visibility rules (e.g. an unmarked member defaults to `"public"`, which
  is TypeScript's actual default — not C#'s, where an unmarked member
  defaults to `"private"`). A query like `access = 'public'` written with
  C#'s semantics in mind will not mean the same thing against TS class
  members, and means nothing coherent against TS top-level declarations
  at all (`"exported"` never equals `"public"`).

Do not normalize these into one shared vocabulary. Each extractor reports
its own language's real distinctions; forcing them into a common set of
values would make the field *less* accurate, not more portable.

## Opaque fields

Fields `ingest.py` stores as-is and never interprets, validates, or
branches on. Any value an extractor supplies is accepted verbatim; the
vocabulary is entirely extractor-defined.

- `kind` — the C# extractor emits `class`, `interface`, `struct`,
  `record`, `record_struct`, `enum`, `delegate`, `method`, `constructor`,
  `property`, `field`, `event`, `enumMember`. The TypeScript extractor
  (`extractor/typescript/`) emits a different vocabulary — `component`,
  `function`, `class`, `interface`, `type`, plus `method`/`property`/
  `constructor` for class members — confirmed working end-to-end with
  zero `ingest.py` changes required. This is the contract doing exactly
  what it's for: two extractors, two vocabularies, one pipeline.
  `generate_layouts.py` groups by whatever `kind` values are actually
  present per module (Phase 6) rather than filtering against a fixed
  list — see below.
- `access` — see above. Stored as free text; no fixed vocabulary.
- `scope`, `namespace`, `signature` — free text or `null`, never parsed.

## What `ingest.py` actually does with a record

1. Groups records by unique `path` to build the `files` table, one row per
   file, each assigned a `module` via `module_map.json`'s path-prefix
   matching (unrelated to this contract — see Phase 1/2).
2. Inserts every record into `symbols`, one row per record, with a foreign
   key to its file and the same `module` value copied onto the row.

## What this contract does NOT cover

- **Edge/dependency extraction** (`extractor/csharp/extract_edges.py`,
  `extractor/typescript/extract_edges.js`) is a separate contract
  (`extractor/CONTRACT_EDGES.md`), not part of this one. Both languages
  now have an edge extractor; each resolves dependencies its own way
  (namespace matching for C#, import-specifier resolution for TypeScript)
  — see `CONTRACT_EDGES.md` for how that works and why the two aren't
  comparably precise.
- **How an extractor decides what to parse** (file discovery, file
  extensions, exclusion rules) is internal to each extractor, not part of
  this contract.
- **Extraction accuracy or completeness** — the contract only defines the
  wire format, not what an extractor is obligated to detect.
- **`generate_layouts.py`'s presentation choices** — as of Phase 6, it
  groups symbols by whatever `kind` values are actually present per
  module (no fixed per-language list) and excludes only `access` values
  containing `"private"` (a substring check that works across both
  extractors' vocabularies without hardcoding either — see the `access`
  section above). Before Phase 6, this script hardcoded `kind IN ('class',
  'interface', ...)` and `access = 'public'`, which silently hid all
  TypeScript data from generated layouts (confirmed empirically, see
  `extractor/typescript/LIMITATIONS.md`) — that gap is now closed. The
  dependency/edge sections (module "Depends on"/"Used by", "Most-imported
  files") render an explicit "no edge data indexed" when there's genuinely
  nothing to show, but as of the TypeScript edge extractor
  (`extractor/typescript/extract_edges.js`) and the file-identity recovery
  in `ingest_edges.py`, these sections now show real cross-module
  TypeScript dependency data too — confirmed against this repository:
  `mobile` correctly shows `Depends on: engine, ui`.
