import { access, readFile } from "node:fs/promises";

const API_BASE = "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev";
const REQUIRED_FILES = [
  "site/app.js",
  "site/browse/browse.js",
  "site/watch/source-player.js"
];
const REQUIRED_PROVIDER_IDS = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];

for (const path of REQUIRED_FILES) {
  const source = await readFile(path, "utf8");
  if (!source.includes(API_BASE)) {
    throw new Error("Refusing Pages build: " + path + " is not connected to the AppleCMS Worker API.");
  }
  if ((path.includes("browse/") || path.includes("source-player")) && source.includes("../data/catalog.json")) {
    throw new Error("Refusing Pages build: " + path + " still depends on the retired static catalog.");
  }
}

for (const providerId of REQUIRED_PROVIDER_IDS) {
  if (!/^[a-z0-9-]+$/.test(providerId)) {
    throw new Error("Invalid AppleCMS provider identifier: " + providerId);
  }
}

try {
  await access("site/data/catalog.json");
  throw new Error("Refusing Pages build: stale site/data/catalog.json exists. Runtime Worker API is the only catalog source.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(JSON.stringify({
  mode: "runtime-worker-catalog",
  apiBase: API_BASE,
  expectedProviders: REQUIRED_PROVIDER_IDS,
  frontendFilesVerified: REQUIRED_FILES,
  staticCatalogArtifact: "absent",
  result: "PASS"
}, null, 2));
console.log("Build does not sync or publish a static catalog. Browser pages load live data from the read-only Worker API and display explicit errors if that API is unavailable.");
