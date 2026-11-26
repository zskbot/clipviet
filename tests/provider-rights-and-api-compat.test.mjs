import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isProviderRightsApproved, isVideoRightsApproved, filterRightsApprovedVideos } from "../lib/provider-rights-gate.mjs";
import { searchVideos } from "../lib/video-search.mjs";

const providerApproval = {
  approved: true, enabled: true, rightsHolder: "Verified provider rights holder",
  licenseReference: "PROVIDER-LIC-001", evidenceUrl: "https://rights.example.test/provider",
  expiresAt: "2099-12-31T23:59:59.000Z", documentationUrl: "https://api.example.test/docs",
  authMode: "api_key", playbackMode: "official_embed", regions: ["VN"]
};
const videoApproval = {
  approved: true, enabled: true, providerId: "youtube", rightsHolder: "Verified creator rights holder",
  creator: "Verified creator", sourceContentId: "abc", sourceUrl: "https://youtube.com/watch?v=abc",
  licenseReference: "VIDEO-LIC-001", evidenceUrl: "https://rights.example.test/video/abc",
  expiresAt: "2099-12-31T23:59:59.000Z", permittedUses: ["metadata_only"],
  regions: ["VN"], sourceVerified: true, ownershipVerified: true,
  performerAgeVerified: true, performerConsentVerified: true
};
const env = {
  VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ youtube: providerApproval }),
  VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ "youtube:abc": videoApproval })
};

test("provider gate denies by default and does not trust credentials or host allowlists", () => {
  assert.equal(isProviderRightsApproved("youtube", {}), false);
  assert.deepEqual(filterRightsApprovedVideos([{ id: "youtube:abc" }], "youtube", {}), []);
});

test("provider approval requires documented connector contract and future license", () => {
  assert.equal(isProviderRightsApproved("youtube", env), true);
  const invalid = { VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ youtube: { ...providerApproval, documentationUrl: "http://insecure.test" } }) };
  assert.equal(isProviderRightsApproved("youtube", invalid), false);
});

test("exact video approval requires provenance, ownership, age, consent, use and territory", () => {
  assert.equal(isVideoRightsApproved("youtube:abc", "youtube", env), true);
  assert.equal(isVideoRightsApproved("youtube:abc", "vimeo", env), false);
  const incomplete = { ...env, VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ "youtube:abc": { ...videoApproval, performerConsentVerified: false } }) };
  assert.equal(isVideoRightsApproved("youtube:abc", "youtube", incomplete), false);
});

test("metadata-only approval never exposes embed or hosted media URLs", () => {
  const filtered = filterRightsApprovedVideos([{ id: "youtube:abc", embedUrl: "https://youtube-nocookie.com/embed/abc", videoUrl: "https://cdn.example.test/abc.mp4" }], "youtube", env);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].embedUrl, "");
  assert.equal(filtered[0].videoUrl, "");
});

test("expired or incomplete provider records stay disabled", () => {
  const invalid = { VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ youtube: { ...providerApproval, expiresAt: "2000-01-01T00:00:00Z" } }) };
  assert.equal(isProviderRightsApproved("youtube", invalid), false);
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
