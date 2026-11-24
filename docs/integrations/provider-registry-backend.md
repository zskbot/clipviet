# ClipViet Provider Registry — isolated Preview backend

## Architecture
This Worker is a separate Preview-only API backed by Cloudflare D1. It is not the existing `clipviet-live` Worker and does not modify the public site, production Worker, DNS, or existing video feeds.

- `POST /providers`: Admin creates a provider in `PENDING`.
- `GET /providers`: Admin, technical reviewer, or legal reviewer lists providers.
- `PATCH /providers/:id/transition`: role-gated state transition.
- `GET /audit`: Admin-only audit log.

## State machine
- `PENDING → VERIFIED`: technical reviewer token; requires API reachability, schema validation, media probe, redirect rejection, exact-host allowlist and a test-run reference.
- `VERIFIED → APPROVED`: legal reviewer token; requires distribution-rights review, age/consent review and a legal review reference.
- `APPROVED → ENABLED`: admin token only; backend rechecks license expiry.
- No direct transition, deletion, auto-activation or provider execution is implemented.

The review evidence fields are reviewer attestations. They are not proof by themselves: the technical and legal review procedures must be completed and their evidence retained outside this registry.

## Security
- The Worker rejects all requests unless `REGISTRY_ENV=preview` and the request host matches the dedicated `clipviet-provider-registry-preview.*.workers.dev` hostname.
- Three distinct bearer secrets provide Admin, Technical and Legal roles. Keep them in Worker secrets, never in source, frontend bundles, URL parameters or logs.
- Provider API/media hosts must be exact valid DNS hostnames; HTTP, userinfo, custom ports, IP literals and local hostnames are rejected.
- No provider API fetch, scraping, stream proxy, media download, or secret storage is performed by this registry.
- Audit records are append-only through the API and written in the same D1 batch as each state change. The public API has no audit update/delete route.
- D1 uses parameterized statements. Request bodies are capped at 16 KiB. Responses are no-store.
- This first version does not implement SSO, MFA, rate limiting, secret-vault storage, DNS resolution/IP egress controls, or independent legal verification. Do not expose it publicly or connect it to playback until those controls are added and reviewed.

## Preview setup
1. Create a dedicated D1 database named `clipviet-provider-registry-preview` on the Cloudflare Free plan only; do not upgrade the account. Cloudflare D1 Free includes up to 10 databases, 5 million rows read/day, 100,000 rows written/day and 5 GB total storage across the account. Stop if the account is on a paid plan and the new database would incur any charge.
2. Apply `migrations/0001_init.sql` to that new database only.
3. Copy `wrangler.example.toml` to `wrangler.toml` and insert the returned database ID. Do not bind any existing production database.
4. Set Worker secrets `REGISTRY_ADMIN_TOKEN`, `REGISTRY_TECH_TOKEN`, `REGISTRY_LEGAL_TOKEN`; set `REGISTRY_ENV=preview`; set `CORS_ALLOWED_ORIGINS` to the exact Preview origin.
5. Deploy only the separately named Preview Worker. Never change or deploy `clipviet-live`.

No database has been provisioned and no Worker has been deployed by this change.
