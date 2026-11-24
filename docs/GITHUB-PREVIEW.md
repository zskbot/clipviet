# GitHub Preview — ClipViet.live

## Scope

This workflow creates a short-lived GitHub Actions artifact from `site/` for pull requests and `preview/**` branches. It does **not** deploy the artifact to GitHub Pages, Cloudflare, Netlify, a custom domain, or any production environment.

The artifact deliberately excludes `site/CNAME` so it cannot accidentally claim `clipviet.live`. Retention is three days.

## How to inspect a Preview

1. Open the pull request or the branch's Actions run.
2. Open the **GitHub Preview Artifact** workflow.
3. Download the `clipviet-github-preview` artifact.
4. Extract it and inspect `index.html`; the artifact is a static-site package, not a hosted public URL.

GitHub Pages has a single configured site/environment for this repository. Publishing a branch to that Pages environment would replace the currently published site, so this workflow intentionally does not do that.

## Video sources

No real video API or licensed media source has been supplied yet. The public catalogue remains demo metadata and does not pretend to contain playable videos.

Use `/admin/` to test an API you own or are authorized to use:

- API endpoint: HTTPS JSON endpoint.
- API allowlist: exact API hostname(s), comma-separated.
- Media allowlist: exact hostname(s) that serve the MP4/WebM/HLS files.
- Bearer token: optional; held only in the current tab's memory.
- The browser sends no cookies and rejects redirects.
- The API must permit browser CORS requests from the Preview origin.
- Direct playback requires a reachable HTTPS media URL and suitable MIME/range support.

Allowlist values are saved in the current browser's local storage, not in GitHub or server environment variables. Do not put credentials in repository files, commits, query strings, or screenshots.

Only add content that ClipViet is authorized to distribute. Do not use scraped download links, third-party playlists, or sources without documented rights. No provider is configured by default; unknown API/media hosts fail closed.

## Cost and production boundary

- Uses the repository's existing GitHub Actions workflow and standard GitHub-hosted runner.
- No Cloudflare resources, paid services, secrets, DNS, or custom-domain changes.
- No Pages deployment action or production deployment.
- CI/Preview execution remains subject to GitHub Actions runner availability. A runner startup failure is infrastructure-level and does not establish a source-code failure.
