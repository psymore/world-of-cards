# Architecture Audits — Animation

This folder holds the audit artifacts `../AnimationReviewWorkflow.md` §2 requires before every implementation: [`AuditTemplate.md`](./AuditTemplate.md) (full) and [`QuickAuditTemplate.md`](./QuickAuditTemplate.md) (lighter, for small/obvious changes — see its own eligibility checklist) — plus completed, standalone audit records for work that spans multiple demos or touches production, per `AuditTemplate.md`'s own guidance on when a standalone copy is warranted instead of embedding the audit inside a `../demos/DemoTemplate.md`-based doc.

**Templates and completed audits live together here** — the same convention `../ADR/` already uses for its own template and numbered records: one folder per artifact type, holding both what it's produced from and what it produces.

**Naming a completed audit:** a short, descriptive name for the work being audited (e.g. `Demo06-07-RailFanAudit.md`). No fixed numbering scheme — unlike ADRs, audits aren't a supersession chain; each is tied to one specific piece of work and doesn't need to be cited by a stable ID from elsewhere.
