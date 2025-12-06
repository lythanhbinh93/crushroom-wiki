# TROUBLESHOOTING: "Unknown error" khi run setupSheets

## 🔍 COMMON CAUSES & FIXES

### ✅ FIX 1: Save Script trước khi Run

**Bước làm:**
1. Trong Apps Script editor, nhấn **Ctrl+S** (hoặc click icon Save)
2. Đảm bảo thấy message "Saved" ở góc trên
3. Đợi 2-3 giây
4. Thử Run lại

**Lý do:** Apps Script cần save code trước khi execute

---

### ✅ FIX 2: Kiểm tra Script được bind với Sheet

**Vấn đề:** Script không biết Sheet nào để tạo tabs

**Cách kiểm tra:**
1. Trong Apps Script editor, nhấn **Ctrl+S** để save
2. Đóng tab Apps Script
3. Quay lại Google Sheet
4. **Extensions** → **Apps Script** (mở lại)
5. Chạy `setupSheets` lần nữa

**Nếu vẫn lỗi, thử cách này:**

Thay đổi function `setupSheets` một chút để debug:

```javascript
function setupSheets() {
  try {
    // Test xem có access được Sheet không
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('Spreadsheet found: ' + ss.getName());

    // Create QuizResults sheet
    if (!ss.getSheetByName(CONFIG.SHEETS.QUIZ_RESULTS)) {
      Logger.log('Creating QuizResults sheet...');
      createQuizResultsSheet(ss);
      Logger.log('QuizResults created!');
    }

    // Create UserProgress sheet
    if (!ss.getSheetByName(CONFIG.SHEETS.USER_PROGRESS)) {
      Logger.log('Creating UserProgress sheet...');
      createUserProgressSheet(ss);
      Logger.log('UserProgress created!');
    }

    // Create QuizSchedule sheet
    if (!ss.getSheetByName(CONFIG.SHEETS.QUIZ_SCHEDULE)) {
      Logger.log('Creating QuizSchedule sheet...');
      createQuizScheduleSheet(ss);
      Logger.log('QuizSchedule created!');
    }

    Logger.log('All sheets created successfully!');
    SpreadsheetApp.getUi().alert('Setup complete! All sheets have been created.');

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('ERROR Stack: ' + error.stack);
    SpreadsheetApp.getUi().alert('Error: ' + error.toString());
  }
}
```

**Sau đó:**
1. Save script (Ctrl+S)
2. Run lại `setupSheets`
3. Check **View** → **Logs** (Ctrl+Enter) để xem error chi tiết

---

### ✅ FIX 3: Grant Permissions lại

Có thể permissions bị stuck. Làm lại từ đầu:

**Bước 1: Revoke permissions**
1. Truy cập: https://myaccount.google.com/permissions
2. Tìm "Quiz Backend API" hoặc tên project Apps Script của bạn
3. Click **Remove access**

**Bước 2: Run lại và grant permissions mới**
1. Quay lại Apps Script editor
2. Chọn function: `setupSheets`
3. Click **Run**
4. Grant permissions lại (như đã làm lúc đầu)

---

### ✅ FIX 4: Tạo Sheet manually trước

Nếu các cách trên không work, tạo sheets thủ công:

**Bước 1: Tạo 3 sheets trong Google Sheet**

1. Trong Google Sheet, click nút **+** ở góc dưới trái
2. Tạo sheet mới, đổi tên thành: **QuizResults**
3. Lặp lại để tạo: **UserProgress**, **QuizSchedule**

**Bước 2: Add headers manually**

**QuizResults (Sheet 1):**
Row 1, paste các headers này vào A1→P1:
```
Result ID	User ID	Quiz ID	Attempt Number	Started At	Submitted At	Time Spent (s)	MCQ Score	Essay Score	Total Score	Passed	Answers (JSON)	Feedback	Graded By	Graded At	Created At
```

**UserProgress (Sheet 2):**
Row 1, paste vào A1→H1:
```
User ID	Module ID	Started At	Completed At	Progress %	Time Spent (min)	Last Accessed	Sections Completed (JSON)
```

**QuizSchedule (Sheet 3):**
Row 1, paste vào A1→I1:
```
Schedule ID	Quiz ID	Title	Start Date	End Date	Target Users (JSON)	Status	Created By	Created At
```

**Bước 3: Format headers**
1. Select row 1 cho mỗi sheet
2. **Format** → **Text** → **Bold**
3. **View** → **Freeze** → **1 row**

**Bước 4: Skip setupSheets function**

Bây giờ bạn đã có sheets rồi, có thể skip function `setupSheets` và tiến thẳng đến Deploy Web App (Step 3 trong guide).

---

### ✅ FIX 5: Check Apps Script Services

**Enable Advanced Services:**

1. Trong Apps Script editor
2. Click **Settings** (icon bánh răng, sidebar trái)
3. Scroll xuống **"Google Services"**
4. Tìm **"Google Sheets API"**
5. Enable nếu chưa bật

Sau đó run lại.

---

### ✅ FIX 6: Tạo Project mới

Nếu tất cả đều fail, tạo lại từ đầu:

1. **Đóng** Apps Script tab
2. Trong Google Sheet, **Extensions** → **Apps Script**
3. **Delete toàn bộ code** cũ
4. **Paste lại code** từ `quiz-backend.gs`
5. **Save** (Ctrl+S)
6. **Run** `setupSheets` lần nữa

---

## 🧪 QUICK DEBUG TEST

Chạy function đơn giản này để test:

```javascript
function testConnection() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('✓ Connected to: ' + ss.getName());
    Logger.log('✓ URL: ' + ss.getUrl());
    Logger.log('✓ Number of sheets: ' + ss.getSheets().length);

    SpreadsheetApp.getUi().alert('Connection OK!\n\nSheet: ' + ss.getName());
  } catch (error) {
    Logger.log('✗ ERROR: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error: ' + error.toString());
  }
}
```

**Chạy `testConnection`:**
1. Paste function này vào Apps Script
2. Save
3. Select function: `testConnection`
4. Run

**Nếu test này PASS:**
- Sheet connection OK
- Vấn đề ở logic tạo sheets
- Dùng FIX 4 (tạo sheets manually)

**Nếu test này FAIL:**
- Sheet connection có vấn đề
- Dùng FIX 2 hoặc FIX 6

---

## 📋 WHAT TO SEND ME

Nếu vẫn lỗi, gửi tôi:

1. **Screenshot lỗi** trong Apps Script
2. **Logs** từ View → Logs (Ctrl+Enter)
3. **Kết quả** của function `testConnection` ở trên

Tôi sẽ giúp debug cụ thể hơn!

---

## ⚡ QUICKEST FIX (Recommended)

**Nếu đang vội, làm theo cách này:**

1. ✅ **Skip** function `setupSheets` hoàn toàn
2. ✅ **Tạo 3 sheets manually** (FIX 4 ở trên)
3. ✅ **Add headers manually** (copy/paste)
4. ✅ **Tiếp tục Step 3** trong guide (Deploy Web App)

Function `setupSheets` chỉ là helper để auto-create sheets. Tạo manual cũng OK!

---

Thử các fixes trên và cho tôi biết kết quả nhé! 🚀
