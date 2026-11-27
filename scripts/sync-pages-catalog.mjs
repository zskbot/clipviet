const API_BASE = "https://clipviet-catalog-readonly-preview.huynhthuongg2505-f9b.workers.dev";
const EXPECTED_PREVIEW_ORIGIN = "https://feat-api-pagination-preview.clipviet-live-preview.pages.dev";
const PROVIDER_IDS = ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];

async function getJson(url, origin) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", Origin: origin },
    cache: "no-store",
    signal: AbortSignal.timeout(25000)
  });
  const body = await response.text();
  let payload;
  try { payload = JSON.parse(body); } catch {
    throw new Error("Catalog API returned non-JSON HTTP " + response.status + ": " + body.slice(0, 180));
  }
  if (!response.ok) throw new Error("Catalog API HTTP " + response.status + ": " + (payload.error || "request failed"));
  return payload;
}

const origin = EXPECTED_PREVIEW_ORIGIN;
console.log("ClipViet Preview catalog preflight starting.");
console.log("Worker API: " + API_BASE);
console.log("Allowed Preview origin: " + origin);

const providerPayload = await getJson(API_BASE + "/api/providers", origin);
const providers = Array.isArray(providerPayload.data) ? providerPayload.data : [];
const configured = new Set(providers.filter((item) => item.configured).map((item) => item.id));
const missing = PROVIDER_IDS.filter((id) => !configured.has(id));
console.log("Configured AppleCMS providers: " + [...configured].join(", "));
if (missing.length) {
  throw new Error("Refusing Preview build: AppleCMS Worker providers are not configured: " + missing.join(", "));
}

// Use the Worker’s own ordered failover route. One unavailable backup must not
// block Preview when another configured source still returns real, playable rows.
const catalog = await getJson(API_BASE + "/api/catalog/videos?page=1", origin);
const items = Array.isArray(catalog.items) ? catalog.items : [];
const total = Number(catalog.total) || 0;
const pageCount = Number(catalog.pageCount) || 0;
const playableItems = items.filter((video) =>
  Array.isArray(video.lines) && video.lines.some((line) =>
    Array.isArray(line.episodes) && line.episodes.some((episode) =>
      typeof episode.url === "string" && episode.url.startsWith("https://")
    )
  )
);
const playbackUrls = items.reduce((count, video) =>
  count + (Array.isArray(video.lines) ? video.lines.reduce((lineCount, line) =>
    lineCount + (Array.isArray(line.episodes) ? line.episodes.filter((episode) =>
      typeof episode.url === "string" && episode.url.startsWith("https://")
    ).length : 0), 0) : 0), 0);

const report = {
  mode: "runtime-worker-catalog-with-failover",
  previewOrigin: origin,
  providersConfigured: configured.size,
  providerIds: PROVIDER_IDS,
  activeProvider: catalog.provider?.name || catalog.provider?.id || "unknown",
  sourceReportedTotal: total,
  sourcePageCount: pageCount,
  recordsOnPage1: items.length,
  playableRecordsOnPage1: playableItems.length,
  httpsPlaybackUrlsOnPage1: playbackUrls,
  failover: Boolean(catalog.failover)
};
console.log(JSON.stringify(report, null, 2));

if (!items.length || total < 1) {
  throw new Error("Refusing Preview build: Worker failover returned an empty catalog. No empty catalog artifact will be published.");
}
if (!playableItems.length || playbackUrls < 1) {
  throw new Error("Refusing Preview build: Worker returned no HTTPS playback URLs on page 1.");
}

// The Worker serves catalog metadata and detail records at runtime.
// Never generate or overwrite site/data/catalog.json during a Pages build.
console.log("Preview preflight passed. No static empty catalog was generated.");
