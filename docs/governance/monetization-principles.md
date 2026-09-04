# Monetization Principles

**Owner:** Project owner, accepted 2026-09-05 from the draft in `docs/superpowers/specs/2026-09-04-ux-monetization-research-backlog.md` §2.1. **Scope:** constraints on *how* monetization works in any game in this repo, if and when it's ever built. **Load:** before starting any IAP, ads, or pricing work.

This document schedules nothing. No monetization work is implied on `docs/status/roadmap.md` by its existence — it exists so that whenever monetization work does start, it starts inside these constraints rather than reinventing them under deadline pressure.

---

1. **No randomized-outcome paid mechanics** (loot boxes, gacha, card packs with hidden contents) in any game in this repo. Reasoning: King, Delfabbro et al. (*Addiction*, 2018) found these mechanics structurally resemble gambling; every game here already has a fixed, fully-known deck, so a randomized-pack mechanic would introduce a new category of risk rather than extend an existing pattern.
2. **No pay-to-win.** AI difficulty, rule variants, and gameplay depth stay free. If monetization ever exists, it's confined to Content, Convenience, and Customization (cosmetics, ad removal) — never Competitive Advantage (Luton's "4 C's of IAP" framing).
3. **If ads are ever added: rewarded-only, opt-in.** No forced interstitials. Rewarded video is the one ad format the majority of players view positively (Tenjin, 2025 benchmark); forced interstitials are the category most associated with churn.
