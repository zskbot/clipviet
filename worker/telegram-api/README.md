# ClipViet Telegram API — Cloudflare Worker

This is a server-side API, separate from the static GitHub Pages frontend. Never commit the bot token, session secret, Telegram user credentials, or production values.

## Routes
- GET /health — configuration presence only.
- POST /auth/telegram — verifies Telegram Login HMAC, freshness, explicit user allowlist, and KV replay protection; issues a signed HttpOnly session cookie.
- GET /auth/me — checks the session.
- POST /auth/logout — clears the session.
- GET /channel/verify — checks that the signed-in user is a channel administrator and the bot can post.
- POST /channel/publish — publishes only to the one server-configured channel.

## Cloudflare configuration

Secrets (Worker Secrets only):
- TELEGRAM_BOT_TOKEN
- SESSION_SECRET (random, at least 32 characters)

Non-secret Worker variables:
- ALLOWED_ORIGIN = https://clipviet.live (for a separate Preview Worker, use only its exact Preview origin)
- TELEGRAM_BOT_USERNAME (without @)
- TELEGRAM_BOT_ID (numeric bot user ID)
- TELEGRAM_CHANNEL_ID (one approved channel ID or @username)
- TELEGRAM_ALLOWED_USER_IDS (comma-separated numeric user IDs)
- MEDIA_HOST_ALLOWLIST (comma-separated exact media hostnames)

Create a dedicated KV namespace for replay protection and bind it as LOGIN_REPLAY. Do not share an unrelated namespace.

## Login setup
1. Create/select the bot in BotFather and configure the approved site domain for Telegram Login.
2. Add the Telegram Login Widget to the frontend. Its callback must POST the complete verified widget payload as JSON to /auth/telegram with credentials: include.
3. The Worker validates the Telegram HMAC using SHA-256(bot token), rejects payloads older than five minutes, enforces the configured Telegram user ID allowlist, and stores each hash in KV for ten minutes.
4. The Worker issues an eight-hour Secure, HttpOnly, SameSite=Strict cookie. Never trust a browser-supplied Telegram ID without a valid widget signature.

## Publishing controls
- Only the server-configured TELEGRAM_CHANNEL_ID can receive posts.
- The signed-in user must be allowlisted and currently a channel creator/administrator.
- The bot must be a channel creator/administrator with can_post_messages.
- Video URLs must be HTTPS and match MEDIA_HOST_ALLOWLIST (exact host or subdomain).
- The request must include rights_confirmed: true. This is an attestation, not legal verification.
- Telegram fetches the media URL through sendVideo; the URL must be reachable by Telegram and meet Bot API media requirements.
- No arbitrary channel ID, arbitrary Bot API method, public proxy, stream relay, or download endpoint is exposed.

## Security
- Exact Origin validation and credentialed CORS.
- HMAC-signed session in Secure HttpOnly cookie.
- KV-backed one-time login replay prevention.
- Secrets are never returned or logged.
- Rate limiting should be enabled at the Cloudflare edge before public publishing is enabled.

## Rollout status
A Worker named clipviet-telegram-api-preview and a dedicated KV namespace have been provisioned in the Cloudflare account that currently holds the active clipviet.live zone. The Worker has workers.dev disabled and has no custom domain or DNS route, so it is not publicly exposed. The account reports usage_model=standard (Workers Paid model); no plan upgrade or billing action was performed. Keep it disabled until the account's existing Workers plan and spending limits are confirmed. Bot Token, session secret, Telegram IDs, channel ID, and media-host allowlist are not configured. Frontend actions must remain disabled until a same-site API origin is approved and Preview integration tests pass.
