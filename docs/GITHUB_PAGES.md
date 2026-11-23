# ClipViet.live — GitHub Pages static frontend

This repository contains a separate static frontend in `site/` for GitHub Pages.

## Scope

- Static catalog, search, category filters, detail dialog, responsive layout and self-attestation age gate.
- Uses the demo records in `site/data.js`.
- The Next.js application remains in the repository and is not converted by this static preview.
- Dynamic features are not hosted by GitHub Pages: API route handlers, admin endpoints, Telegram webhook, provider ingestion, server-side caching, and PHP API services require a separate server runtime.

## Preview validation

The pull-request workflow checks the static assets and uploads a Pages artifact. It deliberately does not deploy to the public GitHub Pages site.

## Before enabling public Pages deployment

1. Review the static preview PR and confirm the intended public content.
2. Enable GitHub Pages with GitHub Actions as the build source.
3. Deploy the reviewed artifact from the default branch only after explicit approval.
4. Verify the custom domain and HTTPS in repository Pages settings.
5. Configure Cloudflare DNS only after GitHub Pages provides the expected DNS targets for this repository. Do not delete unrelated DNS records.

## Domain

The artifact includes `site/CNAME` with `clipviet.live`. This file does not by itself configure Cloudflare DNS or publish the website.
