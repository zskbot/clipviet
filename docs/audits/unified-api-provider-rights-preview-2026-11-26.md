# Unified API and provider-rights Preview audit — 2026-11-26

## Source-of-truth decision

- Canonical application source: `zskbot/clipviet` (Next.js).
- Compatibility / delivery facade: `zskbot/clipviet.live` (Cloudflare Pages/Functions).
- The repos remain separate deployment artifacts; no automatic overwrite or cross-repo sync is configured.
- The Next.js `/api/videos` contract now returns both `results` and `items`, retains `page`, `limit`, `total`, `hasMore`, and accepts legacy `keyword`, `search`, `categoryId`, `pageSize`, `per_page`, and `currentPage` aliases.

## Branch comparison inventory

GitHub branch inventory and compare results were collected for all 24 branches in `zskbot/clipviet` and all 30 branches in `zskbot/clipviet.live` (54 total).

### zskbot/clipviet — 24 branches

Compare against `main` returned no ahead-only commits for 20 branches. Four branches had branch-only commits:

| Branch | Ahead / behind | Branch-only file(s) | Commit SHA |
|---|---:|---|---|
| `feat/telegram-public-channel-embed-preview` | 1 / 727 | `README.md` | Compare response did not expose branch head SHA |
| `feat/telegram-webhook-preview-agent` | 1 / 721 | `.github/workflows/ci.yml` | Compare response did not expose branch head SHA |
| `fix/diagnostics-mp4-range-preview` | 2 / 299 | `site/diagnostics/diagnostics.js` | Compare response did not expose branch head SHA |
| `fix/diagnostics-mp4-range-preview-v2` | 1 / 286 | `site/diagnostics/diagnostics.js` | Compare response did not expose branch head SHA |

The other 19 non-main branches had `ahead_by=0` and are ancestors of `main` (their commits are already represented in `main`); they do not contain unique commits relative to the current main ref.

### zskbot/clipviet.live — 30 branches

Three comparable branches contained branch-only commits:

| Branch | Ahead / behind | Branch-only file(s) | Commit SHA |
|---|---:|---|---|
| `fix/community-card-anchor-qa` | 1 / 145 | `site/community/index.html` | Compare response did not expose branch head SHA |
| `fix/preview-ci-admin-auth-rights` | 1 / 164 | `.github/workflows/browse-responsive.yml` | Compare response did not expose branch head SHA |
| `preview/admin-cloudflare-access-no-pin-rebuild` | 6 / 35 | `functions/api/admin/[[path]].js`, `site/admin/admin.js`, `site/admin/cms.js`, `site/admin/index.html`, `worker/catalog-api-preview/README.md`, `worker/catalog-api-preview/src/index.js`, `worker/catalog-api-preview/wrangler.example.toml` | Compare response did not expose branch head SHA |

Three branches had no ahead-only commits relative to main: `preview/api-docs-qa`, `preview/auto-admin-acceptance`, and `preview/community-hub-cloudflare`.

The remaining 23 non-main branches returned GitHub's `No common ancestor` response. Their histories are unrelated to `main`; GitHub's compare endpoint cannot produce a safe per-file diff. These branches must be treated as independent source snapshots, not assumed merged or equivalent. A branch-by-branch tree and commit SHA audit remains open for these 23 branches.

## API and provider history comparison

### zskbot/clipviet (Next.js)

- `app/api/videos/route.js` is the legacy application endpoint.
- `lib/video-provider.js` aggregates configured external API, Telegram public feed and MacCMS results, plus local demo records.
- `lib/legal-video-providers.js` contains YouTube Data API v3, Vimeo API and Dailymotion API v2 adapters.
- `lib/maccms-provider.mjs` contains MacCMS/AppleCMS API normalization and media URL allowlists.
- `lib/telegram-public-feed.js` reads public Telegram channel pages and can register a Preview webhook.
- `lib/telegram-importer.js` can download Telegram media and store it in configured object storage.

### zskbot/clipviet.live (Cloudflare Pages/Functions)

- `functions/api/videos.js` is the unified read-only facade.
- `site/app.js` calls `/api/videos`.
- The gateway lists five candidate providers: Souavzy, ApiYutu, LBApi9, Slapibf and JipinVIP1. All five are `PENDING`, disabled and not rights-approved; the gateway makes no upstream requests and returns no media URLs.
- The Cloudflare catalog route remains a legacy compatibility surface; the public contract is `/api/videos`.

### Rights findings

A configured API key, an HTTPS URL, an allowlisted host, a public Telegram post or a provider's public API response is not proof of distribution rights. The separate ClipViet.live source-rights audit records all operator-supplied adult source domains as `REVIEW_REQUIRED`; no title was cleared for redistribution. The five candidate providers remain pending.

## Preview implementation

This branch adds `lib/provider-rights-gate.mjs` and enforces two independent server-side approvals:

1. Provider record: `VIDEO_PROVIDER_RIGHTS_JSON`, keyed by provider ID.
2. Exact asset record: `VIDEO_VIDEO_RIGHTS_JSON`, keyed by normalized video ID and bound to the same `providerId`.

A valid record requires `approved: true`, `enabled: true`, a rights holder, license reference, HTTPS evidence URL and a future expiry timestamp. Missing, invalid, expired or mismatched records deny access.

Protected provider IDs include `external-api`, `youtube`, `vimeo`, `dailymotion`, `telegram-public`, `telegram-importer`, and `maccms:<configured-provider-id>`. MacCMS makes no request until its provider-level record is approved. Telegram public feed and webhook registration are blocked until provider approval; imported Telegram assets additionally require the exact `file_unique_id` in the source's `approvedAssets` list.

### Rights registry shape

```json
{
  "youtube": {
    "approved": true,
    "enabled": true,
    "rightsHolder": "Verified rights holder",
    "licenseReference": "LIC-2026-001",
    "evidenceUrl": "https://rights.example/license/LIC-2026-001",
    "expiresAt": "2027-12-31T23:59:59Z"
  }
}
```

The example is illustrative only. Do not enable any provider using placeholder evidence. Per-video records use the same fields plus `providerId`, keyed by exact normalized video ID. No actual rights record was supplied or activated in this change.

## Validation boundary

- Added unit tests for deny-by-default, provider/asset matching, expiry, categoryId compatibility, pagination and API method/alias declarations.
- This connector session cannot execute the repository's Node.js test suite or build. The tests have been committed to the Preview branch, but no test pass is claimed.
- Runtime HTTP GET/HEAD/OPTIONS and 404/405 behavior require a deployed Preview runtime; not yet verified.
- No provider activated, no media fetched from third-party providers, no database or secrets changed, no DNS/custom domain attached, and no Production deployment performed.
