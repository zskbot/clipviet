const PROVIDERS = [
  { id: "souavzy", name: "Souavzy", role: "primary", envKey: "APPLECMS_SOUAVZY_URL", host: "api.souavzy.vip" },
  { id: "apiyutu", name: "ApiYutu", role: "backup", envKey: "APPLECMS_APIYUTU_URL", host: "apiyutu.com" },
  { id: "lbapi9", name: "LBApi9", role: "backup", envKey: "APPLECMS_LBAPI9_URL", host: "lbapi9.com" },
  { id: "slapibf", name: "Slapibf", role: "backup", envKey: "APPLECMS_SLAPIBF_URL", host: "slapibf.com" },
  { id: "jipinvip1", name: "JipinVIP1", role: "backup", envKey: "APPLECMS_JIPINVIP1_URL", host: "jipinvip1.com" }
];
const EXCLUDED_AGE_LABEL = /(?:học[\\s_-]*sinh|nữ[\\s_-]*sinh|nam[\\s_-]*sinh|thiếu[\\s_-]*niên|vị[\\s_-]*thành[\\s_-]*niên|under[\\s_-]*age|minor|loli|shota|school[\\s_-]*(?:girl|boy|student)|teen[\\s_-]*(?:girl|boy))/i;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30", "x-content-type-options": "nosniff" };
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } }); }
function corsOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return "";
  try {
    const u = new URL(origin), h = u.hostname.toLowerCase();
    if (u.protocol === "https:" && h.endsWith(".clipviet-live-independent-preview.pages.dev") && h.split(".").length === 4) return origin;
  } catch {}
  return null;
}
function corsHeaders(origin) {
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Accept, Content-Type",
    "access-control-max-age": "600",
    "vary": "Origin"
  } : {};
}
function provider(id, env) {
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) throw new Error("Unknown provider");
  const raw = env[p.envKey];
  if (!raw) throw new Error("Provider is not configured");
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== p.host || u.pathname !== "/api.php/provide/vod/" || u.username || u.password || u.search || u.hash) throw new Error("Provider endpoint rejected");
  return { ...p, base: u.toString() };
}
function safeImage(value) {
  try {
    const u = new URL(String(value || ""));
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch { return ""; }
}
function mapMetadata(p, row) {
  const id = String(row.vod_id ?? "");
  if (!id) return null;
  const item = {
    uid: p.id + ":" + id,
    id,
    sourceId: p.id,
    sourceName: p.name,
    title: String(row.vod_name || "").trim(),
    categoryId: Number(row.type_id) || 0,
    parentCategoryId: Number(row.type_id_1) || 0,
    categoryName: String(row.type_name || ""),
    poster: safeImage(row.vod_pic),
    posterThumb: safeImage(row.vod_pic_thumb),
    posterSlide: safeImage(row.vod_pic_slide),
    year: String(row.vod_year || ""),
    area: String(row.vod_area || ""),
    language: String(row.vod_lang || ""),
    remarks: String(row.vod_remarks || ""),
    duration: String(row.vod_duration || ""),
    actors: String(row.vod_actor || ""),
    director: String(row.vod_director || ""),
    description: String(row.vod_content || row.vod_blurb || "").replace(/<[^>]*>/g, " ").trim().slice(0, 4000),
    publishedAt: String(row.vod_pubdate || ""),
    updatedAt: String(row.vod_time || ""),
    views: Number(row.vod_hits) || 0,
    score: String(row.vod_score || ""),
    playbackEnabled: false,
    playbackRightsApproved: false,
    rightsStatus: "PENDING",
    lines: []
  };
  const label = [item.title, item.categoryName, item.description, item.actors, item.director].join(" ");
  return item.title && !EXCLUDED_AGE_LABEL.test(label) ? item : null;
}
async function upstream(p, params) {
  const u = new URL(p.base);
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && String(v) !== "") u.searchParams.set(k, String(v));
  const response = await fetch(u.toString(), { method: "GET", headers: { accept: "application/json", "user-agent": "ClipVietMetadataPreview/1.0" }, redirect: "manual", signal: AbortSignal.timeout(12000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Provider redirect rejected");
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
  const payload = await response.json();
  if (!payload || Number(payload.code) !== 1 || (!Array.isArray(payload.list) && !Array.isArray(payload.class))) throw new Error("Invalid AppleCMS response");
  return payload;
}
async function withFailover(ids, operation) {
  let lastError;
  for (const id of ids) {
    try { return await operation(id); } catch (e) { lastError = e; }
  }
  throw lastError || new Error("No eligible provider");
}
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, "") || "/";
  const origin = corsOrigin(request);
  if (origin === null) return json({ error: "Preview origin not allowed" }, 403);
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET, OPTIONS", ...headers });
  if (path === "/health") return json({ ok: true, service: "clipviet-catalog-metadata-preview", mode: "metadata-only", providers: PROVIDERS.map(p => ({ id:p.id, name:p.name, role:p.role, configured:Boolean(env[p.envKey]) })) }, 200, headers);
  if (path === "/api/providers") return json({ data: PROVIDERS.map(p => ({ id:p.id, name:p.name, role:p.role, protocol:"AppleCMS V10", configured:Boolean(env[p.envKey]) })), count: PROVIDERS.length }, 200, headers);
  if (path === "/api/catalog/categories") {
    const explicit = url.searchParams.get("sourceId");
    const ids = explicit ? [explicit] : PROVIDERS.map(p => p.id);
    try {
      const result = await withFailover(ids, async id => {
        const p = provider(id, env), payload = await upstream(p, { ac:"list" });
        const all = (payload.class || []).map(x => ({ id:Number(x.type_id)||0, parentId:Number(x.type_pid)||0, name:String(x.type_name||"") })).filter(x => x.id && x.name);
        const parents = new Set(all.map(x => x.parentId).filter(Boolean));
        return { sourceId:id, data:all.filter(x => !parents.has(x.id)), count:all.filter(x => !parents.has(x.id)).length };
      });
      return json(result, 200, headers);
    } catch (e) { return json({ error:"Catalog categories unavailable", detail:String(e.message||"") }, 502, headers); }
  }
  if (path === "/api/catalog/videos") {
    const explicit = url.searchParams.get("sourceId");
    const ids = explicit ? [explicit] : PROVIDERS.map(p => p.id);
    const page = Math.max(1, Math.min(1000000, Number.parseInt(url.searchParams.get("page") || "1",10) || 1));
    const categoryId = url.searchParams.get("categoryId") || "";
    const keyword = (url.searchParams.get("keyword") || "").trim().slice(0,100);
    try {
      const result = await withFailover(ids, async id => {
        const p = provider(id, env), params = { ac:"detail", pg:page };
        if (categoryId) params.t = categoryId.slice(0,20);
        if (keyword) params.wd = keyword;
        const payload = await upstream(p, params);
        const items = (payload.list || []).map(row => mapMetadata(p,row)).filter(Boolean);
        return { provider:{id:p.id,name:p.name}, items, page:Number(payload.page)||page, pageCount:Number(payload.pagecount)||0, total:Number(payload.total)||0, limit:Number(payload.limit)||items.length, playback:"locked" };
      });
      return json(result, 200, headers);
    } catch (e) { return json({ error:"Catalog providers unavailable", detail:String(e.message||"") }, 502, headers); }
  }
  const detail = path.match(/^\/api\/providers\/([a-z0-9-]+)\/videos\/([0-9]+)$/);
  if (detail) {
    try {
      const p = provider(detail[1],env), payload = await upstream(p,{ac:"detail",ids:detail[2]});
      const row = (payload.list||[]).find(x => String(x.vod_id) === detail[2]);
      const data = row ? mapMetadata(p,row) : null;
      return data ? json({data,playback:"locked"},200,headers) : json({error:"Video not found"},404,headers);
    } catch (e) { return json({error:"Metadata unavailable"},502,headers); }
  }
  return json({ error:"Not found" },404,headers);
}
export default { async fetch(request, env) { try { return await handle(request,env); } catch (e) { return json({ error:"Internal server error" },500); } } };
