# Google Sheets Backend Setup Guide

> **Goal:** Setup Google Sheets + Apps Script backend để lưu quiz results
> **Time:** 15-20 phút
> **Difficulty:** Easy

---

## 📋 OVERVIEW

Sau khi setup xong, bạn sẽ có:
- ✅ Google Sheet lưu quiz results, user progress, quiz schedules
- ✅ Apps Script API endpoint (REST API)
- ✅ Auto-grading MCQ questions
- ✅ Manual grading interface cho essay questions
- ✅ Analytics dashboard

---

## 🚀 STEP 1: TẠO GOOGLE SHEET

### 1.1 Tạo mới Google Sheet

1. Truy cập [Google Sheets](https://sheets.google.com)
2. Click **Blank** để tạo spreadsheet mới
3. Đặt tên: **"Crush Room Quiz Results"**

### 1.2 Chia sẻ quyền truy cập

1. Click nút **Share** (góc trên bên phải)
2. Thêm email các admin/giảng viên
3. Chọn quyền: **Editor**
4. Click **Done**

---

## 🔧 STEP 2: DEPLOY APPS SCRIPT

### 2.1 Mở Apps Script Editor

1. Trong Google Sheet, click **Extensions** → **Apps Script**
2. Một tab mới sẽ mở ra với Apps Script editor
3. Xóa code mẫu có sẵn (function myFunction...)

### 2.2 Paste code backend

1. Copy toàn bộ code từ file `/docs/google-apps-script/quiz-backend.gs`
2. Paste vào Apps Script editor
3. Đổi tên project: Click **"Untitled project"** → nhập **"Quiz Backend API"**
4. Click **Save** (icon đĩa mềm hoặc Ctrl+S)

### 2.3 Run setup function

1. Trong Apps Script editor, tìm dropdown function (trên toolbar)
2. Chọn function: **`setupSheets`**
3. Click nút **Run** (▶️)

**⚠️ LẦN ĐẦU TIÊN SẼ XIN QUYỀN:**

4. Pop-up xuất hiện: **"Authorization required"**
   - Click **Review permissions**
5. Chọn tài khoản Google của bạn
6. Click **Advanced** → **Go to Quiz Backend API (unsafe)**
   - ⚠️ Đừng lo, đây là code của bạn, hoàn toàn safe
7. Click **Allow**

**KẾT QUẢ:**
- Function chạy xong
- Alert hiện: **"Setup complete! All sheets have been created."**
- Click **OK**

### 2.4 Verify sheets đã được tạo

Quay lại Google Sheet, bạn sẽ thấy 3 sheets mới:
- ✅ **QuizResults** - Lưu kết quả quiz
- ✅ **UserProgress** - Track training progress
- ✅ **QuizSchedule** - Quản lý lịch thi

---

## 🌐 STEP 3: DEPLOY WEB APP

### 3.1 Deploy as Web App

1. Trong Apps Script editor, click **Deploy** → **New deployment**
2. Click **Select type** (icon bánh răng) → chọn **Web app**

### 3.2 Cấu hình deployment

**Điền thông tin:**

| Field | Value |
|-------|-------|
| **Description** | Quiz Backend API v1.0 |
| **Execute as** | **Me** (your email) |
| **Who has access** | **Anyone** |

3. Click **Deploy**

### 3.3 Copy Web App URL

**Quan trọng!** Pop-up hiện ra với:
- Web app URL: **https://script.google.com/macros/s/AKfy...../exec**

4. Click **Copy** để copy URL
5. **LƯU LẠI URL NÀY** - bạn sẽ cần paste vào code

---

## 📝 STEP 4: UPDATE FRONTEND CODE

### 4.1 Update QuizStorage.js

1. Mở file: `/js/quiz/quiz-storage.js`
2. Tìm dòng (line ~18):
   ```javascript
   static SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```

3. Thay bằng URL vừa copy:
   ```javascript
   static SCRIPT_URL = 'https://script.google.com/macros/s/AKfy...../exec';
   ```

4. **Save file**

### 4.2 Commit changes

```bash
git add js/quiz/quiz-storage.js
git commit -m "Connect quiz system to Google Sheets backend"
git push
```

---

## ✅ STEP 5: TEST BACKEND

### 5.1 Test POST request (Save result)

1. Mở quiz: `http://localhost/pages/cs/quiz.html?module=2`
2. Login và làm bài
3. Submit quiz
4. Check console - nên thấy:
   ```
   ✓ Quiz result saved successfully
   ```

### 5.2 Verify data trong Google Sheet

1. Quay lại Google Sheet
2. Mở tab **QuizResults**
3. Nên thấy 1 row mới với data:
   - Result ID
   - User ID (email)
   - Quiz ID (module-2-quiz)
   - MCQ Score
   - Total Score
   - v.v.

### 5.3 Test GET request (Retrieve results)

Trong browser console, chạy:

```javascript
const userId = Auth.getCurrentUser().email;
const results = await QuizStorage.getResults(userId, 'module-2-quiz');
console.log('My quiz results:', results);
```

Nên thấy kết quả quiz vừa làm.

---

## 🎯 STEP 6: GRADE ESSAY QUESTIONS

### 6.1 Xem câu trả lời essay

1. Mở Google Sheet → tab **QuizResults**
2. Tìm column **L** (Answers JSON)
3. Click vào cell để xem câu trả lời
4. Format JSON để dễ đọc (dùng tool online nếu cần)

**Example JSON:**
```json
{
  "e1": {
    "answer": "Dây chuyền bạc 925 size 40cm, 45cm...",
    "timestamp": "2025-12-05T10:30:00Z"
  },
  "e2": {
    "answer": "Thép không gỉ bền hơn, không đen...",
    "timestamp": "2025-12-05T10:32:00Z"
  }
}
```

### 6.2 Chấm điểm essay

**Manual grading (trong Sheet):**

1. Đọc câu trả lời trong column L
2. Đánh giá dựa trên rubric (trong quiz JSON)
3. Nhập điểm vào column **I** (Essay Score)
   - Ví dụ: `3.2` (scale 0-4 vì essayWeight = 0.2)
4. Column **J** (Total Score) sẽ tự cập nhật
5. Nhập feedback vào column **M**
6. Nhập email người chấm vào column **N**
7. Nhập thời gian chấm vào column **O**

**Hoặc dùng API (advanced):**

```javascript
await QuizStorage.gradeEssay({
  resultId: 'uuid-12345',
  essayScore: 3.2,
  feedback: 'Câu trả lời tốt, cần cụ thể hơn ở phần giải thích về bạc S925.',
  gradedBy: 'admin@crushroom.vn'
});
```

---

## 📊 BONUS: ANALYTICS & REPORTS

### View Statistics

Trong Sheet, tạo tab mới: **Analytics**

**Example formulas:**

**Total submissions:**
```
=COUNTA(QuizResults!A:A) - 1
```

**Average score:**
```
=AVERAGE(QuizResults!J:J)
```

**Pass rate:**
```
=COUNTIF(QuizResults!K:K, TRUE) / (COUNTA(QuizResults!K:K) - 1) * 100
```

**Best performer:**
```
=INDEX(QuizResults!B:B, MATCH(MAX(QuizResults!J:J), QuizResults!J:J, 0))
```

### Create Charts

1. Select data range (e.g., columns J:K)
2. Click **Insert** → **Chart**
3. Choose chart type (Column, Pie, etc.)
4. Customize title, labels
5. Click **Insert**

---

## 🔒 SECURITY BEST PRACTICES

### 1. Restrict Access

**Option A: Limit by email domain**

Trong Apps Script, thêm vào đầu mỗi function:

```javascript
function doPost(e) {
  const user = Session.getActiveUser().getEmail();
  const allowedDomain = 'crushroom.vn';

  if (!user.endsWith('@' + allowedDomain)) {
    return createResponse(false, 'Access denied: Invalid domain');
  }

  // Rest of code...
}
```

**Option B: API Key authentication**

1. Generate API key: `const API_KEY = 'your-secret-key-here';`
2. Client gửi key trong headers
3. Server verify key trước khi xử lý

### 2. Data Validation

Thêm validation vào Apps Script:

```javascript
function saveQuizResult(submission) {
  // Validate required fields
  if (!submission.userId || !submission.quizId) {
    return createResponse(false, 'Missing required fields');
  }

  // Validate score range
  if (submission.totalScore < 0 || submission.totalScore > 10) {
    return createResponse(false, 'Invalid score range');
  }

  // Continue...
}
```

### 3. Rate Limiting

Prevent spam submissions:

```javascript
const RATE_LIMIT = 5; // Max 5 submissions per hour per user

function checkRateLimit(userId) {
  const sheet = getSheet('QuizResults');
  const data = sheet.getDataRange().getValues();
  const oneHourAgo = new Date(Date.now() - 3600000);

  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId && new Date(data[i][15]) > oneHourAgo) {
      count++;
    }
  }

  return count < RATE_LIMIT;
}
```

---

## 🐛 TROUBLESHOOTING

### Issue 1: "Authorization required" mỗi lần chạy

**Fix:** Grant permissions permanent

1. Apps Script editor → Click project name
2. **Project Settings** (icon bánh răng)
3. Scroll down → Check **"Show "appsscript.json" manifest file**
4. Quay lại Editor → File `appsscript.json` xuất hiện
5. Thêm vào:
   ```json
   {
     "timeZone": "Asia/Ho_Chi_Minh",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "oauthScopes": [
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/script.external_request"
     ]
   }
   ```

### Issue 2: CORS error khi gọi API

**Fix:** Apps Script automatically handles CORS

Nếu vẫn lỗi:
- Verify deployment type = **Web app**
- Verify "Who has access" = **Anyone**
- Clear browser cache
- Try incognito mode

### Issue 3: Data không lưu vào Sheet

**Debug steps:**

1. Mở Apps Script editor
2. Click **Executions** (icon đồng hồ, sidebar trái)
3. Xem logs của lần execute gần nhất
4. Check error messages

**Common causes:**
- Sheet name sai (phân biệt hoa thường)
- Permissions chưa grant
- JSON parse error

### Issue 4: Slow API response

**Optimize:**

1. Index columns (Sheet không hỗ trợ real index, nhưng có thể sort)
2. Giảm số lượng `getDataRange()` calls
3. Cache data trong Apps Script properties:

```javascript
const cache = CacheService.getScriptCache();
cache.put('quiz_config', JSON.stringify(config), 3600); // Cache 1 hour
```

---

## 📚 ADVANCED FEATURES

### Email Notifications

Gửi email khi quiz submitted:

```javascript
function saveQuizResult(submission) {
  // ... save logic ...

  // Send email notification
  MailApp.sendEmail({
    to: submission.userId,
    subject: '✅ Kết quả quiz Module ' + submission.quizId,
    body: `
      Chào bạn,

      Bạn vừa hoàn thành bài quiz!

      Kết quả:
      - Điểm trắc nghiệm: ${submission.mcqScore}/8
      - Phần tự luận: Đang chờ chấm
      - Tổng điểm hiện tại: ${submission.totalScore}/10

      Giảng viên sẽ chấm phần tự luận trong 24-48h.

      Trân trọng,
      Crush Room Training Team
    `
  });

  return createResponse(true, 'Result saved and email sent');
}
```

### Scheduled Triggers

Tự động remind users chưa làm quiz:

1. Apps Script editor → **Triggers** (icon đồng hồ)
2. Click **Add Trigger**
3. Function: `sendReminders`
4. Event: **Time-driven** → **Day timer** → **9am-10am**
5. Save

```javascript
function sendReminders() {
  const sheet = getSheet('QuizSchedule');
  const today = new Date();

  // Logic to find users who haven't completed quiz
  // Send reminder emails
}
```

### Webhook Integration

Connect to Slack/Discord:

```javascript
function notifySlack(message) {
  const webhookUrl = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';

  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      text: message
    })
  });
}

// Call in saveQuizResult
notifySlack(`🎉 ${submission.userId} vừa hoàn thành quiz với điểm ${submission.totalScore}!`);
```

---

## ✅ CHECKLIST

Sau khi setup xong, verify các items sau:

- [ ] Google Sheet đã tạo với 3 tabs: QuizResults, UserProgress, QuizSchedule
- [ ] Apps Script đã deploy thành công
- [ ] Web App URL đã copy và paste vào `QuizStorage.js`
- [ ] Test submit quiz → data xuất hiện trong Sheet
- [ ] Test retrieve results → lấy được data
- [ ] Essay grading works (manual hoặc API)
- [ ] Email notifications (optional)
- [ ] Analytics dashboard setup (optional)

---

## 🎓 NEXT STEPS

Sau khi backend hoạt động:

1. **Test với real users** - Cho vài người thử làm quiz
2. **Collect feedback** - Hỏi về UX, bugs
3. **Optimize** - Improve based on feedback
4. **Scale** - Create quizzes cho modules khác

**Phase 2:** Progress Tracking
- Track training completion
- Lock quiz until training done

**Phase 3:** Admin Dashboard
- Web UI để view results
- Batch grading interface
- Analytics charts

---

## 📞 SUPPORT

**Nếu gặp vấn đề:**

1. Check **Troubleshooting** section ở trên
2. View Apps Script **Executions** logs
3. Check browser console for errors
4. Test in incognito mode

**Cần help:**
- Open GitHub issue
- Contact dev team

---

**Setup by:** Crush Room Wiki Team
**Last updated:** 2025-12-05
**Version:** 1.0
