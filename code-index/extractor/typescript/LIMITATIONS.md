# TypeScript Extractor — Known Limitations

This extractor is deliberately minimal (per Phase 5's scope: "the goal is
not to build a perfect TypeScript analyzer"). Documented here rather than
silently discovered later.

## Extraction scope

- **Only top-level statements are visited.** Functions/classes/types
  declared inside another function's body are not extracted. Verified:
  the extractor loops `sourceFile.statements` directly, not a recursive
  AST walk.
- **Interface members are not individually enumerated** — an interface is
  recorded as one symbol, not one record per property/method signature
  (unlike class members, which are). This keeps interface handling
  symmetrical with the C# extractor's treatment of `interface` as a type
  declaration, at the cost of not surfacing an interface's shape.
- **HOC-wrapped exports are not specially detected.** Real example found
  in this repo: `packages/ui/src/PlayingCard.tsx` declares
  `function PlayingCardComponent(...)` (correctly extracted as a
  `component`) and separately exports
  `export const PlayingCard = React.memo(PlayingCardComponent);` — the
  extractor does not recognize `React.memo(...)`/`forwardRef(...)` calls
  as re-exporting a component, so `PlayingCard` (the name every consumer
  actually imports) is not itself recorded as a symbol, only
  `PlayingCardComponent` is.
- **Anonymous default exports are skipped** (`export default function() {}`
  with no name) — there is no name to record.
- **No `hook` kind.** A function named `useSomething` is classified as a
  plain `function`, not specially detected as a React hook, even though
  the task's own kind-mapping examples didn't request one. Would be a
  cheap follow-up (name starts with `use` + is a function) if wanted.
- **Component detection is a syntactic heuristic, not type-checked:**
  PascalCase name + declared in a `.tsx` file + a JSX node appears
  anywhere in the body. No verification that the function is actually
  used as a component (e.g. actually returns the JSX from every code
  path, or is actually invoked as `<Name />` anywhere) — false positives
  are possible for a PascalCase helper that happens to construct JSX
  without being a component, though none were observed against this
  repo's real code.

## Contract-vs-consumer mismatch — RESOLVED in Phase 6

- ~~`generate_layouts.py`'s `top_classes()`/`top_public_methods()` filtered
  on `access = 'public'`, so no TS top-level symbol (`"exported"`, never
  `"public"`) ever appeared in those views~~ — **fixed in Phase 6**.
  `top_classes()`/`top_public_methods()` no longer exist; replaced by
  `symbols_by_kind()`, which groups every symbol kind actually present per
  module and filters out only `access` values containing `"private"`
  (matches C#'s `"private"`/`"private protected"` and TS's
  `"private"`/`"module-private"` without hardcoding either vocabulary).
  Confirmed: `LAYOUT_mobile.md` now renders real `## Components`,
  `## Functions`, `## Interfaces`, `## Types` sections populated from the
  142 real ingested TS symbols.
- `namespace` is still always `null` for TS records (no real analog worth
  fabricating — see `extractor/CONTRACT.md`) — `module_namespaces()` still
  correctly and silently omits its section for TS-only modules. This was
  already correct before Phase 6 (the section was already conditional);
  nothing changed here, it just no longer looks like an oversight now that
  the neighboring sections aren't also empty.
- ~~No edge/dependency data exists for TS files~~ — **resolved.**
  `extractor/typescript/extract_edges.js` now extracts real TypeScript
  import/export edges (relative imports and workspace package imports via
  `package.json` `"exports"`/`"main"` resolution). Combined with the
  file-identity recovery in `ingest_edges.py` (real files with zero
  extracted symbols — barrel `index.ts` files above all — no longer get
  silently dropped as edge endpoints), this repository's real cross-module
  dependency graph is now visible: `mobile → engine`, `mobile → ui`,
  `playground → engine`, `playground → ui`, `ui → engine`. See
  `extractor/CONTRACT_EDGES.md` for the extraction contract and
  `extractor/typescript/extract_edges.js`'s own header comment for exactly
  which import forms are supported (relative + workspace package; not
  dynamic `import()`, not `require()`).

## What does work correctly

- `ingest.py`, the SQLite schema, and module resolution (`module_map.json`)
  needed **zero changes** — TS records flow through the identical
  pipeline C# records use.
- Direct SQL queries against `symbols`/`files` return correct,
  well-typed TS data (components, interfaces, functions, classes with
  methods/properties/constructors) — verified against both real repo data
  and a synthetic class fixture.
