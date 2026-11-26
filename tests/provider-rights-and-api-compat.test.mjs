import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isProviderRightsApproved, isVideoRightsApproved, filterRightsApprovedVideos } from "../lib/provider-rights-gate.mjs";
import { searchVideos } from "../lib/video-search.mjs";

const approval = {
  approved: true,
  enabled: true,
  rightsHolder: "Verified rights holder",
  licenseReference: "LIC-TEST-001",
  evidenceUrl: "https://rights.example.test/license/LIC-TEST-001",
  expiresAt: "2099-12-31T23:59:59.000Z"
};

test("provider gate denies by default", () => {
  assert.equal(isProviderRightsApproved("youtube", {}), false);
  assert.deepEqual(filterRightsApprovedVideos([{ id: "youtube:abc" }], "youtube", {}), []);
});

test("provider and exact video approvals are both required", () => {
  const env = {
    VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ youtube: approval }),
    VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({
      "youtube:abc": { ...approval, providerId: "youtube" }
    })
  };
  assert.equal(isProviderRightsApproved("youtube", env), true);
  assert.equal(isVideoRightsApproved("youtube:abc", "youtube", env), true);
  assert.equal(isVideoRightsApproved("youtube:abc", "vimeo", env), false);
  assert.deepEqual(filterRightsApprovedVideos([{ id: "youtube:abc" }, { id: "youtube:def" }], "youtube", env), [{ id: "youtube:abc" }]);
});

test("expired or incomplete provider records stay disabled", () => {
  const env = { VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ maccms: { ...approval, expiresAt: "2000-01-01T00:00:00Z" } }) };
  assert.equal(isProviderRightsApproved("maccms", env), false);
  assert.equal(isProviderRightsApproved("missing", env), false);
});

test("legacy categoryId and pageSize-compatible search filters work", () => {
  const videos = [
    { id: "1", title: "Phim khoa học", category: "Khoa học viễn tưởng", categoryId: "sci-fi" },
    { id: "2", title: "Hài", category: "Hài", categoryId: "comedy" }
  ];
  const result = searchVideos(videos, new URLSearchParams("categoryId=sci-fi&page=1&limit=1"));
  assert.deepEqual(result.results.map(item => item.id), ["1"]);
  assert.equal(result.total, 1);
  assert.equal(result.limit, 1);
});

test("video API route exposes GET, HEAD, OPTIONS and both result aliases", () => {
  const routePath = fileURLToPath(new URL("../app/api/videos/route.js", import.meta.url));
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function HEAD/);
  assert.match(source, /export async function OPTIONS/);
  assert.match(source, /items:/);
  assert.match(source, /results:/);
  assert.match(source, /\["keyword", "q"\]/);
  assert.match(source, /\["pageSize", "limit"\]/);
});
