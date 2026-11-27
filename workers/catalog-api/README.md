# ClipViet AppleCMS catalog Worker

Source snapshot for Preview-only Worker `clipviet-catalog-readonly-preview`.

## Runtime contract
- Pages homepage, Browse, and player use this Worker as the runtime catalog source.
- `GET /health` and `GET /api/providers` report configured providers.
- `GET /api/catalog/categories` and `GET /api/catalog/videos?page=N` use primary-first failover.
- `GET /api/providers/:providerId/videos?page=N` and `GET /api/providers/:providerId/videos/:vodId` access a selected source.
- Provider URLs are environment bindings; this source contains no secrets and performs no D1 writes.

## Required Preview bindings
- `ALLOWED_ORIGINS`
- `APPLECMS_SOUAVZY_URL`
- `APPLECMS_APIYUTU_URL`
- `APPLECMS_LBAPI9_URL`
- `APPLECMS_SLAPIBF_URL`
- `APPLECMS_JIPINVIP1_URL`

## Runtime safeguards
- Provider URLs are validated against approved HTTPS hosts and the AppleCMS V10 path.
- Redirects use Workers-supported `follow` mode; the final response host is checked against the configured provider host.
- Only HTTPS playback URLs are retained.
- Age-label exclusions remain in `applecms.js`.

This source snapshot is tracked for review. Deploy separately and only to the Preview Worker after reviewing bindings.
