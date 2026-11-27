# ClipViet metadata-only catalog Preview Worker

Dedicated Preview-only AppleCMS metadata adapter.

- Reads the five fixed HTTPS AppleCMS endpoints.
- Serves categories, video metadata, thumbnails, counts, search and pagination.
- Never returns playback URLs or stream manifests; every item has `playbackEnabled=false`.
- Filters labels that indicate minors or school-age content.
- Uses no D1, R2, admin-write routes, stream proxy, Production route, or custom domain.
- CORS accepts only one-level HTTPS Pages Preview hostnames under `clipviet-live-independent-preview.pages.dev`.

Worker name: `clipviet-catalog-metadata-preview`.
