# Pişti — Known Issues

**Owner:** whoever finds/confirms an issue here. **Load:** starting new Pişti work. Entries are deleted, not marked "done," once fixed.

**Note:** Phase 2's illustrative knowledge tree did not list this file explicitly for Pişti (only for Batak). It's created here anyway because Step 3 of the Phase 3 migration instructions says known-issues.md should exist "only where actual known issues exist" — and two genuine, still-open ones exist for Pişti, documented below rather than dropped or smuggled into `overview.md` (which explicitly must not hold known problems). Flagged as a minor, deliberate deviation from Phase 2's exact tree, not a silent one.

---

### Hard AI unprofiled on device

Pişti's Hard AI (`minimaxChooseMove` at depth 8) was cleared as a non-issue via a Node-compiled benchmark (mean 0.39ms, p95 0.92ms across 720 real decisions) rather than a literal on-device profile, since no device was reachable at the time. Node/V8 is faster than Hermes-on-Android, so this isn't a literal device number — the margin to a 16.7ms frame budget is wide enough that this is no longer treated as a blocking risk, but a real-device spot-check remains worth doing opportunistically.

### GameResultModal act() warning

`GameResultModal`'s tests have a known, deferred `act()` warning originating from the Modal's fade animation. Not fixed; the correct fix if revisited is switching to `animationType="none"` instead of `"fade"`.
