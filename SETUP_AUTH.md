# 🔐 Hướng dẫn Setup Authentication với Google Sheets

## Bước 1: Tạo Google Sheet

1. Vào [Google Sheets](https://sheets.google.com) và tạo Sheet mới
2. Đặt tên: `Crush Room Wiki - Users`
3. Tạo các cột ở hàng 1:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| email | password | name | role | cs | marketing | laser |

4. Thêm dữ liệu mẫu từ hàng 2:

| email | password | name | role | cs | marketing | laser |
|-------|----------|------|------|-----|-----------|-------|
| admin@crushroom.vn | admin123 | Admin | admin | TRUE | TRUE | TRUE |
| cs@crushroom.vn | cs123 | CS Team | staff | TRUE | FALSE | FALSE |
| marketing@crushroom.vn | mkt123 | Marketing Team | staff | FALSE | TRUE | FALSE |
| laser@crushroom.vn | laser123 | Laser Team | staff | FALSE | FALSE | TRUE |

**Lưu ý:**
- Cột `role`: `admin` hoặc `staff`
- Cột `cs`, `marketing`, `laser`: `TRUE` hoặc `FALSE`

---

## Bước 2: Tạo Google Apps Script

1. Trong Google Sheet, vào **Extensions > Apps Script**
2. Xóa code mặc định, paste code sau:

```javascript
// Crush Room Wiki - Authentication API

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'login') {
      return handleLogin(data.email, data.password);
    }
    
    return jsonResponse({ success: false, message: 'Invalid action' });
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function handleLogin(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const userEmail = row[0];
    const userPassword = row[1];
    const userName = row[2];
    const userRole = row[3];
    const hasCS = row[4];
    const hasMarketing = row[5];
    const hasLaser = row[6];
    
    if (userEmail.toLowerCase() === email.toLowerCase() && userPassword === password) {
      return jsonResponse({
        success: true,
        user: {
          email: userEmail,
          name: userName,
          role: userRole,
          permissions: {
            cs: hasCS === true || hasCS === 'TRUE',
            marketing: hasMarketing === true || hasMarketing === 'TRUE',
            laser: hasLaser === true || hasLaser === 'TRUE'
          }
        }
      });
    }
  }
  
  return jsonResponse({ success: false, message: 'Email hoặc mật khẩu không đúng' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function
function testLogin() {
  const result = handleLogin('admin@crushroom.vn', 'admin123');
  Logger.log(result.getContent());
}
```

3. Lưu file (Ctrl+S)
4. Đặt tên project: `Crush Room Wiki Auth`

---

## Bước 3: Deploy Apps Script

1. Click **Deploy > New deployment**
2. Click ⚙️ (Settings) > Chọn **Web app**
3. Cấu hình:
   - Description: `Wiki Authentication`
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Click **Deploy**
5. **Authorize** khi được hỏi
6. Copy **Web app URL** (dạng: `https://script.google.com/macros/s/xxx/exec`)

---

## Bước 4: Cập nhật code Wiki

1. Mở file `js/auth.js`
2. Tìm dòng:
```javascript
API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL',
```
3. Thay bằng URL vừa copy:
```javascript
API_URL: 'https://script.google.com/macros/s/xxx/exec',
```

---

## Bước 5: Test

1. Mở trang Wiki
2. Đăng nhập với tài khoản trong Google Sheet
3. Kiểm tra quyền truy cập các module

---

## 📝 Quản lý User

### Thêm user mới:
1. Mở Google Sheet
2. Thêm hàng mới với thông tin user
3. Đặt quyền TRUE/FALSE cho từng module

### Xóa user:
1. Xóa hàng tương ứng trong Google Sheet

### Đổi mật khẩu:
1. Sửa cột `password` trong Google Sheet

### Thay đổi quyền:
1. Sửa cột `cs`, `marketing`, `laser` thành TRUE/FALSE

---

## ⚠️ Lưu ý bảo mật

- Đây là giải pháp phù hợp cho **internal tool** với số lượng user nhỏ
- Mật khẩu lưu dạng plain text trong Google Sheet (không mã hóa)
- Chỉ những người có link mới truy cập được API
- Nếu cần bảo mật cao hơn, nên dùng Firebase Authentication

---

## 🔧 Troubleshooting

### Lỗi "CORS error":
- Đảm bảo Apps Script đã deploy với "Anyone" access
- Thử deploy lại với version mới

### Đăng nhập không được:
- Kiểm tra email/password trong Google Sheet
- Kiểm tra Apps Script URL đúng chưa
- Mở Console (F12) xem lỗi chi tiết

### Module vẫn truy cập được:
- Clear localStorage: `localStorage.clear()` trong Console
- Đăng nhập lại

---

## 📱 Tài khoản Test (Mock Data)

Khi chưa setup Google Sheets, có thể dùng tài khoản test:

| Email | Password | Quyền |
|-------|----------|-------|
| admin@crushroom.vn | admin123 | Full |
| cs@crushroom.vn | cs123 | CS only |
| marketing@crushroom.vn | mkt123 | Marketing only |
| laser@crushroom.vn | laser123 | Laser only |
| test@test.com | test123 | Full |
