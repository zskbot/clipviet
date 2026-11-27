import { access, readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { spawnSync } from "node:child_process";

const CATALOG_API_BASE = "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev";
const PLAYBACK_API_BASE = "https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev";
const REQUIRED_CATALOG_FILES = [
  "site/app.js",
  "site/browse/browse.js"
];
const REQUIRED_PROVIDER_IDS = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];

const contractTests = spawnSync(process.execPath, ["--test", "tests/jasna-integration.test.mjs"], {
  encoding: "utf8",
  timeout: 30000
});
if (contractTests.stdout) process.stdout.write(contractTests.stdout);
if (contractTests.stderr) process.stderr.write(contractTests.stderr);
if (contractTests.error || contractTests.status !== 0) {
  throw new Error("Preview contract tests failed; refusing to publish the Pages build.");
}

for (const path of REQUIRED_CATALOG_FILES) {
  const source = await readFile(path, "utf8");
  if (!source.includes(CATALOG_API_BASE)) {
    throw new Error("Refusing Pages build: " + path + " is not connected to the AppleCMS metadata Worker API.");
  }
  if (source.includes("../data/catalog.json")) {
    throw new Error("Refusing Pages build: " + path + " still depends on the retired static catalog.");
  }
}

const diagnosticsSource = await readFile("site/diagnostics/diagnostics.js", "utf8");
const diagnosticsHtml = await readFile("site/diagnostics/index.html", "utf8");
new Script(diagnosticsSource, { filename: "site/diagnostics/diagnostics.js" });
if (!diagnosticsSource.includes(PLAYBACK_API_BASE) ||
    !diagnosticsSource.includes("/api/providers/diagnostics") ||
    !diagnosticsSource.includes("/api/playback/providers/")) {
  throw new Error("Refusing Pages build: Safari diagnostics page is not connected to the rights-gated Playback Worker.");
}
if (!diagnosticsHtml.includes('id="source-id"') || !diagnosticsHtml.includes('id="vod-id"')) {
  throw new Error("Refusing Pages build: Safari acceptance page is missing provider/VOD inputs.");
}
if (!diagnosticsSource.includes("playbackRightsApproved !== true") ||
    diagnosticsSource.includes("autoplay")) {
  throw new Error("Refusing Pages build: Safari diagnostics must verify video rights and never autoplay.");
}
if (diagnosticsSource.includes("/api/catalog/videos")) {
  throw new Error("Refusing Pages build: Safari diagnostics must not probe media from the metadata-only catalog API.");
}

if (!playerPage.includes('id="diagnostics"') || !playerSource.includes('"/diagnostics"')) {
  throw new Error("Refusing Pages build: watch page is missing its rights-gated HLS/MP4 diagnostics control.");
}

if (!playerSource.includes(PLAYBACK_API_BASE) || !playerSource.includes("/api/playback/providers/")) {
  throw new Error("Refusing Pages build: source player is not connected to the dedicated rights-gated Playback Worker API.");
}
if (!playerSource.includes("if (!video.currentSrc && !video.src)")) {
  throw new Error("Refusing Pages build: the play action must reject empty media sources.");
}
const rightsCheckIndex = playerSource.indexOf("if (!isPlaybackAuthorized(data))");
const sourceCheckIndex = playerSource.indexOf("mediaUrl = new URL(episode.url)");
const revealIndex = playerSource.indexOf("playNowButton.hidden = false");
if (rightsCheckIndex < 0 || sourceCheckIndex <= rightsCheckIndex || revealIndex <= sourceCheckIndex) {
  throw new Error("Refusing Pages build: the play overlay must be revealed only after rights and HTTPS URL validation.");
}
if (playerSource.includes(CATALOG_API_BASE)) {
  throw new Error("Refusing Pages build: source player must not resolve media details from the metadata-only catalog Worker.");
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
  mode: "separate-metadata-and-rights-gated-playback-workers",
  catalogApiBase: CATALOG_API_BASE,
  playbackApiBase: PLAYBACK_API_BASE,
  expectedProviders: REQUIRED_PROVIDER_IDS,
  catalogFilesVerified: REQUIRED_CATALOG_FILES,
  playbackFileVerified: "site/watch/source-player.js",
  staticCatalogArtifact: "absent",
  result: "PASS"
}, null, 2));
console.log("Build verifies metadata and playback API separation. The browser receives media URLs only from the dedicated rights-gated Playback Worker.");
