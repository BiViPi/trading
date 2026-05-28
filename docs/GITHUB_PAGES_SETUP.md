# Trading Simulation Dashboard — GitHub Pages Setup

## Overview

Dashboard này là một **static website** được deploy lên GitHub Pages.  
Bạn bè anh Phú có thể xem tại: `https://<username>.github.io/<repo-name>/`

---

## Folder Structure (Local vs Git)

```
E:\Trading\                         ← root folder (local)
├── .gitignore                      ← Tracked by Git
├── .agents/                        (Chỉ lưu local, bị Git ignore)
├── 00-knowledge/                   (Chỉ lưu local, bị Git ignore)
├── 01-docs/                        (Chỉ lưu local, bị Git ignore)
├── 02-logs/                        (Chỉ lưu local, bị Git ignore)
├── 03-reviews/                     (Chỉ lưu local, bị Git ignore)
└── docs/                           ← Thư mục duy nhất được đẩy lên GitHub
    ├── index.html                  ← Dashboard UI
    ├── dashboard.css
    ├── dashboard.js
    └── data/
        └── trading_data.js         ← Agents cập nhật file này
```

---

## Bước 1: Tạo GitHub Repo và Push code

```bash
# Trong thư mục E:\Trading
git init
git add .
git commit -m "Initial commit: Trading Simulation Dashboard"
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

---

## Bước 2: Kích hoạt GitHub Pages

1. Vào **GitHub repo** của anh trên trình duyệt → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`
4. **Folder:** Chọn `/docs` (như trong ảnh screenshot của anh)
5. Click **Save**

Dashboard sẽ live tại:  
`https://<username>.github.io/<repo-name>/`

---

## Bước 3: Quy trình AI Agent cập nhật Dashboard

Mỗi khi AI agent chạy xong một phiên giao dịch (session):

1. **Agent đọc dữ liệu hiện tại:**
   ```
   E:\Trading\docs\data\trading_data.js
   ```

2. **Agent ghi nhật ký chi tiết (local):**
   ```
   E:\Trading\02-logs\YYYY-MM-DD_session_NNN.json
   ```

3. **Agent cập nhật `trading_data.js`** với dữ liệu mới (thêm giao dịch, cập nhật số dư, thống kê hiệu suất, equity curve)

4. **Tự động Commit và Push:**
   ```bash
   git add docs/data/trading_data.js
   git commit -m "Session 2026-05-28: BTCUSDT LONG ema_trend_v1 +2.74R"
   git push
   ```

5. GitHub Pages sẽ tự động nhận diện và cập nhật website sau khoảng ~30 giây.

---

## Bước 4: Chia sẻ với bạn bè

Gửi link: `https://<username>.github.io/<repo-name>/`

Mọi người có thể theo dõi:
- Đường cong tăng trưởng tài khoản (Equity curve)
- Tỷ lệ thắng/thua (Win/Loss ratio)
- Nhật ký giao dịch chi tiết (Trade log table có bộ lọc)
- Các nhận định hàng tuần (Weekly reviews)
- Thư viện mẫu nến/mô hình (Pattern library)

---

## Cấu trúc dữ liệu `trading_data.js`

Agent cập nhật biến `window.TRADING_DATA` với định dạng:

```javascript
window.TRADING_DATA = {
  meta: {
    last_updated: "2026-05-28T14:00:00Z",
    github_repo: "https://github.com/username/trading-sim"
  },
  account: {
    equity_start: 10000,
    equity_current: 10135.49,
    ...
  },
  cumulative_stats: { ... },
  strategy_stats: { ... },
  active_session: {
    status: "in_trade",
    symbol: "BTCUSDT",
    strategy: "ema_trend_v1",
    entry: 107350,
    sl: 106200,
    tp: 110500,
    rr: 2.74,
    agent_reasoning: "ADX 28.5 > 25, EMA stack aligned on H4..."
  },
  equity_curve: [
    { date: "2026-05-28", equity: 10000 },
    { date: "2026-05-29", equity: 10135.49 }
  ],
  trades: [ ... ],
  daily_reviews: [ ... ],
  patterns: [ ... ]
};
```

---

## Lưu ý quan trọng

> [!IMPORTANT]
> File `docs/data/trading_data.js` là file **AGENT TỰ GHI, NGƯỜI ĐỌC**.  
> Anh không cần chỉnh sửa thủ công file này trừ khi muốn reset/test mẫu dữ liệu.

> [!NOTE]
> GitHub Pages có cơ chế lưu cache trong khoảng 1-5 phút. Sau khi push commit mới, nếu F5 chưa thấy thay đổi ngay lập tức thì anh vui lòng đợi một chút nhé.

---

*Cập nhật hướng dẫn: 28/05/2026*
