# Farever Planner

Standalone static website for the Farever gear planner.

## Run Locally

```sh
npm run dev
```

The planner must be served over HTTP because it loads JSON and CDB data with `fetch`.

## Deploy To GitHub Pages

Publish this folder as its own GitHub repository, then enable GitHub Pages from the repository settings. Use the repository root as the Pages source.

The site entry point is `index.html`, so no build step is required.

## Runtime Files

- `gear-planner.js` and `gear-planner.css` contain the planner UI.
- `game-data/extracted/res.light/data.cdb` is the main game data source.
- `game-data/foe_defenses.json`, `game-data/dungeon_regions.json`, and `game-data/loot_tables.json` power combat previews and boss drop hints.
- `game-data/generated/cdb_pngs/` contains generated item, skill, unit, and UI icons.
- `game-data/extracted/res/UI/` contains the few original UI atlas images still referenced directly.

Keep reverse-engineering tools, raw extraction folders, and large intermediate files outside this deployable project unless the runtime starts fetching them directly.

## Saves And Sharing

Saved builds are stored in the user's browser with `localStorage`.

The current build is also encoded into the URL hash as a compact portable payload (`#b=f3...`), so copied planner URLs can be opened by another browser or user without a backend.
