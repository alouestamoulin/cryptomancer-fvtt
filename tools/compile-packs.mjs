/**
 * Compile the legacy NeDB (`.db`) compendium sources in `src/packs` into the
 * LevelDB pack format required by Foundry VTT v11+ (and v12/v13/v14).
 *
 * Foundry no longer reads NeDB `.db` packs at runtime, so the manifest points at
 * LevelDB directories (`packs/<name>`). This script regenerates those directories
 * from the `.db` sources on every build.
 *
 * Requires the `@foundryvtt/foundryvtt-cli` dev dependency (installed via `npm install`).
 * Run automatically as part of `npm run build`, or on its own with `npm run build:packs`.
 */
import { extractPack, compilePack } from "@foundryvtt/foundryvtt-cli";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src", "packs");

// Mirror rollup's output targets: always dist, plus OUT_DIR during dev watch.
const outRoots = [path.join(root, "dist")];
if (process.env.OUT_DIR) outRoots.push(process.env.OUT_DIR);

// Document type per pack (needed by the NeDB reader). Keep in sync with system.json.
const documentTypes = {
  consumables: "Item",
  equipment: "Item",
  outfits: "Item",
  spells: "Item",
  talents: "Item",
  weapons: "Item",
  "outfit-rules": "JournalEntry",
  "status-effects": "JournalEntry",
  "weapon-rules": "JournalEntry",
};

const dbFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith(".db"));

for (const db of dbFiles) {
  const name = db.replace(/\.db$/, "");
  const documentType = documentTypes[name];
  if (!documentType) {
    console.warn(`Skipping ${db}: no documentType mapping.`);
    continue;
  }
  const nedbPath = path.join(srcDir, db);

  // 1. Extract the NeDB source to a temporary folder of one JSON file per document.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `crypt-pack-${name}-`));
  await extractPack(nedbPath, tmpDir, { nedb: true, documentType, log: false });

  // 2. Compile the JSON documents into a LevelDB pack for each output root.
  for (const outRoot of outRoots) {
    const dest = path.join(outRoot, "packs", name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    await compilePack(tmpDir, dest, { log: false });
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Compiled pack: ${name} (${documentType})`);
}
