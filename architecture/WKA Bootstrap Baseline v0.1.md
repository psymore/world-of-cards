# WKA Bootstrap Baseline v0.1

> The minimum architectural context required for humans and AI agents to contribute consistently to a WKA-based project.

---

# Mission

This document is an **AI Context Bootstrap Artifact**.

Its purpose is to provide the minimum architectural context required for a human or AI agent to contribute consistently to a WKA-based project.

It enables rapid architectural understanding within **2–5 minutes** while keeping the **WKA Design Baseline** as the architectural authority.

This document is **not** the architectural authority.

Normative definitions are provided by the **WKA Design Baseline**, which takes precedence whenever additional detail or clarification is required.

---

## Design Objectives

This document MUST:

- minimize onboarding time;
- preserve architectural intent;
- maximize architectural consistency;
- provide a reliable mental model;
- direct readers to authoritative sources when deeper knowledge is required.

This document MUST NOT:

- redefine normative concepts;
- duplicate the Design Baseline;
- become a complete specification;
- become implementation documentation;
- introduce new architectural concepts.

---

## Success Criteria

After reading this document, a contributor should be able to:

- understand WKA's architectural philosophy;
- identify the correct architectural layer for a task;
- distinguish specifications from architectural rationale;
- locate authoritative sources;
- make architecturally consistent decisions.

If additional detail is required, consult the **WKA Design Baseline**.

---

# Purpose

WKA (Knowledge Architecture) is an architecture for organizing, governing, representing, and evolving engineering knowledge.

Its goal is to preserve architectural consistency while making knowledge understandable, maintainable, and reusable by both humans and AI agents.

WKA is architecture-first: documentation represents knowledge but does not define it.

---

# How to Use This Document

Read this document before making architectural decisions.

When contributing to a WKA-based project:

1. Start with the Purpose.
2. Apply the Engineering Principles.
3. Follow the Governance.
4. Prefer refinement over expansion.
5. Preserve Single Source of Truth.
6. Preserve Single Responsibility.

Do not introduce new concepts unless refinement is insufficient.

---

# Mental Model

```
Purpose
    ↓
Engineering Principles
    ↓
Governance
    ↓
Knowledge Domains
    ↓
Knowledge Artifacts
    ↓
Documentation
    ↓
Reference Implementations
```

The architecture is intentionally layered.

Authority flows downward.

Knowledge evolves upward through refinement.

---

# Working Principles

These principles provide guidance for consistent architectural decisions.

---

## Single Responsibility

Every architectural element has one primary responsibility.

Every document answers one primary question.

---

## Single Source of Truth

Every architectural concept is defined once.

Definitions are referenced, not duplicated.

---

## Specification-first

Normative architectural knowledge belongs in specifications.

Supporting artifacts should reference specifications rather than redefine them.

---

## Refinement over Expansion

Improve existing concepts before introducing new ones.

New abstractions require clear justification.

---

## Knowledge Before Documentation

Knowledge exists independently from documentation.

Documentation represents knowledge.

---

## Explicit over Implicit

Architectural intent should be explicit.

Hidden assumptions should be avoided.

---

# Core Definitions

## Purpose

The architectural reason for existence.

Purpose guides all architectural decisions and remains highly stable.

---

## Quality Attributes

Architectural quality goals that influence design decisions.

Examples: consistency, maintainability, discoverability, extensibility, and clarity.

---

## Engineering Principles

Normative rules that govern architectural decisions.

Engineering Principles operationalize Purpose.

---

## Governance

The common rules by which Knowledge Domains are documented, validated, and evolved.

Governance defines rules, not implementations.

---

## Knowledge Domain

A bounded area of engineering knowledge with a defined responsibility.

Knowledge Domains organize knowledge but do not define representation.

---

## Knowledge Artifact

A discrete unit of governed knowledge.

Examples:

- Specifications
- ADRs
- Templates
- Maps
- Reference Implementations

Artifacts belong to one Knowledge Domain.

---

## Documentation Structure

Defines how documentation artifacts are organized.

It represents knowledge but does not own it.

---

## Documentation Map

Defines how documentation artifacts are discovered and navigated.

---

## Naming

Defines naming conventions that improve consistency and discoverability.

Naming does not define semantics.

---

## Templates

Reusable patterns for representing knowledge.

Templates standardize representation but do not define meaning.

---

## Knowledge Lifecycle

Defines how knowledge evolves over time.

---

## Specification

The authoritative source of normative architectural knowledge.

Specifications define architecture, not architectural history.

---

## Architecture Decision Record (ADR)

Preserves the rationale behind significant architectural decisions.

ADRs explain why; they do not define normative architecture.

---

## Mechanism

A tool or process that supports Governance by enabling its rules to be applied consistently.

Mechanisms are not Governance.

---

## Reference Implementation

A concrete realization of specifications.

Reference Implementations demonstrate architecture but do not define it.

---

# Golden Rules

1. Purpose is the architectural north star.

2. Every artifact has one primary responsibility.

3. Every concept has one authoritative definition.

4. Specifications define architecture.

5. ADRs preserve rationale.

6. Governance defines rules.

7. Mechanisms support Governance.

8. Documentation represents knowledge.

9. Knowledge evolves through the Knowledge Lifecycle.

10. Prefer refinement over expansion.

11. Preserve architectural intent.

12. Never duplicate definitions.

---

# End of Part 1

The next section defines:

- Concept Ownership Matrix
- Relationship Matrix
- Governance Model
- Documentation Architecture
- Knowledge Lifecycle

---

# Part 2 — Architecture Model

---

# Concept Ownership Matrix

This matrix defines the owner and primary responsibility of each core concept.

A concept SHOULD be modified only by its owning layer.

| Concept                  | Owner                | Responsibility             | Must NOT Define            |
| ------------------------ | -------------------- | -------------------------- | -------------------------- |
| Purpose                  | Foundation Layer     | Architectural intent       | Governance, Documentation  |
| Quality Attributes       | Foundation Layer     | Quality goals              | Knowledge Domains          |
| Engineering Principles   | Foundation Layer     | Decision rules             | Domain-specific knowledge  |
| Governance               | Conceptual Layer     | Common governance rules    | Specifications, ADRs       |
| Knowledge Domain         | Conceptual Layer     | Knowledge boundaries       | Documentation organization |
| Knowledge Artifact       | Conceptual Layer     | Governed knowledge unit    | Governance rules           |
| Documentation Structure  | Representation Layer | Documentation organization | Architectural meaning      |
| Documentation Map        | Representation Layer | Navigation                 | Knowledge definitions      |
| Naming                   | Representation Layer | Naming conventions         | Semantics                  |
| Templates                | Representation Layer | Representation patterns    | Knowledge ownership        |
| Knowledge Lifecycle      | Evolution Layer      | Knowledge evolution        | Governance                 |
| Specification            | Specification Layer  | Normative architecture     | Architectural rationale    |
| ADR                      | Governance Mechanism | Architectural rationale    | Normative rules            |
| Mechanism                | Governance Support   | Applying governance rules  | Governance itself          |
| Reference Implementation | Implementation Layer | Practical realization      | Architecture               |

---

## Ownership Rule

Each concept has exactly one architectural owner.

Ownership determines where a concept is defined, not where it may be referenced.

Definitions are centralized.

References are distributed.

---

## Ownership Rule

Each concept has exactly one architectural owner.

Ownership determines where a concept is defined.

Ownership does not determine where the concept may be referenced.

Definitions are centralized.

References are distributed.

---

# Relationship Matrix

The following relationships describe how core concepts interact.

| Concept                  | Owns                    | Uses                                       | Governed By            |
| ------------------------ | ----------------------- | ------------------------------------------ | ---------------------- |
| Purpose                  | Architectural Intent    | Quality Attributes, Engineering Principles | —                      |
| Quality Attributes       | Quality Goals           | Engineering Principles                     | Purpose                |
| Engineering Principles   | Decision Rules          | Architecture                               | Purpose                |
| Governance               | Governance Rules        | Mechanisms                                 | Engineering Principles |
| Knowledge Domain         | Knowledge Artifacts     | Governance                                 | Governance             |
| Knowledge Artifact       | Governed Knowledge      | Documentation Structure, Lifecycle         | Governance             |
| Documentation Structure  | Organization            | Naming, Templates                          | Governance             |
| Documentation Map        | Navigation              | Documentation Structure                    | Governance             |
| Naming                   | Conventions             | Documentation Structure                    | Governance             |
| Templates                | Representation Patterns | Documentation Structure                    | Governance             |
| Knowledge Lifecycle      | Knowledge Evolution     | Knowledge Artifacts                        | Governance             |
| Specification            | Normative Knowledge     | Architecture                               | Governance             |
| ADR                      | Architectural Rationale | Specifications                             | Governance             |
| Mechanism                | Governance Support      | Governance Rules                           | Governance             |
| Reference Implementation | Practical Realization   | Specifications                             | Governance             |

---

## Relationship Principles

Relationships SHOULD be explicit.

Dependencies SHOULD follow architectural authority.

Representations MUST NOT own architectural concepts.

---

# Governance Model

Governance defines the common rules by which Knowledge Domains are documented, validated, and evolved.

Governance owns rules.

Governance does not own knowledge or implementations.

---

    ## Governance Hierarchy

```
Governance
      │
      ├─────────────┐
      │             │
      ▼             ▼
Knowledge      Representation
Domains          Rules
      │             │
      └──────┬──────┘
             ▼
       Knowledge Artifacts
```

Governance applies equally across every Knowledge Domain.

---

## Governance Mechanisms

Governance is supported by mechanisms such as:

- ADRs
- Reviews
- Validation processes
- Conformance checks
- Automation

Mechanisms support the governance model by enabling its rules to be applied consistently.

They do not define governance.

---

## Governance Rules

Governance MUST:

- preserve architectural consistency;
- preserve Single Source of Truth;
- preserve Single Responsibility;
- preserve architectural intent.

Governance SHOULD:

- minimize coupling;
- encourage refinement;
- discourage unnecessary abstraction.

---

# Documentation Architecture

Documentation is a representation layer.

It represents knowledge but does not define or own it.

Documentation exists to make knowledge understandable and discoverable.

---

## Representation Hierarchy

```
Knowledge

↓

Knowledge Artifact

↓

Documentation Structure

↓

Documentation Map

↓

Reader / AI Agent
```

Knowledge precedes documentation.

Documentation changes do not necessarily change knowledge.

Knowledge changes may require documentation updates.

---

## Documentation Rules

Documentation MUST:

- represent architecture faithfully;
- reference authoritative definitions.

Documentation SHOULD:

- remain concise.

Documentation MUST NOT:

- redefine concepts.

---

## Documentation Map

The Documentation Map is the canonical navigation model.

It provides discoverability.

It does not own definitions, governance, or lifecycle.

---

# Knowledge Lifecycle

Knowledge evolves through controlled refinement.

The Lifecycle governs how knowledge changes over time.

---

## Lifecycle States

| State      | Meaning                                 |
| ---------- | --------------------------------------- |
| Proposed   | Candidate knowledge awaiting evaluation |
| Accepted   | Officially adopted knowledge            |
| Active     | Current authoritative knowledge         |
| Deprecated | Maintained but discouraged              |
| Archived   | Preserved historical knowledge          |

---

## Lifecycle Principles

Knowledge SHOULD:

- evolve through controlled refinement;
- preserve historical context;
- avoid unnecessary deletion.

Purpose SHOULD remain stable.

Architecture SHOULD evolve more slowly than implementations.

---

## Lifecycle Rule

Knowledge is refined, not accumulated.

Architecture evolves through refinement rather than replacement.

---

# End of Part 2

The next section defines:

- Authoring Order
- Reading Order
- ADR Philosophy
- Decision Checklist
- Working Agreement
- Anti-Patterns

---

# Part 3 — Working Model

---

# Authoring Order

Authoring Order defines how WKA is established and maintained.

It reflects architectural establishment, not knowledge acquisition.

```
ADR-000
    ↓
00 Overview
    ↓
01 Foundation Layer
    ↓
02 Conceptual Layer
    ↓
03 Representation Layer
    ↓
04 Evolution Layer
    ↓
05 Specifications
    ↓
06 Reference Implementations
```

## Authoring Principles

- Architectural authority is established before specifications.
- Specifications are authored against an accepted baseline.
- Reference Implementations follow specifications.
- Architecture evolves through controlled refinement.

---

# Reading Order

Reading Order defines how WKA should be learned.

It reflects progressive understanding, not historical creation.

```
00 Overview
    ↓
01 Foundation Layer
    ↓
02 Conceptual Layer
    ↓
03 Representation Layer
    ↓
04 Evolution Layer
    ↓
05 Specifications
    ↓
06 Reference Implementations
```

## Reading Principles

- Readers begin with architectural intent.
- Readers progress from concepts toward implementations.
- ADRs are optional for initial understanding and provide value after architectural context is established.

---

# ADR Philosophy

ADRs preserve the rationale behind significant architectural decisions.

Specifications define architecture.

ADRs explain why architectural decisions were made.

---

## ADR Responsibility

An ADR SHOULD:

- preserve significant architectural decisions;
- explain rationale;
- record considered alternatives;
- document the chosen direction.

An ADR MUST NOT:

- redefine specifications;
- duplicate definitions;
- become implementation documentation;
- become a changelog.

---

## ADR Creation Rule

An ADR should exist only when the architecture could reasonably have been designed differently.

Use this filter:

1. Does the decision introduce or fundamentally change architecture?
2. Were multiple reasonable alternatives possible?
3. Would future readers benefit from knowing why this choice was made?

If any answer is **No**, an ADR is usually unnecessary.

---

## Typical ADR Candidates

- New architectural layers.
- New governance models.
- New lifecycle models.
- Changes to architectural organization.
- New architectural approaches.

---

## Not ADR Candidates

- Document renaming.
- Wording improvements.
- Section reorganization.
- Terminology expansion.
- Documentation corrections.
- Minor refinements.

---

# Decision Checklist

Every architectural proposal SHOULD follow this decision process.

```
Need to change something?

        │
        ▼

Is this introducing a new concept?

        │
   ┌────┴────┐
   │         │
  NO        YES
   │         │
   ▼         ▼

Refine     Can refinement solve it?

              │
         ┌────┴────┐
         │         │
        YES       NO
         │         │
         ▼         ▼

      Refine   Does it change architecture?

                     │
                ┌────┴────┐
                │         │
               NO        YES
                │         │
                ▼         ▼

         Normal change   Candidate ADR
```

---

---

## Architectural Questions

Before introducing a change, ask:

- What responsibility changes?
- Who owns this concept?
- Does this duplicate existing knowledge?
- Can refinement solve this?
- Does this preserve architectural intent?

---

# Working Agreement

Every contributor should preserve architectural consistency.

---

## Preserve

Always preserve:

- Purpose;
- Engineering Principles;
- Governance;
- Architectural intent;
- Single Source of Truth;
- Single Responsibility.

---

## Documentation Rules

Documentation SHOULD:

- represent knowledge;
- reference authoritative definitions;
- remain concise.

Documentation MUST NOT:

- redefine concepts;
- duplicate specifications.

---

## Evolution Rules

Architecture evolves through refinement.

Expansion occurs only when refinement is insufficient.

---

## Collaboration Rules

When uncertain:

- do not invent;
- do not duplicate;
- do not generalize prematurely;
- return to the Design Baseline;
- refine before expanding.

---

## AI Agent Expectations

AI agents should:

- understand Purpose before proposing changes;
- preserve architectural intent;
- respect concept ownership;
- avoid unnecessary abstractions;
- follow Governance;
- distinguish rationale from normative content.

---

# End of Part 3

The final section defines:

- Anti-Patterns
- Bootstrap Completion Criteria
- Architectural Compass
- Quick Reference
- Final Notes

---

# Part 4 — Completion

---

# Anti-Patterns

The following patterns violate WKA principles.

---

## Duplicate Definitions

Defining the same concept in multiple locations.

Prefer:

Reference the authoritative definition.

---

## Responsibility Overlap

Allowing artifacts to have multiple primary responsibilities.

Prefer:

One artifact.
One primary responsibility.

---

## Premature Abstraction

Introducing concepts before existing ones are refined.

Prefer:

Refinement over expansion.

---

## Documentation as Knowledge

Treating documentation as the source of knowledge.

Prefer:

Knowledge precedes representation.

---

## Specification Duplication

Repeating normative content across documents.

Prefer:

Reference.
Never duplicate.

---

## Governance by Convention

Relying on implicit practices instead of explicit rules.

Prefer:

Explicit governance.

---

## Architecture by Implementation

Allowing implementations to define architecture.

Prefer:

Implementations conform to architecture.

---

# Architectural Compass

When uncertainty exists, follow this priority order.

```
Purpose
    ↓
Engineering Principles
    ↓
Governance
    ↓
Knowledge Domains
    ↓
Knowledge Artifacts
    ↓
Representation
    ↓
Implementation
```

Lower layers should never redefine higher layers.

Higher layers provide context for lower layers.

# Architectural Decision Compass

The Architectural Thinking Compass defines how architectural decisions should be made.

Its purpose is to guide consistent reasoning before introducing changes to the architecture.

```text
I have an idea.

↓

Does an existing concept already solve it?

YES
    ↓
Refine the existing concept.

NO
    ↓
Does it introduce a new architectural responsibility?

NO
    ↓
Continue refining the existing architecture.

YES
    ↓
Does it fundamentally change the architecture?

NO
    ↓
Update the appropriate specification.

YES
    ↓
Create an ADR candidate.

↓

Governance Review

↓

Accepted?

↓

Update the Design Baseline.

↓

Reference Implementation
```

## Principle

Refinement is always preferred over expansion.

New concepts are introduced only when refinement can no longer satisfy the architectural responsibility.

# Navigation Compass

The Navigation Compass helps contributors identify the authoritative artifact for a specific task.

| If you are...                         | Read...                   |
| ------------------------------------- | ------------------------- |
| Understanding WKA                     | Overview                  |
| Understanding architectural intent    | Purpose                   |
| Making architectural decisions        | Foundation Layer          |
| Working with concepts                 | Conceptual Layer          |
| Organizing documentation              | Representation Layer      |
| Defining knowledge evolution          | Evolution Layer           |
| Understanding architectural rationale | ADRs                      |
| Building software                     | Specifications            |
| Looking for implementation examples   | Reference Implementations |
| Joining the project                   | Bootstrap Baseline        |

## Principle

Always consult the authoritative artifact before introducing or modifying architectural knowledge.

# Evolution Compass

The Evolution Compass defines how architectural change flows through WKA.

```text
Need for Change

↓

Existing concept sufficient?

YES
    ↓
Refine the Specification.

NO
    ↓
Architectural change required?

NO
    ↓
Update the appropriate artifact.

YES
    ↓
Architectural Decision (ADR)

↓

Governance Review

↓

Accepted?

↓

Update Design Baseline

↓

Update Specifications

↓

Update Reference Implementations

↓

Knowledge evolves.
```

## Principle

Architecture evolves through controlled refinement.

Governance authorizes change.

Specifications define change.

Reference Implementations demonstrate change.

---

## Architectural Priorities

When two alternatives are both technically correct, prefer the one that better preserves:

1. Purpose

2. Architectural intent

3. Single Source of Truth

4. Single Responsibility

5. Refinement over Expansion

6. Long-term maintainability

---

# Bootstrap Completion Criteria

After reading this document, a contributor should understand:

✓ Why WKA exists.  
✓ The role of Purpose.  
✓ The role of Engineering Principles.  
✓ The responsibility of Governance.  
✓ Knowledge Domains and Knowledge Artifacts.  
✓ The difference between knowledge and documentation.  
✓ Documentation Architecture and Knowledge Lifecycle.  
✓ The relationship between Specifications and ADRs.  
✓ Authoring Order and Reading Order.  
✓ The architectural decision process.  
✓ The Working Agreement.

If any of these remain unclear, consult the **WKA Design Baseline** before proposing architectural changes.

---

# Quick Reference

| Concept                   | Responsibility                  |
| ------------------------- | ------------------------------- |
| Specifications            | Define architecture             |
| ADRs                      | Explain architectural rationale |
| Governance                | Define common rules             |
| Mechanisms                | Support Governance              |
| Knowledge Domains         | Organize knowledge              |
| Knowledge Artifacts       | Represent governed knowledge    |
| Documentation             | Represent knowledge             |
| Lifecycle                 | Govern knowledge evolution      |
| Reference Implementations | Demonstrate specifications      |

---

# Final Notes

This document is a context artifact.

Its purpose is rapid architectural understanding.

It intentionally omits detailed normative definitions.

The WKA Design Baseline remains the authoritative architectural source.

When contributing to a WKA-based project:

- Follow the Design Baseline.
- Preserve architectural intent.
- Refine before expanding.
- Keep concepts centralized.
- Keep responsibilities explicit.
- Record significant architectural rationale through ADRs when appropriate.

---

# Bootstrap Principle

> Understand before changing.
>
> Refine before expanding.
>
> Preserve before replacing.

---

# End of Document

WKA Bootstrap Baseline v0.1

Status: Stable

Audience:

- Human contributors
- AI agents
- Architects
- Maintainers

Purpose:

Rapid context acquisition for consistent architectural contribution.

Normative authority:

WKA Design Baseline.
