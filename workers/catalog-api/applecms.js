const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", role: "primary", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip", enabled: true },
  { id: "apiyutu", name: "ApiYutu · Backup 1", role: "backup", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com", enabled: true },
  { id: "lbapi9", name: "LBApi9 · Backup 2", role: "backup", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com", enabled: true },
  { id: "slapibf", name: "Slapibf · Backup 3", role: "backup", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com", enabled: true },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", role: "backup", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com", enabled: true }
];
const USER_AGENT = "Mozilla/5.0 (compatible; ClipVietProvider/1.0; +https://clipviet.live)";
const EXCLUDED_AGE_LABEL = /(?:học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên|under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy))/i;
function hasExcludedAgeLabel(item) { return EXCLUDED_AGE_LABEL.test([item?.title,item?.categoryName,item?.description,item?.blurb,item?.actors,item?.director].filter(Boolean).join(" ")); }
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 500;
const CACHE_TTL_SECONDS = 60;
const PLAYBACK_MODES = new Set(["metadata_only", "official_embed", "owner_hosted_stream"]);
const RIGHTS_USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);
function rightsRegistry(raw) {
  try { const value = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function validEvidenceUrl(value) {
  try { const u = new URL(String(value || "")); return u.protocol === "https:" && !u.username && !u.password && !u.port && u.hostname.includes("."); }
  catch { return false; }
}
function providerRightsValid(record) {
  const expiry = Date.parse(record?.expiresAt || "");
  return record?.approved === true && record?.enabled === true &&
    Boolean(String(record.rightsHolder || "").trim()) && Boolean(String(record.licenseReference || "").trim()) &&
    validEvidenceUrl(record.evidenceUrl) && validEvidenceUrl(record.documentationUrl) &&
    Number.isFinite(expiry) && expiry > Date.now() &&
    Array.isArray(record.regions) && (record.regions.includes("GLOBAL") || record.regions.includes("VN")) &&
    ["none", "api_key", "oauth2", "signed_request"].includes(record.authMode) && PLAYBACK_MODES.has(record.playbackMode);
}
function videoRightsValid(record, providerId, videoId, use) {
  const expiry = Date.parse(record?.expiresAt || "");
  return record?.providerId === providerId && record?.approved === true && record?.enabled === true &&
    String(record.sourceContentId || "") === String(videoId) &&
    Boolean(String(record.rightsHolder || "").trim()) && Boolean(String(record.licenseReference || "").trim()) &&
    Boolean(String(record.creator || "").trim()) && validEvidenceUrl(record.sourceUrl) && validEvidenceUrl(record.evidenceUrl) &&
    Number.isFinite(expiry) && expiry > Date.now() &&
    record.sourceVerified === true && record.ownershipVerified === true &&
    record.performerAgeVerified === true && record.performerConsentVerified === true &&
    Array.isArray(record.permittedUses) && record.permittedUses.includes(use) &&
    record.permittedUses.every(item => RIGHTS_USES.has(item)) &&
    Array.isArray(record.regions) && (record.regions.includes("GLOBAL") || record.regions.includes("VN"));
}
function getVideoRecord(env, providerId, videoId) {
  const registry = rightsRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  return registry[providerId + ":" + videoId] || registry[videoId] || null;
}
const providerQueues = new Map();
const lastProviderRequestAt = new Map();
async function withProviderThrottle(providerId, operation) {
  const previous = providerQueues.get(providerId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  providerQueues.set(providerId, current);
  await previous;
  try {
    const elapsed = Date.now() - (lastProviderRequestAt.get(providerId) || 0);
    if (elapsed < 200) await new Promise(resolve => setTimeout(resolve, 200 - elapsed));
    lastProviderRequestAt.set(providerId, Date.now());
    return await operation();
  } finally {
    release();
    if (providerQueues.get(providerId) === current) providerQueues.delete(providerId);
  }
}

export class ProviderError extends Error {
  constructor(providerId, message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.status = status;
  }
}
export function listProviders(env = {}) {
  const rights = rightsRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON);
  return PROVIDERS.filter(p => p.enabled).map(provider => {
    const configured = Boolean(env[provider.envKey]);
    const approved = providerRightsValid(rights[provider.id]);
    return {
      id: provider.id, name: provider.name, role: provider.role, protocol: "AppleCMS V10",
      configured, rightsApproved: approved, playbackMode: approved ? rights[provider.id].playbackMode : "none",
      status: !configured ? "NOT_CONFIGURED" : !approved ? "PENDING_RIGHTS" :
        rights[provider.id].playbackMode === "metadata_only" ? "METADATA_ONLY" : "PLAYBACK_APPROVED",
      operationalState: "NOT_CHECKED"
    };
  });
}
function getProvider(id, env) {
  const configured = PROVIDERS.find(p => p.id === id && p.enabled);
  if (!configured) throw new ProviderError(String(id || ""), "Unknown or disabled provider", 404);
  const raw = env?.[configured.envKey];
  if (!raw) throw new ProviderError(configured.id, "Provider URL is not configured", 503);
  const rights = rightsRegistry(env?.VIDEO_PROVIDER_RIGHTS_JSON)[configured.id];
  if (!providerRightsValid(rights)) throw new ProviderError(configured.id, "Provider rights are pending review", 403);
  let url;
  try { url = new URL(raw); } catch { throw new ProviderError(configured.id, "Provider URL is invalid", 503); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== configured.host || url.pathname !== "/api.php/provide/vod/" || url.username || url.password || url.search || url.hash) throw new ProviderError(configured.id, "Provider URL does not match the approved AppleCMS endpoint", 503);
  return { ...configured, baseUrl: url.toString(), rights };
}
export function parsePlayUrls(raw, playFrom) {
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
export function mapVideo(provider, row, env = {}) {
  const sourceId = String(row.vod_id ?? "");
  if (!sourceId) return null;
  const approval = getVideoRecord(env, provider.id, sourceId);
  if (!videoRightsValid(approval, provider.id, sourceId, "metadata_only")) return null;
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
    playbackEnabled: false,
    playbackRightsApproved: false,
    rightsStatus: "METADATA_APPROVED",
    lines: String(row.vod_play_from || "").split("$$").map((name, index) => ({ lineName: name || "线路" + (index + 1), episodes: [] }))
  };
}
async function fetchProviderJson(provider, params) {
  const url = new URL(provider.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") url.searchParams.set(key, String(value));
  }
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const categoryRequest = params.ac === "list";
  const cache = caches.default;
  const cached = categoryRequest ? await cache.match(cacheKey) : null;
  if (cached) return cached.json();

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await withProviderThrottle(provider.id, () => fetch(url.toString(), {
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "follow"
      }));
      if (response.url) { const finalUrl = new URL(response.url); if (finalUrl.protocol !== "https:" || finalUrl.hostname.toLowerCase() !== provider.host) throw new Error("Provider redirected outside the approved HTTPS host"); }
      if (!response.ok) throw new Error("Provider HTTP " + response.status);
      const payload = await response.json();
      if (!payload || Number(payload.code) !== 1 || !Array.isArray(payload.list) && !Array.isArray(payload.class)) {
        throw new Error("Provider returned an invalid AppleCMS response");
      }
      const cacheResponse = new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=" + CACHE_TTL_SECONDS }
      });
      if (categoryRequest) await cache.put(cacheKey, cacheResponse);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  console.warn("applecms_provider_failed", { providerId: provider.id, reason: lastError instanceof Error ? lastError.message : "unknown" });
  throw new ProviderError(provider.id, "Provider request failed", 502);
}
export async function getProviderCategories(providerId, env) {
  const provider = getProvider(providerId, env);
  const payload = await fetchProviderJson(provider, { ac: "list" });
  const all = (payload.class || []).filter(item => !EXCLUDED_AGE_LABEL.test(String(item.type_name || ""))).map(item => ({
    id: Number(item.type_id) || 0,
    parentId: Number(item.type_pid) || 0,
    name: String(item.type_name || "")
  })).filter(item => item.id && item.name);
  const parentIds = new Set(all.map(item => item.parentId).filter(Boolean));
  return all.filter(item => !parentIds.has(item.id));
}
export async function listProviderVideos(providerId, options = {}, env) {
  const provider = getProvider(providerId, env);
  const page = Math.max(1, Math.min(1000000, Number.parseInt(options.page, 10) || 1));
  const params = { ac: "detail", pg: page, limit: 30 };
  if (options.categoryId) params.t = String(options.categoryId).slice(0, 20);
  if (options.keyword) params.wd = String(options.keyword).trim().slice(0, 100);
  const payload = await fetchProviderJson(provider, params);
  const items = (payload.list || []).map(row => mapVideo(provider, row, env)).filter(item => item && !hasExcludedAgeLabel(item));
  return {
    provider: { id: provider.id, name: provider.name },
    items,
    page: Number(payload.page) || page,
    pageCount: Number(payload.pagecount) || 0,
    total: Number(payload.total) || 0,
    limit: Number(payload.limit) || items.length
  };
}
export async function getProviderVideo(providerId, vodId, env) {
  const provider = getProvider(providerId, env);
  const id = String(vodId || "").trim().slice(0, 40);
  if (!/^[0-9,]+$/.test(id)) throw new ProviderError(provider.id, "Invalid video ID", 400);
  const payload = await fetchProviderJson(provider, { ac: "detail", ids: id });
  const row = (payload.list || []).find(item => String(item.vod_id) === id);
  const item = row ? mapVideo(provider, row, env) : null;
  return item && !hasExcludedAgeLabel(item) ? item : null;
}
export async function getProviderPlayback(providerId, vodId, env) {
  const provider = getProvider(providerId, env);
  const id = String(vodId || "").trim().slice(0, 40);
  if (!/^[0-9]+$/.test(id)) throw new ProviderError(provider.id, "Invalid video ID", 400);
  const payload = await fetchProviderJson(provider, { ac: "detail", ids: id });
  const row = (payload.list || []).find(item => String(item.vod_id) === id);
  if (!row) throw new ProviderError(provider.id, "Video not found", 404);
  const mode = provider.rights.playbackMode;
  const use = mode === "official_embed" ? "official_embed" : "owner_hosted_stream";
  if (mode === "metadata_only" || !videoRightsValid(getVideoRecord(env, provider.id, id), provider.id, id, use)) {
    throw new ProviderError(provider.id, "Playback rights are not approved for this video", 403);
  }
  const hostAllowed = (value, hosts) => {
    try {
      const u = new URL(String(value || ""));
      return u.protocol === "https:" && !u.username && !u.password && !u.port &&
        Array.isArray(hosts) && hosts.some(host => String(host).toLowerCase() === u.hostname.toLowerCase());
    } catch { return false; }
  };
  if (mode === "official_embed") {
    const embed = String(row.vod_embed || row.embed_url || row.vod_player_url || "");
    if (!hostAllowed(embed, provider.rights.embedHosts)) throw new ProviderError(provider.id, "Official embed host is not approved", 403);
    return { providerId, videoId: id, playbackMode: mode, sources: [{ name: "Official embed", url: new URL(embed).href }] };
  }
  const sources = parsePlayUrls(row.vod_play_url, row.vod_play_from).map(line => ({
    lineName: line.lineName,
    episodes: line.episodes.filter(episode => hostAllowed(episode.url, provider.rights.mediaHosts))
      .map(episode => ({ name: episode.name, url: episode.url }))
  })).filter(line => line.episodes.length);
  if (!sources.length) throw new ProviderError(provider.id, "No URL matches the approved media host list", 403);
  return { providerId, videoId: id, playbackMode: mode, delivery: "direct-browser", sources };
}
export async function checkProviderHealth(providerId, env) {
  const started = Date.now();
  try {
    const provider = getProvider(providerId, env);
    const categories = await getProviderCategories(providerId, env);
    const page = await listProviderVideos(providerId, { page: 1 }, env);
    const playbackUrlsPresent = page.items.some(item => item.lines.some(line => line.episodes.length > 0));
    return {
      id: provider.id, name: provider.name, status: page.items.length > 0 && categories.length > 0 && playbackUrlsPresent ? "api-ok" : "degraded",
      latencyMs: Date.now() - started, categoryCount: categories.length,
      pageCount: page.pageCount, total: page.total, sampleCount: page.items.length,
      playbackUrlsPresent
    };
  } catch (error) {
    const provider = PROVIDERS.find(item => item.id === providerId);
    return { id: providerId, name: provider?.name || providerId, status: error?.status === 503 ? "not-configured" : "offline", latencyMs: Date.now() - started };
  }
}
export async function checkAllProviderHealth(env) {
  const results = [];
  for (const provider of PROVIDERS.filter(item => item.enabled)) {
    results.push(await checkProviderHealth(provider.id, env));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
