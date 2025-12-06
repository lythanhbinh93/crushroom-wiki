# CS Training & Quiz - Quick Start Implementation Guide

> **Goal:** Hướng dẫn bắt đầu implement kiến trúc mới ngay lập tức
> **Time to First Working Version:** 2-3 days
> **Difficulty:** Medium

---

## 🎯 PHASE 1: FOUNDATION (Start Here!)

### Step 1: Create Data Structure (30 minutes)

#### 1.1 Create folders
```bash
cd /home/user/crushroom-wiki
mkdir -p data/quiz
mkdir -p data/training
mkdir -p js/quiz
mkdir -p js/training
mkdir -p js/admin
mkdir -p pages/admin
```

#### 1.2 Create quiz config file
Create `data/quiz/config.json`:

```json
{
  "quizzes": [
    {
      "id": "cs-module-2",
      "title": "Kiểm tra Module 2: Sản phẩm",
      "moduleId": "module-2",
      "category": "cs",
      "version": "1.0",
      "status": "active",
      "settings": {
        "totalQuestions": 50,
        "mcqCount": 40,
        "essayCount": 10,
        "timeLimit": 60,
        "passingScore": 7.0,
        "maxAttempts": 3,
        "shuffleQuestions": false,
        "shuffleOptions": false,
        "showCorrectAnswers": false,
        "allowReview": true
      },
      "prerequisites": {
        "requiredModules": [],
        "requiredQuizzes": [],
        "minTrainingProgress": 0
      },
      "grading": {
        "mcqWeight": 0.8,
        "essayWeight": 0.2,
        "autoGrade": true,
        "manualReview": true
      }
    }
  ]
}
```

---

### Step 2: Extract Quiz Data from quiz-m2.html (1 hour)

#### 2.1 Create module-2-quiz.json

Create `data/quiz/module-2-quiz.json`:

```json
{
  "quizId": "cs-module-2",
  "version": "1.0",
  "lastUpdated": "2025-12-04",
  "questions": {
    "mcq": [
      {
        "id": "m2-q1",
        "type": "single-choice",
        "question": "COUPLEPIX cơ bản có kích thước nào?",
        "options": [
          {"id": "A", "text": "20x30 cm"},
          {"id": "B", "text": "30x40 cm"},
          {"id": "C", "text": "40x60 cm"},
          {"id": "D", "text": "50x70 cm"}
        ],
        "correctAnswer": "B"
      }
      // TODO: Add all 40 MCQ questions from quiz-m2.html
    ],
    "essay": [
      {
        "id": "m2-e1",
        "type": "short-answer",
        "question": "Liệt kê các sản phẩm chính của Crush Room và giá bán tương ứng.",
        "minWords": 50,
        "maxWords": 200
      }
      // TODO: Add all 10 essay questions from quiz-m2.html
    ]
  }
}
```

**Action:** Manually copy questions from `pages/cs/quiz-m2.html` (lines 411-420 for answer key, HTML for questions)

---

### Step 3: Build Core Quiz Engine (2-3 hours)

#### 3.1 Create QuizEngine class

Create `js/quiz/quiz-engine.js`:

```javascript
/**
 * QuizEngine - Core quiz player logic
 * Handles loading, navigation, answer storage, and submission
 */
class QuizEngine {
  constructor(quizId) {
    this.quizId = quizId;
    this.config = null;
    this.questions = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.startTime = null;
    this.timer = null;
  }

  /**
   * Initialize quiz - Load config and questions from JSON
   */
  async initialize() {
    try {
      // Load config
      const configResponse = await fetch('/data/quiz/config.json');
      const configData = await configResponse.json();
      this.config = configData.quizzes.find(q => q.id === this.quizId);

      if (!this.config) {
        throw new Error(`Quiz ${this.quizId} not found in config`);
      }

      // Load questions
      const questionsResponse = await fetch(`/data/quiz/${this.quizId}.json`);
      this.questions = await questionsResponse.json();

      console.log('Quiz initialized:', this.config.title);
      return true;
    } catch (error) {
      console.error('Failed to initialize quiz:', error);
      return false;
    }
  }

  /**
   * Check if user meets prerequisites
   */
  async checkPrerequisites() {
    const user = Auth.getCurrentUser();
    if (!user) return false;

    // Check training progress
    if (this.config.prerequisites.minTrainingProgress > 0) {
      const progress = await this.getModuleProgress(user.email, this.config.moduleId);
      if (progress < this.config.prerequisites.minTrainingProgress) {
        return {
          passed: false,
          reason: `Bạn cần hoàn thành ít nhất ${this.config.prerequisites.minTrainingProgress}% Module ${this.config.moduleId} trước khi làm bài kiểm tra.`
        };
      }
    }

    // Check attempt limit
    const attempts = await this.getAttemptCount(user.email, this.quizId);
    if (attempts >= this.config.settings.maxAttempts) {
      return {
        passed: false,
        reason: `Bạn đã hết số lần làm bài (${this.config.settings.maxAttempts} lần).`
      };
    }

    return { passed: true };
  }

  /**
   * Start quiz session
   */
  startQuiz() {
    this.startTime = new Date();
    this.currentQuestionIndex = 0;
    this.userAnswers = {};

    // Start timer if time limit is set
    if (this.config.settings.timeLimit > 0) {
      this.startTimer();
    }

    console.log('Quiz started at:', this.startTime);
  }

  /**
   * Navigate to next question
   */
  nextQuestion() {
    const totalQuestions = this.config.settings.totalQuestions;
    if (this.currentQuestionIndex < totalQuestions - 1) {
      this.currentQuestionIndex++;
      return true;
    }
    return false;
  }

  /**
   * Navigate to previous question
   */
  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return true;
    }
    return false;
  }

  /**
   * Jump to specific question
   */
  goToQuestion(index) {
    if (index >= 0 && index < this.config.settings.totalQuestions) {
      this.currentQuestionIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Save user's answer for a question
   */
  saveAnswer(questionId, answer) {
    this.userAnswers[questionId] = {
      answer: answer,
      timestamp: new Date().toISOString()
    };

    // Auto-save to localStorage as backup
    this.saveToLocalStorage();

    console.log('Answer saved:', questionId, answer);
  }

  /**
   * Get current question data
   */
  getCurrentQuestion() {
    const mcqCount = this.config.settings.mcqCount;
    const currentIndex = this.currentQuestionIndex;

    if (currentIndex < mcqCount) {
      // MCQ question
      return {
        type: 'mcq',
        question: this.questions.questions.mcq[currentIndex],
        number: currentIndex + 1
      };
    } else {
      // Essay question
      const essayIndex = currentIndex - mcqCount;
      return {
        type: 'essay',
        question: this.questions.questions.essay[essayIndex],
        number: currentIndex + 1
      };
    }
  }

  /**
   * Submit quiz
   */
  async submitQuiz() {
    const endTime = new Date();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000); // seconds

    // Calculate MCQ score
    const mcqScore = this.calculateMCQScore();

    // Prepare submission data
    const submission = {
      userId: Auth.getCurrentUser().email,
      quizId: this.quizId,
      startedAt: this.startTime.toISOString(),
      submittedAt: endTime.toISOString(),
      timeSpent: timeSpent,
      answers: this.userAnswers,
      mcqScore: mcqScore,
      essayScore: 0, // Will be graded manually
      totalScore: mcqScore * this.config.grading.mcqWeight
    };

    try {
      // Send to backend
      const response = await QuizStorage.saveResult(submission);

      // Clear localStorage backup
      this.clearLocalStorage();

      console.log('Quiz submitted successfully:', response);
      return response;
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      throw error;
    }
  }

  /**
   * Calculate MCQ score (auto-grading)
   */
  calculateMCQScore() {
    let correctCount = 0;
    const mcqQuestions = this.questions.questions.mcq;
    const mcqCount = this.config.settings.mcqCount;

    mcqQuestions.forEach(question => {
      const userAnswer = this.userAnswers[question.id];
      if (!userAnswer) return;

      if (question.type === 'single-choice') {
        if (userAnswer.answer === question.correctAnswer) {
          correctCount++;
        }
      } else if (question.type === 'multiple-choice') {
        // Check if arrays are equal
        const userAns = userAnswer.answer.sort();
        const correctAns = question.correctAnswers.sort();
        if (JSON.stringify(userAns) === JSON.stringify(correctAns)) {
          correctCount++;
        }
      }
    });

    // Calculate score (0-10 scale)
    const mcqMaxScore = 10 * this.config.grading.mcqWeight;
    const score = (correctCount / mcqCount) * mcqMaxScore;

    return parseFloat(score.toFixed(2));
  }

  /**
   * Start countdown timer
   */
  startTimer() {
    const timeLimit = this.config.settings.timeLimit * 60; // convert to seconds
    let timeRemaining = timeLimit;

    this.timer = setInterval(() => {
      timeRemaining--;

      // Update UI (will be handled by renderer)
      document.dispatchEvent(new CustomEvent('quiz:timer', {
        detail: { timeRemaining }
      }));

      if (timeRemaining <= 0) {
        clearInterval(this.timer);
        this.autoSubmit();
      }
    }, 1000);
  }

  /**
   * Auto-submit when time expires
   */
  async autoSubmit() {
    alert('Hết giờ! Bài làm của bạn sẽ được tự động nộp.');
    await this.submitQuiz();
    window.location.href = 'quiz.html?result=timeout';
  }

  /**
   * Save progress to localStorage (backup)
   */
  saveToLocalStorage() {
    const state = {
      quizId: this.quizId,
      currentQuestionIndex: this.currentQuestionIndex,
      userAnswers: this.userAnswers,
      startTime: this.startTime
    };
    localStorage.setItem('quiz_state', JSON.stringify(state));
  }

  /**
   * Clear localStorage backup
   */
  clearLocalStorage() {
    localStorage.removeItem('quiz_state');
  }

  /**
   * Helper: Get module progress
   */
  async getModuleProgress(userId, moduleId) {
    // TODO: Implement API call to backend
    return 100; // For now, assume completed
  }

  /**
   * Helper: Get attempt count
   */
  async getAttemptCount(userId, quizId) {
    // TODO: Implement API call to backend
    return 0; // For now, no attempts
  }
}

// Make available globally
window.QuizEngine = QuizEngine;
```

---

### Step 4: Build Quiz Renderer (1-2 hours)

Create `js/quiz/quiz-renderer.js`:

```javascript
/**
 * QuizRenderer - Handle UI rendering for quiz
 */
class QuizRenderer {
  constructor(engine, containerId) {
    this.engine = engine;
    this.container = document.getElementById(containerId);
  }

  /**
   * Render quiz instructions
   */
  renderInstructions() {
    const config = this.engine.config;
    const html = `
      <div class="quiz-instructions">
        <h2>${config.title}</h2>
        <div class="quiz-info">
          <ul>
            <li><strong>Số câu hỏi:</strong> ${config.settings.totalQuestions} câu
              (${config.settings.mcqCount} trắc nghiệm + ${config.settings.essayCount} tự luận)</li>
            <li><strong>Thời gian:</strong> ${config.settings.timeLimit} phút</li>
            <li><strong>Điểm đạt:</strong> ≥ ${config.settings.passingScore}/10</li>
            <li><strong>Số lần làm tối đa:</strong> ${config.settings.maxAttempts} lần</li>
          </ul>
        </div>
        <div class="quiz-rules">
          <h3>Lưu ý:</h3>
          <ul>
            <li>Đọc kỹ đề trước khi trả lời</li>
            <li>Câu tự luận cần viết tối thiểu ${this.engine.questions.questions.essay[0]?.minWords || 50} từ</li>
            <li>Bài làm sẽ tự động nộp khi hết giờ</li>
            <li>Không thể chỉnh sửa sau khi nộp bài</li>
          </ul>
        </div>
        <button id="start-quiz-btn" class="btn btn-primary btn-large">
          Bắt đầu làm bài
        </button>
      </div>
    `;
    this.container.innerHTML = html;

    // Attach event listener
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
      this.engine.startQuiz();
      this.renderQuiz();
    });
  }

  /**
   * Render main quiz interface
   */
  renderQuiz() {
    const html = `
      <div class="quiz-header">
        <div class="quiz-timer" id="quiz-timer">
          <span class="timer-icon">⏰</span>
          <span id="timer-display">60:00</span>
        </div>
        <div class="quiz-progress">
          <span id="question-counter">Câu 1/${this.engine.config.settings.totalQuestions}</span>
        </div>
      </div>

      <div class="quiz-palette" id="quiz-palette">
        <!-- Question numbers will be rendered here -->
      </div>

      <div class="quiz-content" id="quiz-content">
        <!-- Question will be rendered here -->
      </div>

      <div class="quiz-navigation">
        <button id="prev-btn" class="btn btn-secondary">← Câu trước</button>
        <button id="next-btn" class="btn btn-primary">Câu sau →</button>
        <button id="submit-btn" class="btn btn-success" style="display:none;">Nộp bài</button>
      </div>
    `;
    this.container.innerHTML = html;

    this.renderQuestionPalette();
    this.renderQuestion();
    this.attachNavigationListeners();
    this.attachTimerListener();
  }

  /**
   * Render question palette (overview of all questions)
   */
  renderQuestionPalette() {
    const palette = document.getElementById('quiz-palette');
    const totalQuestions = this.engine.config.settings.totalQuestions;

    let html = '<div class="palette-grid">';
    for (let i = 0; i < totalQuestions; i++) {
      const answered = this.isQuestionAnswered(i);
      const current = i === this.engine.currentQuestionIndex;
      const classes = ['palette-item'];

      if (current) classes.push('current');
      if (answered) classes.push('answered');

      html += `<button class="${classes.join(' ')}" data-question="${i}">${i + 1}</button>`;
    }
    html += '</div>';

    palette.innerHTML = html;

    // Attach click listeners
    palette.querySelectorAll('.palette-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.question);
        this.engine.goToQuestion(index);
        this.renderQuestion();
        this.updateNavigation();
      });
    });
  }

  /**
   * Render current question
   */
  renderQuestion() {
    const questionData = this.engine.getCurrentQuestion();
    const content = document.getElementById('quiz-content');

    if (questionData.type === 'mcq') {
      content.innerHTML = this.renderMCQQuestion(questionData);
    } else {
      content.innerHTML = this.renderEssayQuestion(questionData);
    }

    this.updateQuestionCounter();
    this.updateQuestionPalette();
  }

  /**
   * Render MCQ question
   */
  renderMCQQuestion(questionData) {
    const q = questionData.question;
    const savedAnswer = this.engine.userAnswers[q.id]?.answer;

    let html = `
      <div class="question-container">
        <div class="question-number">Câu ${questionData.number}</div>
        <div class="question-text">${q.question}</div>
        <div class="question-options">
    `;

    q.options.forEach(option => {
      const checked = savedAnswer === option.id ? 'checked' : '';
      html += `
        <label class="option-label">
          <input type="radio" name="answer" value="${option.id}" ${checked}>
          <span class="option-text">${option.id}. ${option.text}</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;

    // Attach change listener
    setTimeout(() => {
      document.querySelectorAll('input[name="answer"]').forEach(input => {
        input.addEventListener('change', (e) => {
          this.engine.saveAnswer(q.id, e.target.value);
          this.updateQuestionPalette();
        });
      });
    }, 0);

    return html;
  }

  /**
   * Render essay question
   */
  renderEssayQuestion(questionData) {
    const q = questionData.question;
    const savedAnswer = this.engine.userAnswers[q.id]?.answer || '';

    const html = `
      <div class="question-container">
        <div class="question-number">Câu ${questionData.number} (Tự luận)</div>
        <div class="question-text">${q.question}</div>
        <div class="essay-requirements">
          <small>Yêu cầu: ${q.minWords}-${q.maxWords} từ</small>
        </div>
        <textarea
          id="essay-answer"
          class="essay-textarea"
          placeholder="Nhập câu trả lời của bạn..."
          rows="10"
        >${savedAnswer}</textarea>
        <div class="word-counter">
          <span id="word-count">0</span> từ
        </div>
      </div>
    `;

    // Attach input listener for word count
    setTimeout(() => {
      const textarea = document.getElementById('essay-answer');
      const wordCountEl = document.getElementById('word-count');

      const updateWordCount = () => {
        const text = textarea.value.trim();
        const wordCount = text ? text.split(/\s+/).length : 0;
        wordCountEl.textContent = wordCount;

        // Save answer
        this.engine.saveAnswer(q.id, textarea.value);
        this.updateQuestionPalette();
      };

      textarea.addEventListener('input', updateWordCount);
      updateWordCount(); // Initial count
    }, 0);

    return html;
  }

  /**
   * Update question counter
   */
  updateQuestionCounter() {
    const counter = document.getElementById('question-counter');
    const current = this.engine.currentQuestionIndex + 1;
    const total = this.engine.config.settings.totalQuestions;
    counter.textContent = `Câu ${current}/${total}`;
  }

  /**
   * Update question palette
   */
  updateQuestionPalette() {
    this.renderQuestionPalette();
  }

  /**
   * Check if question is answered
   */
  isQuestionAnswered(index) {
    const questionData = this.getQuestionAtIndex(index);
    return this.engine.userAnswers[questionData.id] !== undefined;
  }

  /**
   * Get question at specific index
   */
  getQuestionAtIndex(index) {
    const mcqCount = this.engine.config.settings.mcqCount;
    if (index < mcqCount) {
      return this.engine.questions.questions.mcq[index];
    } else {
      return this.engine.questions.questions.essay[index - mcqCount];
    }
  }

  /**
   * Attach navigation listeners
   */
  attachNavigationListeners() {
    document.getElementById('prev-btn').addEventListener('click', () => {
      if (this.engine.previousQuestion()) {
        this.renderQuestion();
        this.updateNavigation();
      }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
      if (this.engine.nextQuestion()) {
        this.renderQuestion();
        this.updateNavigation();
      } else {
        // Last question - show submit button
        this.showSubmitButton();
      }
    });

    document.getElementById('submit-btn').addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn nộp bài? Bạn sẽ không thể chỉnh sửa sau khi nộp.')) {
        await this.submitQuiz();
      }
    });
  }

  /**
   * Update navigation buttons
   */
  updateNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    prevBtn.disabled = this.engine.currentQuestionIndex === 0;

    const isLastQuestion = this.engine.currentQuestionIndex === this.engine.config.settings.totalQuestions - 1;
    if (isLastQuestion) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-block';
    } else {
      nextBtn.style.display = 'inline-block';
      submitBtn.style.display = 'none';
    }
  }

  /**
   * Show submit button
   */
  showSubmitButton() {
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'inline-block';
  }

  /**
   * Attach timer listener
   */
  attachTimerListener() {
    document.addEventListener('quiz:timer', (e) => {
      const { timeRemaining } = e.detail;
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      document.getElementById('timer-display').textContent = display;

      // Change color based on time
      const timerEl = document.getElementById('quiz-timer');
      if (timeRemaining <= 60) {
        timerEl.classList.add('timer-critical');
      } else if (timeRemaining <= 300) {
        timerEl.classList.add('timer-warning');
      }
    });
  }

  /**
   * Submit quiz and show results
   */
  async submitQuiz() {
    try {
      const result = await this.engine.submitQuiz();
      this.renderResults(result);
    } catch (error) {
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
      console.error(error);
    }
  }

  /**
   * Render results page
   */
  renderResults(result) {
    const html = `
      <div class="quiz-results">
        <h2>Kết quả bài kiểm tra</h2>
        <div class="score-summary">
          <div class="score-item">
            <span class="score-label">Điểm trắc nghiệm:</span>
            <span class="score-value">${result.mcqScore.toFixed(2)}</span>
          </div>
          <div class="score-item">
            <span class="score-label">Điểm tự luận:</span>
            <span class="score-value">Đang chờ chấm</span>
          </div>
          <div class="score-item total">
            <span class="score-label">Tổng điểm:</span>
            <span class="score-value">${result.totalScore.toFixed(2)}/10</span>
          </div>
        </div>
        <div class="result-message">
          <p>Phần tự luận sẽ được giảng viên chấm trong 24-48 giờ.</p>
          <p>Bạn sẽ nhận được thông báo qua email khi có kết quả.</p>
        </div>
        <div class="result-actions">
          <a href="library.html" class="btn btn-primary">Quay lại thư viện</a>
          <button onclick="window.print()" class="btn btn-secondary">In kết quả</button>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
  }
}

// Make available globally
window.QuizRenderer = QuizRenderer;
```

---

### Step 5: Build Storage Module (1 hour)

Create `js/quiz/quiz-storage.js`:

```javascript
/**
 * QuizStorage - Handle backend communication (Google Sheets)
 */
class QuizStorage {
  static SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

  /**
   * Save quiz result to backend
   */
  static async saveResult(submission) {
    try {
      const response = await fetch(this.SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'saveQuizResult',
          data: submission
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to save quiz result:', error);

      // Fallback: Save to localStorage if backend fails
      this.saveToLocalStorage('quiz_result_backup', submission);
      throw error;
    }
  }

  /**
   * Get quiz results for a user
   */
  static async getResults(userId, quizId) {
    try {
      const response = await fetch(
        `${this.SCRIPT_URL}?action=getQuizResults&userId=${userId}&quizId=${quizId}`
      );
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get quiz results:', error);
      return [];
    }
  }

  /**
   * Save to localStorage (backup)
   */
  static saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Get from localStorage
   */
  static getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  }
}

// Make available globally
window.QuizStorage = QuizStorage;
```

---

### Step 6: Update quiz.html (30 minutes)

Update `pages/cs/quiz.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CS Quiz - Crush Room Wiki</title>
    <link rel="stylesheet" href="../../css/style.css">
    <style>
        .quiz-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }

        .quiz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .quiz-timer {
            font-size: 1.5rem;
            font-weight: bold;
        }

        .quiz-timer.timer-warning {
            color: #ff9800;
        }

        .quiz-timer.timer-critical {
            color: #f44336;
            animation: blink 1s infinite;
        }

        @keyframes blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.5; }
        }

        .quiz-palette {
            margin-bottom: 30px;
        }

        .palette-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 10px;
        }

        .palette-item {
            padding: 10px;
            border: 2px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .palette-item:hover {
            border-color: #667eea;
        }

        .palette-item.current {
            border-color: #667eea;
            background: #667eea;
            color: white;
        }

        .palette-item.answered {
            background: #10b981;
            color: white;
            border-color: #10b981;
        }

        .question-container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .question-number {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 10px;
        }

        .question-text {
            font-size: 1.2rem;
            margin-bottom: 20px;
            line-height: 1.6;
        }

        .option-label {
            display: block;
            padding: 15px;
            margin-bottom: 10px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .option-label:hover {
            border-color: #667eea;
            background: #f3f4f6;
        }

        .option-label input[type="radio"] {
            margin-right: 10px;
        }

        .essay-textarea {
            width: 100%;
            min-height: 200px;
            padding: 15px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            font-family: inherit;
            resize: vertical;
        }

        .word-counter {
            text-align: right;
            color: #666;
            margin-top: 5px;
        }

        .quiz-navigation {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
        }

        .btn-secondary {
            background: #e5e7eb;
            color: #374151;
        }

        .btn-secondary:hover {
            background: #d1d5db;
        }

        .btn-success {
            background: #10b981;
            color: white;
        }

        .btn-success:hover {
            background: #059669;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="quiz-container" id="quiz-container">
        <div class="loading">Đang tải quiz...</div>
    </div>

    <!-- Scripts -->
    <script src="../../js/auth.js"></script>
    <script src="../../js/quiz/quiz-engine.js"></script>
    <script src="../../js/quiz/quiz-renderer.js"></script>
    <script src="../../js/quiz/quiz-storage.js"></script>

    <script>
        // Main quiz initialization
        (async function() {
            // Check authentication
            if (!Auth.requireAuth()) return;
            if (!Auth.requirePermission('cs')) {
                document.getElementById('quiz-container').innerHTML =
                    '<div class="error">Bạn không có quyền truy cập CS Training.</div>';
                return;
            }

            // Get quiz ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const moduleId = urlParams.get('module') || '2'; // Default to module 2
            const quizId = `cs-module-${moduleId}`;

            // Initialize quiz engine
            const engine = new QuizEngine(quizId);
            const renderer = new QuizRenderer(engine, 'quiz-container');

            // Load quiz
            const initialized = await engine.initialize();
            if (!initialized) {
                document.getElementById('quiz-container').innerHTML =
                    '<div class="error">Không thể tải quiz. Vui lòng thử lại sau.</div>';
                return;
            }

            // Check prerequisites
            const prereqCheck = await engine.checkPrerequisites();
            if (!prereqCheck.passed) {
                document.getElementById('quiz-container').innerHTML =
                    `<div class="error">${prereqCheck.reason}</div>`;
                return;
            }

            // Render instructions
            renderer.renderInstructions();
        })();
    </script>
</body>
</html>
```

---

### Step 7: Create Google Sheets Backend (1 hour)

#### 7.1 Create Sheets
Create a new Google Spreadsheet with 2 sheets:
1. **QuizResults** - Columns: resultId, userId, quizId, attemptNumber, startedAt, submittedAt, timeSpent, mcqScore, essayScore, totalScore, passed, answers, feedback, gradedBy, gradedAt
2. **UserProgress** - Columns: userId, moduleId, startedAt, completedAt, progress, timeSpent, lastAccessed, sectionsCompleted

#### 7.2 Create Apps Script

Open **Extensions > Apps Script** and paste:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === 'saveQuizResult') {
    return saveQuizResult(data.data);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Unknown action'
  })).setMimeType(ContentService.MimeType.JSON);
}

function saveQuizResult(submission) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QuizResults');
  const resultId = Utilities.getUuid();

  const row = [
    resultId,
    submission.userId,
    submission.quizId,
    getAttemptNumber(submission.userId, submission.quizId),
    submission.startedAt,
    submission.submittedAt,
    submission.timeSpent,
    submission.mcqScore,
    submission.essayScore,
    submission.totalScore,
    submission.totalScore >= 7.0,
    JSON.stringify(submission.answers),
    '', // feedback
    '', // gradedBy
    ''  // gradedAt
  ];

  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    resultId: resultId,
    score: {
      mcq: submission.mcqScore,
      essay: submission.essayScore,
      total: submission.totalScore
    },
    passed: submission.totalScore >= 7.0
  })).setMimeType(ContentService.MimeType.JSON);
}

function getAttemptNumber(userId, quizId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QuizResults');
  const data = sheet.getDataRange().getValues();

  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId && data[i][2] === quizId) {
      count++;
    }
  }

  return count + 1;
}

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getQuizResults') {
    return getQuizResults(e.parameter.userId, e.parameter.quizId);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Unknown action'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getQuizResults(userId, quizId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('QuizResults');
  const data = sheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId && data[i][2] === quizId) {
      results.push({
        attemptNumber: data[i][3],
        totalScore: data[i][9],
        passed: data[i][10],
        submittedAt: data[i][5]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: results
  })).setMimeType(ContentService.MimeType.JSON);
}
```

#### 7.3 Deploy
1. Click **Deploy > New deployment**
2. Select **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the **Web app URL**
7. Update `QuizStorage.SCRIPT_URL` in `quiz-storage.js`

---

## ✅ TESTING CHECKLIST

- [ ] Quiz loads from JSON successfully
- [ ] Questions display correctly (MCQ and essay)
- [ ] Timer counts down
- [ ] Answer selection saves
- [ ] Question palette updates
- [ ] Navigation works (prev, next, jump)
- [ ] Submit sends data to Google Sheets
- [ ] Results page shows scores
- [ ] Can take quiz again (within attempt limit)

---

## 🚀 NEXT STEPS

After completing Phase 1, move to:

1. **Phase 2: Progress Tracking** - Track training completion
2. **Phase 3: Quiz Expansion** - Create quizzes for Modules 1, 3, 4, 5
3. **Phase 4: Admin Dashboard** - Grade essays, view analytics
4. **Phase 5: Polish** - Advanced features

---

## 📞 NEED HELP?

Common issues:

**Issue:** Quiz doesn't load
- Check console for errors
- Verify JSON syntax in config.json and module-2-quiz.json
- Ensure file paths are correct

**Issue:** Can't save to Google Sheets
- Verify Apps Script is deployed as web app
- Check CORS settings
- Look at Apps Script execution logs

**Issue:** Timer doesn't work
- Check browser console for errors
- Ensure CustomEvent is supported (all modern browsers)

**Issue:** Questions don't render
- Verify JSON structure matches expected format
- Check quiz ID matches between config and questions file

---

**Ready to start? Follow Step 1 and work through each step sequentially!**
