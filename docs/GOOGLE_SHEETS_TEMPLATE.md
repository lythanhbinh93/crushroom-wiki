# Google Sheets Structure Template

> Quick reference cho structure của Google Sheets backend

---

## 📊 SHEET 1: QuizResults

**Purpose:** Lưu kết quả quiz của tất cả users

### Columns:

| Column | Field Name | Data Type | Example | Description |
|--------|-----------|-----------|---------|-------------|
| **A** | Result ID | String | `a1b2c3-...` | UUID unique cho mỗi submission |
| **B** | User ID | Email | `nhan@crushroom.vn` | Email của user làm quiz |
| **C** | Quiz ID | String | `module-2-quiz` | ID của quiz |
| **D** | Attempt Number | Number | `1` | Lần thử thứ mấy |
| **E** | Started At | DateTime | `2025-12-05 14:00:00` | Thời điểm bắt đầu |
| **F** | Submitted At | DateTime | `2025-12-05 15:05:30` | Thời điểm nộp bài |
| **G** | Time Spent (s) | Number | `3930` | Thời gian làm bài (seconds) |
| **H** | MCQ Score | Number | `6.4` | Điểm trắc nghiệm (0-8) |
| **I** | Essay Score | Number | `1.5` | Điểm tự luận (0-2) |
| **J** | Total Score | Number | `7.9` | Tổng điểm (0-10) |
| **K** | Passed | Boolean | `TRUE` | Đạt hay không (≥7.0) |
| **L** | Answers (JSON) | JSON Text | `{"q1": {...}}` | Câu trả lời chi tiết |
| **M** | Feedback | Text | `Good job! Improve...` | Feedback từ giảng viên |
| **N** | Graded By | Email | `admin@crushroom.vn` | Email người chấm |
| **O** | Graded At | DateTime | `2025-12-06 09:00:00` | Thời điểm chấm |
| **P** | Created At | DateTime | `2025-12-05 15:05:30` | Timestamp tạo record |

### Sample Data:

```
| A          | B                  | C             | D | E                   | F                   | G    | H   | I   | J   | K    | L        | M          | N                | O                   | P                   |
|------------|--------------------| --------------|---|---------------------|---------------------|------|-----|-----|-----|------|----------|------------|------------------|---------------------|---------------------|
| Result ID  | User ID            | Quiz ID       |Att| Started At          | Submitted At        |Time  | MCQ |Essay|Total|Passed| Answers  | Feedback   | Graded By        | Graded At           | Created At          |
| uuid-001   | nhan@crushroom.vn  | module-2-quiz | 1 | 2025-12-05 14:00:00 | 2025-12-05 15:05:30 | 3930 | 6.4 | 1.5 | 7.9 | TRUE | {...}    | Good job!  | admin@crushroom  | 2025-12-06 09:00:00 | 2025-12-05 15:05:30 |
| uuid-002   | linh@crushroom.vn  | module-2-quiz | 1 | 2025-12-05 14:30:00 | 2025-12-05 15:15:00 | 2700 | 5.2 | 0   | 5.2 | FALSE| {...}    |            |                  |                     | 2025-12-05 15:15:00 |
```

### Usage Notes:

- **Column L (Answers JSON)** contains full quiz data:
  ```json
  {
    "q1": {"answer": "B", "timestamp": "2025-12-05T14:05:00Z"},
    "q2": {"answer": "B", "timestamp": "2025-12-05T14:06:00Z"},
    ...
    "e1": {"answer": "Dây chuyền bạc 925...", "timestamp": "2025-12-05T14:30:00Z"}
  }
  ```

- **Auto-calculated fields:**
  - Column J (Total Score) = H (MCQ) + I (Essay)
  - Column K (Passed) = IF(J >= 7.0, TRUE, FALSE)

- **Manual grading:**
  - Admin fills column I (Essay Score)
  - Update columns M, N, O after grading

---

## 👤 SHEET 2: UserProgress

**Purpose:** Track training progress của users

### Columns:

| Column | Field Name | Data Type | Example | Description |
|--------|-----------|-----------|---------|-------------|
| **A** | User ID | Email | `nhan@crushroom.vn` | Email của user |
| **B** | Module ID | String | `module-2` | ID của module training |
| **C** | Started At | DateTime | `2025-12-01 09:00:00` | Thời điểm bắt đầu học |
| **D** | Completed At | DateTime | `2025-12-03 16:30:00` | Thời điểm hoàn thành (100%) |
| **E** | Progress % | Number | `100` | Tiến độ hoàn thành (0-100) |
| **F** | Time Spent (min) | Number | `180` | Tổng thời gian học (minutes) |
| **G** | Last Accessed | DateTime | `2025-12-03 16:30:00` | Lần truy cập cuối |
| **H** | Sections Completed | JSON Array | `["1.1","1.2","2.1"]` | Các sections đã hoàn thành |

### Sample Data:

```
| A          | B        | C                   | D                   | E   | F   | G                   | H                      |
|------------|----------|---------------------|---------------------|-----|-----|---------------------|------------------------|
| User ID    | Module   | Started At          | Completed At        | %   | Min | Last Accessed       | Sections               |
| nhan@cr.vn | module-1 | 2025-11-28 10:00:00 | 2025-11-30 15:00:00 | 100 | 120 | 2025-11-30 15:00:00 | ["1.1","1.2","2.1"...] |
| nhan@cr.vn | module-2 | 2025-12-01 09:00:00 | 2025-12-03 16:30:00 | 100 | 180 | 2025-12-03 16:30:00 | ["1.1","1.2","1.3"...] |
| linh@cr.vn | module-1 | 2025-12-04 14:00:00 |                     | 65  | 45  | 2025-12-05 10:00:00 | ["1.1","1.2"]          |
```

### Usage Notes:

- **Column D (Completed At)** chỉ được fill khi Progress = 100%
- **Column F (Time Spent)** tăng dần mỗi lần user truy cập module
- **Column H (Sections)** là JSON array chứa danh sách section IDs

---

## 📅 SHEET 3: QuizSchedule

**Purpose:** Quản lý lịch thi, deadline cho quiz

### Columns:

| Column | Field Name | Data Type | Example | Description |
|--------|-----------|-----------|---------|-------------|
| **A** | Schedule ID | String | `sched-001` | Unique ID cho schedule |
| **B** | Quiz ID | String | `module-2-quiz` | Quiz được schedule |
| **C** | Title | String | `Đợt thi Module 2 - T12/2025` | Tên đợt thi |
| **D** | Start Date | DateTime | `2025-12-10 08:00:00` | Ngày bắt đầu mở quiz |
| **E** | End Date | DateTime | `2025-12-15 23:59:59` | Ngày đóng quiz |
| **F** | Target Users | JSON Array | `["nhan@...","linh@..."]` | Users được assign (hoặc "all") |
| **G** | Status | String | `active` | active / scheduled / ended |
| **H** | Created By | Email | `admin@crushroom.vn` | Admin tạo schedule |
| **I** | Created At | DateTime | `2025-12-05 10:00:00` | Timestamp tạo |

### Sample Data:

```
| A          | B             | C                        | D                   | E                   | F              | G      | H               | I                   |
|------------|---------------|--------------------------|---------------------|---------------------|----------------|--------|-----------------|---------------------|
| Schedule ID| Quiz ID       | Title                    | Start Date          | End Date            | Target Users   | Status | Created By      | Created At          |
| sched-001  | module-2-quiz | Đợt thi M2 - T12/2025   | 2025-12-10 08:00:00 | 2025-12-15 23:59:59 | ["all"]        | active | admin@cr.vn     | 2025-12-05 10:00:00 |
| sched-002  | module-1-quiz | Test thử Module 1       | 2025-12-08 09:00:00 | 2025-12-09 18:00:00 | ["nhan@cr.vn"] | ended  | admin@cr.vn     | 2025-12-04 15:00:00 |
```

### Usage Notes:

- **Column F (Target Users):**
  - `["all"]` → Tất cả users có quyền CS
  - `["email1", "email2"]` → Specific users

- **Column G (Status):**
  - `scheduled` → Chưa đến ngày bắt đầu
  - `active` → Đang trong thời gian làm bài
  - `ended` → Đã quá deadline

- **Quiz enforcement:** Frontend check status trước khi cho làm bài

---

## 📐 FORMULAS & CONDITIONAL FORMATTING

### QuizResults Sheet

**Auto-calculate Total Score (Column J):**
```
=H2+I2
```

**Auto-check Passed (Column K):**
```
=IF(J2>=7, TRUE, FALSE)
```

**Conditional Formatting:**

1. **Passed = TRUE** → Row màu xanh nhạt
   - Apply to: Row 2 to last row
   - Format rules: `=$K2=TRUE`
   - Background: Light green (#d9ead3)

2. **Essay Score = 0** → Column I màu vàng
   - Apply to: Column I
   - Format rules: `=$I2=0`
   - Background: Light yellow (#fff2cc)

3. **Total Score < 7** → Column J màu đỏ nhạt
   - Apply to: Column J
   - Format rules: `=$J2<7`
   - Background: Light red (#f4cccc)

### UserProgress Sheet

**Progress bar visualization (Column E):**
- Data bars: Green gradient (0% = white, 100% = green)
- Format → Conditional formatting → Color scale

**Highlight completed modules:**
- Format rule: `=$E2=100`
- Background: Light green

### QuizSchedule Sheet

**Highlight active schedules:**
- Format rule: `=$G2="active"`
- Background: Light blue (#cfe2f3)

**Highlight ended schedules:**
- Format rule: `=$G2="ended"`
- Background: Light gray (#d9d9d9)

---

## 📊 ANALYTICS DASHBOARD (Optional Tab)

Create a new tab: **"Analytics"**

### Key Metrics:

**A. Total Submissions:**
```
=COUNTA(QuizResults!A:A)-1
```

**B. Unique Users:**
```
=COUNTA(UNIQUE(QuizResults!B2:B))
```

**C. Average Score:**
```
=AVERAGE(QuizResults!J2:J)
```

**D. Pass Rate:**
```
=COUNTIF(QuizResults!K:K, TRUE) / (COUNTA(QuizResults!K:K)-1) * 100 & "%"
```

**E. Best Score:**
```
=MAX(QuizResults!J:J)
```

**F. Lowest Score:**
```
=MIN(QuizResults!J:J)
```

**G. Pending Essay Grading:**
```
=COUNTIF(QuizResults!I:I, 0)
```

### Charts:

1. **Score Distribution** (Histogram)
   - Data: Column J (Total Score)
   - Chart: Column chart
   - Buckets: 0-2, 2-4, 4-6, 6-8, 8-10

2. **Pass Rate by Quiz** (Pie Chart)
   - Data: Passed (TRUE) vs Failed (FALSE)
   - Chart: Pie chart
   - Colors: Green (passed), Red (failed)

3. **Submissions Over Time** (Line Chart)
   - Data: Column F (Submitted At) grouped by date
   - Chart: Line chart
   - X-axis: Date, Y-axis: Count

---

## 🔐 SHEET PROTECTION (Optional)

Protect sheets để tránh users edit nhầm:

### Protect QuizResults:
1. Right-click tab → **Protect sheet**
2. Range: **Entire sheet**
3. Permissions: **Only you and admins**
4. Exception: Allow editing Column M (Feedback), I (Essay Score) for graders

### Protect UserProgress:
- Full protection
- Only Apps Script can edit

### Protect QuizSchedule:
- Admins only can edit

---

## 📥 IMPORT/EXPORT

### Export to CSV:

1. File → Download → **Comma-separated values (.csv)**
2. Choose sheet to export

### Import from CSV:

1. File → Import
2. Upload CSV file
3. Choose import location
4. Select **Replace data at selected cell**

### Backup:

**Automatic backup (recommended):**
1. File → Version history → **See version history**
2. Google auto-saves versions
3. Can restore from any version

**Manual backup:**
1. File → Make a copy
2. Name: `Quiz Results Backup - [Date]`
3. Save to specific folder

---

## 🎨 FORMATTING TIPS

### Headers:
- Font: **Bold**, size 11pt
- Background: Light gray (#f3f3f3)
- Freeze: Row 1
- Text alignment: Center

### Data Rows:
- Font: Regular, size 10pt
- Alternating colors: White / Light gray (#f9f9f9)
- Text alignment: Left (text), Right (numbers)

### Columns Width:
- Email columns: 200px
- Date columns: 150px
- Score columns: 80px
- JSON columns: 300px (wrap text)

### Number Formats:
- Score columns (H, I, J): `0.0` (1 decimal)
- Progress % (E): `0%`
- Time Spent (F, G): `#,##0` (integer with comma)

---

## ✅ VERIFICATION CHECKLIST

Sau khi tạo xong sheets, verify:

**Sheet Structure:**
- [ ] QuizResults has 16 columns (A-P)
- [ ] UserProgress has 8 columns (A-H)
- [ ] QuizSchedule has 9 columns (A-I)
- [ ] All headers are bold and frozen
- [ ] Column widths are readable

**Formulas:**
- [ ] Total Score auto-calculates (J = H + I)
- [ ] Passed auto-checks (K = J >= 7)
- [ ] Analytics formulas work

**Formatting:**
- [ ] Conditional formatting applied
- [ ] Colors make sense (green = good, red = bad)
- [ ] Data bars show progress clearly

**Protection:**
- [ ] Sheets are protected (if needed)
- [ ] Only authorized users can edit

**Backup:**
- [ ] Version history enabled
- [ ] Manual backup created

---

**Template by:** Crush Room Wiki Team
**Last updated:** 2025-12-05
**Version:** 1.0
