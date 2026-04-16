# Changelog (Tiếng Việt)

## [5.6.4] - 2026-04-16
- Đồng bộ NPM registry và bump version.

## [5.6.3] - 2026-04-16
- Cập nhật thông báo hướng dẫn cài đặt bot vào group trên Telegram cho rõ nghĩa hơn (tiếp tục).

## [5.6.2] - 2026-04-16
- Cập nhật thông báo hướng dẫn cài đặt bot vào group trên Telegram cho rõ nghĩa hơn.

## [5.6.1] - 2026-04-16
- Hotfix: Sửa lỗi ReferenceError modelsPrimary is not defined khi chạy CLI lúc tạo bot.

## [5.6.0] — 2026-04-16
- Bật sẵn `memory`, `memory-core` dreaming và thêm `DREAMS.md` cho workspace mới.
- Cải thiện UX relay Telegram và cập nhật hướng dẫn trong `TOOLS.md`, `TEAMS.md`.
- Sửa luồng sinh tài liệu tiếng Việt để giữ UTF-8 ổn định.

## [5.5.0] — 2026-04-15
- Đồng bộ luồng sinh workspace docs giữa Wizard và CLI qua shared scaffold builders.
- Chuẩn hóa bộ tài liệu tạo ra quanh `AGENTS.md`, `TOOLS.md`, `MEMORY.md`, `TEAMS.md` và tài liệu browser.
- Nâng mốc OpenClaw lên `2026.4.14` và bỏ hẳn file agent `.yaml` cũ.

## [5.4.2] — 2026-04-14
- Sửa lỗi cài relay plugin bị lặp trong script native được generate.

## [5.4.1] — 2026-04-14
- Khôi phục hỗ trợ browser trong Docker và sửa CORS cho control UI Docker.
- Bổ sung script gỡ cài đặt cho cả Docker và native.

## [5.4.0] — 2026-04-14
- Gỡ kênh `telegram+zalo-personal` khỏi Wizard và CLI.
- Đơn giản hóa luồng multi-bot về một cờ `isMultiBot` và dọn phần generate config.
- Chuẩn hóa đường dẫn agent/workspace tương đối và siết quy tắc cross-workspace trong `AGENTS.md`.

## [5.3.5] — 2026-04-12
- Sửa lỗi sinh tài liệu workspace liên quan đến `MEMORY.md`.
- Ghi sẵn script uninstall ngay trong thư mục project được tạo.

## [5.3.4] — 2026-04-12
- Tăng độ ổn định cho gateway Windows native và đặt tên workspace theo từng agent.
- Mở rộng `TOOLS.md` / `AGENTS.md` cho cả workspace Zalo và Telegram.

## [5.3.3] — 2026-04-11
- Thêm script uninstall vào luồng tải file từ Wizard.

## [5.3.2] — 2026-04-11
- Ổn định quá trình khởi động 9Router native trên desktop và pre-seed dữ liệu 9Router theo project.

## [5.3.1] — 2026-04-10
- Chuyển mặc định DM của Zalo Personal sang `open`.

## [5.3.0] — 2026-04-11
- Thêm luồng combo Telegram + Zalo Personal đầu tiên.
- Tự bật plugin Zalo Personal và cải thiện cold-start Docker.

## [5.2.4] — 2026-04-10
- Tăng tốc luồng upgrade bằng cách tận dụng cache Docker tốt hơn.
- Thêm tooling theo dõi bản cập nhật OpenClaw mới.

## [5.2.3] — 2026-04-10
- Sửa các lỗi state/validation của wizard multi-bot.
- Cải thiện thông báo khi thiếu dữ liệu và an toàn encoding cho script.

## [5.2.2] — 2026-04-10
- Sửa bind/CORS gateway trong Docker và giảm rebuild Docker không cần thiết.
- Sửa đường dẫn PM2 native để bám theo `.openclaw` trong project.

## [5.2.1] — 2026-04-09
- Sửa nhiều lỗi cài native Ubuntu/VPS liên quan PM2, 9Router, runtime packages và đường dẫn project-local.
- Cải thiện hướng dẫn đăng nhập Zalo Personal và thư mục credentials.

## [5.2.0] — 2026-04-09
- Thêm luồng upgrade 1 lệnh qua CLI, `upgrade.ps1` và `upgrade.sh`.
- Giữ nguyên dữ liệu người dùng khi cập nhật OpenClaw và artifact phụ trợ.

## [5.1.15] — 2026-04-08
- Đồng bộ native Windows với hành vi Docker tốt hơn.
- Sửa runtime path theo project, sync provider và luồng browser install.

## [5.1.14] — 2026-04-08
- Pin OpenClaw về bản ổn định hơn và sửa lỗi generate Docker trên Windows.
- Bổ sung khuyến nghị version Node.js tương thích.

## [5.1.13] — 2026-04-08
- Sửa generate script cài đặt trên macOS, luồng Docker startup và cài npm global native.
- Sửa lỗi state Wizard liên quan persona và điều hướng step.

## [5.1.12] — 2026-04-07
- Mở rộng danh sách skills tích hợp và cải thiện auto-select relay plugin cho multi-bot.
- Cập nhật mặc định Zalo Personal và sửa một số điểm validate trong Wizard.

## [5.1.11] — 2026-04-07
- Cập nhật hành vi DM và onboarding mặc định cho Zalo Personal.

## [5.1.10] — 2026-04-07
- Thêm auto-approve cho luồng đăng nhập/ghép thiết bị Zalo trên native VPS.

## [5.1.9] — 2026-04-07
- Khôi phục schema chặt hơn và cải thiện UX liên quan WebCrypto.

## [5.1.8] — 2026-04-07
- Sửa lỗi kết nối dashboard trên VPS và đăng nhập bằng token.

## [5.1.7] — 2026-04-07
- Sửa CORS của Control UI và đường dẫn 9Router native.

## [5.1.6] — 2026-04-07
- Khắc phục lỗi `SIGKILL` của PM2 khi cài native trên VPS.

## [5.1.5] — 2026-04-06
- Sửa lỗi PM2 khởi động 9Router trên native.

## [5.1.4] — 2026-04-06
- Sửa lỗi BOM làm CLI không khởi động và cải thiện patch timeout cho Docker.

## [5.1.3] — 2026-04-06
- Sửa lỗi rò biến nội suy trong Docker Compose.

## [5.1.2] — 2026-04-06
- Gia cố script sync trước lỗi shell injection bằng cách chuyển sang Base64.

## [5.1.1] — 2026-04-06
- Ổn định đồng bộ smart-route của 9Router qua provider API.
- Thêm auto-approve Zalo pairing và làm output Docker CLI gọn hơn.

## [5.1.0] — 2026-04-07
- Cải thiện luồng đăng nhập Zalo Personal và xử lý QR.

## [5.0.9] — 2026-04-06
- Bổ sung chế độ cài native không cần Docker.
- Cập nhật Gemma 4, multi-bot Telegram và tinh chỉnh UI/setup.

## [5.0.0] — 2026-04-04
- Thêm hỗ trợ Gemma 4 và tài liệu yêu cầu phần cứng.

## [4.1.4] — 2026-04-03
- Cải thiện chung về độ ổn định và trải nghiệm.

## [4.1.3] — 2026-04-02
- Cải thiện chung về độ ổn định và trải nghiệm.

## [4.1.2] — 2026-04-01
- Sửa lỗi trong nhánh v4.1.

## [4.1.0] — 2026-04-01
- Ổn định smart routing của 9Router.

## [4.0.9] — 2026-04-01
- Thêm đồng bộ smart-route theo thời gian thực và luồng tự cài Docker.

## [4.0.8] — 2026-03-31
- Cải thiện độ ổn định 9Router, hỗ trợ Ollama cloud và dọn luồng setup đa nền tảng.

## [4.0.1] — 2026-03-31
- Tăng mức tự động hóa khi tạo thư mục cài đặt và dùng npm CLI.

## [4.0.0] — 2026-03-30
- Phát hành đợt nâng cấp lớn của nhánh v4.

## [3.0.2] — 2026-03-29
- Mở rộng hỗ trợ smart proxy của 9Router.

## [3.0.1] — 2026-03-29
- Bổ sung đợt cập nhật nối tiếp cho tính năng, sửa lỗi, UI và phần kỹ thuật của v3.

## [3.0.0] — 2026-03-28
- Giới thiệu luồng generate mới của v3, làm mới UI, tài liệu và phần kỹ thuật.

## [2.0.0] — 2026-03-27
- Giới thiệu trải nghiệm setup v2 với cải thiện về giao diện, tài liệu và bảo mật.

## [1.0.0] — 2026-03-26
- Bản phát hành đầu tiên.
