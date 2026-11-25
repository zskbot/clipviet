import registry from "./index.mjs";
import { resolveRole } from "./security.mjs";
import { validateContentRights, canApproveContentRights, playbackDecision } from "./rights-gate.mjs";

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
});
const clean = (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16 * 1024) return { error: "Request body too large.", status: 413 };
  const raw = await request.text();
  if (raw.length > 16 * 1024) return { error: "Request body too large.", status: 413 };
  try { return { data: JSON.parse(raw || "{}") }; } catch { return { error: "Invalid JSON body.", status: 400 }; }
}
const previewOnly = request => {
  const host = new URL(request.url).hostname.toLowerCase();
  return /^clipviet-provider-registry-preview\.[a-z0-9-]+\.workers\.dev$/.test(host);
};
const rowToJson = row => ({
  id: row.id, providerId: row.provider_id, sourcePlatform: row.source_platform,
  sourceContentId: row.source_content_id, sourceUrl: row.source_url, creator: row.creator,
  rightsHolder: row.rights_holder, licenseReference: row.license_reference,
  evidenceUrl: row.evidence_url, licenseExpiresAt: row.license_expires_at,
  permittedUses: JSON.parse(row.permitted_uses_json), regions: JSON.parse(row.regions_json),
  status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const rightsRoute = (parts[0] === "providers" && parts[2] === "content-rights") ||
      (parts[0] === "playback" && parts[1] === "authorize");
    if (!rightsRoute) return registry.fetch(request, env, ctx);
    if (env.REGISTRY_ENV !== "preview" || !previewOnly(request)) return json({ error: "Preview-only registry is disabled." }, 404);

    const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
    const origin = request.headers.get("origin") || "";
    if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403);
    const cors = {};
    if (origin) { cors["Access-Control-Allow-Origin"] = origin; cors.Vary = "Origin"; }
    cors["Access-Control-Allow-Methods"] = "GET,POST,PATCH,OPTIONS";
    cors["Access-Control-Allow-Headers"] = "Authorization,Content-Type";
    cors["Access-Control-Max-Age"] = "600";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const role = await resolveRole(request, env);
    if (!role) return json({ error: "Unauthorized" }, 401, cors);
    if (!env.PROVIDER_DB) return json({ error: "Preview D1 binding is not configured." }, 503, cors);
    const db = env.PROVIDER_DB;
    try {
      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "content-rights" && request.method === "GET") {
        if (!["admin", "technical", "legal"].includes(role)) return json({ error: "Forbidden" }, 403, cors);
        const result = await db.prepare("SELECT * FROM provider_content_rights WHERE provider_id=? ORDER BY created_at DESC LIMIT 500").bind(parts[1]).all();
        return json({ records: (result.results || []).map(rowToJson) }, 200, cors);
      }

      if (parts[0] === "providers" && parts.length === 3 && parts[2] === "content-rights" && request.method === "POST") {
        if (role !== "admin") return json({ error: "Admin role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const parsed = validateContentRights(parsedBody.data);
        if (parsed.error) return json({ error: parsed.error }, 400, cors);
        const provider = await db.prepare("SELECT id,status FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider) return json({ error: "Provider not found." }, 404, cors);
        const data = parsed.data;
        const id = crypto.randomUUID(), eventId = crypto.randomUUID(), now = new Date().toISOString();
        await db.batch([
          db.prepare("INSERT INTO provider_content_rights (id,provider_id,source_platform,source_content_id,source_url,creator,rights_holder,license_reference,evidence_url,license_expires_at,permitted_uses_json,regions_json,source_verified,ownership_verified,performer_age_verified,performer_consent_verified,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id,parts[1],data.sourcePlatform,data.sourceContentId,data.sourceUrl,data.creator,data.rightsHolder,data.licenseReference,data.evidenceUrl,data.licenseExpiresAt,JSON.stringify(data.permittedUses),JSON.stringify(data.regions),1,1,1,1,"PENDING",now,now),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
            .bind(eventId,parts[1],"CONTENT_RIGHTS_CREATED",null,"PENDING",role,JSON.stringify({contentRightsId:id,sourcePlatform:data.sourcePlatform,sourceContentId:data.sourceContentId}),now)
        ]);
        const row = await db.prepare("SELECT * FROM provider_content_rights WHERE id=?").bind(id).first();
        return json({ record: rowToJson(row) }, 201, cors);
      }

      if (parts[0] === "providers" && parts.length === 5 && parts[2] === "content-rights" && parts[4] === "approve" && request.method === "PATCH") {
        if (role !== "legal") return json({ error: "Legal reviewer role required." }, 403, cors);
        const parsedBody = await readJson(request);
        if (parsedBody.error) return json({ error: parsedBody.error }, parsedBody.status, cors);
        const evidence = parsedBody.data.evidence || {};
        const row = await db.prepare("SELECT * FROM provider_content_rights WHERE provider_id=? AND id=?").bind(parts[1],parts[3]).first();
        if (!row) return json({ error: "Content rights record not found." }, 404, cors);
        if (!canApproveContentRights(row, role, evidence)) return json({ error: "Approval denied: provenance, consent, license expiry or legal evidence is incomplete." }, 409, cors);
        const provider = await db.prepare("SELECT id,status,license_expires_at FROM provider_registry WHERE id=?").bind(parts[1]).first();
        if (!provider || !Number.isFinite(Date.parse(provider.license_expires_at)) || Date.parse(provider.license_expires_at) <= Date.now()) return json({ error: "Provider-level license is missing or expired." }, 409, cors);
        const eventId = crypto.randomUUID(), now = new Date().toISOString();
        const legalEvidence = JSON.stringify({
          permissionReference:clean(evidence.permissionReference), ownershipReference:clean(evidence.ownershipReference),
          ageReference:clean(evidence.ageReference), consentReference:clean(evidence.consentReference),
          reviewReference:clean(evidence.reviewReference), reviewedAt:now
        });
        await db.batch([
          db.prepare("UPDATE provider_content_rights SET status='APPROVED',legal_evidence_json=?,updated_at=? WHERE id=? AND provider_id=? AND status='PENDING'")
            .bind(legalEvidence,now,parts[3],parts[1]),
          db.prepare("INSERT INTO provider_audit (event_id,provider_id,action,from_status,to_status,actor_role,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
            .bind(eventId,parts[1],"CONTENT_RIGHTS_APPROVED","PENDING","APPROVED",role,JSON.stringify({contentRightsId:parts[3],evidenceRecorded:true}),now)
        ]);
        const updated = await db.prepare("SELECT * FROM provider_content_rights WHERE id=? AND provider_id=?").bind(parts[3],parts[1]).first();
        if (!updated || updated.status !== "APPROVED") return json({ error: "Concurrent update or approval failed." }, 409, cors);
        return json({ record: rowToJson(updated) }, 200, cors);
      }

      if (parts[0] === "playback" && parts[1] === "authorize" && request.method === "GET") {
        if (!["admin", "technical", "legal"].includes(role)) return json({ error: "Forbidden" }, 403, cors);
        const providerId = clean(url.searchParams.get("providerId"),80);
        const contentId = clean(url.searchParams.get("contentId"),80);
        const requestedUse = clean(url.searchParams.get("use"),40);
        const region = clean(url.searchParams.get("region"),8);
        if (!providerId || !contentId || !requestedUse || !region) return json({ allowed:false,reason:"missing_policy_input" },400,cors);
        const provider = await db.prepare("SELECT status,license_expires_at FROM provider_registry WHERE id=?").bind(providerId).first();
        const content = await db.prepare("SELECT * FROM provider_content_rights WHERE id=? AND provider_id=?").bind(contentId,providerId).first();
        const decision = playbackDecision({provider,content,requestedUse,region});
        return json(decision, decision.allowed ? 200 : 403, cors);
      }

      return json({ error: "Not found" }, 404, cors);
    } catch {
      return json({ error: "Internal rights-gate error." }, 500, cors);
    }
  }
};
