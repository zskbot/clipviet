# ClipViet provider integration — Preview scope

## AppleCMS sources supplied for review

| ID | Endpoint | Status |
| --- | --- | --- |
| souavzy | https://api.souavzy.vip/api.php/provide/vod/ | PENDING_RIGHTS |
| apiyutu | https://apiyutu.com/api.php/provide/vod/ | PENDING_RIGHTS |
| lbapi9 | https://lbapi9.com/api.php/provide/vod/ | PENDING_RIGHTS |
| slapibf | https://slapibf.com/api.php/provide/vod/ | PENDING_RIGHTS |
| jipinvip1 | https://jipinvip1.com/api.php/provide/vod/ | PENDING_RIGHTS |

Catalog listing uses AppleCMS `ac=list`; selected-item detail uses `ac=detail&ids=<vod_id>`. Do not infer playback permission from API availability. Provider-level and per-video rights approval are required separately.

## Website references

The supplied hsex.men, sexonline.blog, sexvn.co, buomtv.biz, xnhau.plus, viet69.be, javhay.onl and 91taopian domains are recorded as website references, not API contracts. No crawler, hidden endpoint discovery, scraping, media proxy, download or embed is enabled. Require official API documentation and written rights evidence before implementing a connector.

## Catalog behavior

The previous feed adapter requested `ac=detail` for paginated catalog listing. This branch corrects it to `ac=list`, retaining `ac=detail&ids=...` for selected video details. The adapter still returns only per-title rights-approved metadata and keeps playback URLs out of public catalogue responses.

## Preview boundary

No secrets are committed. All providers remain pending. No Production deploy, DNS/domain update, PR merge or paid service action is included.

## Verification notes

The provider adapter uses `ac=list` with `pg` and `pagesize` for catalog rows and retains `ac=detail&ids=...` for a selected video. Its regression test asserts the request action, pagination parameters, normalized metadata and the rights-approved owner-hosted test fixture. A test fixture does not authorize a real provider or any live title.
