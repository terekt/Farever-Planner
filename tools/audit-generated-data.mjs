import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const gameDataDir = path.join(rootDir, "game-data");

const requiredFiles = [
  "extracted/res.light/data.cdb",
  "foe_defenses.json",
  "dungeon_regions.json",
  "loot_tables.json",
  "generated/cdb_pngs/manifest.json",
];

const problems = [];
const todoRefs = [];

function readJson(relPath) {
  const abs = path.join(gameDataDir, relPath);
  if (!fs.existsSync(abs)) {
    problems.push(`missing required file: game-data/${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    problems.push(`invalid JSON in game-data/${relPath}: ${err.message}`);
    return null;
  }
}

function walk(value, relPath, jsonPath = "$") {
  if (value == null) return;
  if (typeof value === "string") {
    if (value.includes("TODO_")) todoRefs.push(`${relPath} ${jsonPath}=${value}`);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) walk(value[i], relPath, `${jsonPath}[${i}]`);
    return;
  }
  if (typeof value !== "object") return;
  for (const [k, v] of Object.entries(value)) walk(v, relPath, `${jsonPath}.${k}`);
}

function reportDuplicateIds(rows, label) {
  if (!Array.isArray(rows)) return;
  const seen = new Map();
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i] && rows[i].id;
    if (typeof id !== "string" || !id.trim()) continue;
    if (seen.has(id)) problems.push(`duplicate id in ${label}: ${id} at rows ${seen.get(id)} and ${i}`);
    else seen.set(id, i);
  }
}

for (const rel of requiredFiles) {
  const data = readJson(rel);
  if (data) walk(data, rel);
}

const foe = readJson("foe_defenses.json");
if (foe) {
  if (!Array.isArray(foe.units)) problems.push("foe_defenses.json is missing units[]");
  reportDuplicateIds(foe.units, "foe_defenses.json units");
  if (!foe.summaryByMonsterLevel || typeof foe.summaryByMonsterLevel !== "object") {
    problems.push("foe_defenses.json is missing summaryByMonsterLevel");
  }
}

const loot = readJson("loot_tables.json");
if (loot && typeof loot !== "object") problems.push("loot_tables.json must be an object");

console.log(`Generated data audit: ${requiredFiles.length} required files checked.`);
console.log(`TODO_* references: ${todoRefs.length}`);
if (todoRefs.length) {
  for (const ref of todoRefs.slice(0, 20)) console.log(`  - ${ref}`);
  if (todoRefs.length > 20) console.log(`  ... ${todoRefs.length - 20} more`);
}

if (problems.length) {
  console.error("Generated data audit found problems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}
