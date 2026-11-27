const PROVIDERS = [
  { id: "souavzy", name: "Souavzy · Main", role: "primary", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu · Backup 1", role: "backup", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9 · Backup 2", role: "backup", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf · Backup 3", role: "backup", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1 · Backup 4", role: "backup", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com" }
];
const EXCLUDED_AGE_LABEL = /(?:học[\\s_-]*sinh|nữ[\\s_-]*sinh|nam[\\s_-]*sinh|thiếu[\\s_-]*niên|vị[\\s_-]*thành[\\s_-]*niên|under[\\s_-]*age|minor|loli|shota|school[\\s_-]*(?:girl|boy|student)|teen[\\s_-]*(?:girl|boy))/i;
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30", "x-content-type-options": "nosniff" };
const PAGE_SIZE = 30;
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...headers } }); }
function corsOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return "";
  try {
    const u = new URL(origin), h = u.hostname.toLowerCase();
    if (u.protocol === "https:" && !u.username && !u.password && h.endsWith(".clipviet-live-independent-preview.pages.dev") && h.split(".").length === 4) return origin;
  } catch {}
  return null;
}
function corsHeaders(origin) {
  return origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "Accept, Content-Type", "access-control-max-age": "600", "vary": "Origin" } : {};
}
function getProvider(id, env) {
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) throw Object.assign(new Error("Unknown provider"), { status: 404 });
  const raw = env[p.envKey];
  if (!raw) throw Object.assign(new Error("Provider is not configured"), { status: 503 });
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== p.host || u.pathname !== "/api.php/provide/vod/" || u.username || u.password || u.search || u.hash) throw Object.assign(new Error("Provider endpoint rejected"), { status: 503 });
  return { ...p, base: u.toString() };
}
function safeImage(value) {
  try { const u = new URL(String(value || "")); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; }
  catch { return ""; }
}
function mapMetadata(p, row) {
  const id = String(row.vod_id ?? "");
  if (!id) return null;
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
    playbackEnabled: false, playbackRightsApproved: false, rightsStatus: "METADATA_ONLY", lines: []
  };
  const label = [item.title, item.categoryName, item.description, item.actors, item.director].join(" ");
  return item.title && !EXCLUDED_AGE_LABEL.test(label) ? item : null;
}
async function fetchAppleCms(p, params) {
  const u = new URL(p.base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v) !== "") u.searchParams.set(k, String(v));
  const key = new Request(u.toString(), { method: "GET" });
  const cached = await caches.default.match(key);
  if (cached) return cached.json();
  const response = await fetch(u.toString(), { headers: { accept: "application/json", "user-agent": "ClipVietMetadataPreview/2.0" }, redirect: "manual", signal: AbortSignal.timeout(12000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Provider redirect rejected");
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 1 || (!Array.isArray(payload.list) && !Array.isArray(payload.class))) throw new Error("Invalid AppleCMS response");
  await caches.default.put(key, new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } }));
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
  const limit = PAGE_SIZE;
  const params = { ac: "detail", pg: page, limit };
  const categoryId = url.searchParams.get("categoryId");
  const keyword = url.searchParams.get("keyword") || url.searchParams.get("wd");
  if (categoryId) params.t = String(categoryId).slice(0, 20);
  if (keyword) params.wd = String(keyword).trim().slice(0, 100);
  const payload = await fetchAppleCms(p, params);
  const items = (payload.list || []).map(row => mapMetadata(p, row)).filter(Boolean);
  return { provider: { id: p.id, name: p.name }, items, page: Number(payload.page) || page, pageCount: Number(payload.pagecount) || 0, total: Number(payload.total) || 0, limit: Number(payload.limit) || limit, playbackEnabled: false, catalogMode: "metadata-only" };
}
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname.replace(/\\/$/, "") || "/";
  const origin = corsOrigin(request);
  if (origin === null) return json({ error: "Preview origin not allowed" }, 403);
  const cors = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405, { allow: "GET, HEAD, OPTIONS", ...cors });
  if (path === "/health") return json({ ok: true, service: "clipviet-catalog-metadata-preview", mode: "metadata-only", providerCount: PROVIDERS.length, configuredProviderCount: PROVIDERS.filter(p => Boolean(env[p.envKey])).length, playbackEnabled: false, providers: PROVIDERS.map(p => ({ id: p.id, name: p.name, role: p.role, configured: Boolean(env[p.envKey]), catalogMode: "metadata-only" })) }, 200, cors);
  if (path === "/api/providers") return json({ data: PROVIDERS.map(p => ({ id: p.id, name: p.name, role: p.role, protocol: "AppleCMS V10", configured: Boolean(env[p.envKey]), catalogMode: "metadata-only" })), count: PROVIDERS.length, playbackEnabled: false }, 200, cors);
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
    return json({ error: "All AppleCMS providers are currently unavailable", detail: String(lastError?.message || "unknown"), items: [], total: 0, page: 1, pageCount: 0, playbackEnabled: false }, 502, cors);
  }
  const match = path.match(/^\\/api\\/providers\\/([a-z0-9-]+)\\/(categories|videos)(?:\\/([0-9]+))?$/);
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
      const data = row ? mapMetadata(p, row) : null;
      return data ? json({ data, playbackEnabled: false, catalogMode: "metadata-only" }, 200, cors) : json({ error: "Video not found" }, 404, cors);
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
    return json({ error: error?.message || "Catalog error", code: error?.status || 502 }, error?.status || 502);
  }
} };
