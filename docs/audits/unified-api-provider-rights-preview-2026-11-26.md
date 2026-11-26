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
| `feat/telegram-public-channel-embed-preview` | 1 / 727 | `README.md` | `24f3c800c56340983c4415a991030da36fc18445` |
| `feat/telegram-webhook-preview-agent` | 1 / 721 | `.github/workflows/ci.yml` | `6bcb6613b1cdb3e9df8103029116439c409d70d6` |
| `fix/diagnostics-mp4-range-preview` | 2 / 299 | `site/diagnostics/diagnostics.js` | `9c9be26231203a3119003bddf15408033474c1e4` |
| `fix/diagnostics-mp4-range-preview-v2` | 1 / 286 | `site/diagnostics/diagnostics.js` | `1b12b4a776d4f46a937a3247448b426abb88f64c` |

The other 19 non-main branches had `ahead_by=0` and are ancestors of `main` (their commits are already represented in `main`); they do not contain unique commits relative to the current main ref.

### zskbot/clipviet.live — 30 branches

Three comparable branches contained branch-only commits:

| Branch | Ahead / behind | Branch-only file(s) | Commit SHA |
|---|---:|---|---|
| `fix/community-card-anchor-qa` | 1 / 145 | `site/community/index.html` | `87b79b2ce76160c4a9a24877f141e895f9623fbe` |
| `fix/preview-ci-admin-auth-rights` | 1 / 164 | `.github/workflows/browse-responsive.yml` | `8044bdcf7451edbd5250fdde9a7f1ea46900b940` |
| `preview/admin-cloudflare-access-no-pin-rebuild` | 6 / 35 | `functions/api/admin/[[path]].js`, `site/admin/admin.js`, `site/admin/cms.js`, `site/admin/index.html`, `worker/catalog-api-preview/README.md`, `worker/catalog-api-preview/src/index.js`, `worker/catalog-api-preview/wrangler.example.toml` | `3484c8a087950147b717f3f5df0bef673b565732` (branch head) |

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

A provider record additionally requires an official HTTPS documentation URL, declared auth mode, playback mode and territories. A per-video record additionally requires exact source URL/content ID, creator, rights holder, license reference, HTTPS evidence, expiry, permitted uses, territories, and explicit source/ownership/performer-age/performer-consent verification flags. Missing, invalid, expired, mismatched or unlicensed-use records deny access. Metadata-only approval does not expose embed or hosted media URLs.

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

The example is illustrative only and must also include provider connector fields `documentationUrl`, `authMode`, `playbackMode`, and `regions`. Per-video records use the source/creator/consent/provenance/use/territory fields plus `providerId`, keyed by exact normalized video ID. No actual rights record was supplied or activated in this change.

## Validation boundary

- Added unit tests for deny-by-default, provider/asset matching, expiry, categoryId compatibility, pagination and API method/alias declarations.
- This connector session cannot execute the repository's Node.js test suite or build. The tests have been committed to the Preview branch, but no test pass is claimed.
- Runtime HTTP GET/HEAD/OPTIONS and 404/405 behavior require a deployed Preview runtime; not yet verified.
- No provider activated, no media fetched from third-party providers, no database or secrets changed, no DNS/custom domain attached, and no Production deployment performed.


## Branch-head SHA inventory for independent snapshots in clipviet.live

GitHub compare returned no common ancestor for 23 branch refs. Fetching each ref directly shows these are independent snapshot roots (commit message begins "Initialize …"), not normal feature branches with a merge base. Their head SHAs and relevant files visible in each snapshot are:

| Branch | Head SHA | Feature-bearing paths visible in snapshot |
|---|---|---|
| `agent-update-to-latest-version-f763` | `bb3f1dab52e85d886b1a0df2c72769bf364f42ea` | Next.js app, `lib/video-provider.js`, base CI |
| `feat/admin-cms-license-registry` | `6356e493c493af2788d01a11553b03f08f6bdafb` | `app/admin/page.js`, admin video/provider routes, `lib/admin-cms.js`, `docs/ADMIN-CMS-STAGING.md`, video catalog migration |
| `feat/clipviet-live-rebrand` | `69ba8b9ca5401f618993c0443b5f164df69a122a` | Admin CMS, Telegram source/webhook routes, `lib/telegram-importer.js`, PHP API, branding assets |
| `feat/dailymotion-api-v2-staging` | `ae480fd0f97d5eb782fe31e7468fd21949072873` | `docs/DAILYMOTION-API-V2-STAGING.md`, `lib/legal-video-providers.js`, PHP API |
| `feat/legal-video-provider-staging` | `e38052203c97e266b0a5cd2e82321957af1131de` | `app/providers/page.js`, provider API routes, `lib/legal-video-providers.js` |
| `feat/nextjs-streaming-platform` | `d8048eb760d2a73619801f561d56f4341c898f05` | Next.js streaming app, `app/api/videos/route.js`, `lib/video-provider.js` |
| `feat/php85-mysql-staging-api` | `4d37fc0933e32f982b2144b5807db5a786b6f8e9` | `php-api/public/index.php`, PHP schema/bootstrap, PHP staging docs |
| `feat/telegram-auto-sync-groups-channels` | `85c6a9431e359cebff1eb0c999bb3678c8fe9c3f` | Telegram webhook/source routes, `lib/telegram-importer.js`, preview store, Telegram migrations |
| `feat/telegram-channel-sync-preview` | `aa9549f171e674d52f5911a232cd482177036cbf` | Telegram webhook/importer and staging docs |
| `feat/telegram-public-channel-embed-preview` | `499ab508809a2ab7c154faf5134ba2ae121ea1ca` | Telegram embed docs, watch route, `lib/telegram-public-feed.js` |
| `feat/telegram-public-feed-preview` | `ddc9dbfc09457e5eb246b29106e6528a5c7fe423` | `lib/telegram-preview-store.js`, `lib/telegram-public-feed.js` |
| `feat/telegram-public-sources-preview` | `32fd348731394d528c8dfa9e2596122a41b6abc6` | Admin Telegram source route, `lib/telegram-public-feed.js` |
| `feat/telegram-webhook-preview-agent` | `a80d5019e5c9a718a2588b7742caa5733d18c0f5` | Telegram webhook route, preview store and CI |
| `feat/tx-top-branding` | `cef4eb18c6177cef2259241c4d434bd6634ad6db` | Homepage/layout/header branding |
| `fix/ci-node22-lockfile-install` | `56a274a2c8e8c1ab82c36295676b23c2fc6ffb2c` | CI workflow, lockfile and Next.js snapshot |
| `fix/diagnostics-mp4-range-preview` | `a9a8f9839d3143e2dd002eb22c55e924efe5fd9e` | Full static/Next.js snapshot, `site/diagnostics/diagnostics.js`, provider registry worker and tests |
| `fix/diagnostics-mp4-range-preview-v2` | `f574fb1e68aa422186aca55a3561d6b73ef231b5` | Full static/Next.js snapshot, diagnostics, provider registry worker and tests |
| `fix/header-search-query` | `590c462902271e7279b992b47293f46086175828` | `components/Header.js`, `components/HomeFeed.js`, video API |
| `fix/preview-auth-mobile-ux` | `d24d500a6764836efcd49ef73f786204f4044d70` | Admin provider verification, `workers/provider-registry/src/rights-gate.mjs`, D1 rights migration 0003, auth migrations, rights-gate tests |
| `fix/preview-source-manager-no-token` | `71e2e0dfb94a220d0b38e96897d571a393004c17` | Admin Telegram source routes and source manager |
| `preview/catalog-dynamic-pagination-acceptance` | `97ea616ddcbbdb76dbb151bdbf5c2abe22f08e30` | Catalog pagination, provider discovery data and tests |
| `preview/community-clipviet-navigation` | `d8142a20736e5a44cf0e18af9326edffe9ab4a4a` | `site/navigation.js`, community/navigation UI |
| `preview/homepage-top-search-footer` | `462e914a6c136e02fcc9791ca342a5d3ef65a237` | Homepage, navigation and footer snapshot |

These 23 refs are not mergeable by ordinary PR ancestry because they have no common ancestor with current `clipviet.live/main`. Their full snapshot contents are not automatically "exclusive changes"; they must be reviewed as separate historical app snapshots. The most substantial historical rights implementation is in `fix/preview-auth-mobile-ux`: `workers/provider-registry/src/rights-gate.mjs`, `workers/provider-registry/src/rights-entry.mjs`, `workers/provider-registry/migrations/0003_content_rights_gate.sql`, and `tests/rights-gate.test.mjs`. That design validates source provenance, ownership, performer age/consent, permitted uses, territory and provider playback mode. It is not present on current `clipviet.live/main` and has not been deployed; the new Next.js Preview gate adopts its key deny-by-default principles without provisioning or mutating a D1 database.

## Implementation commit trail

- Rights gate module (latest hardened revision): `6e5adc4ffe845429186042d09d86bbebc7e62756`
- MacCMS provider and asset enforcement: `b8352526b9ecaaa2bc371cff503fc70714e2304e`
- Telegram importer rights checks: `5a71017d9f97a73a8334a37e50d5b5fd84adc680`
- Unified video feed gate: `50c1403e12b21da9b1c81d259da459ce12ef4ed0`
- API compatibility route: `620820424dc9501942d2cddc13801f0e51f15c1d`
- Search compatibility: `7c3bd3a23344c3f82eeb86bf394abfb4a8aad589`
- Legal-provider status: `35bba96695912b5cf13e27e8ab4232c5647123ee`\n- Unit tests (latest playback-mode/network-gate additions): `b69cfe8f5203f6e777199211dcbbe385d28c693d`


- Cloudflare compatibility facade (`functions/api/videos.js`): `0fb226e7e0dfc901a6b8315621165d02f54577f5` in `zskbot/clipviet.live`\n- Cloudflare GET/HEAD/OPTIONS/404/405 handler tests: `8eaeaece20df4a09fdcd1782114a3c3a4f72eaf9` in `zskbot/clipviet.live`\n\n## Latest validation observations

- Isolated local Node harness: 8/8 canonical rights/search/API-contract tests passed; 5/5 Cloudflare facade handler tests passed. These were targeted harnesses, not a full repository `npm test`, lint or Next.js build.
- GitHub Actions on the Draft PR heads report completed failures for CI and several security workflows. The connector returned no job steps and the workflow-job log endpoint returned `BlobNotFound`; the failure cause cannot be determined from available run evidence. Do not interpret these runs as passing.
- No full HTTP request was sent to a deployed Preview URL. The endpoint tests exercise the local handler contract only. Preview runtime, real provider network isolation and browser behavior remain unverified.
- Consequently, no Cloudflare Preview deployment has been promoted or bound to `api.clipviet.live`; the custom domain remains out of scope until CI/log diagnosis and deployed Preview acceptance are complete.
