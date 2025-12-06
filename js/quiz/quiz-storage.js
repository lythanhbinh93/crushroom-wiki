/**
 * QuizStorage - Handle backend communication with Google Sheets
 * Manages saving quiz results and retrieving user data
 *
 * @version 1.1 (no-preflight CORS) 
 */

class QuizStorage {
  // Google Apps Script Web App URL (/exec)
  static SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2EoqLu-yYd-sRoELoKVOGgCImPpizJj5bJ7PBMKXslRrpBj1JGIFfFKOYKA5DE6yc/exec';

  /**
   * Save quiz result to backend
   * @param {Object} submission - Quiz submission data
   * @returns {Promise<Object>} Response from backend
   */
  static async saveResult(submission) {
    console.log('💾 Saving quiz result to backend...');

    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('⚠️ Backend URL not configured. Saving to localStorage instead.');
      return this.saveToLocalStorage(submission);
    }

    try {
      const response = await fetch(this.SCRIPT_URL, {
        method: 'POST',
        // Simple request để tránh preflight
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveQuizResult',
          data: submission
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json(); // { success, message, data }
      if (!result.success) {
        throw new Error(result.message || 'Failed to save quiz result');
      }

      const payload = result.data || {};
      console.log('✓ Quiz result saved successfully');
      console.log('  - Result ID:', payload.resultId);

      return { success: true, ...payload };
    } catch (error) {
      console.error('✗ Failed to save to backend:', error);
      console.log('⚠️ Falling back to localStorage...');
      return this.saveToLocalStorage(submission);
    }
  }

  /**
   * Save to localStorage (fallback)
   */
  static saveToLocalStorage(submission) {
    try {
      const resultId = this.generateUUID();
      const savedResults = this.getFromLocalStorage('quiz_results') || [];

      const resultData = {
        ...submission,
        resultId,
        savedAt: new Date().toISOString(),
        savedLocally: true
      };

      savedResults.push(resultData);
      localStorage.setItem('quiz_results', JSON.stringify(savedResults));

      console.log('✓ Saved to localStorage (ID:', resultId, ')');

      return {
        success: true,
        resultId,
        score: {
          mcq: submission.mcqScore,
          essay: submission.essayScore,
          total: submission.totalScore
        },
        passed: submission.passed,
        savedLocally: true
      };
    } catch (error) {
      console.error('✗ Failed to save to localStorage:', error);
      throw new Error('Cannot save quiz result anywhere');
    }
  }

  /**
   * Get quiz results for a user
   */
  static async getResults(userId, quizId = null) {
    console.log('📊 Fetching quiz results for:', userId);

    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      return this.getResultsFromLocalStorage(userId, quizId);
    }

    try {
      const url = new URL(this.SCRIPT_URL);
      url.searchParams.append('action', 'getQuizResults');
      url.searchParams.append('userId', userId);
      if (quizId) url.searchParams.append('quizId', quizId);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json(); // { success, message, data }
      if (!result.success) throw new Error(result.message || 'Failed to get quiz results');

      return result.data || [];
    } catch (error) {
      console.error('✗ Failed to fetch from backend:', error);
      return this.getResultsFromLocalStorage(userId, quizId);
    }
  }

  static getResultsFromLocalStorage(userId, quizId = null) {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];
    return savedResults.filter(r => (r.userId === userId) && (quizId ? r.quizId === quizId : true));
    }

  /**
   * Update progress
   */
  static async updateProgress(progressData) {
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('⚠️ Backend URL not configured. Progress not saved.');
      return { success: true, savedLocally: true };
    }

    try {
      const response = await fetch(this.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateProgress',
          data: progressData
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json(); // { success, message, data }
      if (!result.success) throw new Error(result.message || 'Failed to update progress');

      return result.data ? { success: true, ...result.data } : { success: true };
    } catch (error) {
      console.error('✗ Failed to update progress:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get progress
   */
  static async getProgress(userId, moduleId) {
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      return { progress: 100, completed: true };
    }

    try {
      const url = new URL(this.SCRIPT_URL);
      url.searchParams.append('action', 'getProgress');
      url.searchParams.append('userId', userId);
      url.searchParams.append('moduleId', moduleId);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json(); // { success, message, data }
      if (!result.success) throw new Error(result.message || 'Failed to get progress');

      return result.data || { progress: 0, completed: false };
    } catch (error) {
      console.error('✗ Failed to get progress:', error);
      return { progress: 0, completed: false };
    }
  }

  /**
   * Get quiz schedule
   */
  static async getQuizSchedule(quizId) {
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      return { enabled: false };
    }

    try {
      const url = new URL(this.SCRIPT_URL);
      url.searchParams.append('action', 'getQuizSchedule');
      url.searchParams.append('quizId', quizId);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json(); // { success, message, data }
      if (!result.success) throw new Error(result.message || 'Failed to get schedule');

      return result.data || { enabled: false };
    } catch (error) {
      console.error('✗ Failed to get quiz schedule:', error);
      return { enabled: false };
    }
  }

  // -------------- Utilities --------------
  static getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('✗ Failed to get from localStorage:', error);
      return null;
    }
  }

  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static exportResultsToCSV() {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];
    if (savedResults.length === 0) return 'No results to export';

    let csv = 'Result ID,User ID,Quiz ID,Attempt,Started At,Submitted At,Time Spent (s),MCQ Score,Essay Score,Total Score,Passed\n';
    savedResults.forEach(r => {
      csv += `${r.resultId},${r.userId},${r.quizId},${r.attemptNumber},${r.startedAt},${r.submittedAt},${r.timeSpent},${r.mcqScore},${r.essayScore},${r.totalScore},${r.passed}\n`;
    });
    return csv;
  }

  static downloadCSV(filename = 'quiz_results.csv') {
    const csv = this.exportResultsToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static clearAllData() {
    if (confirm('⚠️ Delete ALL quiz results saved locally?')) {
      localStorage.removeItem('quiz_results');
      localStorage.removeItem('quiz_state_backup');
      console.log('✓ All quiz data cleared from localStorage');
      return true;
    }
    return false;
  }

  static getStatistics() {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];
    if (savedResults.length === 0) {
      return { totalSubmissions: 0, uniqueUsers: 0, averageScore: 0, passRate: 0 };
    }
    const uniqueUsers = new Set(savedResults.map(r => r.userId)).size;
    const totalScore = savedResults.reduce((sum, r) => sum + r.totalScore, 0);
    const passedCount = savedResults.filter(r => r.passed).length;
    return {
      totalSubmissions: savedResults.length,
      uniqueUsers,
      averageScore: (totalScore / savedResults.length).toFixed(2),
      passRate: ((passedCount / savedResults.length) * 100).toFixed(1) + '%'
    };
  }
}

// Expose globally
window.QuizStorage = QuizStorage;
