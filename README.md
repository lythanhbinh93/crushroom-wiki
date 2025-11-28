# 💎 Crush Room Wiki

Trang Wiki nội bộ cho team Crush Room - Trung tâm tài liệu & đào tạo.

## 📁 Cấu trúc thư mục

```
crushroom-wiki/
├── index.html              # Trang chủ
├── css/
│   └── style.css           # Stylesheet chính
├── js/
│   └── main.js             # JavaScript (navigation, quiz)
└── pages/
    ├── schedule.html       # Đăng ký lịch làm
    ├── cs/
    │   ├── library.html    # Thư viện CS
    │   └── quiz.html       # Bài kiểm tra CS
    ├── marketing/
    │   ├── library.html    # Thư viện Marketing
    │   └── quiz.html       # Bài kiểm tra Marketing
    └── laser/
        ├── guide.html      # Hướng dẫn khắc Laser
        └── lightburn.html  # Thông số Lightburn
```

## 🚀 Hướng dẫn Deploy

### Bước 1: Tạo GitHub Repository

1. Vào [github.com](https://github.com) và đăng nhập
2. Click **New repository** (nút + góc trên phải)
3. Đặt tên: `crushroom-wiki`
4. Chọn **Public**
5. Click **Create repository**

### Bước 2: Push code lên GitHub

Mở Terminal/Command Prompt tại thư mục project:

```bash
# Khởi tạo git
git init

# Thêm tất cả files
git add .

# Commit
git commit -m "Initial commit - Crush Room Wiki"

# Thêm remote (thay YOUR_USERNAME bằng username GitHub của bạn)
git remote add origin https://github.com/YOUR_USERNAME/crushroom-wiki.git

# Push lên GitHub
git branch -M main
git push -u origin main
```

### Bước 3: Deploy lên Vercel

**Cách 1: Qua Vercel Dashboard (Dễ nhất)**

1. Vào [vercel.com](https://vercel.com) và đăng nhập bằng GitHub
2. Click **Add New Project**
3. Import repository `crushroom-wiki`
4. Framework Preset: Chọn **Other**
5. Click **Deploy**
6. Đợi 1-2 phút, Vercel sẽ cấp URL dạng: `crushroom-wiki.vercel.app`

**Cách 2: Qua Vercel CLI**

```bash
# Cài Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Chọn các options mặc định, enter để tiếp tục
```

### Bước 4: Custom Domain (Tùy chọn)

1. Vào Vercel Dashboard > Project Settings > Domains
2. Thêm domain của bạn (ví dụ: `wiki.crushroom.vn`)
3. Cập nhật DNS theo hướng dẫn của Vercel

## ✏️ Cập nhật nội dung

Sau khi deploy, mỗi lần cập nhật:

```bash
# Thêm changes
git add .

# Commit với message
git commit -m "Cập nhật: [mô tả thay đổi]"

# Push lên GitHub
git push
```

Vercel sẽ tự động re-deploy khi có push mới.

## 🎨 Tùy chỉnh

### Đổi màu brand
Mở `css/style.css`, tìm phần `:root` và thay đổi:

```css
:root {
    --primary: #e91e63;        /* Màu chính - Pink */
    --primary-dark: #c2185b;   /* Màu tối hơn */
    --primary-light: #fce4ec;  /* Màu nhạt hơn */
}
```

### Thêm trang mới
1. Copy một file HTML có sẵn trong `/pages/`
2. Đổi nội dung
3. Thêm link vào sidebar trong tất cả các file HTML

### Thêm câu hỏi quiz
Mở file `quiz.html`, thêm block câu hỏi mới theo format có sẵn. Nhớ cập nhật `correctAnswers` object trong hàm `submitQuiz()`.

## 📱 Responsive

Wiki đã được thiết kế responsive:
- Desktop: Sidebar cố định bên trái
- Tablet: Sidebar có thể collapse
- Mobile: Sidebar ẩn, hiện khi click menu

## 🔧 Troubleshooting

**Lỗi: CSS không load**
- Kiểm tra đường dẫn `href` trong thẻ `<link>` 
- Đảm bảo cấu trúc thư mục đúng

**Lỗi: Link navigation sai**
- Kiểm tra relative path (`../`, `../../`)
- Trang ở cấp 1: `../index.html`
- Trang ở cấp 2: `../../index.html`

**Vercel deploy lỗi**
- Kiểm tra tất cả file có đúng cú pháp HTML
- Không có file bị thiếu

## 📞 Hỗ trợ

Liên hệ team IT nếu cần hỗ trợ kỹ thuật.

---
© 2025 Crush Room
