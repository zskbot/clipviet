# video-list-crawler

Apify Actor (TypeScript, Crawlee + Cheerio) thu thập URL trang video từ các trang danh sách.
Actor đi qua phân trang của từng nguồn và xuất danh sách URL video vào dataset.

Actor id: `api-dev-owner/video-list-crawler`

## Trạng thái

- Đã có: crawl danh sách, phân trang, nhận diện link video theo từng site, xuất dataset `{sourcePage, videoUrl, pageTitle}`.
- Đã test: hsex.men (build 0.0.2), sexonline.blog (build 0.0.3, 5 request, 310 item).
- Chưa làm: bước gọi API phát video (playback dispatch), khử trùng lặp, cấu hình riêng cho buomtv.biz và xnhau.plus (chưa xác minh được cấu trúc trang).

## Input

| Trường | Kiểu | Mô tả |
|---|---|---|
| `startUrls` | array | Danh sách URL trang nguồn |
| `maxRequestsPerCrawl` | integer | Giới hạn số request mỗi lần chạy (mặc định 50) |
| `maxPages` | integer | Số trang danh sách tối đa mỗi nguồn (mặc định 0 = không giới hạn) |
| `useProxy` | boolean | Dùng Apify Proxy (mặc định true) |

## Chạy local với Apify CLI

```bash
npm install
apify login
apify run -p input.json
```

Đẩy lên Apify: `apify push`.

## Lưu ý

- Kiểm tra điều khoản của từng site trước khi chạy quy mô lớn.
- Giữ `maxRequestsPerCrawl` nhỏ khi thử nghiệm.
