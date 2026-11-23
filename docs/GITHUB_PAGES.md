# ClipViet.live — GitHub Pages static frontend

This repository contains a standalone static frontend in `site/` intended for GitHub Pages.

## Scope

- Static catalog, search, category filters, detail dialog, responsive layout and age self-attestation.
- Uses demo records in `site/data.js`; no video stream source is configured.
- The existing Next.js application remains in the repository.
- API route handlers, admin endpoints, Telegram webhooks, provider ingestion, server-side caching and PHP API services require a separate server runtime and are not hosted by GitHub Pages.

## Preview validation

The pull-request workflow validates the required static files, checks the custom-domain marker and parses the JavaScript modules. It does not deploy the site or request GitHub Pages deployment permissions.

## Before public Pages deployment

1. Review the static frontend and confirm all public content and rights to displayed media.
2. Enable GitHub Pages with GitHub Actions as the build source.
3. Add a protected default-branch deployment workflow only after review and explicit approval.
4. Verify the custom domain and HTTPS in repository Pages settings.
5. Configure Cloudflare DNS only after confirming the Pages custom-domain status and the DNS targets GitHub specifies. Do not delete unrelated records.

## Domain

The static site includes `site/CNAME` with `clipviet.live`. This file does not configure DNS or publish the website.
