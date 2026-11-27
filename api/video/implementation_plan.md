# Hệ Thống Quản Lý DNS Doanh Nghiệp (Giai đoạn 1: Tên Miền & Bản Ghi)

Nền tảng điều khiển DNS (Control Plane) hoàn toàn bằng tiếng Việt dành cho quản trị tên miền riêng, hỗ trợ quản lý 19 loại bản ghi chuẩn và nâng cao, nhập/xuất tệp vùng BIND/CSV, kiểm tra tình trạng phân giải thực tế, phát hiện bản ghi lơ lửng và chuyển tiếp web trên nền tảng Firebase Auth & Firestore.

---

## Quyết Định Đã Chốt & Lưu Ý Trước Khi Triển Khai

> [!IMPORTANT]
> Sau khi bạn phê duyệt kế hoạch này, bước đầu tiên khi bắt đầu xây dựng là kích hoạt hộp thoại cấu hình **Firebase (Firestore & Auth)** để cấp phát cơ sở dữ liệu thực tế cho ứng dụng. Khi hộp thoại xuất hiện, bạn vui lòng xác nhận đồng ý điều khoản để hệ thống hoàn tất kết nối.

- **Mục tiêu sử dụng**: Triển khai thực tế cho tên miền riêng (hỗ trợ kiểm tra phân giải DNS thực tế qua Internet và xuất tệp vùng BIND chuẩn để đồng bộ với máy chủ tên miền hoặc nhà đăng ký).
- **Phạm vi xây dựng**: Tập trung chuyên sâu và hoàn chỉnh **Giai đoạn 1** (Tổng quan hệ thống, Tài khoản & Bảo mật 2FA, Quản lý Tên miền, Quản lý 19 loại Bản ghi DNS, Nhập/Xuất hàng loạt, Kiểm tra sức khỏe & Bản ghi lơ lửng, Chuyển tiếp Web).
- **Ngôn ngữ giao diện**: 100% tiếng Việt chuẩn hóa, chỉ giữ nguyên ký hiệu kỹ thuật định danh loại bản ghi (như `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `SRV`, `CAA`, `DS`, `TLSA`, v.v.).
- **Lưu trữ & Xác thực**: Firebase Authentication (đăng nhập Google) và Cloud Firestore với quy tắc bảo mật nghiêm ngặt theo từng tài khoản sở hữu.

---

## 1. Tổng Quan & Giá Trị Cốt Lõi

- **Chức năng chính**: Cung cấp bảng điều khiển tập trung để khai báo, tổ chức, kiểm chứng và xuất cấu hình DNS cho các tên miền cá nhân hoặc doanh nghiệp nhỏ mà không cần thao tác thủ công trên giao diện dòng lệnh hay bảng điều khiển rời rạc của từng nhà đăng ký tên miền.
- **Đối tượng sử dụng**: Quản trị viên hệ thống, lập trình viên vận hành tên miền riêng, người cần kiểm soát bản ghi DNS chi tiết, phát hiện sớm nguy cơ bản ghi lơ lửng (Subdomain Takeover) và chuyển tiếp tên miền gọn nhẹ.
- **Giá trị mang lại**:
  - Giảm thiểu sai sót nhập liệu nhờ bộ kiểm tra cú pháp chuyên sâu cho đủ 19 loại bản ghi DNS.
  - Rút ngắn thời gian di chuyển tên miền nhờ trình nhập hàng loạt chuẩn BIND/CSV có bước xem trước và kiểm lỗi.
  - Kết nối trực tiếp với dữ liệu phân giải DNS thực tế ngoài Internet để đối chiếu độ lệch giữa cấu hình khai báo và trạng thái vận hành thực.

---

## 2. Trải Nghiệm Người Dùng & Thiết Kế Giao Diện

### Luồng Thao Tác Chính

1. **Đăng nhập & Khởi tạo hồ sơ**: Người dùng truy cập bảng điều khiển và đăng nhập bằng tài khoản Google thông qua Firebase Auth. Hệ thống tự động tạo hồ sơ người dùng và thiết lập tùy chọn mặc định trong Firestore.
2. **Tổng quan hệ thống (Bảng điều khiển)**: Hiển thị tóm tắt số lượng tên miền đang quản lý, tổng số bản ghi, cảnh báo bản ghi lơ lửng hoặc tên miền chưa trỏ máy chủ tên miền hợp lệ, cùng danh sách truy cập nhanh các tên miền vừa chỉnh sửa.
3. **Quản lý Tên miền**:
   - Người dùng thêm tên miền mới (kiểm tra định dạng tên miền hợp lệ), gắn thẻ phân loại (ví dụ: Sản xuất, Cá nhân, Thử nghiệm) và ghi chú mục đích.
   - Từ danh sách tên miền, người dùng có thể lọc theo thẻ, tìm kiếm theo tên miền, hoặc bấm vào từng tên miền để mở không gian làm việc chi tiết gồm 4 phân khu chức năng: **Bản ghi DNS**, **Kiểm tra sức khỏe & Bản ghi lơ lửng**, **Chuyển tiếp Web**, và **Nhập / Xuất tệp vùng**.
4. **Quản lý Bản ghi DNS (19 loại bản ghi)**:
   - Bảng dữ liệu mật độ cao hỗ trợ tìm kiếm tức thì, lọc theo nhóm bản ghi (Phổ biến / Nâng cao) hoặc từng loại cụ thể, lọc theo thẻ bản ghi, sắp xếp theo tên/loại/TTL và phân trang.
   - Hộp thoại Thêm/Sửa bản ghi tự động biến đổi biểu mẫu theo đúng đặc tả của từng loại:
     - *Nhóm phổ biến*: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `PTR`, `SRV`, `CAA`, `SPF`.
     - *Nhóm nâng cao*: `ALIAS` (Bí danh đỉnh), `DS`, `HINFO`, `HTTPS`, `NAPTR`, `RP`, `SSHFP`, `SVCB`, `TLSA`.
   - Hỗ trợ nhân bản nhanh bản ghi, chỉnh sửa TTL và gắn thẻ phân loại cho từng bản ghi.
5. **Nhập hàng loạt (BIND / CSV) & Xuất tệp vùng**:
   - Dán hoặc tải lên tệp vùng chuẩn BIND hoặc bảng CSV; hệ thống phân tích từng dòng, chỉ rõ dòng hợp lệ và dòng lỗi cú pháp trước khi lưu đồng loạt vào Firestore.
   - Xuất toàn bộ bản ghi của tên miền thành tệp vùng `.zone` chuẩn BIND để nạp sang máy chủ DNS thực tế (PowerDNS, BIND9, Cloudflare...).
6. **Kiểm tra sức khỏe DNS & Phát hiện bản ghi lơ lửng**:
   - Chạy kiểm tra trực tiếp tới hệ thống phân giải DNS thực tế trên Internet: xác minh bản ghi `NS` ủy quyền, `SOA` (số sê-ri, chu kỳ làm mới), đối chiếu từng bản ghi đã khai báo với kết quả phân giải thực tế và đo thời gian phản hồi.
   - Tự động đánh dấu các bản ghi `CNAME`, `ALIAS`, `MX` hoặc `A` trỏ tới đích không tồn tại (`NXDOMAIN`), địa chỉ IP nội bộ bị lộ, hoặc tên miền dịch vụ đám mây có dấu hiệu chưa được cấp phát (nguy cơ chiếm quyền tên miền phụ).
7. **Chuyển tiếp Web (Web Forwarding)**:
   - Tạo và quản lý quy tắc chuyển hướng HTTP `301` (vĩnh viễn), `302` (tạm thời) hoặc chuyển tiếp giữ nguyên đường dẫn cho tên miền gốc và tên miền phụ, kèm mã cấu hình tham chiếu để triển khai trên máy chủ web.
8. **Hồ sơ của tôi & Bảo mật (2FA TOTP)**:
   - Chỉnh sửa thông tin hiển thị, cấu hình TTL mặc định, tùy chọn thông báo cảnh báo sức khỏe DNS, và bật/tắt xác thực hai yếu tố (2FA) chuẩn TOTP (hiển thị mã QR thiết lập, mã bí mật Base32 và kiểm thử mã OTP 6 chữ số thực tế).

### Định Hướng Thẩm Mỹ & Hệ Thống Giao Diện

- **Phong cách thị giác**: Bảng điều khiển kỹ thuật tối giản, chính xác, độ tin cậy cao — tránh hoàn toàn hiệu ứng trang trí dư thừa, không lạm dụng khung thẻ lồng nhau hay nhãn bo tròn cho dữ liệu tĩnh.
- **Bảng màu (60-30-10)**:
  - *60% Nền chính*: Trắng sạch (`#FFFFFF`) kết hợp nền khung phụ xám lạnh dịu (`#F8FAFC`).
  - *30% Bề mặt cấu trúc*: Đường viền mảnh 1px (`#E2E8F0`), chữ chính xám than đậm (`#0F172A`), chữ phụ (`#475569` / `#64748B`).
  - *10% Điểm nhấn & Ngữ nghĩa*: Xanh dương kỹ thuật đậm (`#1D4ED8`) dành riêng cho nút thao tác chính và trạng thái đang chọn; xanh lá (`#16A34A`), vàng hổ phách (`#D97706`) và đỏ thẫm (`#DC2626`) chỉ dùng kèm nhãn chữ rõ ràng cho trạng thái kiểm tra sức khỏe DNS.
- **Kiểu chữ & Căn chỉnh số liệu**:
  - Tiêu đề và điều hướng sử dụng `Plus Jakarta Sans`, nội dung giao diện dùng `DM Sans` ở mật độ 13px–15px dễ quét nhanh.
  - Toàn bộ tên miền, địa chỉ IP, giá trị TTL, mã ưu tiên, thời gian phản hồi (ms) và dấu thời gian sử dụng `JetBrains Mono` với `tabular-nums` giúp các cột số thẳng hàng tuyệt đối.
- **Bố cục chuẩn (1440px)**:
  - Thanh điều hướng trái cố định (`256px`) gồm: Tổng quan, Tên miền, Hồ sơ & Bảo mật, cùng danh sách rút gọn tên miền đang thao tác.
  - Thanh tiêu đề trên (`56px`) chứa đường dẫn ngữ cảnh (Breadcrumb) bên trái và tối đa 1–2 nút thao tác chính trên một dòng bên phải.
  - Mọi khung chứa dùng độ nổi phẳng (single-elevation) với đường viền mảnh 1px và khoảng thở rộng rãi; không dùng thanh trạng thái giả lập ở chân trang.
  - Mọi bảng dữ liệu và khung kiểm tra đều có đủ 4 trạng thái: Có dữ liệu, Trống (kèm nút tạo mới), Đang tải (khung xương khớp kích thước dòng), và Lỗi (kèm hướng dẫn khắc phục).

---

## 3. Các Quyết Định Thiết Kế & Đánh Đổi Kỹ Thuật

- **Kiểm tra DNS thực tế qua máy chủ trung gian Express thay vì gọi trực tiếp từ trình duyệt**:
  - *Giải pháp chọn*: Xây dựng tuyến API nội bộ trên Express (`/api/dns/health`, `/api/dns/dangling`, `/api/dns/lookup`) sử dụng bộ phân giải DNS của Node.js kết hợp truy vấn DNS-over-HTTPS (DoH).
  - *Lý do*: Trình duyệt bị giới hạn bởi chính sách CORS và không thể truy vấn trực tiếp các loại bản ghi như `SOA`, `NS`, `CAA`, `DS`, `SSHFP`, `TLSA` hoặc đo độ trễ chuẩn xác. Máy chủ trung gian giúp trả về kết quả phân giải thực tế ngoài Internet cho tên miền riêng của người dùng.
  - *Phương án đã cân nhắc*: Chỉ gọi DoH từ trình duyệt — loại bỏ vì thiếu ổn định khi kiểm tra chuỗi chuyển tiếp và một số loại bản ghi đặc thù.

- **Lưu trữ toàn bộ dữ liệu quản trị trên Cloud Firestore kèm quy tắc bảo mật theo chủ sở hữu**:
  - *Giải pháp chọn*: Dùng Firebase Client SDK kết nối trực tiếp tới Firestore với mô hình tách biệt theo `ownerId` và áp dụng quy tắc bảo mật `firestore.rules` (Eight Pillars), không lưu khóa bí mật 2FA dưới dạng công khai.
  - *Lý do*: Đáp ứng chính xác yêu cầu sử dụng Firebase Firestore & Auth, đồng bộ thời gian thực giữa các phiên làm việc và bảo vệ dữ liệu từng người dùng ở tầng cơ sở dữ liệu.
  - *Phương án đã cân nhắc*: Dùng bảng PostgreSQL hoặc lưu trên tệp cục bộ — loại bỏ theo lựa chọn của người dùng.

- **Xác thực 2FA TOTP thực tế bằng chuẩn RFC 6238 phía ứng dụng và lưu trạng thái bảo vệ thao tác nhạy cảm**:
  - *Giải pháp chọn*: Sinh khóa bí mật Base32 chuẩn, tạo liên kết `otpauth://` hiển thị mã QR quét bằng Google Authenticator / Authy, và xác minh mã 6 chữ số theo thời gian thực bằng thuật toán HMAC-SHA1 chuẩn Web Crypto API (không phụ thuộc thư viện nặng).
  - *Lý do*: Người dùng có thể quét mã thật trên điện thoại và kiểm tra bước xác thực 2 lớp ngay lập tức khi bật/tắt bảo mật hoặc thực hiện xóa tên miền.

---

## 4. Kiến Trúc Kỹ Thuật & Chiến Lược Dữ Liệu

### Sơ Đồ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Trình Duyệt (React + Tailwind)                    │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ Thanh Trái   │  │ Không Gian Chính │  │ Bộ Phân Tích BIND / CSV & │  │
│  │ Điều Hướng   │  │ - Tổng quan      │  │ Kiểm Tra Cú Pháp 19 Loại  │  │
│  └──────┬───────┘  │ - Tên miền       │  └─────────────┬─────────────┘  │
│         │          │ - Bản ghi DNS    │                │                │
│         │          │ - Chuyển tiếp    │                │                │
│         │          │ - Hồ sơ & 2FA    │                │                │
│         │          └────────┬─────────┘                │                │
└─────────┼───────────────────┼──────────────────────────┼────────────────┘
          │                   │                          │
          ▼                   ▼                          ▼
┌───────────────────────────────┐      ┌──────────────────────────────────┐
│   Firebase Auth & Firestore   │      │    Máy Chủ Express (/api/dns)    │
│                               │      │                                  │
│  - Đăng nhập Google           │      │  - /api/dns/health (NS, SOA, ms) │
│  - /users/{uid} (Hồ sơ & 2FA) │      │  - /api/dns/lookup (Đối chiếu)   │
│  - /domains/{domainId}        │      │  - /api/dns/dangling (Lơ lửng)   │
│  - /domains/{id}/records/{id} │      │                                  │
│  - /domains/{id}/forwards/{id}│      └─────────────────┬────────────────┘
│  (Bảo vệ bởi firestore.rules) │                        │
└───────────────────────────────┘                        ▼
                                       ┌──────────────────────────────────┐
                                       │  Hệ Thống Phân Giải DNS Thực Tế  │
                                       │  (Node DNS + DoH Internet)       │
                                       └──────────────────────────────────┘
```

### Mô Hình Dữ Liệu Firestore

- **`users/{userId}`**: Lưu thông tin hồ sơ quản trị (`displayName`, `email`, `defaultTtl`, `notifyHealthAlerts`, `notifyDanglingRecords`, `totpEnabled`, `updatedAt`, `createdAt`).
- **`users/{userId}/security/totp`**: Tách riêng khóa bí mật TOTP (`secret`, `verifiedAt`, `updatedAt`) vào tài liệu bảo mật chỉ chủ sở hữu được phép đọc/ghi để tách biệt khỏi thông tin hiển thị chung.
- **`domains/{domainId}`**: Lưu thông tin tên miền (`ownerId`, `name`, `tags` tối đa 10 thẻ, `notes`, `status`, `recordCount`, `lastHealthCheckAt`, `lastHealthStatus`, `createdAt`, `updatedAt`).
- **`domains/{domainId}/records/{recordId}`**: Lưu từng bản ghi DNS thuộc tên miền (`ownerId`, `domainId`, `type` thuộc 19 loại hợp lệ, `host`, `value`, `ttl`, `priority`, `weight`, `port`, `caaFlags`, `caaTag`, `dsKeyTag`, `dsAlgorithm`, `dsDigestType`, `sshfpAlgorithm`, `sshfpFingerprintType`, `tlsaUsage`, `tlsaSelector`, `tlsaMatchingType`, `tags`, `notes`, `createdAt`, `updatedAt`).
- **`domains/{domainId}/forwards/{forwardId}`**: Lưu quy tắc chuyển tiếp web (`ownerId`, `domainId`, `sourceHost`, `targetUrl`, `redirectType` 301/302, `preservePath`, `enabled`, `createdAt`, `updatedAt`).

### Ánh Xạ Tương Tác & Trạng Thái

- **Khởi tạo kết nối & Xác thực**: Khi ứng dụng mở, hệ thống chạy kiểm tra kết nối Firestore (`getDocFromServer`), theo dõi `onAuthStateChanged` và chỉ đăng ký lắng nghe dữ liệu thời gian thực (`onSnapshot`) sau khi người dùng đã đăng nhập thành công. Mọi lỗi phân quyền Firestore đều đi qua hàm chuẩn hóa lỗi cấu trúc và được bắt bởi `ErrorBoundary` hiển thị thông báo tiếng Việt dễ hiểu.
- **CRUD Tên miền & Bản ghi**: Mọi thao tác thêm/sửa/xóa đều kiểm tra hợp lệ phía giao diện (đồng bộ tuyệt đối với giới hạn độ dài và biểu thức chính quy trong `firebase-blueprint.json` và `firestore.rules`), cập nhật bộ đếm bản ghi nguyên tử bằng `writeBatch`, và hiển thị thông báo kết quả tức thì.
- **Luồng Nhập BIND / CSV hàng loạt**: Người dùng dán nội dung hoặc chọn tệp -> Bộ phân tích bóc tách và đánh dấu từng bản ghi hợp lệ/lỗi -> Người dùng bấm "Xác nhận nhập" -> Ghi theo lô (`writeBatch`) vào subcollection `records` của tên miền.
- **Luồng Kiểm tra DNS thực tế**: Người dùng bấm "Kiểm tra sức khỏe DNS" hoặc "Quét bản ghi lơ lửng" -> Gửi danh sách tên miền/bản ghi cần đối chiếu sang máy chủ Express -> Máy chủ thực hiện truy vấn phân giải DNS thực tế -> Trả về báo cáo đối chiếu từng bản ghi (Khớp, Lệch giá trị, Chưa phân giải, Có nguy cơ lơ lửng) và lưu tóm tắt trạng thái kiểm tra gần nhất vào tài liệu tên miền.
