# Engine — Known Issues

**Owner:** whoever finds/confirms an issue here. **Load:** starting new engine work. Entries are deleted, not marked "done," once fixed — see `architecture/phase-2-knowledge-architecture-design.md` §5.

---

### RuleEngine options typing

`RuleEngine.setup(options: unknown, ...)` loses type safety across the options-passing chain. Deferred from the original Phase 1 whole-branch review as non-blocking; consider a `TOptions` generic once real games multiply enough to justify it.

### rngState not exercised

`GameState.rngState` exists specifically to support reproducible resume, but no game's mid-game randomness actually exercises it yet: Pişti's `setup` pre-shuffles the whole deck up front, and its mid-hand redeals just deal from the already-ordered `stock` zone, consuming no further RNG. This remains open for a future game whose mid-game randomness is genuinely re-rolled (e.g. a game that reshuffles a discard pile back into a live deck).
