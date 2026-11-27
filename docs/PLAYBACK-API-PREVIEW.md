# ClipViet Playback API Preview

Video detail pages open a dedicated, read-only playback check endpoint:

`https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev/api/playback/providers/{providerId}/videos/{videoId}`

The Worker is maintained in `zskbot/clipviet.live/worker/playback-api-preview` and shared by both ClipViet Preview frontends. It returns source URLs only after provider, connector, per-video license, territory, provenance/consent and media-host allowlist checks pass. The API does not proxy or store video bytes.

Until rights records and approved media hosts exist in the Preview provider registry, the endpoint intentionally returns HTTP 403. Do not bypass this response, add placeholder streams, or use production domains.
