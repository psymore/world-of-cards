# UI Visual System — Known Issues

**Owner:** whoever finds/confirms an issue here. **Load:** starting new work on shared visual components. Entries are deleted, not marked "done," once fixed.

---

### Theme color duplication

Navy/gold/wood palette color literals are duplicated, not centralized, across several shared components — `TableWoodCorners`, `TableEdgeRails`, `HeaderWoodFrame`, `HomeScreen.tsx`, `PistiSetupView.tsx`, and others each hardcode their own copies rather than reading from one shared theme module. A dedicated navy/gold theme-extraction pass has been repeatedly flagged as worth doing (across several separate whole-branch reviews) but deliberately deferred each time as a bigger, more foundational decision than whichever cleanup pass surfaced it.

### Settings icon asymmetry

The global "Dim Unplayable Cards" setting (`apps/mobile/src/state/settingsStore.ts`) only has a gear/settings button to toggle it on Batak's screen (`GameScreenLayout`'s `onSettingsPress` prop, wired only for Batak). Pişti's screen doesn't pass that prop, so it has no way to reach the setting at all — meaning toggling it off in Batak also silently affects Pişti's rendering for the rest of that app session, with no way to restore it from Pişti's own UI. Accepted as-is at the time it was found, but re-flagged here as an open asymmetry — this is also the item the "cross-table visual consistency pass" UI-review sub-project (see `docs/status/roadmap.md`) is meant to resolve.
