/**
 * QuizRenderer - Handle UI rendering for quiz player
 * Manages DOM manipulation and user interactions
 *
 * @version 1.0
 * @author Crush Room Wiki Team
 */

class QuizRenderer {
  constructor(engine, containerId) {
    this.engine = engine;
    this.container = document.getElementById(containerId);

    if (!this.container) {
      throw new Error(`Container element #${containerId} not found`);
    }
  }

  /**
   * Render quiz instructions page
   */
  renderInstructions() {
    const config = this.engine.config;

    const html = `
      <div class="quiz-instructions">
        <div class="quiz-header-banner">
          <h1>${config.title}</h1>
          <p>Module ${config.moduleId} - ${config.category.toUpperCase()}</p>
        </div>

        <div class="quiz-info-box">
          <h3>📋 Thông tin bài kiểm tra</h3>
          <ul>
            <li><strong>Số câu hỏi:</strong> ${config.settings.totalQuestions} câu
              (${config.settings.mcqCount} trắc nghiệm + ${config.settings.essayCount} tự luận)</li>
            <li><strong>Thời gian:</strong> ${config.settings.timeLimit} phút</li>
            <li><strong>Điểm đạt:</strong> ≥ ${config.settings.passingScore}/10</li>
            <li><strong>Số lần làm tối đa:</strong> ${config.settings.maxAttempts} lần</li>
          </ul>
        </div>

        <div class="quiz-rules-box">
          <h3>⚠️ Lưu ý quan trọng</h3>
          <ul>
            <li>Đọc kỹ đề trước khi trả lời</li>
            <li>Câu tự luận cần viết tối thiểu số từ yêu cầu</li>
            <li>Bài làm sẽ tự động nộp khi hết giờ</li>
            <li>Không thể chỉnh sửa sau khi nộp bài</li>
            <li>Câu trả lời được tự động lưu</li>
          </ul>
        </div>

        <div class="quiz-start-actions">
          <button id="start-quiz-btn" class="btn btn-primary btn-large">
            🚀 Bắt đầu làm bài
          </button>
        </div>
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
      <div class="quiz-player">
        <!-- Timer & Progress Header -->
        <div class="quiz-header-bar">
          <div class="quiz-timer" id="quiz-timer">
            <span class="timer-icon">⏰</span>
            <span id="timer-display">--:--</span>
          </div>
          <div class="quiz-progress-info">
            <span id="question-counter">Câu 1/${this.engine.config.settings.totalQuestions}</span>
            <span class="separator">•</span>
            <span id="answered-counter">Đã trả lời: 0/${this.engine.config.settings.totalQuestions}</span>
          </div>
        </div>

        <!-- Question Palette -->
        <div class="quiz-palette" id="quiz-palette">
          <div class="palette-header">
            <span>Danh sách câu hỏi</span>
            <button id="toggle-palette" class="btn-icon">▼</button>
          </div>
          <div class="palette-grid" id="palette-grid">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Question Content -->
        <div class="quiz-content-wrapper">
          <div class="quiz-content" id="quiz-content">
            <!-- Question rendered here -->
          </div>

          <!-- Navigation Buttons -->
          <div class="quiz-navigation">
            <button id="prev-btn" class="btn btn-secondary">
              ← Câu trước
            </button>

            <div class="nav-center">
              <button id="flag-btn" class="btn btn-outline">
                🚩 Đánh dấu
              </button>
            </div>

            <button id="next-btn" class="btn btn-primary">
              Câu sau →
            </button>

            <button id="submit-btn" class="btn btn-success" style="display:none;">
              ✓ Nộp bài
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Initialize components
    this.renderQuestionPalette();
    this.renderQuestion();
    this.attachNavigationListeners();
    this.attachTimerListener();
    this.updateNavigation();
  }

  /**
   * Render question palette (overview grid)
   */
  renderQuestionPalette() {
    const paletteGrid = document.getElementById('palette-grid');

    // Safety check: element must exist
    if (!paletteGrid) {
      console.error('❌ palette-grid element not found in DOM');
      return;
    }

    const totalQuestions = this.engine.config.settings.totalQuestions;
    const mcqCount = this.engine.config.settings.mcqCount;

    let html = '';
    for (let i = 0; i < totalQuestions; i++) {
      const answered = this.engine.isQuestionAnswered(i);
      const current = i === this.engine.currentQuestionIndex;
      const isMCQ = i < mcqCount;

      const classes = ['palette-item'];
      if (current) classes.push('current');
      if (answered) classes.push('answered');
      if (!isMCQ) classes.push('essay');

      html += `
        <button class="${classes.join(' ')}"
                data-question="${i}"
                title="${isMCQ ? 'Trắc nghiệm' : 'Tự luận'} - Câu ${i + 1}">
          ${i + 1}
        </button>
      `;
    }

    paletteGrid.innerHTML = html;

    // Attach click listeners
    paletteGrid.querySelectorAll('.palette-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.question);
        this.engine.goToQuestion(index);
        this.renderQuestion();
        this.updateNavigation();
        this.updatePalette();
      });
    });
  }

  /**
   * Update palette to reflect current state
   */
  updatePalette() {
    this.renderQuestionPalette();
    this.updateAnsweredCounter();
  }

  /**
   * Update answered counter
   */
  updateAnsweredCounter() {
    const counter = document.getElementById('answered-counter');
    const answeredCount = this.engine.getAnsweredCount();
    const total = this.engine.config.settings.totalQuestions;
    counter.textContent = `Đã trả lời: ${answeredCount}/${total}`;
  }

  /**
   * Render current question
   */
  renderQuestion() {
    const questionData = this.engine.getCurrentQuestion();
    const content = document.getElementById('quiz-content');

    if (questionData.type === 'mcq') {
      content.innerHTML = this.renderMCQQuestion(questionData);
      this.attachMCQListeners();
    } else {
      content.innerHTML = this.renderEssayQuestion(questionData);
      this.attachEssayListeners();
    }

    this.updateQuestionCounter();
    this.scrollToTop();
  }

  /**
   * Render MCQ question
   */
  renderMCQQuestion(questionData) {
    const q = questionData.question;
    const savedAnswer = this.engine.getAnswer(q.id);

    let html = `
      <div class="question-container mcq-question">
        <div class="question-badge">
          <span class="badge-mcq">Trắc nghiệm</span>
        </div>
        <div class="question-number">Câu ${questionData.number}/${questionData.totalQuestions}</div>
        <div class="question-text">${q.question}</div>
        <div class="question-options">
    `;

    q.options.forEach(option => {
      const checked = savedAnswer === option.id ? 'checked' : '';
      const selectedClass = savedAnswer === option.id ? 'selected' : '';

      html += `
        <label class="option-label ${selectedClass}">
          <input type="radio"
                 name="answer"
                 value="${option.id}"
                 ${checked}
                 data-question-id="${q.id}">
          <span class="option-marker"></span>
          <span class="option-text">
            <strong>${option.id}.</strong> ${option.text}
          </span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Attach listeners for MCQ question
   */
  attachMCQListeners() {
    const inputs = document.querySelectorAll('input[name="answer"]');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const questionId = e.target.dataset.questionId;
        const answer = e.target.value;

        this.engine.saveAnswer(questionId, answer);
        this.updatePalette();

        // Update visual selection
        document.querySelectorAll('.option-label').forEach(label => {
          label.classList.remove('selected');
        });
        e.target.closest('.option-label').classList.add('selected');
      });
    });
  }

  /**
   * Render essay question
   */
  renderEssayQuestion(questionData) {
    const q = questionData.question;
    const savedAnswer = this.engine.getAnswer(q.id) || '';
    const wordCount = this.countWords(savedAnswer);

    let html = `
      <div class="question-container essay-question">
        <div class="question-badge">
          <span class="badge-essay">Tự luận</span>
          <span class="badge-type">${q.type}</span>
        </div>
        <div class="question-number">Câu ${questionData.number}/${questionData.totalQuestions}</div>
        <div class="question-text">${q.question}</div>

        <div class="essay-requirements">
          <small>
            📝 Yêu cầu: ${q.minWords}-${q.maxWords} từ
          </small>
        </div>

        <textarea
          id="essay-answer"
          class="essay-textarea"
          placeholder="Nhập câu trả lời của bạn..."
          rows="12"
          data-question-id="${q.id}"
        >${savedAnswer}</textarea>

        <div class="essay-footer">
          <div class="word-counter">
            <span id="word-count" class="${this.getWordCountClass(wordCount, q.minWords, q.maxWords)}">
              ${wordCount}
            </span> / ${q.minWords}-${q.maxWords} từ
          </div>
          <div class="auto-save-indicator" id="auto-save">
            <span class="save-icon">💾</span>
            <span id="save-status">Đã lưu</span>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Attach listeners for essay question
   */
  attachEssayListeners() {
    const textarea = document.getElementById('essay-answer');
    const wordCountEl = document.getElementById('word-count');
    const saveStatus = document.getElementById('save-status');
    let saveTimeout = null;

    const updateWordCount = () => {
      const text = textarea.value.trim();
      const wordCount = this.countWords(text);
      wordCountEl.textContent = wordCount;

      const q = this.engine.getCurrentQuestion().question;
      wordCountEl.className = this.getWordCountClass(wordCount, q.minWords, q.maxWords);
    };

    const saveAnswer = () => {
      const questionId = textarea.dataset.questionId;
      const answer = textarea.value;

      this.engine.saveAnswer(questionId, answer);
      this.updatePalette();

      // Show save indicator
      saveStatus.textContent = 'Đã lưu';
      saveStatus.parentElement.classList.add('saved');

      setTimeout(() => {
        saveStatus.parentElement.classList.remove('saved');
      }, 1000);
    };

    textarea.addEventListener('input', () => {
      updateWordCount();

      // Show saving indicator
      saveStatus.textContent = 'Đang lưu...';

      // Debounce save
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveAnswer, 1000);
    });

    // Initial count
    updateWordCount();
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text || text.trim() === '') return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Get word count CSS class based on requirements
   */
  getWordCountClass(count, min, max) {
    if (count < min) return 'word-count-low';
    if (count > max) return 'word-count-high';
    return 'word-count-ok';
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
   * Attach navigation button listeners
   */
  attachNavigationListeners() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    prevBtn.addEventListener('click', () => {
      if (this.engine.previousQuestion()) {
        this.renderQuestion();
        this.updateNavigation();
        this.updatePalette();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (this.engine.nextQuestion()) {
        this.renderQuestion();
        this.updateNavigation();
        this.updatePalette();
      }
    });

    submitBtn.addEventListener('click', async () => {
      await this.handleSubmit();
    });

    // Toggle palette
    const toggleBtn = document.getElementById('toggle-palette');
    toggleBtn.addEventListener('click', () => {
      const paletteGrid = document.getElementById('palette-grid');
      paletteGrid.classList.toggle('collapsed');
      toggleBtn.textContent = paletteGrid.classList.contains('collapsed') ? '▶' : '▼';
    });
  }

  /**
   * Update navigation button states
   */
  updateNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    const isFirst = this.engine.currentQuestionIndex === 0;
    const isLast = this.engine.currentQuestionIndex === this.engine.config.settings.totalQuestions - 1;

    prevBtn.disabled = isFirst;

    if (isLast) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-block';
    } else {
      nextBtn.style.display = 'inline-block';
      submitBtn.style.display = 'none';
    }
  }

  /**
   * Handle quiz submission
   */
  async handleSubmit() {
    const answeredCount = this.engine.getAnsweredCount();
    const totalQuestions = this.engine.config.settings.totalQuestions;

    // Warning if not all questions answered
    if (answeredCount < totalQuestions) {
      const unanswered = totalQuestions - answeredCount;
      const confirmMsg = `⚠️ Bạn còn ${unanswered} câu chưa trả lời.\n\nBạn có chắc chắn muốn nộp bài?`;

      if (!confirm(confirmMsg)) {
        return;
      }
    } else {
      const confirmMsg = 'Bạn đã trả lời đủ tất cả câu hỏi.\n\nXác nhận nộp bài?';
      if (!confirm(confirmMsg)) {
        return;
      }
    }

    // Show loading
    this.showLoading('Đang nộp bài...');

    try {
      const result = await this.engine.submitQuiz();
      this.renderResults(result);
    } catch (error) {
      this.hideLoading();
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại hoặc liên hệ giảng viên.');
      console.error('Submit error:', error);
    }
  }

  /**
   * Attach timer listener
   */
  attachTimerListener() {
    document.addEventListener('quiz:timer-tick', (e) => {
      const { timeRemaining, timeLimit } = e.detail;
      this.updateTimerDisplay(timeRemaining, timeLimit);
    });

    document.addEventListener('quiz:auto-submitted', () => {
      // Auto-submit happened, results will be shown
    });
  }

  /**
   * Update timer display
   */
  updateTimerDisplay(timeRemaining, timeLimit) {
    const timerDisplay = document.getElementById('timer-display');
    const timerEl = document.getElementById('quiz-timer');

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    timerDisplay.textContent = display;

    // Color coding
    timerEl.classList.remove('timer-warning', 'timer-critical');

    if (timeRemaining <= 60) {
      timerEl.classList.add('timer-critical');
    } else if (timeRemaining <= 300) {
      timerEl.classList.add('timer-warning');
    }
  }

  /**
   * Render results page
   */
  renderResults(result) {
    const mcqCount = this.engine.config.settings.mcqCount;
    const essayCount = this.engine.config.settings.essayCount;
    const passingScore = this.engine.config.settings.passingScore;
    const passed = result.passed;

    const html = `
      <div class="quiz-results">
        <div class="results-header ${passed ? 'passed' : 'failed'}">
          <div class="result-icon">${passed ? '🎉' : '💪'}</div>
          <h2>${passed ? 'Chúc mừng! Bạn đã đạt' : 'Chưa đạt - Cố gắng lần sau'}</h2>
        </div>

        <div class="score-summary">
          <div class="total-score ${passed ? 'score-passed' : 'score-failed'}">
            <div class="score-label">Tổng điểm</div>
            <div class="score-value">${result.totalScore.toFixed(1)}<span>/10</span></div>
            <div class="score-status">${passed ? '✓ Đạt' : '✗ Chưa đạt'} (Yêu cầu: ≥${passingScore})</div>
          </div>

          <div class="score-breakdown">
            <div class="score-item">
              <div class="score-item-label">Trắc nghiệm</div>
              <div class="score-item-value">${result.mcqScore.toFixed(1)}</div>
              <div class="score-item-detail">${result.mcqCorrectCount}/${mcqCount} câu đúng</div>
            </div>

            <div class="score-item pending">
              <div class="score-item-label">Tự luận</div>
              <div class="score-item-value">--</div>
              <div class="score-item-detail">Đang chờ chấm</div>
            </div>
          </div>
        </div>

        <div class="results-info">
          <h3>📌 Thông tin</h3>
          <ul>
            <li>Phần tự luận sẽ được giảng viên chấm trong 24-48 giờ</li>
            <li>Bạn sẽ nhận được điểm tổng kết qua email</li>
            <li>Kết quả chi tiết được lưu trong hệ thống</li>
            ${!passed ? `<li>Bạn còn ${this.engine.config.settings.maxAttempts - result.attemptNumber || 0} lần làm lại</li>` : ''}
          </ul>
        </div>

        <div class="results-actions">
          <a href="library.html" class="btn btn-primary">
            ← Quay lại thư viện
          </a>
          ${!passed && result.attemptNumber < this.engine.config.settings.maxAttempts ? `
            <button onclick="location.reload()" class="btn btn-secondary">
              🔄 Làm lại
            </button>
          ` : ''}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'Đang tải...') {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(overlay);
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Scroll to top of content
   */
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Make available globally
window.QuizRenderer = QuizRenderer;
