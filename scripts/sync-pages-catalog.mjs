const API_BASE = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";
const EXPECTED_PREVIEW_ORIGIN = "https://feat-api-pagination-preview.clipviet-live-preview.pages.dev";
const PROVIDER_IDS = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];

async function getJson(url, origin) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", Origin: origin },
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.text();
  let payload;
  try { payload = JSON.parse(body); } catch {
    throw new Error("Catalog API returned non-JSON HTTP " + response.status + ": " + body.slice(0, 120));
  }
  if (!response.ok) throw new Error("Catalog API HTTP " + response.status + ": " + (payload.error || "request failed"));
  return payload;
}

const origin = EXPECTED_PREVIEW_ORIGIN;
if (!origin.startsWith("https://")) throw new Error("CF_PAGES_URL must be an HTTPS Preview URL.");

const providerPayload = await getJson(API_BASE + "/api/providers", origin);
const providers = Array.isArray(providerPayload.data) ? providerPayload.data : [];
const configured = new Set(providers.filter((item) => item.configured).map((item) => item.id));
const missing = PROVIDER_IDS.filter((id) => !configured.has(id));
if (missing.length) {
  throw new Error("Refusing Preview build: AppleCMS Worker providers are not configured: " + missing.join(", "));
}

const checks = [];
for (const id of PROVIDER_IDS) {
  try {
    const payload = await getJson(API_BASE + "/api/providers/" + id + "/videos?page=1", origin);
    if (!Array.isArray(payload.items)) throw new Error("items[] missing");
    const playbackUrls = payload.items.reduce((count, video) =>
      count + (Array.isArray(video.lines) ? video.lines.reduce((lineCount, line) =>
        lineCount + (Array.isArray(line.episodes) ? line.episodes.filter((episode) =>
          typeof episode.url === "string" && episode.url.startsWith("https://")
        ).length : 0), 0) : 0), 0);
    checks.push({
      id,
      total: Number(payload.total) || 0,
      pageCount: Number(payload.pageCount) || 0,
      pageItems: payload.items.length,
      httpsPlaybackUrlsOnPage1: playbackUrls,
      ok: payload.items.length > 0 && Number(payload.total) > 0
    });
  } catch (error) {
    checks.push({ id, ok: false, error: String(error?.message || error).slice(0, 220) });
  }
}

const live = checks.filter((item) => item.ok);
const totalReported = live.reduce((sum, item) => sum + item.total, 0);
const playbackOnFirstPages = live.reduce((sum, item) => sum + (item.httpsPlaybackUrlsOnPage1 || 0), 0);

console.log(JSON.stringify({
  mode: "runtime-worker-catalog",
  previewOrigin: origin,
  providersConfigured: configured.size,
  providerChecks: checks,
  providersWithData: live.length,
  summedProviderTotals: totalReported,
  httpsPlaybackUrlsOnFirstPages: playbackOnFirstPages
}, null, 2));

if (!live.length || totalReported < 1) {
  throw new Error("Refusing Preview build: all five AppleCMS sources failed or returned an empty catalog. No empty catalog artifact will be published.");
}
if (playbackOnFirstPages < 1) {
  throw new Error("Refusing Preview build: no HTTPS playback URL was found on the first page of any available source.");
}

// Catalog metadata and playback details are served at runtime by the read-only Worker API.
// Never generate or overwrite site/data/catalog.json during a Pages build.
console.log("Preview preflight passed. Runtime catalog remains connected to the five AppleCMS Worker sources.");
