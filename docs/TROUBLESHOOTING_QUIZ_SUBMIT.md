# TROUBLESHOOTING: Quiz loading mãi khi nộp bài

## 🔍 DIAGNOSTIC STEPS

### Step 1: Check Browser Console

**Làm ngay:**

1. Trong trang quiz đang loading, nhấn **F12** (hoặc Right-click → Inspect)
2. Chọn tab **Console**
3. Tìm các error màu đỏ

**Common errors:**

#### Error A: CORS Error
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**Fix:** Google Apps Script URL không đúng hoặc chưa deploy

#### Error B: Network Error
```
Failed to fetch
TypeError: Failed to fetch
```
**Fix:** Script URL sai hoặc network issue

#### Error C: 404 Not Found
```
GET https://script.google.com/... 404 (Not Found)
```
**Fix:** Web App URL chưa được copy đúng

---

### Step 2: Verify Script URL

**Check file `js/quiz/quiz-storage.js`:**

1. Mở file: `/home/user/crushroom-wiki/js/quiz/quiz-storage.js`
2. Tìm dòng ~18:
   ```javascript
   static SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```

3. **Đã update chưa?**
   - ❌ Nếu vẫn là `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` → CHƯA UPDATE
   - ✅ Nếu là `https://script.google.com/macros/s/...` → ĐÃ UPDATE

**Nếu chưa update:**

1. Quay lại Google Apps Script
2. **Deploy** → **Manage deployments**
3. Click vào deployment đang active
4. Copy **Web app URL**
5. Paste vào `QuizStorage.js`
6. **Save file** và refresh browser

---

### Step 3: Test Script URL trực tiếp

**Test xem Apps Script có hoạt động không:**

1. Copy Web App URL của bạn
2. Mở tab mới, paste URL vào address bar
3. Add parameter test: `?action=test`
4. Nhấn Enter

**Ví dụ:**
```
https://script.google.com/macros/s/AKfycby.../exec?action=test
```

**Expected response:**
```json
{
  "success": false,
  "message": "Unknown action: test"
}
```

**Nếu thấy response JSON** → Script hoạt động ✅
**Nếu lỗi 404/403** → Script chưa deploy đúng ❌

---

### Step 4: Check Apps Script Deployment

**Verify deployment settings:**

1. Mở Google Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Check deployment hiện tại:
   - **Type:** Web app ✅
   - **Execute as:** Me ✅
   - **Who has access:** **Anyone** ✅ (QUAN TRỌNG!)

**Nếu "Who has access" = "Only myself":**
- Click **Edit** (icon bút)
- Change to **Anyone**
- Click **Deploy**
- Copy **NEW URL** (URL sẽ thay đổi!)
- Update lại `QuizStorage.js`

---

### Step 5: Test với Mock Data

**Bypass backend để test frontend:**

Temporary disable backend call, test local save:

1. Mở browser console (F12)
2. Paste code này:

```javascript
// Test local save (should work immediately)
QuizStorage.SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// Force save to localStorage
const testSubmission = {
  userId: Auth.getCurrentUser().email,
  quizId: 'module-2-quiz',
  mcqScore: 0.4,
  essayScore: 0,
  totalScore: 0.4,
  passed: false
};

const result = await QuizStorage.saveToLocalStorage(testSubmission);
console.log('Local save result:', result);
```

**Nếu local save works** → Vấn đề ở backend connection
**Nếu local save fails** → Vấn đề ở frontend code

---

## 🔧 QUICK FIXES

### FIX A: Update Script URL (Most Common)

Bạn đã update `QuizStorage.js` chưa? Nếu chưa:

```bash
# Mở file
nano /home/user/crushroom-wiki/js/quiz/quiz-storage.js

# Tìm dòng 18, sửa thành:
static SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_URL/exec';

# Save và reload browser
```

### FIX B: Re-deploy Apps Script

Có thể deployment cũ bị lỗi:

1. Apps Script editor → **Deploy** → **Manage deployments**
2. Click **Archive** deployment cũ
3. Click **New deployment**
4. Type: **Web app**
5. Description: **Quiz Backend v1.1**
6. Execute as: **Me**
7. Who has access: **Anyone**
8. **Deploy**
9. Copy **NEW URL**
10. Update `QuizStorage.js`
11. Clear browser cache (Ctrl+Shift+Delete)
12. Reload page

### FIX C: Enable Apps Script Execution API

1. Trong Apps Script, click **Project Settings** (icon bánh răng)
2. Scroll xuống **Google Cloud Platform (GCP) Project**
3. Nếu chưa có, click **Change project**
4. Tạo project mới hoặc link existing project
5. Save
6. Re-deploy

### FIX D: Temporarily use localStorage

Nếu cần test quiz ngay, dùng localStorage thay vì backend:

Không cần sửa gì, QuizStorage đã có fallback:

```javascript
// In QuizStorage.saveResult()
if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
  console.warn('⚠️ Backend URL not configured. Saving to localStorage instead.');
  return this.saveToLocalStorage(submission);
}
```

Quiz sẽ save vào browser localStorage, xem được trong:
- F12 → Application → Local Storage → quiz_results

---

## 🧪 DETAILED DEBUG PROCEDURE

**Chạy từng bước này trong Console:**

```javascript
// 1. Check if QuizStorage loaded
console.log('QuizStorage:', typeof QuizStorage);
// Expected: "function"

// 2. Check Script URL
console.log('Script URL:', QuizStorage.SCRIPT_URL);
// Expected: "https://script.google.com/macros/s/..."

// 3. Test connection
fetch(QuizStorage.SCRIPT_URL + '?action=test')
  .then(r => r.json())
  .then(d => console.log('Backend response:', d))
  .catch(e => console.error('Backend error:', e));
// Expected: {success: false, message: "Unknown action: test"}

// 4. Check current user
console.log('Current user:', Auth.getCurrentUser());
// Expected: {email: "...", name: "..."}

// 5. Check quiz state
console.log('Quiz answers:', window.quizEngine?.userAnswers);
// Expected: Object with answers
```

**Send me output của 5 commands trên**, tôi sẽ biết chính xác vấn đề ở đâu.

---

## 📋 CHECKLIST

Debug theo thứ tự:

- [ ] Check browser Console có errors không (F12)
- [ ] Verify `QuizStorage.SCRIPT_URL` đã update chưa
- [ ] Test Script URL trực tiếp trong browser
- [ ] Check Apps Script deployment: "Who has access" = "Anyone"
- [ ] Re-deploy Apps Script với new URL
- [ ] Clear browser cache và reload
- [ ] Test với localStorage fallback

---

## 🚨 IF ALL ELSE FAILS

**Temporary workaround - Use localStorage:**

1. Keep `QuizStorage.SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';`
2. Quiz sẽ auto-fallback to localStorage
3. Data saved locally in browser
4. Export results: Trong console chạy:
   ```javascript
   QuizStorage.downloadCSV();
   ```
5. Fix backend sau, data vẫn còn trong localStorage

---

## 📞 WHAT TO SEND ME

Để tôi giúp debug nhanh hơn, send:

1. **Screenshot Console errors** (F12 → Console tab)
2. **QuizStorage.SCRIPT_URL value** (console: `QuizStorage.SCRIPT_URL`)
3. **Apps Script deployment URL** (from Google Apps Script)
4. **Output của 5 debug commands** ở trên

Tôi sẽ pinpoint exact issue! 🎯
