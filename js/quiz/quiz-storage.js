/**
 * QuizStorage - Handle backend communication with Google Sheets
 * Manages saving quiz results and retrieving user data
 *
 * @version 1.0
 * @author Crush Room Wiki Team
 */

class QuizStorage {
  // TODO: Replace with actual Google Apps Script URL after deployment
  static SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuH3XYSTlHp3pL6_s7-7UF7JZ0t_5_CPBR5LfJdv4uLcz7qv03nvC2o82cvGCRh_NV/exec';

  /**
   * Save quiz result to backend
   * @param {Object} submission - Quiz submission data
   * @returns {Promise<Object>} Response from backend
   */
  static async saveResult(submission) {
    console.log('💾 Saving quiz result to backend...');

    // For development/testing: save to localStorage if no backend URL
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('⚠️ Backend URL not configured. Saving to localStorage instead.');
      return this.saveToLocalStorage(submission);
    }

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

      if (!result.success) {
        throw new Error(result.error || 'Failed to save quiz result');
      }

      console.log('✓ Quiz result saved successfully');
      console.log('  - Result ID:', result.resultId);

      return result;
    } catch (error) {
      console.error('✗ Failed to save to backend:', error);

      // Fallback: Save to localStorage
      console.log('⚠️ Falling back to localStorage...');
      return this.saveToLocalStorage(submission);
    }
  }

  /**
   * Save to localStorage (fallback when backend unavailable)
   * @param {Object} submission - Quiz submission data
   * @returns {Object} Mock response
   */
  static saveToLocalStorage(submission) {
    try {
      const resultId = this.generateUUID();
      const savedResults = this.getFromLocalStorage('quiz_results') || [];

      const resultData = {
        ...submission,
        resultId: resultId,
        savedAt: new Date().toISOString(),
        savedLocally: true
      };

      savedResults.push(resultData);
      localStorage.setItem('quiz_results', JSON.stringify(savedResults));

      console.log('✓ Saved to localStorage (ID:', resultId, ')');

      return {
        success: true,
        resultId: resultId,
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
   * @param {string} userId - User email
   * @param {string} quizId - Quiz ID (optional - get all if not specified)
   * @returns {Promise<Array>} Array of quiz results
   */
  static async getResults(userId, quizId = null) {
    console.log('📊 Fetching quiz results for:', userId);

    // Check localStorage first
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      return this.getResultsFromLocalStorage(userId, quizId);
    }

    try {
      const url = new URL(this.SCRIPT_URL);
      url.searchParams.append('action', 'getQuizResults');
      url.searchParams.append('userId', userId);
      if (quizId) {
        url.searchParams.append('quizId', quizId);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to get quiz results');
      }

      return result.data || [];
    } catch (error) {
      console.error('✗ Failed to fetch from backend:', error);

      // Fallback to localStorage
      return this.getResultsFromLocalStorage(userId, quizId);
    }
  }

  /**
   * Get results from localStorage
   * @param {string} userId - User email
   * @param {string} quizId - Quiz ID (optional)
   * @returns {Array} Filtered results
   */
  static getResultsFromLocalStorage(userId, quizId = null) {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];

    return savedResults.filter(result => {
      const userMatch = result.userId === userId;
      const quizMatch = quizId ? result.quizId === quizId : true;
      return userMatch && quizMatch;
    });
  }

  /**
   * Update progress for a training module
   * @param {Object} progressData - Progress data
   * @returns {Promise<Object>} Response from backend
   */
  static async updateProgress(progressData) {
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      console.warn('⚠️ Backend URL not configured. Progress not saved.');
      return { success: true, savedLocally: true };
    }

    try {
      const response = await fetch(this.SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'updateProgress',
          data: progressData
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('✗ Failed to update progress:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get progress for a training module
   * @param {string} userId - User email
   * @param {string} moduleId - Module ID
   * @returns {Promise<Object>} Progress data
   */
  static async getProgress(userId, moduleId) {
    if (this.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
      return { progress: 100, completed: true }; // Assume completed for now
    }

    try {
      const url = new URL(this.SCRIPT_URL);
      url.searchParams.append('action', 'getProgress');
      url.searchParams.append('userId', userId);
      url.searchParams.append('moduleId', moduleId);

      const response = await fetch(url.toString());
      const result = await response.json();

      return result.data || { progress: 0, completed: false };
    } catch (error) {
      console.error('✗ Failed to get progress:', error);
      return { progress: 0, completed: false };
    }
  }

  /**
   * Get quiz schedule
   * @param {string} quizId - Quiz ID
   * @returns {Promise<Object>} Schedule data
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
      const result = await response.json();

      return result.data || { enabled: false };
    } catch (error) {
      console.error('✗ Failed to get quiz schedule:', error);
      return { enabled: false };
    }
  }

  /**
   * Get data from localStorage
   * @param {string} key - Storage key
   * @returns {any} Parsed data or null
   */
  static getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('✗ Failed to get from localStorage:', error);
      return null;
    }
  }

  /**
   * Generate UUID (simple version)
   * @returns {string} UUID
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Export results to CSV (for admin/debugging)
   * @returns {string} CSV content
   */
  static exportResultsToCSV() {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];

    if (savedResults.length === 0) {
      return 'No results to export';
    }

    // CSV Header
    let csv = 'Result ID,User ID,Quiz ID,Attempt,Started At,Submitted At,Time Spent (s),MCQ Score,Essay Score,Total Score,Passed\n';

    // CSV Rows
    savedResults.forEach(result => {
      csv += `${result.resultId},${result.userId},${result.quizId},${result.attemptNumber},`;
      csv += `${result.startedAt},${result.submittedAt},${result.timeSpent},`;
      csv += `${result.mcqScore},${result.essayScore},${result.totalScore},${result.passed}\n`;
    });

    return csv;
  }

  /**
   * Download CSV file (browser download)
   * @param {string} filename - File name for download
   */
  static downloadCSV(filename = 'quiz_results.csv') {
    const csv = this.exportResultsToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Clear all localStorage data (for development/debugging)
   * WARNING: This will delete all saved quiz results
   */
  static clearAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL quiz results saved locally. Continue?')) {
      localStorage.removeItem('quiz_results');
      localStorage.removeItem('quiz_state_backup');
      console.log('✓ All quiz data cleared from localStorage');
      return true;
    }
    return false;
  }

  /**
   * Get statistics summary
   * @returns {Object} Statistics object
   */
  static getStatistics() {
    const savedResults = this.getFromLocalStorage('quiz_results') || [];

    if (savedResults.length === 0) {
      return {
        totalSubmissions: 0,
        uniqueUsers: 0,
        averageScore: 0,
        passRate: 0
      };
    }

    const uniqueUsers = new Set(savedResults.map(r => r.userId)).size;
    const totalScore = savedResults.reduce((sum, r) => sum + r.totalScore, 0);
    const passedCount = savedResults.filter(r => r.passed).length;

    return {
      totalSubmissions: savedResults.length,
      uniqueUsers: uniqueUsers,
      averageScore: (totalScore / savedResults.length).toFixed(2),
      passRate: ((passedCount / savedResults.length) * 100).toFixed(1) + '%'
    };
  }
}

// Make available globally
window.QuizStorage = QuizStorage;
