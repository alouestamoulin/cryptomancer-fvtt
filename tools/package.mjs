// Packages the built system for a FoundryVTT release.
//
// Produces, in ./release/:
//   - system.zip : the ZIP that Foundry downloads and extracts. Its ROOT
//                  contains system.json, cryptomancer.js, template.json,
//                  lang/, packs/, etc. (i.e. the *contents* of dist/, not the
//                  dist folder itself). This is the layout Foundry expects.
//   - system.json: a standalone copy of the manifest, used as the release's
//                  manifest URL for installing/updating.
//
// Upload BOTH files as assets on the GitHub release.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");
const outDir = resolve(root, "release");
const zipPath = resolve(outDir, "system.zip");

if (!existsSync(resolve(dist, "system.json"))) {
  console.error("dist/system.json not found. Run `npm run build` first.");
  process.exit(1);
}
if (!existsSync(resolve(dist, "cryptomancer.js"))) {
  console.error("dist/cryptomancer.js not found. Build did not emit the ESM bundle.");
  process.exit(1);
}

// Fresh output dir
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Zip the CONTENTS of dist/ (cwd = dist so paths are relative to the root).
// Exclude source maps to keep the release lean.
execFileSync("zip", ["-r", "-q", zipPath, ".", "-x", "*.map"], { cwd: dist, stdio: "inherit" });

// Standalone manifest for the release's manifest URL.
copyFileSync(resolve(dist, "system.json"), resolve(outDir, "system.json"));

console.log("Release assets written to ./release/:");
console.log("  - release/system.zip");
console.log("  - release/system.json");
