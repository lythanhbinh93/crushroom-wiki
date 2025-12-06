# CS Training & Quiz System - Kiến Trúc Mở Rộng

> **Document Version:** 1.0
> **Date:** 2025-12-04
> **Purpose:** Đề xuất kiến trúc scalable cho CS Training & Quiz System dài hạn

---

## 📊 TÓM TẮT EXECUTIVE

### Vấn đề hiện tại
- Quiz data hardcoded trong HTML → không scalable
- Không có backend persistence → mất dữ liệu quiz results
- Chỉ có quiz cho Module 2 → 4 modules còn lại thiếu quiz
- Không track progress training → không ép buộc học trước khi thi
- Mỗi quiz là 1 file riêng → duplicate code, khó maintain

### Giải pháp đề xuất
✅ **Centralized Data Layer** - Tách data ra khỏi UI
✅ **Modular Quiz Engine** - 1 engine chạy tất cả quiz
✅ **Progress Tracking System** - Track training completion & quiz attempts
✅ **Google Sheets Backend** - Persistent storage for results
✅ **Admin Dashboard** - Quản lý quiz, view reports, configure settings

---

## 🏗️ KIẾN TRÚC MỚI

### 1. TỔNG QUAN HỆ THỐNG

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Training   │  │     Quiz     │  │    Admin     │          │
│  │    Viewer    │  │    Player    │  │   Dashboard  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼───────────────────┐
│         │        APPLICATION / BUSINESS LAYER  │                   │
├─────────┼──────────────────┼──────────────────┼───────────────────┤
│         │                  │                  │                   │
│  ┌──────▼────────┐  ┌──────▼────────┐  ┌──────▼────────┐        │
│  │   Progress    │  │     Quiz      │  │   Analytics   │        │
│  │   Tracker     │  │    Engine     │  │    Service    │        │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘        │
│         │                   │                   │                 │
│         └───────────────────┼───────────────────┘                 │
│                             │                                     │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────┐
│                        DATA LAYER                                 │
├─────────────────────────────┼─────────────────────────────────────┤
│                             │                                     │
│  ┌──────────────┐  ┌────────▼──────┐  ┌──────────────┐          │
│  │  Quiz Data   │  │  User Progress│  │ Quiz Results │          │
│  │   (JSON)     │  │ (Google Sheet)│  │(Google Sheet)│          │
│  └──────────────┘  └───────────────┘  └──────────────┘          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📂 CẤU TRÚC FILE MỚI

```
crushroom-wiki/
│
├── index.html
├── login.html
├── admin.html                    # Enhanced admin panel
│
├── css/
│   ├── style.css
│   └── quiz-player.css          # 🆕 Dedicated quiz styles
│
├── js/
│   ├── auth.js                  # Existing auth
│   ├── main.js                  # Common utilities
│   ├── schedule.js
│   ├── schedule-admin.js
│   │
│   ├── quiz/                    # 🆕 Quiz Module
│   │   ├── quiz-engine.js       # Core quiz player (reusable)
│   │   ├── quiz-renderer.js     # UI rendering logic
│   │   ├── quiz-timer.js        # Timer component
│   │   ├── quiz-grader.js       # Scoring logic
│   │   ├── quiz-storage.js      # Backend communication
│   │   └── quiz-pdf.js          # PDF export
│   │
│   ├── training/                # 🆕 Training Module
│   │   ├── progress-tracker.js  # Track completion
│   │   ├── content-loader.js    # Dynamic content loading
│   │   └── navigation.js        # Module navigation
│   │
│   └── admin/                   # 🆕 Admin Module
│       ├── quiz-manager.js      # CRUD quiz configs
│       ├── analytics.js         # View reports
│       └── schedule-quiz.js     # Schedule quiz sessions
│
├── data/                        # 🆕 Data Layer (JSON)
│   ├── quiz/
│   │   ├── config.json          # Quiz metadata
│   │   ├── module-1-quiz.json   # M1 questions
│   │   ├── module-2-quiz.json   # M2 questions (migrate from HTML)
│   │   ├── module-3-quiz.json   # M3 questions
│   │   ├── module-4-quiz.json   # M4 questions
│   │   └── module-5-quiz.json   # M5 questions
│   │
│   └── training/
│       └── modules-config.json  # Module metadata
│
├── pages/
│   ├── cs/
│   │   ├── library.html
│   │   ├── quiz.html            # 🔄 Enhanced - Universal quiz player
│   │   ├── quiz-m2.html         # 🗑️ Deprecated (migrate to quiz.html)
│   │   ├── quick-replies.html
│   │   │
│   │   ├── training/            # Enhanced with progress tracking
│   │   │   ├── module-1-foundation.html
│   │   │   ├── module-2-products.html
│   │   │   ├── module-3-consulting.html
│   │   │   ├── module-4-advanced.html
│   │   │   └── module-5-cases.html
│   │   │
│   │   ├── products/
│   │   └── skills/
│   │
│   └── admin/
│       ├── quiz-management.html # 🆕 Quiz CRUD interface
│       └── reports.html         # 🆕 Analytics dashboard
│
└── docs/                        # Documentation
    ├── CS_TRAINING_QUIZ_ARCHITECTURE.md  # This file
    └── API_SPECIFICATION.md     # 🆕 Backend API docs
```

---

## 💾 DATA MODELS

### 1. Quiz Configuration (`data/quiz/config.json`)

```json
{
  "quizzes": [
    {
      "id": "cs-module-1",
      "title": "Kiểm tra Module 1: Nền tảng",
      "moduleId": "module-1",
      "category": "cs",
      "version": "1.0",
      "status": "active",
      "settings": {
        "totalQuestions": 30,
        "mcqCount": 25,
        "essayCount": 5,
        "timeLimit": 45,
        "passingScore": 7.0,
        "maxAttempts": 3,
        "shuffleQuestions": true,
        "shuffleOptions": true,
        "showCorrectAnswers": false,
        "allowReview": true
      },
      "prerequisites": {
        "requiredModules": [],
        "requiredQuizzes": [],
        "minTrainingProgress": 100
      },
      "scheduling": {
        "enabled": false,
        "startDate": null,
        "endDate": null,
        "allowedDays": [1, 2, 3, 4, 5],
        "allowedTimeRange": {
          "start": "09:00",
          "end": "18:00"
        }
      },
      "grading": {
        "mcqWeight": 0.6,
        "essayWeight": 0.4,
        "autoGrade": true,
        "manualReview": true
      }
    }
  ]
}
```

### 2. Quiz Questions (`data/quiz/module-1-quiz.json`)

```json
{
  "quizId": "cs-module-1",
  "version": "1.0",
  "lastUpdated": "2025-12-04",
  "questions": {
    "mcq": [
      {
        "id": "m1-q1",
        "type": "single-choice",
        "category": "brand-story",
        "difficulty": "easy",
        "points": 1,
        "question": "Crush Room được thành lập vào năm nào?",
        "options": [
          {"id": "A", "text": "2018"},
          {"id": "B", "text": "2019"},
          {"id": "C", "text": "2020"},
          {"id": "D", "text": "2021"}
        ],
        "correctAnswer": "B",
        "explanation": "Crush Room được thành lập năm 2019 với sứ mệnh lưu giữ kỷ niệm đẹp.",
        "reference": "Module 1 - Phần 1.1"
      },
      {
        "id": "m1-q2",
        "type": "multiple-choice",
        "category": "customer-persona",
        "difficulty": "medium",
        "points": 2,
        "question": "Những đặc điểm nào sau đây thuộc về persona 'Cô gái lãng mạn'?",
        "options": [
          {"id": "A", "text": "Thích sự đơn giản, tinh tế"},
          {"id": "B", "text": "Yêu thích những câu chuyện tình yêu"},
          {"id": "C", "text": "Quan tâm đến giá cả hơn chất lượng"},
          {"id": "D", "text": "Thích sản phẩm có tính cá nhân hóa cao"}
        ],
        "correctAnswers": ["A", "B", "D"],
        "explanation": "Persona 'Cô gái lãng mạn' thường đánh giá cao sự tinh tế, câu chuyện tình cảm và tính cá nhân hóa.",
        "reference": "Module 1 - Phần 2.1"
      }
    ],
    "essay": [
      {
        "id": "m1-e1",
        "type": "short-answer",
        "category": "brand-values",
        "difficulty": "medium",
        "points": 10,
        "question": "Hãy mô tả bằng lời của bạn: 3 giá trị cốt lõi của Crush Room là gì và tại sao chúng quan trọng với khách hàng?",
        "minWords": 100,
        "maxWords": 200,
        "rubric": {
          "criteria": [
            {
              "name": "Chính xác",
              "weight": 0.4,
              "description": "Nêu đúng 3 giá trị cốt lõi"
            },
            {
              "name": "Giải thích rõ ràng",
              "weight": 0.3,
              "description": "Giải thích tại sao mỗi giá trị quan trọng"
            },
            {
              "name": "Ví dụ thực tế",
              "weight": 0.3,
              "description": "Đưa ra ví dụ hoặc tình huống cụ thể"
            }
          ]
        },
        "sampleAnswer": "Ba giá trị cốt lõi của Crush Room là: 1) Chất lượng vượt trội...",
        "reference": "Module 1 - Phần 1.2"
      }
    ]
  }
}
```

### 3. User Progress (`Google Sheet: UserProgress`)

| Column | Type | Description |
|--------|------|-------------|
| `userId` | String | Email của user |
| `moduleId` | String | module-1, module-2, etc. |
| `startedAt` | Timestamp | Thời điểm bắt đầu học |
| `completedAt` | Timestamp | Thời điểm hoàn thành |
| `progress` | Number | % hoàn thành (0-100) |
| `timeSpent` | Number | Thời gian học (minutes) |
| `lastAccessed` | Timestamp | Lần truy cập cuối |
| `sectionsCompleted` | JSON | Array sections đã đọc |

**Example:**
```
userId: nhan@crushroom.vn
moduleId: module-1
startedAt: 2025-12-01 09:00:00
completedAt: 2025-12-01 10:30:00
progress: 100
timeSpent: 90
lastAccessed: 2025-12-01 10:30:00
sectionsCompleted: ["1.1", "1.2", "1.3", "2.1", "2.2"]
```

### 4. Quiz Results (`Google Sheet: QuizResults`)

| Column | Type | Description |
|--------|------|-------------|
| `resultId` | String | Unique ID (UUID) |
| `userId` | String | Email |
| `quizId` | String | cs-module-1 |
| `attemptNumber` | Number | Lần thi thứ mấy |
| `startedAt` | Timestamp | Thời điểm bắt đầu |
| `submittedAt` | Timestamp | Thời điểm nộp bài |
| `timeSpent` | Number | Thời gian làm (seconds) |
| `mcqScore` | Number | Điểm trắc nghiệm |
| `essayScore` | Number | Điểm tự luận |
| `totalScore` | Number | Tổng điểm (0-10) |
| `passed` | Boolean | Có đạt không |
| `answers` | JSON | Chi tiết câu trả lời |
| `feedback` | String | Phản hồi từ giảng viên |
| `gradedBy` | String | Email người chấm |
| `gradedAt` | Timestamp | Thời điểm chấm |

**Example:**
```json
{
  "resultId": "uuid-12345",
  "userId": "nhan@crushroom.vn",
  "quizId": "cs-module-1",
  "attemptNumber": 1,
  "startedAt": "2025-12-01T14:00:00Z",
  "submittedAt": "2025-12-01T14:42:15Z",
  "timeSpent": 2535,
  "mcqScore": 4.8,
  "essayScore": 3.5,
  "totalScore": 8.3,
  "passed": true,
  "answers": {
    "mcq": {
      "m1-q1": "B",
      "m1-q2": ["A", "B", "D"]
    },
    "essay": {
      "m1-e1": "Ba giá trị cốt lõi của Crush Room là..."
    }
  }
}
```

### 5. Quiz Schedule (`Google Sheet: QuizSchedule`)

| Column | Type | Description |
|--------|------|-------------|
| `scheduleId` | String | Unique ID |
| `quizId` | String | cs-module-1 |
| `title` | String | Tên đợt thi |
| `startDate` | Timestamp | Ngày bắt đầu |
| `endDate` | Timestamp | Ngày kết thúc |
| `targetUsers` | JSON | Array emails hoặc "all" |
| `status` | String | scheduled, active, ended |
| `createdBy` | String | Email admin |
| `createdAt` | Timestamp | Thời điểm tạo |

---

## 🔧 CORE COMPONENTS

### 1. Quiz Engine (`/js/quiz/quiz-engine.js`)

**Responsibilities:**
- Load quiz configuration & questions from JSON
- Manage quiz state (current question, timer, user answers)
- Handle user interactions (answer selection, navigation)
- Validate quiz prerequisites (training completion, previous quizzes)
- Submit answers to backend

**Key Methods:**
```javascript
class QuizEngine {
  constructor(quizId) {}

  async initialize() {}          // Load quiz data
  async checkPrerequisites() {}  // Verify user can take quiz
  startQuiz() {}                 // Begin quiz session
  nextQuestion() {}              // Navigate forward
  previousQuestion() {}          // Navigate backward
  saveAnswer(questionId, answer) {}
  async submitQuiz() {}          // Send results to backend
  pauseQuiz() {}                 // Save progress
  resumeQuiz() {}                // Continue from saved state
}
```

### 2. Progress Tracker (`/js/training/progress-tracker.js`)

**Responsibilities:**
- Track time spent on training modules
- Mark sections as read/completed
- Calculate completion percentage
- Send progress updates to backend
- Check prerequisites before quiz

**Key Methods:**
```javascript
class ProgressTracker {
  constructor(moduleId) {}

  async initialize() {}              // Load user's progress
  markSectionComplete(sectionId) {}  // User finished a section
  updateProgress() {}                // Calculate % complete
  async syncToBackend() {}           // Save to Google Sheets
  getModuleProgress() {}             // Get completion status
  getTimeSpent() {}                  // Total time on module
}
```

### 3. Quiz Storage (`/js/quiz/quiz-storage.js`)

**Responsibilities:**
- Communication with Google Sheets backend
- Save quiz results
- Load user's quiz history
- Handle retry logic for network failures

**Key Methods:**
```javascript
class QuizStorage {
  static async saveResult(quizResult) {}
  static async getResults(userId, quizId) {}
  static async getAllResults(userId) {}
  static async updateProgress(progressData) {}
  static async getProgress(userId, moduleId) {}
  static async getQuizSchedule(quizId) {}
}
```

### 4. Admin Quiz Manager (`/js/admin/quiz-manager.js`)

**Responsibilities:**
- CRUD operations for quiz configurations
- Schedule quiz sessions
- View and grade essay questions
- Generate reports

**Key Features:**
- Create new quiz configurations
- Edit question banks
- Schedule quiz sessions for specific users/groups
- Grade essay questions manually
- Export results to CSV/Excel
- View analytics (pass rate, average score, question difficulty)

---

## 🔄 USER FLOWS

### Flow 1: Training Module Completion

```
User visits Module 1
    ↓
ProgressTracker.initialize()
    ↓
User scrolls through content
    ↓
Scroll event triggers → markSectionComplete()
    ↓
Progress: 0% → 20% → 40% → 60% → 80% → 100%
    ↓
On 100% → syncToBackend() → Save to Google Sheets
    ↓
Show completion badge + "Bạn đã hoàn thành Module 1"
    ↓
Unlock Quiz 1 button
```

### Flow 2: Taking a Quiz

```
User clicks "Làm bài kiểm tra Module 1"
    ↓
QuizEngine.checkPrerequisites()
    ├─ Check: Module 1 training complete? ✓
    ├─ Check: Previous attempts < maxAttempts? ✓
    └─ Check: Quiz schedule active? ✓
    ↓
QuizEngine.initialize() → Load questions from JSON
    ↓
Shuffle questions & options (if enabled)
    ↓
Show quiz instructions + Start button
    ↓
User clicks "Bắt đầu"
    ↓
QuizEngine.startQuiz() → Timer starts
    ↓
User answers questions
    ├─ MCQ: Click options → saveAnswer()
    └─ Essay: Type text → saveAnswer() (auto-save every 10s)
    ↓
User clicks "Nộp bài" OR Timer expires
    ↓
QuizEngine.submitQuiz()
    ├─ Calculate MCQ score (auto-grading)
    ├─ Essay score = 0 (pending manual grading)
    └─ Send to QuizStorage.saveResult()
    ↓
Show results page
    ├─ MCQ Score: 6.0/6.0
    ├─ Essay Score: Đang chờ chấm
    └─ Status: Pending
    ↓
Admin grades essays → Update totalScore → passed/failed
```

### Flow 3: Admin Grading Essays

```
Admin opens "Reports" dashboard
    ↓
Filter: Pending grading
    ↓
See list of submissions with essay questions
    ↓
Click a submission → View essay answers
    ↓
For each essay:
    ├─ Read student answer
    ├─ Compare with rubric
    ├─ Assign points (0-10)
    └─ Add feedback comment
    ↓
Submit grades
    ↓
Backend calculates totalScore
    ↓
Update QuizResults sheet
    ↓
Send notification to user (optional)
```

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
**Goal:** Setup data layer + core quiz engine

**Tasks:**
1. ✅ Create `/data/quiz/` folder structure
2. ✅ Define JSON schemas for quiz config & questions
3. ✅ Build `QuizEngine` class (load, navigate, save answers)
4. ✅ Build `QuizRenderer` class (display questions, options)
5. ✅ Build `QuizTimer` component
6. ✅ Create Google Sheet: `QuizResults`
7. ✅ Build `QuizStorage` class (save results to Sheets)
8. ✅ Migrate Module 2 quiz from HTML to JSON
9. ✅ Update `quiz.html` to use QuizEngine

**Deliverables:**
- Working quiz player for Module 2 (using new engine)
- Data stored in Google Sheets

---

### Phase 2: Progress Tracking (Week 3)
**Goal:** Track training completion

**Tasks:**
1. ✅ Create Google Sheet: `UserProgress`
2. ✅ Build `ProgressTracker` class
3. ✅ Add scroll tracking to training modules
4. ✅ Show progress bar on each module
5. ✅ Lock quiz until module 100% complete
6. ✅ Add "completion badge" UI

**Deliverables:**
- Users must complete training before quiz
- Progress visible in UI

---

### Phase 3: Quiz Expansion (Week 4-5)
**Goal:** Create quizzes for all modules

**Tasks:**
1. ✅ Create `module-1-quiz.json` (30 questions)
2. ✅ Create `module-3-quiz.json` (35 questions)
3. ✅ Create `module-4-quiz.json` (30 questions)
4. ✅ Create `module-5-quiz.json` (25 questions)
5. ✅ Test each quiz with QuizEngine
6. ✅ Update `config.json` with all quiz metadata

**Deliverables:**
- 5 complete quizzes (1 per module)
- All using centralized engine

---

### Phase 4: Admin Dashboard (Week 6-7)
**Goal:** Admin tools for quiz management

**Tasks:**
1. ✅ Create `/pages/admin/quiz-management.html`
2. ✅ Build UI for viewing quiz results
3. ✅ Build essay grading interface
4. ✅ Create analytics dashboard (pass rate, avg score)
5. ✅ Add quiz scheduling UI
6. ✅ Create Google Sheet: `QuizSchedule`
7. ✅ Implement schedule enforcement

**Deliverables:**
- Admin can grade essays
- Admin can schedule quizzes
- Analytics visible

---

### Phase 5: Advanced Features (Week 8+)
**Goal:** Polish & advanced features

**Tasks:**
1. ⚡ Question bank management (add/edit questions via UI)
2. ⚡ Randomized quiz generation (pick N questions from pool)
3. ⚡ Retry quiz with cooldown period
4. ⚡ Certificate generation on passing
5. ⚡ Email notifications (quiz assigned, results ready)
6. ⚡ Mobile app support (responsive quiz player)
7. ⚡ Offline mode (cache questions, sync later)
8. ⚡ Leaderboard (top performers)

**Deliverables:**
- Production-ready system
- Full feature set

---

## 📈 MIGRATION STRATEGY

### Step 1: Parallel System (No Disruption)
- Keep `quiz-m2.html` working as-is
- Build new system alongside
- Test with small group (admins + volunteers)

### Step 2: Soft Launch
- Enable new `quiz.html` for Module 1 only (no existing quiz)
- Collect feedback
- Fix bugs

### Step 3: Module 2 Migration
- Extract questions from `quiz-m2.html` → `module-2-quiz.json`
- Add migration banner: "Hệ thống quiz mới đã sẵn sàng!"
- Users can choose old or new for 2 weeks
- Track issues

### Step 4: Full Cutover
- Redirect `quiz-m2.html` → `quiz.html?module=2`
- Keep old file for 1 month (emergency fallback)
- Delete after confirmed stable

### Step 5: Expand
- Launch quizzes for Module 3, 4, 5
- Enable progress tracking
- Launch admin dashboard

---

## 🔐 SECURITY & PERMISSIONS

### Access Control Matrix

| Feature | Admin | CS Staff | Restricted |
|---------|-------|----------|------------|
| View training | ✅ | ✅ | ❌ |
| Take quiz | ✅ | ✅ | ❌ |
| View own results | ✅ | ✅ | ❌ |
| View all results | ✅ | ❌ | ❌ |
| Grade essays | ✅ | ❌ | ❌ |
| Edit questions | ✅ | ❌ | ❌ |
| Schedule quizzes | ✅ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ |

### Data Protection
- Quiz answers encrypted in transit (HTTPS)
- Google Sheets protected (only App Script has write access)
- No client-side storage of correct answers
- Essay answers stored in backend only (not localStorage)

---

## 📊 SUCCESS METRICS

### Week 1-2 (Foundation)
- ✅ QuizEngine successfully loads Module 2 questions
- ✅ Users can complete quiz end-to-end
- ✅ Results saved to Google Sheets (100% success rate)

### Week 3 (Progress Tracking)
- ✅ 95%+ of training completions tracked accurately
- ✅ Quiz button locked until training complete
- ✅ 0 users bypass prerequisite check

### Week 4-5 (Quiz Expansion)
- ✅ 5 quizzes live (Modules 1-5)
- ✅ 90%+ user satisfaction score
- ✅ <5% bug report rate

### Week 6-7 (Admin Dashboard)
- ✅ Admin can grade 10 essays in <15 minutes
- ✅ Analytics dashboard loads in <2 seconds
- ✅ 100% of scheduled quizzes enforce correctly

### Week 8+ (Production)
- ✅ 100+ quizzes taken per month
- ✅ 80%+ pass rate on first attempt
- ✅ <1% technical failure rate
- ✅ 0 data loss incidents

---

## 🛠️ TECHNICAL SPECIFICATIONS

### Frontend Stack
- **HTML5** - Semantic markup
- **CSS3** - Responsive design (existing `style.css`)
- **Vanilla JavaScript (ES6+)** - No frameworks needed
- **Web APIs** - localStorage, Fetch API, Web Workers (optional)

### Backend Stack
- **Google Sheets** - Data storage
- **Google Apps Script** - Backend API
- **JSON** - Data interchange format

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance Targets
- Quiz load time: <1s
- Question navigation: <100ms
- Submit quiz: <2s
- Admin dashboard: <3s page load

---

## 📝 API ENDPOINTS (Google Apps Script)

### 1. Save Quiz Result
```javascript
POST /api/quiz/submit
Body: {
  userId: "nhan@crushroom.vn",
  quizId: "cs-module-1",
  answers: {...},
  timeSpent: 2535
}
Response: {
  success: true,
  resultId: "uuid-12345",
  score: { mcq: 4.8, essay: 0, total: 4.8 },
  passed: false // pending essay grading
}
```

### 2. Get User Progress
```javascript
GET /api/progress?userId=nhan@crushroom.vn&moduleId=module-1
Response: {
  success: true,
  progress: {
    moduleId: "module-1",
    progress: 100,
    completedAt: "2025-12-01T10:30:00Z",
    sectionsCompleted: ["1.1", "1.2", "1.3"]
  }
}
```

### 3. Update Progress
```javascript
POST /api/progress/update
Body: {
  userId: "nhan@crushroom.vn",
  moduleId: "module-1",
  sectionId: "1.2",
  timeSpent: 15
}
Response: {
  success: true,
  progress: 40
}
```

### 4. Get Quiz Results
```javascript
GET /api/quiz/results?userId=nhan@crushroom.vn&quizId=cs-module-1
Response: {
  success: true,
  results: [
    {
      attemptNumber: 1,
      totalScore: 8.3,
      passed: true,
      submittedAt: "2025-12-01T14:42:15Z"
    }
  ]
}
```

### 5. Grade Essay (Admin Only)
```javascript
POST /api/quiz/grade-essay
Body: {
  resultId: "uuid-12345",
  essayScores: {
    "m1-e1": 8.5,
    "m1-e2": 7.0
  },
  feedback: "Câu trả lời tốt, cần cụ thể hơn ở phần 2.",
  gradedBy: "admin@crushroom.vn"
}
Response: {
  success: true,
  totalScore: 8.1,
  passed: true
}
```

---

## 🎨 UI/UX IMPROVEMENTS

### Quiz Player Enhancements
1. **Progress Indicator**
   ```
   [=====>    ] 5/10 câu
   ```

2. **Question Palette**
   ```
   [1✓] [2✓] [3✓] [4] [5] [6] [7] [8] [9] [10]
   ```
   - Green = answered
   - White = not answered
   - Click to jump

3. **Timer Visual**
   ```
   ⏰ 42:15 còn lại
   ```
   - Turn yellow at 10 mins
   - Turn red at 5 mins
   - Blink at 1 min

4. **Essay Word Counter**
   ```
   📝 125/200 từ (Min: 100)
   ```

5. **Auto-save Indicator**
   ```
   💾 Đã lưu lúc 14:32:15
   ```

### Training Module Enhancements
1. **Progress Bar**
   ```
   Module 1: Nền tảng
   [=========>    ] 75% hoàn thành
   ```

2. **Section Checklist**
   ```
   ✅ 1.1 Giới thiệu Crush Room
   ✅ 1.2 Giá trị cốt lõi
   ⬜ 1.3 Văn hóa CS
   ```

3. **Time Badge**
   ```
   ⏱️ Bạn đã học: 1h 25phút
   ```

4. **Next Steps**
   ```
   🎉 Hoàn thành Module 1!

   Tiếp theo:
   📚 Module 2: Sản phẩm
   📝 Làm bài kiểm tra Module 1
   ```

---

## 🔍 QUALITY ASSURANCE

### Testing Checklist

#### Unit Tests
- [ ] QuizEngine loads questions correctly
- [ ] Timer counts down accurately
- [ ] Grader calculates scores correctly
- [ ] ProgressTracker computes % accurately
- [ ] Storage saves/loads data without corruption

#### Integration Tests
- [ ] Quiz submission saves to Google Sheets
- [ ] Progress updates sync to backend
- [ ] Admin can grade essays and update scores
- [ ] Schedule enforcement prevents early/late access

#### E2E Tests
- [ ] User completes training → unlocks quiz
- [ ] User takes quiz → sees results
- [ ] Admin grades essay → user sees updated score
- [ ] User retries quiz after cooling period

#### Browser Tests
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Mobile responsive (phone, tablet)
- [ ] No console errors
- [ ] HTTPS works

#### Performance Tests
- [ ] Quiz loads in <1s (even with 50 questions)
- [ ] No memory leaks (check after 30 mins)
- [ ] Background sync doesn't block UI

---

## 🚧 KNOWN LIMITATIONS & FUTURE WORK

### Current Limitations
1. **No Offline Mode** - Requires internet to save answers
2. **No Real-time Collaboration** - Admin can't watch users take quiz live
3. **Limited Question Types** - Only MCQ and essay (no drag-drop, matching, etc.)
4. **Manual Essay Grading** - No AI-assisted grading yet
5. **No Adaptive Testing** - Difficulty doesn't adjust based on performance

### Future Enhancements (Post-Phase 5)
1. **AI Essay Grading** - Use GPT-4 to suggest scores + feedback
2. **Video Questions** - Embed videos, ask questions about content
3. **Gamification** - Badges, points, leaderboards
4. **Social Features** - Share results, challenge colleagues
5. **Mobile App** - Native iOS/Android app
6. **Advanced Analytics** - Item analysis, difficulty calibration
7. **Multi-language Support** - English quiz versions
8. **Integrations** - Slack notifications, Calendar reminders

---

## 📞 SUPPORT & MAINTENANCE

### Code Ownership
- **Quiz Engine:** Development Team
- **Data Layer:** Backend Team
- **Admin Dashboard:** Product Team
- **Training Content:** CS Team

### Documentation
- **API Docs:** `/docs/API_SPECIFICATION.md`
- **User Guide:** `/docs/USER_GUIDE.md`
- **Admin Manual:** `/docs/ADMIN_MANUAL.md`

### Monitoring
- **Error Tracking:** Google Apps Script logs
- **Usage Analytics:** Google Sheets (QuizResults, UserProgress)
- **Performance:** Browser DevTools + Lighthouse

### Backup Strategy
- **Data Backup:** Google Sheets auto-backup (daily)
- **Code Backup:** Git repository
- **Recovery Time:** <1 hour for data loss

---

## ✅ APPROVAL & SIGN-OFF

### Stakeholders
- [ ] Product Owner - Approved architecture?
- [ ] CS Manager - Training flow acceptable?
- [ ] Tech Lead - Technical feasibility confirmed?
- [ ] Admin Team - Admin tools sufficient?

### Next Steps
1. Review this document with stakeholders
2. Get approval to proceed
3. Kick off Phase 1 development
4. Weekly progress reviews

---

## 📌 APPENDIX

### A. Glossary
- **MCQ:** Multiple Choice Question
- **Essay:** Open-ended text question
- **Rubric:** Grading criteria for essays
- **Progress Tracking:** Monitoring training completion
- **Quiz Engine:** Core quiz player logic

### B. References
- Google Apps Script Docs: https://developers.google.com/apps-script
- JSON Schema: https://json-schema.org/
- Web APIs: https://developer.mozilla.org/en-US/docs/Web/API

### C. Change Log
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-04 | Claude | Initial architecture proposal |

---

**Document Owner:** Development Team
**Last Updated:** 2025-12-04
**Status:** Draft - Awaiting Approval
