const parseObject = (raw, label) => {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error(`${label} must be a JSON object.`);
  }
};

function validApproval(record, now = Date.now()) {
  if (!record || typeof record !== "object" || record.approved !== true || record.enabled !== true) return false;
  const rightsHolder = typeof record.rightsHolder === "string" && record.rightsHolder.trim();
  const licenseReference = typeof record.licenseReference === "string" && record.licenseReference.trim();
  const evidenceUrl = typeof record.evidenceUrl === "string" ? record.evidenceUrl : "";
  const expiresAt = Date.parse(record.expiresAt || "");
  let evidenceValid = false;
  try {
    const url = new URL(evidenceUrl);
    evidenceValid = url.protocol === "https:" && !url.username && !url.password;
  } catch {}
  return Boolean(rightsHolder && licenseReference && evidenceValid && Number.isFinite(expiresAt) && expiresAt > now);
}

export function isProviderRightsApproved(providerId, env = process.env) {
  if (!providerId) return false;
  const registry = parseObject(env.VIDEO_PROVIDER_RIGHTS_JSON, "VIDEO_PROVIDER_RIGHTS_JSON");
  return validApproval(registry[providerId]);
}

export function isVideoRightsApproved(videoId, providerId, env = process.env) {
  if (!videoId || !providerId) return false;
  const registry = parseObject(env.VIDEO_VIDEO_RIGHTS_JSON, "VIDEO_VIDEO_RIGHTS_JSON");
  const record = registry[videoId];
  return Boolean(record && record.providerId === providerId && validApproval(record));
}

export function filterRightsApprovedVideos(items, providerId, env = process.env) {
  if (!isProviderRightsApproved(providerId, env) || !Array.isArray(items)) return [];
  return items.filter(item => item && isVideoRightsApproved(item.id, providerId, env));
}

export function providerRightsStatus(providerId, env = process.env) {
  let approved = false;
  try { approved = isProviderRightsApproved(providerId, env); } catch {}
  return { id: providerId, status: approved ? "ENABLED" : "PENDING", enabled: approved, rightsApproved: approved };
}
