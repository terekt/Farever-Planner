/**
 * Regression: planner **`simulateGearFlats`** vs **your** captured stats (**`expect`**).
 *
 * ## When this test fails (required workflow)
 *
 * A failure means **our item-stat processing / display path does not match the game** for the listed item, level, and viewer — **not** that the fixture is “out of date.”
 *
 * **Do:** drive fixes from **`game-data/hlboot.dat`** via **`tools/hlbc-latest`** — **`_asm_*.txt`** dumps (**`generateItemAffixes`**, **`getItemAffixes`**, tooltip callers per **`GEAR_STATS_PIPELINE.md`** / **`DEFINITIVE_ITEM_STATS_PARITY.md`**), plus **`data.cdb`**. Align **`gear-planner.js`** with what those artifacts show; cite the relevant **`RefFun`** / symbol when you change behavior.
 *
 * **Do not:** invent presentation rules or **`item.faction`** / viewer heuristics to silence failures without a bytecode-backed explanation in those dumps. Guessing is how parity drifts; **`hlboot.dat`** is the authority when tests disagree with the planner.
 *
 * **Do not:** edit **`CASES`**, shrink or inflate **`expect`**, or delete cases to make the run green. **`CASES[].expect`** is **only** changed by the maintainer after **re-verifying numbers in the live game client** (same item, level, class).
 *
 * **`simulateGearFlats`** must match **`expect`** exactly (**same keys and values** — no extra simulated stats, nothing missing vs **`expect`**).
 *
 * **`assertPlannerPreviewLinesMatchSimulation`** checks that modal preview strings stay derived from the same simulation math.
 *
 * **`level`** — planner tier / Level slider that produced the tooltip (**must match** capture).
 *
 * Optional **`rarity`** — same as the planner’s rarity override (**must be ≥** the item’s sheet rarity); forwarded as **`rarityOverride`** to **`simulateGearFlats`** / **`affixPreviewLines`**. Omit to use the template rarity from **`data.cdb`**.
 *
 * Run: `node tests/gear-item-attribute-display.mjs` or `npm run test:gear`
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

vm.runInThisContext(fs.readFileSync(path.join(rootDir, "gear-planner.js"), "utf8"), {
  filename: "gear-planner.js",
});

const api = globalThis.__GEAR_PLANNER_TEST__;
if (!api || typeof api.hydratePlannerFromCdb !== "function") {
  throw new Error("globalThis.__GEAR_PLANNER_TEST__ missing — gear-planner.js must expose the test API.");
}

const cdbPath = path.join(rootDir, "game-data/extracted/res.light/data.cdb");
const cdb = JSON.parse(fs.readFileSync(cdbPath, "utf8"));
api.hydratePlannerFromCdb(cdb);

const VIEWER_CLASS_ID =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.GEAR_TEST_VIEWER_CLASS &&
    String(process.env.GEAR_TEST_VIEWER_CLASS).trim()) ||
  "Mage";

/** Minimal **`slotDef`** for **`affixPreviewLines`** (same keys as **`SLOT_DEFS`**). */
const SLOT_DEF_MIN = {
  back: { key: "back", weaponSlot: false },
  boots: { key: "boots", weaponSlot: false },
  gloves: { key: "gloves", weaponSlot: false },
  shoulder: { key: "shoulder", weaponSlot: false },
  helmet: { key: "helmet", weaponSlot: false },
  /** Aligns with **`SLOT_DEFS`** (`belt` / Waist). */
  waist: { key: "belt", weaponSlot: false },
  /** Aligns with **`SLOT_DEFS`** (`pants` / Legs). */
  legs: { key: "pants", weaponSlot: false },
  /** Crafted staff — same slot flags as **`SLOT_DEFS`** `mainHand`. */
  weapon: { key: "mainHand", weaponSlot: true, weaponRole: "main" },
};

/**
 * @param {Record<string, number>} sim from **`simulateGearFlats`**
 * @param {Record<string, number>} expected maintainer-authored stats @ tier — must match **`sim`** exactly (same keys and values)
 */
function assertGearFlatsExact(caseLabel, sim, expected) {
  const simKeys = Object.keys(sim).sort();
  const expKeys = Object.keys(expected).sort();
  if (simKeys.length !== expKeys.length || simKeys.some((k, i) => k !== expKeys[i])) {
    throw new Error(
      `${caseLabel}: simulated stats must exactly match expect (same keys, no extra stats).\n` +
        `  expect keys (${expKeys.length}): ${JSON.stringify(expKeys)}\n` +
        `  sim keys (${simKeys.length}): ${JSON.stringify(simKeys)}\n` +
        `  sim: ${JSON.stringify(sim)}`
    );
  }
  for (const attr of expKeys) {
    const want = expected[attr];
    const got = sim[attr];
    if (got !== want) {
      throw new Error(
        `${caseLabel}: ${attr} expected ${want}, got ${got}. Snapshot: ${JSON.stringify(sim)}`
      );
    }
  }
}

function sortedLines(lines) {
  return [...lines].map(String).sort();
}

/** Modal `affixPreviewLines` must match formatted output from **`simulateGearFlats`**. */
function assertPlannerPreviewLinesMatchSimulation(caseLabel, itemId, tier, slotDef, simOpts) {
  const item = api.itemByIdRef[itemId];
  if (!item) throw new Error(`Unknown item ${itemId}`);

  const sim = api.simulateGearFlats(itemId, tier, simOpts);
  const canonical = api.gearPreviewStatLinesFromTotals(sim, slotDef);
  const sel = {
    item,
    ilvl: tier,
    stars: 0,
    rarityOverride:
      simOpts && simOpts.rarityOverride != null && String(simOpts.rarityOverride).trim() !== ""
        ? String(simOpts.rarityOverride).trim()
        : null,
    enchantId: null,
    flawless: false,
    ...(VIEWER_CLASS_ID ? { viewerClassId: VIEWER_CLASS_ID } : {}),
  };
  const uiLines = api
    .affixPreviewLinesFromSelection(sel, tier, slotDef)
    .filter((L) => !String(L).startsWith("Upgrade:"));

  const a = sortedLines(uiLines);
  const b = sortedLines(canonical);
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    throw new Error(
      `${caseLabel}: modal/tool preview lines !== formatted simulation.\n` +
        `  UI (${uiLines.length}): ${JSON.stringify(uiLines)}\n` +
        `  ref (${canonical.length}): ${JSON.stringify(canonical)}\n` +
        `  sim: ${JSON.stringify(sim)}`
    );
  }
}

/** Ground-truth rows — **you** maintain **`expect`** (see file header). */
const CASES = [
  {
    label: "Spellbound Scarf of the Nomad",
    id: "Back_Z2U2_Wiz",
    level: 18,
    slotKey: "back",
    expect: { Armor: 36, Vitality: 3 },
  },
  {
    label: "Infused Boots of the Nomad",
    id: "Feet_Z2U2_AssWiz",
    level: 18,
    slotKey: "boots",
    expect: { Armor: 99, Dexterity: 2, Intellect: 2 },
  },
  {
    label: "Spellbound Wrists of the Nomad",
    id: "Hands_Z2U2_Wiz",
    level: 19,
    slotKey: "gloves",
    expect: { Armor: 84, Vitality: 5 },
  },
  {
    label: "Protected Pauldrons of the Nomad",
    id: "Shoulders_Z2U2_FigWiz",
    level: 18,
    slotKey: "shoulder",
    expect: { Armor: 137, Intellect: 2, Strength: 2 },
  },
  {
    label: "Ceremonial Siren Gloves",
    id: "Hands_RManfish_Wiz",
    level: 20,
    slotKey: "gloves",
    rarity: "Rare",
    expect: { Armor: 91, Vitality: 6, Intellect: 6, SpellPenetrationRating: 18 },
  },
  {
    label: "Aura of the Honeycomb",
    id: "Waist_RBee_FigWiz",
    level: 15,
    slotKey: "waist",
    rarity: "Rare",
    expect: { Armor: 105, Vitality: 4, Strength: 2, Intellect: 2, ArmorPenetrationRating: 7, SpellPenetrationRating: 7 },
  },
  {
    label: "Zenobee's Breeches",
    id: "Legs_RBee_WizCle",
    level: 13,
    slotKey: "legs",
    rarity: "Rare",
    expect: { Armor: 95, Vitality: 5, Faith: 2, Intellect: 2, SpellPenetrationRating: 9, FervorRating: 9 },
  },
  {
    label: "Radiance",
    id: "Staff_Craft",
    level: 18,
    slotKey: "weapon",
    rarity: "Epic",
    expect: { Vitality: 22, Intellect: 21, SpellPenetrationRating: 57 },
  },
  {
    label: "Infused Headband of the Nomad",
    id: "Head_Z2U2_AssWiz",
    level: 18,
    slotKey: "helmet",
    expect: { Armor: 116, Dexterity: 3, Intellect: 3 },
  },
];

const baseSimOpts = {
  stars: 0,
  weaponSlot: false,
  viewerClassId: VIEWER_CLASS_ID,
};

for (const c of CASES) {
  const slotDef = SLOT_DEF_MIN[c.slotKey];
  if (!slotDef) throw new Error(`Missing SLOT_DEF_MIN for ${c.slotKey}`);

  const simOpts = { ...baseSimOpts, ...(c.simOpts || {}) };
  if (c.rarity != null && String(c.rarity).trim() !== "") {
    simOpts.rarityOverride = String(c.rarity).trim();
  }
  if (slotDef.weaponSlot) {
    simOpts.weaponSlot = true;
  }
  const rarityPart =
    c.rarity != null && String(c.rarity).trim() !== "" ? `, rarity ${String(c.rarity).trim()}` : "";
  const label = `${c.label} (${c.id}) @ planner tier ${c.level}, viewer ${VIEWER_CLASS_ID}${rarityPart}`;

  const sim = api.simulateGearFlats(c.id, c.level, simOpts);
  assertGearFlatsExact(label, sim, c.expect);
  assertPlannerPreviewLinesMatchSimulation(label, c.id, c.level, slotDef, simOpts);
}

// Flawless adds Item_FlawlessILevelBonus raw ilvl — armor scaling must strictly increase vs non-flawless at same tier.
const tierFlaw = api.plannerTierForItemId("Shoulders_Z2U1_Wiz");
const simBase = api.simulateGearFlats("Shoulders_Z2U1_Wiz", tierFlaw, {
  stars: 0,
  weaponSlot: false,
  viewerClassId: VIEWER_CLASS_ID,
});
const simFlaw = api.simulateGearFlats("Shoulders_Z2U1_Wiz", tierFlaw, {
  stars: 0,
  weaponSlot: false,
  viewerClassId: VIEWER_CLASS_ID,
  flawless: true,
});
const ab = simBase.Armor;
const af = simFlaw.Armor;
if (!(typeof ab === "number" && typeof af === "number") || af <= ab) {
  throw new Error(
    `Flawless ilvl bump should increase Armor (base=${ab}, flawless=${af}, flawlessBonus=${api.scalingParams.flawlessIlvlBonus})`
  );
}

// Rare dual-aptitude ring: vitality pool matches generateItemAffixes math_round (not ceil from attribute flags).
const levelSignetWizard = 15;
const sheetSignet = api.plannerTierForItemId("Finger_Z2RCraft_FerMP");
if (sheetSignet !== levelSignetWizard) {
  throw new Error(
    `Finger_Z2RCraft_FerMP: expected sheet level ${levelSignetWizard}, CDB has ${sheetSignet}`
  );
}
const simSignet = api.simulateGearFlats("Finger_Z2RCraft_FerMP", levelSignetWizard, {
  stars: 0,
  weaponSlot: false,
  viewerClassId: VIEWER_CLASS_ID,
});
if (simSignet.Vitality !== 3) {
  throw new Error(
    `Signet of the Wizard Vitality expected 3 from math_round parity, got ${simSignet.Vitality} (${JSON.stringify(simSignet)})`
  );
}

console.log(
  `gear-item-attribute-display: ${CASES.length} cases OK (${cdbPath}) viewer=${VIEWER_CLASS_ID}`
);
