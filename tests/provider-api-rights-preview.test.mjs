import test from "node:test";
import assert from "node:assert/strict";
import metadataWorker from "../workers/catalog-metadata-preview/index.js";
import catalogApiWorker from "../workers/catalog-api/index.js";

const origin = "https://pr-155.clipviet-live-independent-preview.pages.dev";
const apiUrl = "https://api.souavzy.vip/api.php/provide/vod/";
const providerApproval = (playbackMode = "metadata_only", extra = {}) => ({
  approved: true, enabled: true, rightsHolder: "Licensed Rights Holder",
  licenseReference: "FIXTURE-PROVIDER-LICENSE", evidenceUrl: "https://rights.example/provider.pdf",
  documentationUrl: "https://docs.example/provider", expiresAt: "2099-12-31T23:59:59.000Z",
  regions: ["VN"], authMode: "none", playbackMode, ...extra
});
const videoApproval = (uses = ["metadata_only"], extra = {}) => ({
  providerId: "souavzy", sourceContentId: "42", approved: true, enabled: true,
  rightsHolder: "Licensed Rights Holder", licenseReference: "FIXTURE-VIDEO-LICENSE",
  creator: "Verified Creator", sourceUrl: "https://source.example/video/42",
  evidenceUrl: "https://rights.example/video-42.pdf", expiresAt: "2099-12-31T23:59:59.000Z",
  sourceVerified: true, ownershipVerified: true, performerAgeVerified: true,
  performerConsentVerified: true, permittedUses: uses, regions: ["VN"], ...extra
});
const envFor = (mode = "metadata_only", uses = ["metadata_only"], extra = {}) => ({
  APPLECMS_SOUAVZY_URL: apiUrl,
  VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ souavzy: providerApproval(mode, extra) }),
  VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ "souavzy:42": videoApproval(uses) })
});
const fixture = {
  code: 1, page: 1, pagecount: 1, total: 1, limit: 30,
  class: [{ type_id: 1, type_pid: 0, type_name: "Root" }, { type_id: 2, type_pid: 1, type_name: "Category" }],
  list: [{
    vod_id: 42, vod_name: "Authorized Fixture", type_id: 2, type_name: "Category",
    vod_pic: "https://images.example/poster.jpg", vod_play_from: "Line A",
    vod_play_url: "Episode 1$https://media.example/fixture.m3u8",
    vod_embed: "https://player.example/embed/42"
  }]
};
function harness() {
  const oldFetch = globalThis.fetch, oldCaches = globalThis.caches;
  let calls = 0;
  globalThis.caches = { default: { match: async () => null, put: async () => null } };
  globalThis.fetch = async input => {
    calls++;
    const u = new URL(String(input));
    const body = u.searchParams.get("ac") === "list"
      ? { code: 1, class: fixture.class, list: [] }
      : { code: 1, page: 1, pagecount: 1, total: 1, limit: 30, list: fixture.list };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const request = path => new Request("https://worker.example" + path, { headers: { Origin: origin } });
  return { calls: () => calls, request, restore: () => { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; } };
}

test("metadata preview status distinguishes configured pending providers", async () => {
  const h = harness();
  try {
    const response = await metadataWorker.fetch(h.request("/api/providers"), { APPLECMS_SOUAVZY_URL: apiUrl });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.find(item => item.id === "souavzy").status, "PENDING_RIGHTS");
    assert.equal(body.data.find(item => item.id === "souavzy").operationalState, "NOT_CHECKED");
    assert.equal(h.calls(), 0);
  } finally { h.restore(); }
});

test("metadata worker refuses provider requests before network access without provider rights", async () => {
  const h = harness();
  try {
    const response = await metadataWorker.fetch(h.request("/api/catalog/videos?sourceId=souavzy"), { APPLECMS_SOUAVZY_URL: apiUrl });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "PROVIDER_RIGHTS_PENDING");
    assert.equal(h.calls(), 0);
  } finally { h.restore(); }
});

test("metadata worker returns per-video approved metadata without playback URLs", async () => {
  const h = harness();
  try {
    const response = await metadataWorker.fetch(h.request("/api/catalog/videos?sourceId=souavzy"), envFor());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].rightsStatus, "METADATA_APPROVED");
    assert.equal(body.items[0].playbackEnabled, false);
    assert.equal(JSON.stringify(body).includes("fixture.m3u8"), false);
    assert.equal(JSON.stringify(body).includes("player.example"), false);
  } finally { h.restore(); }
});

test("metadata worker playback endpoint returns an owner-hosted URL only when exact host and per-video use are approved", async () => {
  const h = harness();
  try {
    const allowedEnv = envFor("owner_hosted_stream", ["metadata_only", "owner_hosted_stream"], { mediaHosts: ["media.example"] });
    const response = await metadataWorker.fetch(h.request("/api/providers/souavzy/videos/42/playback"), allowedEnv);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.sources[0].episodes[0].url, "https://media.example/fixture.m3u8");
    const denied = await metadataWorker.fetch(h.request("/api/providers/souavzy/videos/42/playback"), envFor("owner_hosted_stream", ["metadata_only", "owner_hosted_stream"], { mediaHosts: [] }));
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "MEDIA_HOST_NOT_APPROVED");
  } finally { h.restore(); }
});

test("legacy catalog API worker denies providers without rights before upstream access", async () => {
  const h = harness();
  try {
    const response = await catalogApiWorker.fetch(h.request("/api/catalog/videos?sourceId=souavzy"), { APPLECMS_SOUAVZY_URL: apiUrl });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, "PLAYBACK_RIGHTS_PENDING");
    assert.equal(h.calls(), 0);
  } finally { h.restore(); }
});
