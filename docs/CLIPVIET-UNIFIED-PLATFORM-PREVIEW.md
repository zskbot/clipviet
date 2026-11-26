# ClipViet unified platform — Preview

The public-facing frontend remains owned by this repository.

- Root frontend: `site/`
- Preview gateway: Cloudflare Worker `clipviet-unified-preview`
- Secondary docs/modules: repository `zskbot/clipviet.live`
- Catalog reads: `clipviet-catalog-api-preview`
- Production domain and DNS are unchanged.

The path gateway is Preview-only. It must not be attached to `clipviet.live` or deployed to a production route. Admin writes and binary video uploads remain disabled until dedicated Access-protected metadata storage and a separate video R2 bucket are configured.
