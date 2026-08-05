# WKA v1.0 — Canonical Model

**Status:** Frozen — v1.0.
**Instantiates:** `WKA v0.1 Architecture.md`, `WKA Bootstrap Baseline v0.1.md`, and `WKA_Design_Baseline_v0.1.md` (unchanged — those remain the generic, project-independent WKA meta-model) for the Code-Index-based knowledge layer specifically: how indexed source code becomes structured, governed knowledge for this repository.
**Consumes:** the Code Index (`files`, `symbols`, `file_edges`, `module_edges`, `reachability`) as a read-only, generated fact source. This document never redefines or replaces the Code Index — see `code-index/README.md` for its own schema and query protocol.
**RFC 2119:** MUST / SHOULD / MAY / MUST NOT / SHOULD NOT are interpreted as normative requirements, per `WKA_Design_Baseline_v0.1.md`'s own convention.

---

## 0. Framing

The Code Index answers *what exists and what references what*. It carries no ownership, rationale, or intent — a `symbols` entry for a load-bearing type and a throwaway test helper are structurally identical. Structured knowledge is a Code Index fact plus three things the Index cannot provide on its own: an owning Domain, a governing Artifact, and a traceable path to Purpose. This document defines the entities and rules that make that binding explicit rather than assumed.

Authority flows downward — nothing below Purpose may contradict what a higher layer states. Facts flow upward — the Code Index is regenerated from source and never edited by hand. These are two independent directions; conflating them is the most common way to misapply this model.

---

## 1. Canonical Entity Model

| Entity | Responsibility | Owner | Authority |
|---|---|---|---|
| Purpose | Why the system exists | Foundation | Highest — nothing above it |
| Quality Attribute | A quality the architecture preserves; evaluation criteria for tradeoffs | Foundation | High — evaluates decisions, does not itself decide |
| Engineering Principle | A normative, cross-domain decision rule | Foundation | Binding on every Domain equally |
| Governance Rule | A common rule for how Domains/Artifacts are created, validated, and evolved — including domain-to-domain dependency constraints, expressed as a rule whose subject is a pair of Domains rather than one | Governance | Binding across the Domain(s) it names |
| Mechanism | A process that applies a Governance Rule consistently (e.g. a conformance or drift check) | Governance | **None of its own** — produces a signal, never a verdict |
| Knowledge Domain | A bounded ownership area | Itself, established by Governance | Authoritative for what it owns; nothing outside its boundary |
| Artifact (ADR / Specification / Decision / Plan / Known Issue) | A discrete unit of governed knowledge | Exactly one Domain, or Governance directly for cross-cutting artifacts | Varies by subtype — see §1a. "Artifact" is a classification, not a uniform authority level. |

Domain-to-domain dependency constraints are **not** a separate entity type — they are Governance Rules whose subject is a Domain pair. This avoids a concept the model does not need.

### 1a. Artifact subtypes

| Subtype | Authority | Distinguishing rule |
|---|---|---|
| **ADR** | *Why*, historical, immutable once Accepted | May supersede at most one prior ADR. |
| **Specification** | *What should be true*, current | The only subtype exercising the full lifecycle (Draft/Proposed → Accepted → Active → Deprecated → Archived), since it is meant to track reality over time. |
| **Decision** (domain-scoped, ADR-in-miniature) | Domain-level rationale, historical once recorded | Accepted and Active collapse into one moment, the same way an ADR's does — there is no separate adoption step. Append-only; a later, contradicting choice supersedes the earlier entry rather than editing it. |
| **Plan** | Sequencing only, never architecture | Closes via Active → Completed rather than Deprecated/Archived. A changed approach mid-work is a new Plan, not a mutated one. |
| **Known Issue** | Current-state fact, authoritative until false | **The one subtype whose terminal state is deletion, not Archived.** An archived known-issues register would recreate the append-only-changelog failure this model exists to prevent. |

**Required attributes**, every Artifact: a fixed type; an owning Domain or Governance; at least one path traceable toward Purpose (§5).
**Optional:** references to code entities — not every Artifact needs one (a pure process rule does not).

**Domain's own required attributes:** a boundary declaration (what it owns) and at least one governing rationale. A Domain's `overview.md`-equivalent content is the textual realization of these attributes, including any domain-scoped standing technical guidance it wants to record — this is not a sixth Artifact subtype, it is Domain's own attribute content.

---

## 2. Identity Model

Every Domain and Artifact is assigned an identity at creation that **never changes for its lifetime** — independent of label, title, description, or boundary.

- A rename changes the label. It never changes identity.
- A genuine replacement is not an identity change — it creates a **new** identity, connected to the old one through `SUPERSEDES` (§3). The old identity and every reference to it remain intact.
- A Domain's identity is independent of its boundary — a Domain MAY be redrawn without losing continuity or invalidating what it already owns elsewhere.
- An Artifact's identity is independent of its content but not of its type — an ADR cannot "become" a Specification; that requires a new identity of a different type, connected by reference, not mutation.
- References always bind to identity, never to a label, a location, or a content snapshot.

**Acknowledged boundary condition:** an Artifact's reference into the Code Index (a Symbol, Module, or File) needs the same stability guarantee — surviving a move or re-extraction, not just a rename. The Code Index is fixed, given scope; this model states the requirement but cannot itself guarantee the Code Index provides it.

---

## 3. Relationship Model

**Structural** (owned by the Code Index, read-only):

```
Module ──CONTAINS──▶ File
File   ──DECLARES──▶ Symbol
File   ──DEPENDS_ON──▶ File
Module ──DEPENDS_ON──▶ Module
Module ──REACHES──▶ Module          (reserved, unpopulated)
```

**Knowledge-level:**

```
Domain      ──OWNS──▶ Module | File            (exactly one Domain per target)
Domain      ──OWNS──▶ Artifact                  (or Governance owns it directly)
Governance  ──GOVERNS──▶ Domain                 (via a Governance Rule)
Foundation  ──GOVERNS──▶ Domain                 (transitively, through Governance)
Mechanism   ──SUPPORTS──▶ Governance Rule
Mechanism   ──OBSERVES──▶ Domain | Artifact | structural fact   (read-only; produces no
                                                                    authoritative edge)
Artifact    ──REFERENCES[role]──▶ Module | File | Symbol | Domain | Artifact
Entity      ──SUPERSEDES──▶ Entity              (same type only, acyclic — applies to Domain,
                                                    Governance Rule, Engineering Principle,
                                                    Purpose, and each Artifact subtype, not
                                                    only to Artifact)
```

`REFERENCES` carries one role from `{implements, realizes, affects, documents, clarifies, governs, requires}`. There is one relationship type, not one per meaning — the role distinguishes meaning. `requires` carries a validation rule: its target MUST be at least `Accepted` before the referencing Artifact may itself be `Accepted`.

**Multiplicity**

| Relationship | Cardinality |
|---|---|
| `Domain OWNS Module/File` | Exactly one Domain per target |
| `Domain OWNS Artifact` | Exactly one Domain, or Governance directly — never both, never neither |
| `Entity SUPERSEDES Entity` | At most one outgoing edge per entity (a linear chain); at most one entity may supersede a given target |
| `Artifact REFERENCES[governs] target` | At most one Artifact may hold a governing reference to a given target without an explicit `SUPERSEDES` between them |
| `Artifact REFERENCES[documents/clarifies] target` | Many-to-many |

**Forbidden**

- Symbol/Module/File → Purpose, Governance, Engineering Principle, or Quality Attribute directly, bypassing Domain.
- Cross-subtype `SUPERSEDES` (a Specification superseding an ADR, a Decision superseding a Plan).
- A cycle anywhere in `SUPERSEDES` or `GOVERNS`.
- More than one Domain claiming `OWNS` on the same target.
- A `governs`-role reference from a **Domain-owned** Artifact into a target outside its owning Domain's boundary. A `documents`/`clarifies` role is exempt, and a **Governance-owned**, cross-cutting Artifact is exempt from this restriction entirely — it is permitted, by design, to govern across Domain boundaries.

---

## 4. Lifecycle Model

**Base states:** `Proposed → Accepted → Active → Deprecated → Archived`.

**Valid transitions:**

```
Proposed   ──▶ Accepted     (a Governance decision)
Accepted   ──▶ Active       (adoption — collapses with Accepted for subtypes with no
                              separate adoption step, e.g. ADR, Decision)
Active     ──▶ Deprecated   (discouraged, not yet retired — a review window)
Deprecated ──▶ Archived     (retained for history, no longer authoritative)
Active     ──▶ Superseded   (triggered by a successor entity reaching Accepted)
```

`Archived` MUST be reached only through `Deprecated` — a direct `Active → Archived` transition is not permitted; skipping the discouraged period removes the review window Governance needs to catch a mistaken retirement.

Content is immutable once `Accepted`. `Proposed`/`Draft` are the only states where in-place revision is legitimate. Supersession is the one place one entity's transition forces another's: when a successor reaches `Accepted`, its target automatically transitions to `Superseded`.

**Per-entity variance:** see §1a for Artifact subtypes. Additionally:

- **Domain** gains `Active → (Split | Merged)`, realized via the generalized `SUPERSEDES` relationship (§3) — a successor Domain (or Domains) supersedes the prior one, preserving its identity and every reference to it.
- **Purpose, Engineering Principle, Governance Rule** revise through the same `Proposed → Accepted → Supersession` discipline as any other entity — never an in-place edit, including for Purpose. This is required for the Traceability Model (§5) to remain a meaningful guarantee over time: if Purpose could be silently rewritten, "traces back to Purpose" would not mean anything stable.
- **Mechanism** uses only `Active → Deprecated → Archived` — it carries no rationale, so it does not require `Proposed`/`Accepted` ceremony.

---

## 5. Traceability Model

```
Purpose
  ↓
Engineering Principle
  ↓
Governance Rule
  ↓
Knowledge Domain
  ↓
Artifact (most directly: Specification)
  ↓  REFERENCES[implements/realizes]
Symbol / Module / File            (Code Index — given, fixed)
```

**Mandatory rules**

1. Every Domain MUST declare at least one Governance Rule — or an Engineering Principle directly, if no intermediate rule exists — as its rationale for existing.
2. Every `Accepted` Artifact MUST belong to exactly one Domain, or explicitly to Governance.
3. Every Specification that reaches `Active` MUST have at least one `REFERENCES[implements]` edge to a Code Index entity, **or** be explicitly marked as not yet realized. An unrealized Specification is a legitimate, visible state; a silently unrealized one is the actual defect.
4. No Symbol/Module/File may be referenced with a `governs`, `implements`, or `realizes` role by a Domain-owned Artifact whose owning Domain does not include that entity in its `OWNS` boundary. `documents`/`clarifies` are exempt, and Governance-owned cross-cutting Artifacts are exempt from this rule entirely.

Any Code Index entity participating in the knowledge graph has exactly one path upward to Purpose. An entity with no such path is, by this definition, undocumented — a structurally detectable condition, not a matter of judgment.

---

## 6. Invariants

**Mandatory**

1. Exactly one owning Domain per Module, File, or Artifact.
2. `SUPERSEDES` and `GOVERNS` are acyclic.
3. Every `Accepted` Artifact belongs to exactly one Domain or to Governance.
4. Every Domain traces to at least one Governance Rule (or Engineering Principle, per §5 rule 1).
5. Identity is immutable for the lifetime of an entity.
6. `Archived` is reachable only through `Deprecated`.
7. At most one entity may supersede a given target.
8. A Mechanism never produces authoritative content — only a signal.
9. Cross-domain `REFERENCES` held by a **Domain-owned** Artifact may never carry a governing role. Governance-owned cross-cutting Artifacts are exempt — they are permitted, by design, to govern across Domain boundaries.

**Recommended**

- A Governance Rule encoding a temporary condition SHOULD carry a review trigger.
- A Specification SHOULD reach `Active` only with at least one implementing reference where practical.
- Known Issues SHOULD be reviewed for materiality, not merely accumulated until fixed.
- New Domain creation SHOULD be weighed against Refinement over Expansion before acceptance.

---

## 7. Relationship to this repository

This document defines the canonical model only. Its applied instance — which Domains exist, what they own, what their Artifacts say — lives entirely in `docs/governance/`, `docs/domains/`, `docs/status/`, `docs/superpowers/`, and `docs/animation/`, per `docs/00-DocumentationMap.md`. Nothing here duplicates that content, and nothing there should duplicate this document's definitions — if the two ever appear to disagree, this document is authoritative for what a concept *is*; the domain documents are authoritative for what *is currently true* about this repository.
