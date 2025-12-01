# 🔐 Hướng dẫn Setup Authentication với Google Sheets

## Bước 1: Tạo Google Sheet

1. Vào [Google Sheets](https://sheets.google.com) và tạo Sheet mới
2. Đặt tên: `Crush Room Wiki - Users`

### Sheet 1: Users (đổi tên sheet thành "Users")
Tạo các cột ở hàng 1:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| email | password | name | role | cs | marketing | laser |

Thêm dữ liệu mẫu từ hàng 2:

| email | password | name | role | cs | marketing | laser |
|-------|----------|------|------|-----|-----------|-------|
| admin@crushroom.vn | admin123 | Admin | admin | TRUE | TRUE | TRUE |
| cs@crushroom.vn | cs123 | CS Team | staff | TRUE | FALSE | FALSE |

### Sheet 2: Logs (tạo sheet mới tên "Logs")
Tạo các cột ở hàng 1:

| A | B | C | D | E |
|---|---|---|---|---|
| timestamp | email | name | page | url |

**Lưu ý:**
- Cột `role`: `admin` hoặc `staff`
- Cột `cs`, `marketing`, `laser`: `TRUE` hoặc `FALSE`

---

## Bước 2: Tạo Google Apps Script

1. Trong Google Sheet, vào **Extensions > Apps Script**
2. Xóa code mặc định, paste code sau:

```javascript
// Crush Room Wiki - Full Authentication API
// Hỗ trợ: Login, CRUD Users, Page View Logging, Stats

// ===== MAIN HANDLERS =====

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    switch(data.action) {
      case 'login':
        return handleLogin(data.email, data.password);
      case 'getUsers':
        return handleGetUsers();
      case 'addUser':
        return handleAddUser(data.userData);
      case 'updateUser':
        return handleUpdateUser(data.row, data.userData);
      case 'deleteUser':
        return handleDeleteUser(data.row);
      case 'logPageView':
        return handleLogPageView(data.log);
      case 'getStats':
        return handleGetStats();
      default:
        return jsonResponse({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function doGet(e) {
  return jsonResponse({ success: true, message: 'Crush Room Wiki API is running' });
}

// ===== LOGIN =====

function handleLogin(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0].toLowerCase() === email.toLowerCase() && row[1] === password) {
      // Log login
      logActivity(email, row[2], 'Đăng nhập', '');
      
      return jsonResponse({
        success: true,
        user: {
          email: row[0],
          name: row[2],
          role: row[3],
          permissions: {
            cs: row[4] === true || row[4] === 'TRUE',
            marketing: row[5] === true || row[5] === 'TRUE',
            laser: row[6] === true || row[6] === 'TRUE'
          }
        }
      });
    }
  }
  
  return jsonResponse({ success: false, message: 'Email hoặc mật khẩu không đúng' });
}

// ===== USERS CRUD =====

function handleGetUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // Skip empty rows
      users.push({
        row: i + 1, // Sheet row number (1-indexed)
        email: row[0],
        password: row[1],
        name: row[2],
        role: row[3],
        cs: row[4] === true || row[4] === 'TRUE',
        marketing: row[5] === true || row[5] === 'TRUE',
        laser: row[6] === true || row[6] === 'TRUE'
      });
    }
  }
  
  return jsonResponse({ success: true, users: users });
}

function handleAddUser(userData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  
  // Check duplicate email
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === userData.email.toLowerCase()) {
      return jsonResponse({ success: false, message: 'Email đã tồn tại' });
    }
  }
  
  // Add new row
  sheet.appendRow([
    userData.email,
    userData.password,
    userData.name,
    userData.role,
    userData.cs ? 'TRUE' : 'FALSE',
    userData.marketing ? 'TRUE' : 'FALSE',
    userData.laser ? 'TRUE' : 'FALSE'
  ]);
  
  return jsonResponse({ success: true, message: 'Đã thêm user' });
}

function handleUpdateUser(row, userData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  
  sheet.getRange(row, 1, 1, 7).setValues([[
    userData.email,
    userData.password,
    userData.name,
    userData.role,
    userData.cs ? 'TRUE' : 'FALSE',
    userData.marketing ? 'TRUE' : 'FALSE',
    userData.laser ? 'TRUE' : 'FALSE'
  ]]);
  
  return jsonResponse({ success: true, message: 'Đã cập nhật user' });
}

function handleDeleteUser(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Đã xóa user' });
}

// ===== PAGE VIEW LOGGING =====

function handleLogPageView(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
  
  sheet.appendRow([
    log.timestamp || new Date().toISOString(),
    log.userEmail,
    log.userName,
    log.page,
    log.url
  ]);
  
  return jsonResponse({ success: true });
}

function logActivity(email, name, page, url) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
    sheet.appendRow([
      new Date().toISOString(),
      email,
      name,
      page,
      url
    ]);
  } catch (e) {
    // Ignore logging errors
  }
}

// ===== STATS =====

function handleGetStats() {
  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
  
  const usersData = usersSheet.getDataRange().getValues();
  const logsData = logsSheet.getDataRange().getValues();
  
  // Count users
  const totalUsers = usersData.length - 1; // Exclude header
  
  // Process logs
  const today = new Date().toDateString();
  let totalViews = 0;
  let todayViews = 0;
  const pageStats = {};
  
  for (let i = 1; i < logsData.length; i++) {
    const row = logsData[i];
    if (!row[0]) continue;
    
    totalViews++;
    
    const logDate = new Date(row[0]).toDateString();
    if (logDate === today) {
      todayViews++;
    }
    
    const page = row[3] || 'Unknown';
    const userName = row[2] || row[1] || 'Unknown';
    
    if (!pageStats[page]) {
      pageStats[page] = { totalViews: 0, users: {} };
    }
    pageStats[page].totalViews++;
    
    if (!pageStats[page].users[userName]) {
      pageStats[page].users[userName] = 0;
    }
    pageStats[page].users[userName]++;
  }
  
  // Convert to array and sort
  const pageStatsArray = Object.entries(pageStats).map(([pageName, data]) => ({
    pageName: pageName,
    totalViews: data.totalViews,
    userViews: Object.entries(data.users).map(([name, count]) => ({ name, count }))
  })).sort((a, b) => b.totalViews - a.totalViews);
  
  return jsonResponse({
    success: true,
    stats: {
      totalViews: totalViews,
      totalUsers: totalUsers,
      totalPages: Object.keys(pageStats).length,
      todayViews: todayViews,
      pageStats: pageStatsArray
    }
  });
}

// ===== HELPER =====

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== TEST FUNCTIONS =====

function testLogin() {
  const result = handleLogin('admin@crushroom.vn', 'admin123');
  Logger.log(result.getContent());
}

function testGetUsers() {
  const result = handleGetUsers();
  Logger.log(result.getContent());
}

function testGetStats() {
  const result = handleGetStats();
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
   - Description: `Wiki Authentication v2`
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

1. Mở trang Wiki → Đăng nhập
2. Đăng nhập với tài khoản admin → Vào Admin Panel
3. Thử thêm/sửa/xóa user
4. Xem tab "Thống kê xem trang"

---

## 📝 Tính năng Admin Panel

### Tab 1: Quản lý User
- Xem danh sách user
- Thêm user mới
- Sửa thông tin user
- Xóa user
- Phân quyền CS/Marketing/Laser

### Tab 2: Thống kê xem trang
- Tổng lượt xem
- Lượt xem hôm nay
- Chi tiết từng trang: ai xem, xem bao nhiêu lần

---

## ⚠️ Lưu ý

- **Re-deploy khi sửa code:** Mỗi lần sửa Apps Script, phải Deploy > New deployment
- **Giới hạn:** 20,000 API calls/ngày (free tier)
- **Team 10 người:** ~2,000 calls/ngày → OK

---

## 📱 Tài khoản Test (Mock Data)

Khi chưa setup Google Sheets, có thể dùng tài khoản test:

| Email | Password | Quyền |
|-------|----------|-------|
| `admin@crushroom.vn` | `admin123` | Full + Admin |
| `cs@crushroom.vn` | `cs123` | CS only |
| `marketing@crushroom.vn` | `mkt123` | Marketing only |
| `laser@crushroom.vn` | `laser123` | Laser only |
| `test@test.com` | `test123` | Full |
