/**
 * QuizEngine - Core quiz player logic
 * Handles loading, navigation, answer storage, and submission
 *
 * @version 1.0
 * @author Crush Room Wiki Team
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
    this.timeRemaining = 0;
  }

  /**
   * Initialize quiz - Load config and questions from JSON
   * @returns {Promise<boolean>} true if successful, false otherwise
   */
  async initialize() {
    try {
      // Load config
      const configResponse = await fetch('/data/quiz/config.json');
      if (!configResponse.ok) {
        throw new Error(`Failed to load config: ${configResponse.status}`);
      }

      const configData = await configResponse.json();
      this.config = configData.quizzes.find(q => q.id === this.quizId);

      if (!this.config) {
        throw new Error(`Quiz ${this.quizId} not found in config`);
      }

      // Load questions
      const questionsResponse = await fetch(`/data/quiz/${this.quizId}.json`);
      if (!questionsResponse.ok) {
        throw new Error(`Failed to load questions: ${questionsResponse.status}`);
      }

      this.questions = await questionsResponse.json();

      console.log('✓ Quiz initialized:', this.config.title);
      console.log('  - MCQ questions:', this.questions.questions.mcq.length);
      console.log('  - Essay questions:', this.questions.questions.essay.length);

      return true;
    } catch (error) {
      console.error('✗ Failed to initialize quiz:', error);
      return false;
    }
  }

  /**
   * Check if user meets prerequisites to take this quiz
   * @returns {Promise<Object>} {passed: boolean, reason: string}
   */
  async checkPrerequisites() {
    const user = Auth.getCurrentUser();
    if (!user) {
      return {
        passed: false,
        reason: 'Bạn cần đăng nhập để làm bài kiểm tra.'
      };
    }

    // Check training progress requirement
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

    // Check schedule (if enabled)
    if (this.config.scheduling && this.config.scheduling.enabled) {
      const now = new Date();
      const startDate = new Date(this.config.scheduling.startDate);
      const endDate = new Date(this.config.scheduling.endDate);

      if (now < startDate) {
        return {
          passed: false,
          reason: `Bài kiểm tra chưa mở. Thời gian bắt đầu: ${startDate.toLocaleString('vi-VN')}`
        };
      }

      if (now > endDate) {
        return {
          passed: false,
          reason: `Bài kiểm tra đã đóng. Thời gian kết thúc: ${endDate.toLocaleString('vi-VN')}`
        };
      }
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

    // Initialize time remaining (in seconds)
    if (this.config.settings.timeLimit > 0) {
      this.timeRemaining = this.config.settings.timeLimit * 60;
      this.startTimer();
    }

    console.log('✓ Quiz started at:', this.startTime.toLocaleString('vi-VN'));
    console.log('  - Time limit:', this.config.settings.timeLimit, 'minutes');
  }

  /**
   * Start countdown timer
   */
  startTimer() {
    this.timer = setInterval(() => {
      this.timeRemaining--;

      // Dispatch event for UI to update
      document.dispatchEvent(new CustomEvent('quiz:timer-tick', {
        detail: {
          timeRemaining: this.timeRemaining,
          timeLimit: this.config.settings.timeLimit * 60
        }
      }));

      // Auto-submit when time expires
      if (this.timeRemaining <= 0) {
        clearInterval(this.timer);
        this.autoSubmit();
      }
    }, 1000);
  }

  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Auto-submit when time expires
   */
  async autoSubmit() {
    alert('⏰ Hết giờ! Bài làm của bạn sẽ được tự động nộp.');
    await this.submitQuiz();

    // Dispatch event to show results
    document.dispatchEvent(new CustomEvent('quiz:auto-submitted'));
  }

  /**
   * Navigate to next question
   * @returns {boolean} true if navigation successful
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
   * @returns {boolean} true if navigation successful
   */
  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return true;
    }
    return false;
  }

  /**
   * Jump to specific question index
   * @param {number} index - Zero-based question index
   * @returns {boolean} true if navigation successful
   */
  goToQuestion(index) {
    if (index >= 0 && index < this.config.settings.totalQuestions) {
      this.currentQuestionIndex = index;
      return true;
    }
    return false;
  }

  /**
   * Get current question data
   * @returns {Object} {type: 'mcq'|'essay', question: Object, number: number}
   */
  getCurrentQuestion() {
    const mcqCount = this.config.settings.mcqCount;
    const currentIndex = this.currentQuestionIndex;

    if (currentIndex < mcqCount) {
      // MCQ question
      return {
        type: 'mcq',
        question: this.questions.questions.mcq[currentIndex],
        number: currentIndex + 1,
        totalQuestions: this.config.settings.totalQuestions
      };
    } else {
      // Essay question
      const essayIndex = currentIndex - mcqCount;
      return {
        type: 'essay',
        question: this.questions.questions.essay[essayIndex],
        number: currentIndex + 1,
        totalQuestions: this.config.settings.totalQuestions
      };
    }
  }

  /**
   * Get question at specific index (for palette)
   * @param {number} index - Zero-based question index
   * @returns {Object} question object
   */
  getQuestionAtIndex(index) {
    const mcqCount = this.config.settings.mcqCount;

    if (index < mcqCount) {
      return this.questions.questions.mcq[index];
    } else {
      return this.questions.questions.essay[index - mcqCount];
    }
  }

  /**
   * Save user's answer for a question
   * @param {string} questionId - Question ID (e.g., 'q1', 'e1')
   * @param {string|array} answer - User's answer
   */
  saveAnswer(questionId, answer) {
    this.userAnswers[questionId] = {
      answer: answer,
      timestamp: new Date().toISOString()
    };

    // Auto-save to localStorage as backup
    this.saveToLocalStorage();

    console.log('✓ Answer saved:', questionId);
  }

  /**
   * Get user's answer for a question
   * @param {string} questionId - Question ID
   * @returns {string|array|null} User's answer or null if not answered
   */
  getAnswer(questionId) {
    return this.userAnswers[questionId]?.answer || null;
  }

  /**
   * Check if a question has been answered
   * @param {number} index - Zero-based question index
   * @returns {boolean} true if answered
   */
  isQuestionAnswered(index) {
    const question = this.getQuestionAtIndex(index);
    return this.userAnswers[question.id] !== undefined;
  }

  /**
   * Get number of answered questions
   * @returns {number} Count of answered questions
   */
  getAnsweredCount() {
    return Object.keys(this.userAnswers).length;
  }

  /**
   * Calculate MCQ score (auto-grading)
   * @returns {number} Score out of 10 (weighted)
   */
  calculateMCQScore() {
    let correctCount = 0;
    const mcqQuestions = this.questions.questions.mcq;
    const mcqCount = this.config.settings.mcqCount;

    mcqQuestions.forEach(question => {
      const userAnswerData = this.userAnswers[question.id];
      if (!userAnswerData) return;

      const userAnswer = userAnswerData.answer;

      // Single choice question
      if (question.correctAnswer) {
        if (userAnswer === question.correctAnswer) {
          correctCount++;
        }
      }
      // Multiple choice question (if implemented)
      else if (question.correctAnswers) {
        const userAns = Array.isArray(userAnswer) ? userAnswer.sort() : [userAnswer];
        const correctAns = question.correctAnswers.sort();
        if (JSON.stringify(userAns) === JSON.stringify(correctAns)) {
          correctCount++;
        }
      }
    });

    // Calculate weighted score
    const mcqWeight = this.config.grading.mcqWeight;
    const score = (correctCount / mcqCount) * 10 * mcqWeight;

    return parseFloat(score.toFixed(2));
  }

  /**
   * Submit quiz
   * @returns {Promise<Object>} Submission result
   */
  async submitQuiz() {
    const endTime = new Date();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000); // seconds

    // Stop timer
    this.stopTimer();

    // Calculate MCQ score
    const mcqScore = this.calculateMCQScore();
    const essayScore = 0; // Will be graded manually by admin

    // Calculate total score (weighted)
    const totalScore = mcqScore + essayScore;
    const passed = totalScore >= this.config.settings.passingScore;

    // Prepare submission data
    const submission = {
      userId: Auth.getCurrentUser().email,
      quizId: this.quizId,
      attemptNumber: await this.getAttemptCount(Auth.getCurrentUser().email, this.quizId) + 1,
      startedAt: this.startTime.toISOString(),
      submittedAt: endTime.toISOString(),
      timeSpent: timeSpent,
      answers: this.userAnswers,
      mcqScore: mcqScore,
      essayScore: essayScore,
      totalScore: totalScore,
      passed: passed
    };

    try {
      // Send to backend
      const response = await QuizStorage.saveResult(submission);

      // Clear localStorage backup
      this.clearLocalStorage();

      console.log('✓ Quiz submitted successfully');
      console.log('  - MCQ Score:', mcqScore);
      console.log('  - Total Score:', totalScore);
      console.log('  - Passed:', passed);

      return {
        success: true,
        resultId: response.resultId || 'local',
        mcqScore: mcqScore,
        essayScore: essayScore,
        totalScore: totalScore,
        passed: passed,
        mcqCorrectCount: this.getMCQCorrectCount()
      };
    } catch (error) {
      console.error('✗ Failed to submit quiz:', error);

      // Keep in localStorage as backup
      alert('Có lỗi khi nộp bài. Câu trả lời của bạn đã được lưu tạm thời. Vui lòng liên hệ giảng viên.');

      throw error;
    }
  }

  /**
   * Get number of correct MCQ answers
   * @returns {number} Count of correct answers
   */
  getMCQCorrectCount() {
    let correctCount = 0;
    const mcqQuestions = this.questions.questions.mcq;

    mcqQuestions.forEach(question => {
      const userAnswerData = this.userAnswers[question.id];
      if (!userAnswerData) return;

      const userAnswer = userAnswerData.answer;
      if (userAnswer === question.correctAnswer) {
        correctCount++;
      }
    });

    return correctCount;
  }

  /**
   * Save quiz state to localStorage (backup)
   */
  saveToLocalStorage() {
    const state = {
      quizId: this.quizId,
      currentQuestionIndex: this.currentQuestionIndex,
      userAnswers: this.userAnswers,
      startTime: this.startTime?.toISOString(),
      timeRemaining: this.timeRemaining
    };
    localStorage.setItem('quiz_state_backup', JSON.stringify(state));
  }

  /**
   * Clear localStorage backup
   */
  clearLocalStorage() {
    localStorage.removeItem('quiz_state_backup');
  }

  /**
   * Restore quiz state from localStorage
   * @returns {boolean} true if state was restored
   */
  restoreFromLocalStorage() {
    try {
      const savedState = localStorage.getItem('quiz_state_backup');
      if (!savedState) return false;

      const state = JSON.parse(savedState);

      // Only restore if same quiz
      if (state.quizId !== this.quizId) return false;

      this.currentQuestionIndex = state.currentQuestionIndex;
      this.userAnswers = state.userAnswers;
      this.startTime = new Date(state.startTime);
      this.timeRemaining = state.timeRemaining;

      console.log('✓ Quiz state restored from backup');
      return true;
    } catch (error) {
      console.error('✗ Failed to restore quiz state:', error);
      return false;
    }
  }

  /**
   * Get module progress (placeholder - to be implemented with backend)
   * @param {string} userId - User email
   * @param {string} moduleId - Module ID
   * @returns {Promise<number>} Progress percentage (0-100)
   */
  async getModuleProgress(userId, moduleId) {
    // TODO: Implement API call to backend
    // For now, assume training is completed
    return 100;
  }

  /**
   * Get attempt count (placeholder - to be implemented with backend)
   * @param {string} userId - User email
   * @param {string} quizId - Quiz ID
   * @returns {Promise<number>} Number of attempts
   */
  async getAttemptCount(userId, quizId) {
    // TODO: Implement API call to backend
    // For now, return 0 (first attempt)
    return 0;
  }
}

// Make available globally
window.QuizEngine = QuizEngine;
