const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", role: "primary", baseUrl: "https://api.souavzy.vip/api.php/provide/vod/", enabled: true },
  { id: "apiyutu", name: "ApiYutu · Backup 1", role: "backup", baseUrl: "https://apiyutu.com/api.php/provide/vod/", enabled: true },
  { id: "lbapi9", name: "LBApi9 · Backup 2", role: "backup", baseUrl: "https://lbapi9.com/api.php/provide/vod/", enabled: true },
  { id: "slapibf", name: "Slapibf · Backup 3", role: "backup", baseUrl: "https://slapibf.com/api.php/provide/vod/", enabled: true },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", role: "backup", baseUrl: "https://jipinvip1.com/api.php/provide/vod/", enabled: true }
];
const USER_AGENT = "Mozilla/5.0 (compatible; ClipVietProvider/1.0; +https://clipviet.live)";
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 500;
const CACHE_TTL_SECONDS = 60;

export class ProviderError extends Error {
  constructor(providerId, message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.status = status;
  }
}
export function listProviders() {
  return PROVIDERS.filter(p => p.enabled).map(({ id, name, role }) => ({ id, name, role, protocol: "AppleCMS V10" }));
}
function getProvider(id) {
  const provider = PROVIDERS.find(p => p.id === id && p.enabled);
  if (!provider) throw new ProviderError(String(id || ""), "Unknown or disabled provider", 404);
  return provider;
}
function parsePlayUrls(raw, playFrom) {
  if (!raw) return [];
  const froms = String(playFrom || "").split("$$$");
  return String(raw).split("$$$").map((line, li) => ({
    lineName: froms[li] || "线路" + (li + 1),
    episodes: line.split("#").filter(Boolean).map((segment, i) => {
      const pos = segment.lastIndexOf("$");
      const name = pos > -1 ? segment.slice(0, pos) : "";
      const url = pos > -1 ? segment.slice(pos + 1) : segment;
      let safeUrl = "";
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && !parsed.username && !parsed.password) safeUrl = parsed.href;
      } catch {}
      return { index: i, name: name || "第 " + (i + 1) + " 集", url: safeUrl };
    }).filter(ep => ep.url)
  })).filter(line => line.episodes.length);
}
function mapVideo(provider, row) {
  const sourceId = String(row.vod_id ?? "");
  if (!sourceId) return null;
  const rawDescription = String(row.vod_content || "");
  const blurb = String(row.vod_blurb || "");
  return {
    uid: provider.id + ":" + sourceId,
    id: sourceId,
    sourceId: provider.id,
    sourceName: provider.name,
    title: String(row.vod_name || ""),
    categoryId: Number(row.type_id) || 0,
    parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || ""),
    poster: String(row.vod_pic || ""),
    posterThumb: String(row.vod_pic_thumb || ""),
    posterSlide: String(row.vod_pic_slide || ""),
    screenshotsRaw: String(row.vod_pic_screenshot || ""),
    year: String(row.vod_year || ""),
    area: String(row.vod_area || ""),
    language: String(row.vod_lang || ""),
    remarks: String(row.vod_remarks || ""),
    duration: String(row.vod_duration || ""),
    actors: String(row.vod_actor || ""),
    director: String(row.vod_director || ""),
    description: rawDescription.trim() ? rawDescription : blurb,
    blurb,
    publishedAt: String(row.vod_pubdate || ""),
    updatedAt: String(row.vod_time || ""),
    views: Number(row.vod_hits) || 0,
    score: String(row.vod_score || ""),
    playFrom: String(row.vod_play_from || ""),
    playServer: String(row.vod_play_server || ""),
    lines: parsePlayUrls(row.vod_play_url, row.vod_play_from)
  };
}
async function fetchProviderJson(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "error"
      });
      if (!response.ok) throw new Error("Provider HTTP " + response.status);
      const payload = await response.json();
      if (!payload || Number(payload.code) !== 1 || !Array.isArray(payload.list) && !Array.isArray(payload.class)) {
        throw new Error("Provider returned an invalid AppleCMS response");
      }
      const cacheResponse = new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=" + CACHE_TTL_SECONDS }
      });
      await cache.put(cacheKey, cacheResponse);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  console.warn("applecms_provider_failed", { providerId: provider.id, reason: lastError instanceof Error ? lastError.message : "unknown" });
  throw new ProviderError(provider.id, "Provider request failed", 502);
}
export async function getProviderCategories(providerId) {
  const provider = getProvider(providerId);
  const payload = await fetchProviderJson(provider, { ac: "list" });
  const all = (payload.class || []).map(item => ({
    id: Number(item.type_id) || 0,
    parentId: Number(item.type_pid) || 0,
    name: String(item.type_name || "")
  })).filter(item => item.id && item.name);
  const parentIds = new Set(all.map(item => item.parentId).filter(Boolean));
  return all.filter(item => !parentIds.has(item.id));
}
export async function listProviderVideos(providerId, options = {}) {
  const provider = getProvider(providerId);
  const page = Math.max(1, Math.min(1000000, Number.parseInt(options.page, 10) || 1));
  const params = { ac: "detail", pg: page };
  if (options.categoryId) params.t = String(options.categoryId).slice(0, 20);
  if (options.keyword) params.wd = String(options.keyword).trim().slice(0, 100);
  const payload = await fetchProviderJson(provider, params);
  const items = (payload.list || []).map(row => mapVideo(provider, row)).filter(Boolean);
  return {
    provider: { id: provider.id, name: provider.name },
    items,
    page: Number(payload.page) || page,
    pageCount: Number(payload.pagecount) || 0,
    total: Number(payload.total) || 0,
    limit: Number(payload.limit) || items.length
  };
}
export async function getProviderVideo(providerId, vodId) {
  const provider = getProvider(providerId);
  const id = String(vodId || "").trim().slice(0, 40);
  if (!/^[0-9,]+$/.test(id)) throw new ProviderError(provider.id, "Invalid video ID", 400);
  const payload = await fetchProviderJson(provider, { ac: "detail", ids: id });
  const row = (payload.list || []).find(item => String(item.vod_id) === id);
  return row ? mapVideo(provider, row) : null;
}
export async function checkProviderHealth(providerId) {
  const provider = getProvider(providerId);
  const started = Date.now();
  try {
    const [categories, page] = await Promise.all([
      getProviderCategories(providerId),
      listProviderVideos(providerId, { page: 1 })
    ]);
    return {
      id: provider.id, name: provider.name, status: page.items.length > 0 && categories.length > 0 ? "api-ok" : "degraded",
      latencyMs: Date.now() - started, categoryCount: categories.length,
      pageCount: page.pageCount, total: page.total, sampleCount: page.items.length,
      playbackUrlsPresent: page.items.some(item => item.lines.some(line => line.episodes.length > 0))
    };
  } catch {
    return { id: provider.id, name: provider.name, status: "offline", latencyMs: Date.now() - started };
  }
}
export async function checkAllProviderHealth() {
  const results = [];
  for (const provider of PROVIDERS.filter(item => item.enabled)) {
    results.push(await checkProviderHealth(provider.id));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
