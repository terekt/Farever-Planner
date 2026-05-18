# Planner Test Notes

The planner tests use `gear-planner.js` through `globalThis.__GEAR_PLANNER_TEST__` so browser-facing behavior and Node regressions stay aligned.

## Authoritative Data

- Item stat parity comes from the live game client, `game-data/extracted/res.light/data.cdb`, and bytecode-backed notes referenced in `gear-item-attribute-display.mjs`.
- Do not change expected item stat rows just to make tests pass. Update them only after re-verifying the same item, tier, rarity, and viewer class in the game.
- Portable build, snapshot, URL, and GitHub Pages policy tests should stay deterministic and should not depend on a browser or network.

## Adding Coverage

Prefer exposing small pure helpers through `__GEAR_PLANNER_TEST__` over duplicating planner logic in tests. This keeps refactors honest while preserving the no-build GitHub Pages deployment.
