# 🔧 Cập nhật Apps Script để fix CORS

## ❌ Vấn đề

Quiz không thể save lên Google Sheets vì gặp lỗi CORS:
```
Access to fetch has been blocked by CORS policy:
Response to preflight request doesn't pass access control check
```

## ✅ Giải pháp

Code Apps Script thiếu CORS headers. Cần update code và **REDEPLOY** lại.

---

## 📝 Các bước thực hiện

### Bước 1: Mở Google Apps Script

1. Vào **Google Sheets** đã tạo trước đó
2. Click menu **Extensions** > **Apps Script**

### Bước 2: Update toàn bộ code

1. **XÓA HẾT** code cũ trong file `Code.gs`
2. **COPY** toàn bộ code mới từ file: `/docs/google-apps-script/quiz-backend.gs`
3. **PASTE** vào `Code.gs`

### Bước 3: Save code

1. Click nút **💾 Save** (hoặc `Ctrl+S`)
2. Đợi "All changes saved in Drive" xuất hiện

### Bước 4: REDEPLOY (QUAN TRỌNG!)

**CÁCH 1: Deploy mới hoàn toàn (KHUYẾN NGHỊ)**

1. Click nút **Deploy** > **New deployment**
2. Settings:
   - Type: **Web app**
   - Description: `Quiz Backend v2 - CORS fixed`
   - Execute as: **Me** (your-email@gmail.com)
   - Who has access: **Anyone**
3. Click **Deploy**
4. **COPY URL MỚI** (URL sẽ khác với URL cũ!)
5. Click **Done**

**CÁCH 2: Manage deployments (cập nhật deployment cũ)**

1. Click **Deploy** > **Manage deployments**
2. Tìm deployment hiện tại
3. Click **✏️ Edit** (icon bút chì)
4. Chọn **New version**
5. Description: `v2 - CORS fixed`
6. Click **Deploy**
7. Click **Done**
8. **URL GIỮ NGUYÊN** (không cần update code)

---

## 🔗 Bước 5: Cập nhật URL trong code (nếu dùng CÁCH 1)

Nếu deploy mới hoàn toàn, cần update URL:

**File:** `/js/quiz/quiz-storage.js`

**Line 11:** Thay URL cũ bằng URL mới:

```javascript
static SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_NEW_URL_HERE/exec';
```

---

## 🧪 Bước 6: Test

1. **Hard refresh** browser: `Ctrl + Shift + R`
2. Load trang quiz: `pages/cs/quiz.html`
3. Làm quiz và nộp bài
4. **Check console** - bạn sẽ thấy:
   ```
   ✅ 💾 Saving quiz result to backend...
   ✅ ✓ Quiz result saved successfully
   ```
5. **Check Google Sheets** - Có data mới trong sheet "QuizResults"

---

## 🎯 Những gì đã sửa

### 1. Thêm hàm `doOptions()` (line 34-42)

Xử lý CORS preflight requests:

```javascript
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '3600');
}
```

### 2. Thêm CORS headers vào `createResponse()` (line 581-583)

Mọi response đều có CORS headers:

```javascript
.setHeader('Access-Control-Allow-Origin', '*')
.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

---

## ⚠️ Lưu ý

- **PHẢI REDEPLOY** sau khi update code - không redeploy thì code mới không có effect!
- Nếu dùng **New deployment**, URL sẽ thay đổi → phải update `quiz-storage.js`
- Nếu dùng **Manage deployments > Edit**, URL giữ nguyên → không cần update code
- Sau khi deploy, đợi **1-2 phút** để Google propagate changes

---

## 🐛 Troubleshooting

### Vẫn gặp CORS error sau khi redeploy?

1. **Đợi 2-3 phút** - Google cần thời gian để update
2. **Hard refresh** browser: `Ctrl + Shift + R`
3. **Clear browser cache** hoàn toàn
4. **Check deployment settings:**
   - Deploy > Manage deployments
   - Verify "Who has access" = **Anyone**
5. **Test URL trực tiếp:**
   ```
   https://YOUR_APPS_SCRIPT_URL/exec?action=test
   ```
   Expected response: `{"success":false,"message":"Unknown action: test"}`

### POST request vẫn failed?

1. **Check code đã save chưa** - phải thấy "All changes saved in Drive"
2. **Check đã redeploy chưa** - version mới phải được deploy
3. **Check Apps Script logs:**
   - Apps Script editor > Executions tab
   - Xem có errors không

---

## 📞 Cần hỗ trợ?

Nếu vẫn gặp vấn đề, cung cấp:
1. Screenshot console error
2. URL Apps Script đang dùng
3. Response khi test URL trực tiếp (action=test)
