# Edge Extraction Contract

This document describes the data contract between a language edge
extractor and `ingest_edges.py`. Any edge extractor — `extractor/csharp/
extract_edges.py` today, a future extractor for another language — must
produce output in this shape. `ingest_edges.py` has no knowledge of what
language produced its input; it only knows this contract.

This mirrors `extractor/CONTRACT.md` (the symbol contract), applied to
file-level dependency relationships instead of symbols.

## What this represents

An edge record is a claim: **the `from` file has some relationship to
the `to` file that this extractor considers a dependency.** That's it.
The contract deliberately says nothing about *why* — an edge could mean
"imports directly" (an exact, specifier-resolved relationship — how
`extractor/typescript/extract_edges.js` resolves `import ... from
'./foo'`) or it could mean "references a namespace that the target file
happens to also declare a symbol in" (`extractor/csharp/extract_edges.py`'s
actual behavior — an approximation, not a precise import). See "Semantics
are language-specific" below.

## Output format

Newline-delimited JSON (JSON Lines). One JSON object per line, one line
per edge.

## Record fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | string | yes | Repo-relative path, forward-slash separated, of the file with the dependency. |
| `to` | string | yes | Repo-relative path, forward-slash separated, of the file being depended on. |

Both fields are checked against the `files` table (already populated by
`ingest.py` before any edge extractor runs). **As of the file-identity
recovery fix, an edge referencing a path with no existing `files` row no
longer causes that edge to be dropped** — `ingest_edges.py` creates the
missing row itself (path + module only, resolved via `module_map.json`;
no symbols are fabricated) and the edge is ingested normally. This
recovers real files an edge extractor found and verified on disk (e.g. a
barrel `index.ts` with no extractable symbols) that would otherwise have
been invisible purely because of the symbol extractor's scope, not
because the file isn't real. A path that genuinely doesn't exist as a
real file is not recovered — `ingest_edges.py` trusts that the extractor
already verified the file's existence before emitting the edge (see
`isFile()` in `extract_edges.js` / the successful read in
`extract_edges.py`); it does not independently re-verify against disk.

## Rules

- **Paths are repository-relative, forward-slash separated** — identical
  convention to `path` in `extractor/CONTRACT.md`'s symbol records.
- **Duplicate edges may be removed.** An extractor may emit the same
  `{from, to}` pair more than once (e.g. two separate `using` statements
  resolving to the same target file); `ingest_edges.py` deduplicates on
  ingest, and an extractor is free to deduplicate before emitting too —
  neither side depends on the other doing it.
- **External and unresolved dependencies are not emitted.** If a `from`
  file references something outside the repository (an npm package, a
  `using System;`-style BCL namespace, anything that isn't a file this
  repository owns), the extractor emits **no edge** for it — not a
  partial or placeholder record. The C# extractor's existing behavior
  already works this way (an unmatched namespace produces zero edges,
  confirmed empirically in Phase 7A's review); any future extractor must
  do the same.

## Semantics are language-specific; aggregation is language-neutral

Extraction — deciding what counts as a "relationship" and how to resolve
it to a file — is entirely up to each language's extractor, and different
languages will have meaningfully different precision:

- **C#** (`extractor/csharp/extract_edges.py`): resolves a `using X;`
  directive to *every file that declares a symbol in namespace X* (read
  from the already-ingested `symbols` table). Because a C# namespace is a
  many-to-many grouping decoupled from file identity, one `using`
  statement can resolve to more than one file — this is an approximation,
  not a precise reference.
- **TypeScript** (`extractor/typescript/extract_edges.js`): resolves an
  `import ... from '<specifier>'` to exactly one file — relative
  specifiers via extension/index resolution, workspace package specifiers
  (`@scope/name[/sub/path]`) via that package's own `package.json`
  `"exports"`/`"main"` fields — a fundamentally different, more precise
  mechanism than C#'s namespace matching. Nothing in this contract
  requires — or assumes — the two are comparably precise.

Once edges reach `file_edges`, everything downstream (`ingest_edges.py`,
`aggregate_edges.py`, `generate_layouts.py`) is completely language-
neutral: a `file_edges` row is just two file IDs, with no record of which
extractor produced it or how confidently. `aggregate_edges.py`'s roll-up
into `module_edges`/`reachability` (Phase 7B.1, unchanged here) treats
every edge identically regardless of provenance.

## What this contract does NOT include (by design, this phase)

- **Edge types** — no field distinguishes "imports" from any other kind
  of relationship. Every edge means the same generic thing: a dependency
  claim.
- **Confidence or weights** — no field expresses how certain an
  extractor is about a given edge (relevant given C#'s namespace-fan-out
  imprecision above). Not included yet.
- **Symbols** — an edge is a file-to-file relationship only. It does not
  say *which* symbol in `from` depends on *which* symbol in `to`.
- **WKA concepts** — no domain, ownership, or knowledge-architecture
  metadata. This is still a code-index-scoped contract.

These are documented gaps, not oversights — a future phase may decide
some are worth adding, but that's a schema/contract redesign this phase
deliberately does not make.

## What this contract does NOT cover

- **How an extractor resolves the `from`/`to` relationship** — namespace
  matching, specifier resolution, or anything else — is internal to each
  extractor.
- **Multiple extractors' output being combined** — `ingest_edges.py`
  currently ingests one edge JSONL file per run and replaces `file_edges`
  wholesale (see its own docstring). Combining edges from more than one
  language's extractor in a single ingest is not addressed by this
  contract or by `ingest_edges.py` today.
