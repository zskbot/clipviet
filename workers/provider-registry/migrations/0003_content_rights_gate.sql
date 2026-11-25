PRAGMA foreign_keys = ON;

-- Per-video provenance and rights evidence. A provider-level license is not
-- sufficient to authorize every clip returned by that provider.
CREATE TABLE IF NOT EXISTS provider_content_rights (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_registry(id),
  source_platform TEXT NOT NULL,
  source_content_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  creator TEXT NOT NULL,
  rights_holder TEXT NOT NULL,
  license_reference TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  license_expires_at TEXT NOT NULL,
  permitted_uses_json TEXT NOT NULL,
  regions_json TEXT NOT NULL,
  source_verified INTEGER NOT NULL CHECK (source_verified IN (0,1)),
  ownership_verified INTEGER NOT NULL CHECK (ownership_verified IN (0,1)),
  performer_age_verified INTEGER NOT NULL CHECK (performer_age_verified IN (0,1)),
  performer_consent_verified INTEGER NOT NULL CHECK (performer_consent_verified IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
  legal_evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, source_platform, source_content_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_content_rights_status
  ON provider_content_rights(provider_id, status, license_expires_at);
