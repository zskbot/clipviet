const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", role: "primary", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", role: "backup", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", role: "backup", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf · Backup 3", role: "backup", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", role: "backup", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com" }
];
const EXCLUDED_AGE_LABEL = /(?:học[\s_-]*sinh|nữ[\s_-]*sinh|nam[\s_-]*sinh|thiếu[\s_-]*niên|vị[\s_-]*thành[\s_-]*niên|under[\s_-]*age|minor|loli|shota|school[\s_-]*(?:girl|boy|student)|teen[\s_-]*(?:girl|boy))/i;
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30", "x-content-type-options": "nosniff" };
const PAGE_SIZE = 30;
const RIGHTS_USES = new Set(["metadata_only", "official_embed", "owner_hosted_stream", "redistribute"]);
const PLAYBACK_MODES = new Set(["metadata_only", "official_embed", "owner_hosted_stream"]);
function parseRegistry(raw) {
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
    ["none", "api_key", "oauth2", "signed_request"].includes(record.authMode) &&
    PLAYBACK_MODES.has(record.playbackMode);
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
function videoRecord(env, providerId, videoId) {
  const registry = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  return registry[providerId + ":" + videoId] || registry[videoId] || null;
}
function providerStatus(provider, env) {
  const configured = Boolean(env[provider.envKey]);
  const rights = parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON)[provider.id];
  const approved = providerRightsValid(rights);
  return {
    id: provider.id, name: provider.name, role: provider.role,
    protocol: "AppleCMS V10", configured, rightsApproved: approved,
    playbackMode: approved ? rights.playbackMode : "none",
    status: !configured ? "NOT_CONFIGURED" : !approved ? "PENDING_RIGHTS" :
      rights.playbackMode === "metadata_only" ? "METADATA_ONLY" : "PLAYBACK_APPROVED",
    operationalState: "NOT_CHECKED"
  };
}

function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...headers } }); }
function corsOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return "";
  try {
    const u = new URL(origin), h = u.hostname.toLowerCase();
    if (u.protocol === "https:" && !u.username && !u.password && (h.endsWith(".clipviet-live-independent-preview.pages.dev") || h.endsWith(".clipviet-live-preview.pages.dev")) && h.split(".").length === 4) return origin;
  } catch {}
  return null;
}
function corsHeaders(origin) {
  return origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "Accept, Content-Type", "access-control-max-age": "600", "vary": "Origin" } : {};
}
function getProvider(id, env) {
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) throw Object.assign(new Error("Unknown provider"), { status: 404, code: "UNKNOWN_PROVIDER" });
  const raw = env[p.envKey];
  if (!raw) throw Object.assign(new Error("Provider is not configured"), { status: 503, code: "PROVIDER_NOT_CONFIGURED" });
  const rights = parseRegistry(env.VIDEO_PROVIDER_RIGHTS_JSON)[id];
  if (!providerRightsValid(rights)) throw Object.assign(new Error("Provider rights are pending review"), { status: 403, code: "PROVIDER_RIGHTS_PENDING" });
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== p.host || u.pathname !== "/api.php/provide/vod/" || u.username || u.password || u.port || u.search || u.hash) throw Object.assign(new Error("Provider endpoint rejected"), { status: 503, code: "PROVIDER_CONFIG_INVALID" });
  return { ...p, base: u.toString(), rights };
}
function safeImage(value) {
  try { const u = new URL(String(value || "")); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; }
  catch { return ""; }
}
function mapMetadata(p, row, rightsRegistry = {}) {
  const id = String(row.vod_id ?? "");
  if (!id) return null;
  const approval = rightsRegistry[p.id + ":" + id] || rightsRegistry[id];
  if (!videoRightsValid(approval, p.id, id, "metadata_only")) return null;
  const item = {
    uid: p.id + ":" + id, id, sourceId: p.id, sourceName: p.name,
    title: String(row.vod_name || "").trim(),
    categoryId: Number(row.type_id) || 0, parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || ""), poster: safeImage(row.vod_pic),
    posterThumb: safeImage(row.vod_pic_thumb), posterSlide: safeImage(row.vod_pic_slide),
    year: String(row.vod_year || ""), area: String(row.vod_area || ""),
    language: String(row.vod_lang || ""), remarks: String(row.vod_remarks || ""),
    duration: String(row.vod_duration || ""), actors: String(row.vod_actor || ""),
    director: String(row.vod_director || ""),
    description: String(row.vod_content || row.vod_blurb || "").replace(/<[^>]*>/g, " ").trim().slice(0, 4000),
    publishedAt: String(row.vod_pubdate || ""), updatedAt: String(row.vod_time || ""),
    views: Number(row.vod_hits) || 0, score: String(row.vod_score || ""),
    playbackEnabled: false, playbackRightsApproved: false, rightsStatus: "METADATA_APPROVED", lines: [], playbackEndpoint: "/api/providers/" + p.id + "/videos/" + id + "/playback"
  };
  const label = [item.title, item.categoryName, item.description, item.actors, item.director].join(" ");
  return item.title && !EXCLUDED_AGE_LABEL.test(label) ? item : null;
}
async function fetchAppleCms(p, params) {
  const u = new URL(p.base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v) !== "") u.searchParams.set(k, String(v));
  const key = new Request(u.toString(), { method: "GET" });
  const categoryRequest = params.ac === "list";
  const cached = categoryRequest ? await caches.default.match(key) : null;
  if (cached) return cached.json();
  const response = await fetch(u.toString(), { headers: { accept: "application/json", "user-agent": "ClipVietMetadataPreview/2.0" }, redirect: "manual", signal: AbortSignal.timeout(12000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Provider redirect rejected");
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 1 || (!Array.isArray(payload.list) && !Array.isArray(payload.class))) throw new Error("Invalid AppleCMS response");
  if (categoryRequest) await caches.default.put(key, new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } }));
  return payload;
}
async function categories(id, env) {
  const p = getProvider(id, env);
  const payload = await fetchAppleCms(p, { ac: "list" });
  const all = (payload.class || []).filter(x => !EXCLUDED_AGE_LABEL.test(String(x.type_name || ""))).map(x => ({ id: Number(x.type_id) || 0, parentId: Number(x.type_pid) || 0, name: String(x.type_name || "") })).filter(x => x.id && x.name);
  const parentIds = new Set(all.map(x => x.parentId).filter(Boolean));
  return all.filter(x => !parentIds.has(x.id));
}
async function videos(id, url, env) {
  const p = getProvider(id, env);
  const page = Math.max(1, Math.min(1000000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const params = { ac: "detail", pg: page, limit: PAGE_SIZE };
  const categoryId = url.searchParams.get("categoryId");
  const keyword = url.searchParams.get("keyword") || url.searchParams.get("wd");
  if (categoryId) params.t = String(categoryId).slice(0, 20);
  if (keyword) params.wd = String(keyword).trim().slice(0, 100);
  const payload = await fetchAppleCms(p, params);
  const rightsRegistry = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
  const items = (payload.list || []).map(row => mapMetadata(p, row, rightsRegistry)).filter(Boolean);
  return { provider: { id: p.id, name: p.name, status: "ACTIVE" }, items, page: Number(payload.page) || page, pageCount: Number(payload.pagecount) || 0, total: Number(payload.total) || 0, limit: Number(payload.limit) || PAGE_SIZE, playbackEnabled: false, catalogMode: p.rights.playbackMode === "metadata_only" ? "metadata-only" : "rights-scoped" };
}
function parseAuthorizedPlayback(row, provider, videoId, env) {
  const approval = videoRecord(env, provider.id, videoId);
  const mode = provider.rights.playbackMode;
  const use = mode === "official_embed" ? "official_embed" : "owner_hosted_stream";
  if (mode === "metadata_only" || !videoRightsValid(approval, provider.id, videoId, use)) {
    throw Object.assign(new Error("Playback rights are not approved for this video"), { status: 403, code: "PLAYBACK_RIGHTS_PENDING" });
  }
  const allowed = (value, hosts) => {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && !url.username && !url.password && !url.port &&
        Array.isArray(hosts) && hosts.some(host => String(host).toLowerCase() === url.hostname.toLowerCase());
    } catch { return false; }
  };
  if (mode === "official_embed") {
    const embed = String(row.vod_embed || row.embed_url || row.vod_player_url || "");
    if (!allowed(embed, provider.rights.embedHosts)) throw Object.assign(new Error("Official embed host is not approved"), { status: 403, code: "OFFICIAL_EMBED_NOT_AVAILABLE" });
    return { providerId: provider.id, videoId, playbackMode: mode, sources: [{ name: "Official embed", url: new URL(embed).href }] };
  }
  const lines = String(row.vod_play_url || "").split("$$");
  const names = String(row.vod_play_from || "").split("$$");
  const sources = lines.map((line, index) => ({
    name: String(names[index] || "Playback " + (index + 1)),
    episodes: line.split("#").map((entry, episodeIndex) => {
      const cut = entry.lastIndexOf("$");
      if (cut < 1) return null;
      const url = entry.slice(cut + 1).trim();
      if (!allowed(url, provider.rights.mediaHosts)) return null;
      return { name: entry.slice(0, cut).trim() || "Episode " + (episodeIndex + 1), url: new URL(url).href };
    }).filter(Boolean)
  })).filter(line => line.episodes.length);
  if (!sources.length) throw Object.assign(new Error("No source URL matches the approved media host list"), { status: 403, code: "MEDIA_HOST_NOT_APPROVED" });
  return { providerId: provider.id, videoId, playbackMode: mode, delivery: "direct-browser", sources };
}
async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) || "/" : url.pathname;
  const origin = corsOrigin(request);
  if (origin === null) return json({ error: "Preview origin not allowed" }, 403);
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405, { allow: "GET, HEAD, OPTIONS", ...cors });
  const states = PROVIDERS.map(provider => providerStatus(provider, env));
  const apiParts = path.split("/");
  if (apiParts[1] === "api" && apiParts[2] === "providers" && apiParts[3] === "applecms") {
    const sourceId = url.searchParams.get("sourceId") || url.searchParams.get("provider") || "";
    if (apiParts.length === 5 && apiParts[4] === "status") {
      return json({ success: true, providers: states, rightsGate: { policy: "deny-by-default", providerAndVideoApprovalRequired: true } }, 200, cors);
    }
    if (apiParts.length === 5 && apiParts[4] === "categories") {
      if (!sourceId) return json({ success: false, error: "sourceId is required", code: "SOURCE_ID_REQUIRED" }, 400, cors);
      const data = await categories(sourceId, env);
      return json({ success: true, provider: providerStatus(PROVIDERS.find(item => item.id === sourceId) || { id: sourceId, name: sourceId, role: "unknown", envKey: "" }, env), categories: data }, 200, cors);
    }
    if (apiParts.length === 5 && apiParts[4] === "videos") {
      if (!sourceId) return json({ success: false, error: "sourceId is required", code: "SOURCE_ID_REQUIRED" }, 400, cors);
      return json({ success: true, ...(await videos(sourceId, url, env)) }, 200, cors);
    }
    if (apiParts.length === 6 && apiParts[4] === "videos" && /^[0-9]+$/.test(apiParts[5])) {
      if (!sourceId) return json({ success: false, error: "sourceId is required", code: "SOURCE_ID_REQUIRED" }, 400, cors);
      const id = apiParts[5], provider = getProvider(sourceId, env);
      const payload = await fetchAppleCms(provider, { ac: "detail", ids: id });
      const row = (payload.list || []).find(item => String(item.vod_id) === id);
      const record = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
      const data = row ? mapMetadata(provider, row, record) : null;
      return data ? json({ success: true, provider: { id: sourceId, name: provider.name, status: "ACTIVE", operationalState: "ACTIVE" }, data, playback: { enabled: false, endpoint: data.playbackEndpoint } }, 200, cors)
        : json({ success: false, error: "Video is not approved for metadata or was not found", code: "VIDEO_RIGHTS_PENDING" }, 403, cors);
    }
    if (apiParts.length === 7 && apiParts[4] === "videos" && /^[0-9]+$/.test(apiParts[5]) && apiParts[6] === "playback") {
      if (!sourceId) return json({ success: false, error: "sourceId is required", code: "SOURCE_ID_REQUIRED" }, 400, cors);
      const id = apiParts[5], provider = getProvider(sourceId, env);
      const payload = await fetchAppleCms(provider, { ac: "detail", ids: id });
      const row = (payload.list || []).find(item => String(item.vod_id) === id);
      const record = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
      if (!row || !mapMetadata(provider, row, record)) return json({ success: false, error: "Video is not approved for metadata", code: "VIDEO_RIGHTS_PENDING" }, 403, cors);
      return json({ success: true, provider: { id: sourceId, name: provider.name, status: "ACTIVE", operationalState: "ACTIVE" }, data: parseAuthorizedPlayback(row, provider, id, env), rightsGate: { policy: "deny-by-default", providerApproved: true, perVideoApproved: true } }, 200, cors);
    }
  }
  if (path === "/health") return json({ ok: true, service: "clipviet-catalog-metadata-preview", mode: "rights-gated-preview", providerCount: PROVIDERS.length, configuredProviderCount: states.filter(item => item.configured).length, playbackEnabled: false, providers: states }, 200, cors);
  if (path === "/api/providers") return json({ data: states, count: PROVIDERS.length, playbackEnabled: false, rightsGate: { policy: "deny-by-default" } }, 200, cors);
  if (path === "/api/catalog/categories") {
    const id = url.searchParams.get("sourceId") || "souavzy";
    const data = await categories(id, env);
    return json({ data, count: data.length, provider: PROVIDERS.find(p => p.id === id), playbackEnabled: false, catalogMode: "metadata-only" }, 200, cors);
  }
  if (path === "/api/catalog/videos") {
    const requested = url.searchParams.get("sourceId");
    const ids = requested ? [requested] : ["souavzy", "apiyutu", "lbapi9", "slapibf", "jipinvip1"];
    let lastError;
    for (const id of ids) {
      try { return json(await videos(id, url, env), 200, cors); }
      catch (error) { lastError = error; }
    }
    const status = lastError?.status || 502;
    return json({ success: false, error: status === 403 ? "No provider is approved for metadata access" : "AppleCMS providers are unavailable", code: lastError?.code || "PROVIDER_UNAVAILABLE", providers: PROVIDERS.map(provider => providerStatus(provider, env)), items: [], total: 0, page: 1, pageCount: 0, playbackEnabled: false }, status, cors);
  }
  const playbackParts = path.split("/");
  const playbackMatch = playbackParts.length === 7 && playbackParts[1] === "api" && playbackParts[2] === "providers" && playbackParts[4] === "videos" && playbackParts[6] === "playback" ? [null, playbackParts[3], playbackParts[5]] : null;
  if (playbackMatch) {
    const [, id, videoId] = playbackMatch;
    const p = getProvider(id, env);
    const payload = await fetchAppleCms(p, { ac: "detail", ids: videoId });
    const row = (payload.list || []).find(item => String(item.vod_id) === videoId);
    if (!row) return json({ success: false, error: "Video not found", code: "VIDEO_NOT_FOUND" }, 404, cors);
    const rightsRegistry = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
    if (!mapMetadata(p, row, rightsRegistry)) return json({ success: false, error: "Video is not approved for metadata", code: "VIDEO_RIGHTS_PENDING" }, 403, cors);
    return json({ success: true, data: parseAuthorizedPlayback(row, p, videoId, env), rightsGate: { policy: "deny-by-default", providerApproved: true, perVideoApproved: true } }, 200, cors);
  }
  const match = path.match(/^\/api\/providers\/([a-z0-9-]+)\/(categories|videos)(?:\/([0-9]+))?$/);
  if (match) {
    const [, id, kind, vodId] = match;
    if (kind === "categories") {
      const data = await categories(id, env);
      return json({ data, count: data.length, provider: PROVIDERS.find(p => p.id === id), playbackEnabled: false }, 200, cors);
    }
    if (vodId) {
      const p = getProvider(id, env);
      const payload = await fetchAppleCms(p, { ac: "detail", ids: vodId });
      const row = (payload.list || []).find(x => String(x.vod_id) === vodId);
      const rightsRegistry = parseRegistry(env.VIDEO_VIDEO_RIGHTS_JSON);
      const data = row ? mapMetadata(p, row, rightsRegistry) : null;
      return data ? json({ data, playback: { enabled: false, endpoint: data.playbackEndpoint, reason: "PER_VIDEO_PLAYBACK_APPROVAL_REQUIRED" } }, 200, cors) : json({ error: "Video is not approved for metadata or was not found", code: "VIDEO_RIGHTS_PENDING" }, 403, cors);
    }
    return json(await videos(id, url, env), 200, cors);
  }
  return json({ error: "Not found" }, 404, cors);
}
export default { async fetch(request, env) {
  try {
    const response = await handle(request, env);
    if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  } catch (error) {
    const origin = corsOrigin(request);
    const cors = origin && origin !== null ? corsHeaders(origin) : {};
    return json({ success: false, error: error?.message || "Catalog error", code: error?.code || "PROVIDER_ERROR" }, error?.status || 502, cors);
  }
} };
