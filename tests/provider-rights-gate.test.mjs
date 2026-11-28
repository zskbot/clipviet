import test from "node:test";
import assert from "node:assert/strict";
import {
  isProviderRightsApproved,
  hasVideoPermittedUse,
  isVideoRightsApproved,
  filterRightsApprovedVideos,
  providerRightsStatus
} from "../lib/provider-rights-gate.mjs";

const future = new Date(Date.now() + 86_400_000).toISOString();
const provider = {
  approved: true,
  enabled: true,
  rightsHolder: "Verified rights holder",
  licenseReference: "LIC-TEST-001",
  evidenceUrl: "https://rights.example.test/evidence/1",
  expiresAt: future,
  documentationUrl: "https://api.example.test/docs",
  authMode: "api_key",
  playbackMode: "official_embed",
  regions: ["VN"]
};
const video = {
  approved: true,
  enabled: true,
  providerId: "sample",
  rightsHolder: "Verified rights holder",
  licenseReference: "LIC-VIDEO-001",
  creator: "Verified creator",
  sourceContentId: "asset-1",
  sourceUrl: "https://media.example.test/watch/asset-1",
  evidenceUrl: "https://rights.example.test/evidence/asset-1",
  expiresAt: future,
  sourceVerified: true,
  ownershipVerified: true,
  performerAgeVerified: true,
  performerConsentVerified: true,
  permittedUses: ["metadata_only", "official_embed"],
  regions: ["VN"],
  region: "VN"
};
const env = () => ({
  VIDEO_PROVIDER_RIGHTS_JSON: JSON.stringify({ sample: provider }),
  VIDEO_VIDEO_RIGHTS_JSON: JSON.stringify({ "sample:asset-1": { ...video, id: "sample:asset-1" } })
});

test("provider and video rights are denied by default", () => {
  assert.equal(isProviderRightsApproved("sample", {}), false);
  assert.equal(hasVideoPermittedUse("sample:asset-1", "sample", "metadata_only", {}), false);
  assert.deepEqual(providerRightsStatus("sample", {}), {
    id: "sample", status: "PENDING", enabled: false, rightsApproved: false
  });
});

test("valid provider and exact video record allow only licensed uses", () => {
  const config = env();
  assert.equal(isProviderRightsApproved("sample", config), true);
  assert.equal(isVideoRightsApproved("sample:asset-1", "sample", config), true);
  assert.equal(hasVideoPermittedUse("sample:asset-1", "sample", "official_embed", config), true);
  assert.equal(hasVideoPermittedUse("sample:asset-1", "sample", "redistribute", config), false);
});

test("expired or mismatched provider records fail closed", () => {
  const config = env();
  config.VIDEO_PROVIDER_RIGHTS_JSON = JSON.stringify({
    sample: { ...provider, expiresAt: new Date(Date.now() - 1000).toISOString() }
  });
  assert.equal(isProviderRightsApproved("sample", config), false);
  const mismatch = env();
  mismatch.VIDEO_VIDEO_RIGHTS_JSON = JSON.stringify({
    "sample:asset-1": { ...video, providerId: "other" }
  });
  assert.equal(isVideoRightsApproved("sample:asset-1", "sample", mismatch), false);
});

test("filter strips unlicensed playback URLs and excludes unapproved assets", () => {
  const config = env();
  const items = [
    { id: "sample:asset-1", title: "Allowed", embedUrl: "https://player.example.test/embed/1", videoUrl: "https://cdn.example.test/1.mp4" },
    { id: "sample:asset-2", title: "Not licensed", embedUrl: "https://player.example.test/embed/2" }
  ];
  const filtered = filterRightsApprovedVideos(items, "sample", config);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].embedUrl, "https://player.example.test/embed/1");
  assert.equal(filtered[0].videoUrl, "");
});
