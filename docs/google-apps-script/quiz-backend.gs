/**
 * Crush Room Quiz System - Google Apps Script Backend
 *
 * This script provides backend API for:
 * - Saving quiz results
 * - Retrieving quiz results
 * - Tracking training progress
 * - Managing quiz schedules
 *
 * @version 1.0
 * @author Crush Room Wiki Team
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  SHEETS: {
    QUIZ_RESULTS: 'QuizResults',
    USER_PROGRESS: 'UserProgress',
    QUIZ_SCHEDULE: 'QuizSchedule'
  },
  TIMEZONE: 'Asia/Ho_Chi_Minh'
};

// ============================================
// MAIN HANDLERS
// ============================================

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    Logger.log('POST request - Action: ' + action);

    switch (action) {
      case 'saveQuizResult':
        return saveQuizResult(data.data);

      case 'updateProgress':
        return updateProgress(data.data);

      case 'gradeEssay':
        return gradeEssay(data.data);

      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, error.toString());
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    Logger.log('GET request - Action: ' + action);

    switch (action) {
      case 'getQuizResults':
        return getQuizResults(e.parameter.userId, e.parameter.quizId);

      case 'getProgress':
        return getProgress(e.parameter.userId, e.parameter.moduleId);

      case 'getQuizSchedule':
        return getQuizSchedule(e.parameter.quizId);

      case 'getAllResults':
        return getAllResults(); // Admin only

      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse(false, error.toString());
  }
}

// ============================================
// QUIZ RESULTS FUNCTIONS
// ============================================

/**
 * Save quiz result to QuizResults sheet
 */
function saveQuizResult(submission) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.QUIZ_RESULTS);

    // Create sheet if doesn't exist
    if (!sheet) {
      sheet = createQuizResultsSheet(ss);
    }

    const resultId = Utilities.getUuid();
    const timestamp = new Date();
    const attemptNumber = getAttemptNumber(submission.userId, submission.quizId) + 1;

    // Prepare row data
    const row = [
      resultId,                          // A: Result ID
      submission.userId,                 // B: User ID (email)
      submission.quizId,                 // C: Quiz ID
      attemptNumber,                     // D: Attempt Number
      submission.startedAt,              // E: Started At
      submission.submittedAt,            // F: Submitted At
      submission.timeSpent,              // G: Time Spent (seconds)
      submission.mcqScore,               // H: MCQ Score
      submission.essayScore,             // I: Essay Score
      submission.totalScore,             // J: Total Score
      submission.passed,                 // K: Passed
      JSON.stringify(submission.answers), // L: Answers (JSON)
      '',                                // M: Feedback
      '',                                // N: Graded By
      '',                                // O: Graded At
      timestamp                          // P: Created At
    ];

    // Append row
    sheet.appendRow(row);

    Logger.log('Quiz result saved: ' + resultId);

    return createResponse(true, 'Quiz result saved successfully', {
      resultId: resultId,
      attemptNumber: attemptNumber,
      score: {
        mcq: submission.mcqScore,
        essay: submission.essayScore,
        total: submission.totalScore
      },
      passed: submission.passed
    });

  } catch (error) {
    Logger.log('Error saving quiz result: ' + error.toString());
    return createResponse(false, 'Failed to save quiz result: ' + error.toString());
  }
}

/**
 * Get quiz results for a user
 */
function getQuizResults(userId, quizId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QUIZ_RESULTS);
    if (!sheet) {
      return createResponse(true, 'No results found', []);
    }

    const data = sheet.getDataRange().getValues();
    const results = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Check if matches userId and quizId (if provided)
      if (row[1] === userId && (!quizId || row[2] === quizId)) {
        results.push({
          resultId: row[0],
          userId: row[1],
          quizId: row[2],
          attemptNumber: row[3],
          startedAt: row[4],
          submittedAt: row[5],
          timeSpent: row[6],
          mcqScore: row[7],
          essayScore: row[8],
          totalScore: row[9],
          passed: row[10],
          feedback: row[12],
          gradedBy: row[13],
          gradedAt: row[14]
        });
      }
    }

    return createResponse(true, 'Results retrieved', results);

  } catch (error) {
    Logger.log('Error getting quiz results: ' + error.toString());
    return createResponse(false, 'Failed to get results: ' + error.toString());
  }
}

/**
 * Get attempt number for a user's quiz
 */
function getAttemptNumber(userId, quizId) {
  const sheet = getSheet(CONFIG.SHEETS.QUIZ_RESULTS);
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId && data[i][2] === quizId) {
      count++;
    }
  }

  return count;
}

/**
 * Grade essay questions (Admin only)
 */
function gradeEssay(gradeData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QUIZ_RESULTS);
    if (!sheet) {
      return createResponse(false, 'Quiz results sheet not found');
    }

    const data = sheet.getDataRange().getValues();

    // Find the result by resultId
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === gradeData.resultId) {
        const row = i + 1; // Sheet rows are 1-indexed

        // Calculate new total score
        const mcqScore = data[i][7];
        const essayScore = gradeData.essayScore;
        const totalScore = mcqScore + essayScore;
        const passed = totalScore >= 7.0; // Assuming passing score is 7.0

        // Update sheet
        sheet.getRange(row, 9).setValue(essayScore);           // Essay Score
        sheet.getRange(row, 10).setValue(totalScore);          // Total Score
        sheet.getRange(row, 11).setValue(passed);              // Passed
        sheet.getRange(row, 13).setValue(gradeData.feedback);  // Feedback
        sheet.getRange(row, 14).setValue(gradeData.gradedBy);  // Graded By
        sheet.getRange(row, 15).setValue(new Date());          // Graded At

        Logger.log('Essay graded for result: ' + gradeData.resultId);

        return createResponse(true, 'Essay graded successfully', {
          totalScore: totalScore,
          passed: passed
        });
      }
    }

    return createResponse(false, 'Result not found: ' + gradeData.resultId);

  } catch (error) {
    Logger.log('Error grading essay: ' + error.toString());
    return createResponse(false, 'Failed to grade essay: ' + error.toString());
  }
}

// ============================================
// USER PROGRESS FUNCTIONS
// ============================================

/**
 * Update user's training progress
 */
function updateProgress(progressData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.USER_PROGRESS);

    // Create sheet if doesn't exist
    if (!sheet) {
      sheet = createUserProgressSheet(ss);
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find existing progress record
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === progressData.userId && data[i][1] === progressData.moduleId) {
        rowIndex = i + 1; // Sheet rows are 1-indexed
        break;
      }
    }

    const timestamp = new Date();

    if (rowIndex === -1) {
      // New progress record
      const row = [
        progressData.userId,              // A: User ID
        progressData.moduleId,            // B: Module ID
        timestamp,                        // C: Started At
        progressData.progress === 100 ? timestamp : '', // D: Completed At
        progressData.progress,            // E: Progress %
        progressData.timeSpent || 0,      // F: Time Spent (minutes)
        timestamp,                        // G: Last Accessed
        JSON.stringify(progressData.sectionsCompleted || []) // H: Sections Completed
      ];
      sheet.appendRow(row);
    } else {
      // Update existing record
      sheet.getRange(rowIndex, 4).setValue(progressData.progress === 100 ? timestamp : ''); // Completed At
      sheet.getRange(rowIndex, 5).setValue(progressData.progress);                          // Progress
      sheet.getRange(rowIndex, 6).setValue(progressData.timeSpent || 0);                   // Time Spent
      sheet.getRange(rowIndex, 7).setValue(timestamp);                                      // Last Accessed
      sheet.getRange(rowIndex, 8).setValue(JSON.stringify(progressData.sectionsCompleted || [])); // Sections
    }

    return createResponse(true, 'Progress updated successfully', {
      progress: progressData.progress
    });

  } catch (error) {
    Logger.log('Error updating progress: ' + error.toString());
    return createResponse(false, 'Failed to update progress: ' + error.toString());
  }
}

/**
 * Get user's training progress
 */
function getProgress(userId, moduleId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USER_PROGRESS);
    if (!sheet) {
      return createResponse(true, 'No progress found', {
        progress: 0,
        completed: false
      });
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId && data[i][1] === moduleId) {
        return createResponse(true, 'Progress retrieved', {
          userId: data[i][0],
          moduleId: data[i][1],
          startedAt: data[i][2],
          completedAt: data[i][3],
          progress: data[i][4],
          timeSpent: data[i][5],
          lastAccessed: data[i][6],
          sectionsCompleted: JSON.parse(data[i][7] || '[]')
        });
      }
    }

    return createResponse(true, 'No progress found', {
      progress: 0,
      completed: false
    });

  } catch (error) {
    Logger.log('Error getting progress: ' + error.toString());
    return createResponse(false, 'Failed to get progress: ' + error.toString());
  }
}

// ============================================
// QUIZ SCHEDULE FUNCTIONS
// ============================================

/**
 * Get quiz schedule
 */
function getQuizSchedule(quizId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QUIZ_SCHEDULE);
    if (!sheet) {
      return createResponse(true, 'No schedule found', {
        enabled: false
      });
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === quizId && data[i][6] === 'active') {
        return createResponse(true, 'Schedule retrieved', {
          scheduleId: data[i][0],
          quizId: data[i][1],
          title: data[i][2],
          startDate: data[i][3],
          endDate: data[i][4],
          targetUsers: JSON.parse(data[i][5] || '[]'),
          status: data[i][6],
          enabled: true
        });
      }
    }

    return createResponse(true, 'No active schedule', {
      enabled: false
    });

  } catch (error) {
    Logger.log('Error getting quiz schedule: ' + error.toString());
    return createResponse(false, 'Failed to get schedule: ' + error.toString());
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get all quiz results (Admin only)
 */
function getAllResults() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QUIZ_RESULTS);
    if (!sheet) {
      return createResponse(true, 'No results found', []);
    }

    const data = sheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      results.push({
        resultId: row[0],
        userId: row[1],
        quizId: row[2],
        attemptNumber: row[3],
        submittedAt: row[5],
        totalScore: row[9],
        passed: row[10],
        essayGraded: row[8] > 0
      });
    }

    return createResponse(true, 'All results retrieved', results);

  } catch (error) {
    Logger.log('Error getting all results: ' + error.toString());
    return createResponse(false, 'Failed to get results: ' + error.toString());
  }
}

// ============================================
// SHEET CREATION FUNCTIONS
// ============================================

/**
 * Create QuizResults sheet with headers
 */
function createQuizResultsSheet(ss) {
  const sheet = ss.insertSheet(CONFIG.SHEETS.QUIZ_RESULTS);

  const headers = [
    'Result ID',
    'User ID',
    'Quiz ID',
    'Attempt Number',
    'Started At',
    'Submitted At',
    'Time Spent (s)',
    'MCQ Score',
    'Essay Score',
    'Total Score',
    'Passed',
    'Answers (JSON)',
    'Feedback',
    'Graded By',
    'Graded At',
    'Created At'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  Logger.log('Created QuizResults sheet');
  return sheet;
}

/**
 * Create UserProgress sheet with headers
 */
function createUserProgressSheet(ss) {
  const sheet = ss.insertSheet(CONFIG.SHEETS.USER_PROGRESS);

  const headers = [
    'User ID',
    'Module ID',
    'Started At',
    'Completed At',
    'Progress %',
    'Time Spent (min)',
    'Last Accessed',
    'Sections Completed (JSON)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  Logger.log('Created UserProgress sheet');
  return sheet;
}

/**
 * Create QuizSchedule sheet with headers
 */
function createQuizScheduleSheet(ss) {
  const sheet = ss.insertSheet(CONFIG.SHEETS.QUIZ_SCHEDULE);

  const headers = [
    'Schedule ID',
    'Quiz ID',
    'Title',
    'Start Date',
    'End Date',
    'Target Users (JSON)',
    'Status',
    'Created By',
    'Created At'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  Logger.log('Created QuizSchedule sheet');
  return sheet;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get sheet by name
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName);
}

/**
 * Create JSON response
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message
  };

  if (data !== undefined) {
    response.data = data;
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// SETUP FUNCTION (Run once to create sheets)
// ============================================

/**
 * Initialize all sheets
 * Run this function once after deploying the script
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create QuizResults sheet
  if (!ss.getSheetByName(CONFIG.SHEETS.QUIZ_RESULTS)) {
    createQuizResultsSheet(ss);
  }

  // Create UserProgress sheet
  if (!ss.getSheetByName(CONFIG.SHEETS.USER_PROGRESS)) {
    createUserProgressSheet(ss);
  }

  // Create QuizSchedule sheet
  if (!ss.getSheetByName(CONFIG.SHEETS.QUIZ_SCHEDULE)) {
    createQuizScheduleSheet(ss);
  }

  Logger.log('All sheets created successfully!');
  SpreadsheetApp.getUi().alert('Setup complete! All sheets have been created.');
}
