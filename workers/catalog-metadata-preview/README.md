# ClipViet metadata-only catalog Preview Worker

This isolated Preview Worker serves AppleCMS catalog metadata only.

- Uses the five fixed HTTPS AppleCMS endpoints from the existing ClipViet adapter.
- Returns title, category, thumbnail, metadata, total count and pagination.
- Removes all playback URLs and returns `playbackEnabled=false`, `playbackRightsApproved=false`.
- No D1, R2, admin write routes, stream proxy, or Production route.
- CORS is restricted to one-level HTTPS Pages Preview hostnames under `clipviet-live-independent-preview.pages.dev`.

Deploy only to the dedicated Preview Worker name `clipviet-catalog-metadata-preview`.
