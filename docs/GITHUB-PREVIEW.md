# GitHub Pages — ClipViet.live (static HTML)

## Static-site mode

The deployable frontend is the plain HTML/CSS/JavaScript website in `site/`. The `site/.nojekyll` marker disables Jekyll processing when GitHub Pages publishes this folder. Pages serves the files as static assets; it does not execute Next.js, Node.js, PHP, API routes, or server-side authentication.

Keep relative asset paths (for example `./styles.css`, `./app.js`, and `./admin/`) so the site works from a project subpath as well as a custom domain.

## Preview workflow

The **GitHub Preview Artifact** workflow creates a short-lived artifact from `site/` for pull requests and `preview/**` branches. It does **not** deploy to GitHub Pages, Cloudflare, Netlify, a custom domain, or Production. It removes `CNAME` from the artifact so the artifact cannot claim `clipviet.live`. Retention is three days.

To inspect it, open the workflow run, download `clipviet-github-preview`, extract it, and open `index.html`. This is a package for local inspection, not a hosted Preview URL.

GitHub Pages has a single configured site/environment for this repository. Publishing a branch to that Pages environment would replace the currently published site, so this change does not enable or trigger a Pages deployment. The repository's Pages source and HTTPS state still need to be verified in Settings before any future publication.

## Video sources and admin

No real video API or licensed media source has been supplied. The public catalogue remains demo metadata and does not pretend to contain playable videos.

Use `/admin/` to test an API you own or are authorized to use:

- API endpoint: HTTPS JSON endpoint.
- API allowlist: exact API hostname(s), comma-separated.
- Media allowlist: exact hostname(s) that serve MP4/WebM/HLS files.
- Bearer token: optional; held only in the current tab's memory.
- Browser requests omit cookies and reject redirects.
- The API must allow browser CORS requests from the Preview origin.
- Direct playback requires a reachable HTTPS media URL and suitable MIME/range support.

Allowlist values are saved in the current browser's local storage, not in GitHub or server environment variables. Do not put credentials in repository files, commits, query strings, or screenshots. The static admin is a client-side testing panel, not a centrally authenticated control plane.

Only add content ClipViet is authorized to distribute. Do not use scraped download links, third-party playlists, or sources without documented rights. No provider is configured by default; unknown API/media hosts fail closed.

## Cost and Production boundary

- This change uses the existing repository and workflow only.
- No Cloudflare resources, paid services, secrets, DNS, or custom-domain changes.
- No Pages deployment action or Production deployment.
- CI/Preview execution remains subject to GitHub Actions runner availability. A runner startup failure is infrastructure-level and does not establish a source-code failure.
