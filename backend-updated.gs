// Crush Room Wiki - Full Authentication API
// Hỗ trợ: Login, CRUD Users, Page View Logging, Stats, Schedule Availability & Assignment

// ===== MAIN HANDLERS =====

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    switch (data.action) {
      case 'login':
        return handleLogin(data.email, data.password);

      // Users CRUD
      case 'getUsers':
        return handleGetUsers();

      case 'addUser':
        return handleAddUser(data.userData);

      case 'updateUser':
        return handleUpdateUser(data.row, data.userData);

      case 'deleteUser':
        return handleDeleteUser(data.row);

      // Logs & Stats
      case 'logPageView':
        return handleLogPageView(data.log);

      case 'getStats':
        return handleGetStats();

      // ===== SCHEDULE: AVAILABILITY (NHÂN VIÊN) =====
      case 'getAvailability':
        return handleGetAvailability(data.email, data.weekStart);

      case 'saveAvailability':
        return handleSaveAvailability(
          data.email,
          data.name,
          data.weekStart,
          data.availability
        );

      // ===== 🆕 NEW: GET ALL TEAM AVAILABILITY =====
      case 'getAllAvailability':
        return handleGetAllAvailability(data.weekStart, data.team);

      // ===== SCHEDULE META: TRẠNG THÁI LỊCH =====
      case 'getScheduleMeta':
        return handleGetScheduleMeta(data.weekStart, data.team);

      case 'setScheduleStatus':
        return handleSetScheduleStatus(
          data.weekStart,
          data.team,
          data.status,
          data.userEmail,
          data.userName,
          data.note
        );

      // ===== SCHEDULE: TEAM VIEW & PHÂN CA (LEADER) =====
      case 'getTeamAvailability':
        return handleGetTeamAvailability(data.weekStart, data.team);

      case 'getSchedule':
        return handleGetSchedule(data.weekStart, data.team);

      case 'saveSchedule':
        return handleSaveSchedule(data.weekStart, data.team, data.schedule);

      default:
        return jsonResponse({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function doGet(e) {
  return jsonResponse({ success: true, message: 'Crush Room Wiki API is running' });
}

// ===== LOGIN =====

function handleLogin(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  const inEmail = email.toString().trim().toLowerCase();
  const inPass  = password.toString().trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const rowEmail = (row[0] || '').toString().trim().toLowerCase();
    const rowPass  = (row[1] || '').toString().trim();

    if (rowEmail === inEmail && rowPass === inPass) {
      // lấy loại nhân viên, default = parttime
      const employmentType = (row[7] || 'parttime').toString().trim().toLowerCase();

      // Log login
      logActivity(row[0], row[2], 'Đăng nhập', '');

      return jsonResponse({
        success: true,
        user: {
          email: row[0],
          name: row[2],
          role: row[3],
          employmentType: employmentType,
          permissions: {
            cs: row[4] === true || row[4] === 'TRUE',
            marketing: row[5] === true || row[5] === 'TRUE',
            laser: row[6] === true || row[6] === 'TRUE'
          }
        }
      });
    }
  }

  return jsonResponse({ success: false, message: 'Email hoặc mật khẩu không đúng' });
}

// ===== USERS CRUD =====

function handleGetUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      users.push({
        row: i + 1,
        email: row[0],
        password: row[1],
        name: row[2],
        role: row[3],
        cs: row[4] === true || row[4] === 'TRUE',
        marketing: row[5] === true || row[5] === 'TRUE',
        laser: row[6] === true || row[6] === 'TRUE',
        employmentType: (row[7] || 'parttime').toString().trim().toLowerCase()
      });
    }
  }

  return jsonResponse({ success: true, users: users });
}

function handleAddUser(userData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim().toLowerCase() === userData.email.toString().trim().toLowerCase()) {
      return jsonResponse({ success: false, message: 'Email đã tồn tại' });
    }
  }

  const employmentType = (userData.employmentType || 'parttime').toString().trim().toLowerCase();

  sheet.appendRow([
    userData.email,
    userData.password,
    userData.name,
    userData.role,
    userData.cs ? 'TRUE' : 'FALSE',
    userData.marketing ? 'TRUE' : 'FALSE',
    userData.laser ? 'TRUE' : 'FALSE',
    employmentType
  ]);

  return jsonResponse({ success: true, message: 'Đã thêm user' });
}

function handleUpdateUser(row, userData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');

  const employmentType = (userData.employmentType || 'parttime').toString().trim().toLowerCase();

  sheet.getRange(row, 1, 1, 8).setValues([[
    userData.email,
    userData.password,
    userData.name,
    userData.role,
    userData.cs ? 'TRUE' : 'FALSE',
    userData.marketing ? 'TRUE' : 'FALSE',
    userData.laser ? 'TRUE' : 'FALSE',
    employmentType
  ]]);

  return jsonResponse({ success: true, message: 'Đã cập nhật user' });
}

function handleDeleteUser(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Đã xóa user' });
}

// ===== PAGE VIEW LOGGING =====

function handleLogPageView(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');

  sheet.appendRow([
    log.timestamp || new Date().toISOString(),
    log.userEmail,
    log.userName,
    log.page,
    log.url
  ]);

  return jsonResponse({ success: true });
}

function logActivity(email, name, page, url) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
    sheet.appendRow([
      new Date().toISOString(),
      email,
      name,
      page,
      url
    ]);
  } catch (e) {
    // Ignore logging errors
  }
}

// ===== STATS =====

function handleGetStats() {
  const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');

  const usersData = usersSheet.getDataRange().getValues();
  const logsData = logsSheet.getDataRange().getValues();

  const totalUsers = usersData.length - 1;

  const today = new Date().toDateString();
  let totalViews = 0;
  let todayViews = 0;
  const pageStats = {};

  for (let i = 1; i < logsData.length; i++) {
    const row = logsData[i];
    if (!row[0]) continue;

    totalViews++;

    const logDate = new Date(row[0]).toDateString();
    if (logDate === today) {
      todayViews++;
    }

    const page = row[3] || 'Unknown';
    const userName = row[2] || row[1] || 'Unknown';

    if (!pageStats[page]) {
      pageStats[page] = { totalViews: 0, users: {} };
    }
    pageStats[page].totalViews++;

    if (!pageStats[page].users[userName]) {
      pageStats[page].users[userName] = 0;
    }
    pageStats[page].users[userName]++;
  }

  const pageStatsArray = Object.entries(pageStats).map(([pageName, data]) => ({
    pageName: pageName,
    totalViews: data.totalViews,
    userViews: Object.entries(data.users).map(([name, count]) => ({ name, count }))
  })).sort((a, b) => b.totalViews - a.totalViews);

  return jsonResponse({
    success: true,
    stats: {
      totalViews: totalViews,
      totalUsers: totalUsers,
      totalPages: Object.keys(pageStats).length,
      todayViews: todayViews,
      pageStats: pageStatsArray
    }
  });
}

// ===== HELPER: employmentType theo email =====
// (Hiện chưa dùng trong logic mới, nhưng giữ lại nếu sau này cần)
function getEmploymentTypeByEmail(email) {
  if (!email) return 'parttime';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return 'parttime';

  const data = sheet.getDataRange().getValues();
  const inEmail = email.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = (row[0] || '').toString().trim().toLowerCase();
    if (!rowEmail) continue;
    if (rowEmail === inEmail) {
      return (row[7] || 'parttime').toString().trim().toLowerCase();
    }
  }
  return 'parttime';
}

// ===== HELPER: user meta theo email (employmentType + isCS) =====
// Dùng để áp rule: parttime + fulltime CS được đăng ký lịch
function getUserMetaByEmail(email) {
  const meta = {
    employmentType: 'parttime',
    isCS: false
  };

  if (!email) return meta;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return meta;

  const data = sheet.getDataRange().getValues();
  const inEmail = email.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = (row[0] || '').toString().trim().toLowerCase();
    if (!rowEmail || rowEmail !== inEmail) continue;

    meta.employmentType = (row[7] || 'parttime').toString().trim().toLowerCase();
    meta.isCS = (row[4] === true || row[4] === 'TRUE');
    break;
  }

  return meta;
}

// ===== HELPER: team theo email (cs / mo) =====

function getUserTeamByEmail(email) {
  if (!email) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return '';

  const data = sheet.getDataRange().getValues();
  const inEmail = email.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = (row[0] || '').toString().trim().toLowerCase();
    if (!rowEmail || rowEmail !== inEmail) continue;

    const cs = row[4] === true || row[4] === 'TRUE';
    return cs ? 'cs' : 'mo';
  }
  return '';
}

// ===== HELPER: check tuần đã chốt cho team chưa =====
// Đọc từ sheet ScheduleMeta

function isWeekLockedForTeam(weekStart, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ScheduleMeta');
  if (!sheet) return false;

  const tz = Session.getScriptTimeZone();
  const inWeekRaw = (weekStart || '').toString().trim();
  const inWeek    = inWeekRaw.substring(0, 10); // yyyy-MM-dd
  const inTeam    = (team || '').toString().trim().toLowerCase() || 'all';

  if (!inWeek) return false;

  const data = sheet.getDataRange().getValues();

  // Duyệt từ dưới lên để lấy bản ghi mới nhất
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    // Chuẩn hoá weekStart trong sheet
    let rowWeek = '';
    const weekCell = row[0];
    if (weekCell instanceof Date) {
      rowWeek = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
    } else if (weekCell != null) {
      rowWeek = weekCell.toString().trim().substring(0, 10);
    }

    const rowTeam   = (row[1] || '').toString().trim().toLowerCase() || 'all';
    const rowStatus = (row[2] || 'draft').toString().trim().toLowerCase();

    if (rowWeek === inWeek && rowTeam === inTeam) {
      return rowStatus === 'final';
    }
  }

  return false;
}

// ===== SCHEDULE: AVAILABILITY (NHÂN VIÊN) =====
// Sheet: Availability (email, name, weekStart, date, shift, updatedAt)

// Lấy danh sách ca mà 1 nhân viên đã đăng ký rảnh trong 1 tuần
function handleGetAvailability(email, weekStart) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Availability');
  if (!sheet) {
    // Chưa có sheet thì xem như chưa ai đăng ký
    return jsonResponse({ success: true, availability: [] });
  }

  const data = sheet.getDataRange().getValues();

  const inEmailRaw = (email || '').toString().trim().toLowerCase();
  const inWeekRaw  = (weekStart || '').toString().trim();
  const inWeek     = inWeekRaw.substring(0, 10); // chuẩn yyyy-MM-dd

  const tz = Session.getScriptTimeZone();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Email
    const rowEmail = (row[0] || '').toString().trim().toLowerCase();
    if (!rowEmail || rowEmail !== inEmailRaw) continue;

    // Chuẩn hoá weekStart trong sheet
    let rowWeekStr = '';
    const rowWeekVal = row[2];
    if (rowWeekVal instanceof Date) {
      rowWeekStr = Utilities.formatDate(rowWeekVal, tz, 'yyyy-MM-dd');
    } else if (rowWeekVal != null) {
      rowWeekStr = rowWeekVal.toString().trim().substring(0, 10);
    }
    if (rowWeekStr !== inWeek) continue;

    // Chuẩn hoá date (ngày cụ thể)
    let dateStr = '';
    const dateVal = row[3];
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd');
    } else if (dateVal != null) {
      dateStr = dateVal.toString().trim().substring(0, 10);
    }

    // Ca (shift) giữ nguyên
    const shiftStr = (row[4] || '').toString().trim();

    result.push({
      date: dateStr,   // luôn dạng yyyy-MM-dd
      shift: shiftStr  // 08-09, 09-10, ...
    });
  }

  return jsonResponse({ success: true, availability: result });
}

// 🆕 NEW: Get ALL team members' availability for a specific week
// Trả về lịch rãnh của TẤT CẢ nhân viên trong team (không chỉ 1 người)
function handleGetAllAvailability(weekStart, team) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Availability');

    if (!sheet) {
      return jsonResponse({
        success: true,
        availability: []
      });
    }

    const weekStartStr = (weekStart || '').toString().trim().substring(0, 10);
    const teamFilter = (team || 'cs').toString().trim().toLowerCase();

    if (!weekStartStr) {
      return jsonResponse({
        success: false,
        message: 'Missing weekStart parameter'
      });
    }

    // Calculate week end (Sunday)
    const startDate = new Date(weekStartStr + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const tz = Session.getScriptTimeZone();
    const weekEnd = Utilities.formatDate(endDate, tz, 'yyyy-MM-dd');

    // Get Users sheet to map email -> team
    const usersSheet = ss.getSheetByName('Users');
    const usersMap = {};

    if (usersSheet) {
      const uData = usersSheet.getDataRange().getValues();
      for (let i = 1; i < uData.length; i++) {
        const row = uData[i];
        const email = (row[0] || '').toString().trim().toLowerCase();
        if (!email) continue;

        const name = (row[2] || '').toString().trim();
        const cs = row[4] === true || row[4] === 'TRUE';
        const userTeam = cs ? 'cs' : 'mo';

        usersMap[email] = {
          name: name,
          team: userTeam
        };
      }
    }

    const allData = sheet.getDataRange().getValues();
    const availability = [];

    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];

      const emailRaw = (row[0] || '').toString().trim();
      if (!emailRaw) continue;

      const email = emailRaw.toLowerCase();

      // Get user's team
      const userInfo = usersMap[email];
      const userTeam = userInfo ? userInfo.team : 'mo';
      const userName = userInfo ? userInfo.name : (row[1] || '').toString().trim();

      // Filter by team
      if (userTeam !== teamFilter) continue;

      // Check weekStart
      let rowWeekStr = '';
      const rowWeekVal = row[2];
      if (rowWeekVal instanceof Date) {
        rowWeekStr = Utilities.formatDate(rowWeekVal, tz, 'yyyy-MM-dd');
      } else if (rowWeekVal != null) {
        rowWeekStr = rowWeekVal.toString().trim().substring(0, 10);
      }

      if (rowWeekStr !== weekStartStr) continue;

      // Get date
      let dateStr = '';
      const dateVal = row[3];
      if (dateVal instanceof Date) {
        dateStr = Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd');
      } else if (dateVal != null) {
        dateStr = dateVal.toString().trim().substring(0, 10);
      }

      // Validate date is within the week
      if (dateStr < weekStartStr || dateStr > weekEnd) continue;

      const shift = (row[4] || '').toString().trim();
      if (!shift) continue;

      availability.push({
        email: emailRaw,
        name: userName,
        team: userTeam,
        date: dateStr,
        shift: shift
      });
    }

    return jsonResponse({
      success: true,
      availability: availability
    });

  } catch (error) {
    Logger.log('getAllAvailability error: ' + error);
    return jsonResponse({
      success: false,
      message: error.toString(),
      availability: []
    });
  }
}

// Lưu đăng ký ca rảnh của 1 nhân viên cho 1 tuần
function handleSaveAvailability(email, name, weekStart, availability) {
  // ⭐ Cho phép: parttime + fulltime team CS
  //    Chặn: fulltime team khác (MO)
  const meta = getUserMetaByEmail(email);
  const employmentType = meta.employmentType; // 'parttime' | 'fulltime'
  const isCS = meta.isCS;

  const canUseAvailability =
    employmentType === 'parttime' ||
    (employmentType === 'fulltime' && isCS);

  if (!canUseAvailability) {
    return jsonResponse({
      success: false,
      message: 'Nhân viên fulltime team khác không cần đăng ký lịch rảnh.'
    });
  }

  const tz = Session.getScriptTimeZone();

  // Chuẩn hoá weekStart input về yyyy-MM-dd
  const inWeekRaw = (weekStart || '').toString().trim();
  const inWeek    = inWeekRaw.substring(0, 10); // 'YYYY-MM-DD'

  // ⭐ Nếu tuần đã chốt lịch cho team của nhân viên thì không cho chỉnh nữa
  const userTeam = isCS ? 'cs' : 'mo';
  if (userTeam && isWeekLockedForTeam(inWeek, userTeam)) {
    return jsonResponse({
      success: false,
      message:
        'Tuần này đã được leader chốt lịch cho team ' +
        userTeam.toUpperCase() +
        '. Nếu cần đổi ca, vui lòng trao đổi với leader và các bạn trong team để sắp xếp lại.'
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Availability');

  // Nếu chưa có sheet thì tạo + header
  if (!sheet) {
    sheet = ss.insertSheet('Availability');
    sheet.appendRow(['email', 'name', 'weekStart', 'date', 'shift', 'updatedAt']);
  }

  const data    = sheet.getDataRange().getValues();
  const inEmail = (email || '').toString().trim().toLowerCase();

  // ❗ Xoá tất cả đăng ký cũ của email + weekStart (duyệt từ dưới lên)
  for (let i = data.length - 1; i >= 1; i--) {
    const rowEmail = (data[i][0] || '').toString().trim().toLowerCase();
    if (!rowEmail || rowEmail !== inEmail) continue;

    // Chuẩn hoá weekStart trong sheet về yyyy-MM-dd
    let rowWeekStr = '';
    const rowWeekVal = data[i][2];
    if (rowWeekVal instanceof Date) {
      rowWeekStr = Utilities.formatDate(rowWeekVal, tz, 'yyyy-MM-dd');
    } else if (rowWeekVal != null) {
      rowWeekStr = rowWeekVal.toString().trim().substring(0, 10);
    }

    if (rowWeekStr === inWeek) {
      sheet.deleteRow(i + 1); // +1 vì index range bắt đầu từ 1
    }
  }

  // Nếu không có ca nào (uncheck hết) thì coi như xoá đăng ký tuần đó
  if (!availability || availability.length === 0) {
    return jsonResponse({ success: true, message: 'Đã xoá đăng ký ca của tuần này' });
  }

  // Chuẩn hoá và lưu data mới
  const rowsToAppend = availability.map(function(item) {
    const dateStr = (item.date || '').toString().trim().substring(0, 10); // 'YYYY-MM-DD'
    const shiftStr = (item.shift || '').toString().trim();

    return [
      email,
      name,
      inWeek,            // luôn dạng yyyy-MM-dd
      dateStr,           // yyyy-MM-dd
      shiftStr,          // '08-09', '09-10', ...
      new Date().toISOString()
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 6).setValues(rowsToAppend);

  return jsonResponse({ success: true, message: 'Đã lưu đăng ký ca' });
}


// ===== SCHEDULE: TEAM VIEW & PHÂN CA (LEADER) =====
// Sheet: Schedule (weekStart, date, shift, email, name, team, note, updatedAt)

// Lấy tổng hợp đăng ký rảnh của cả team trong 1 tuần
// weekStart: 'YYYY-MM-DD'
// team: 'cs' | 'mo' | 'all' | 'marketing' | 'customer service' ...
function handleGetTeamAvailability(weekStart, team) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const availSheet = ss.getSheetByName('Availability');
    if (!availSheet) {
      return jsonResponse({ success: true, slots: [] });
    }

    if (!weekStart) {
      return jsonResponse({ success: true, slots: [] });
    }

    const tz = Session.getScriptTimeZone();
    const inWeek = (weekStart || '').toString().substring(0, 10); // "2025-12-08"

    // Map Users để biết team + employmentType của từng email
    const usersSheet = ss.getSheetByName('Users');
    const usersMap = {};

    if (usersSheet) {
      const uData = usersSheet.getDataRange().getValues();
      for (let i = 1; i < uData.length; i++) {
        const row = uData[i];
        const email = (row[0] || '').toString().trim().toLowerCase();
        if (!email) continue;

        const name = (row[2] || '').toString().trim();
        const cs = row[4] === true || row[4] === 'TRUE'; // cột CS
        const userTeam = cs ? 'cs' : 'mo';
        const employmentType = (row[7] || 'parttime').toString().trim().toLowerCase();

        usersMap[email] = {
          email: email,
          name: name,
          team: userTeam,
          employmentType: employmentType
        };
      }
    }

    const data = availSheet.getDataRange().getValues();

    // Chuẩn hoá giá trị team gửi từ frontend
    let filterTeam = (team || '').toString().trim().toLowerCase();

    if (filterTeam === 'marketing' || filterTeam === 'mo' || filterTeam === 'mkt') {
      filterTeam = 'mo';
    } else if (
      filterTeam === 'customer service' ||
      filterTeam === 'customer_service' ||
      filterTeam === 'customer-service' ||
      filterTeam === 'cs'
    ) {
      filterTeam = 'cs';
    } else if (filterTeam === 'all' || filterTeam === '') {
      filterTeam = ''; // không lọc
    } else {
      filterTeam = ''; // giá trị lạ -> không lọc
    }

    const result = {}; // key = date|shift -> {date, shift, users: []}

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // So sánh theo weekStart (cột C)
      let weekCell = row[2];
      if (!weekCell) continue;

      let rowWeekIso;
      if (weekCell instanceof Date) {
        rowWeekIso = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
      } else {
        rowWeekIso = weekCell.toString().trim().substring(0, 10);
      }

      if (rowWeekIso !== inWeek) continue; // chỉ lấy đúng tuần

      const emailRaw = (row[0] || '').toString().trim();
      if (!emailRaw) continue;

      // Chuẩn hoá date (cột D) về YYYY-MM-DD
      let dateCell = row[3];
      if (!dateCell) continue;

      let dateIso;
      if (dateCell instanceof Date) {
        dateIso = Utilities.formatDate(dateCell, tz, 'yyyy-MM-dd');
      } else {
        dateIso = dateCell.toString().trim().substring(0, 10);
      }

      const shift = (row[4] || '').toString().trim();
      if (!shift) continue;

      const emailKey = emailRaw.toLowerCase();
      const meta = usersMap[emailKey] || {
        email: emailKey,
        name: (row[1] || '').toString().trim(),
        team: 'mo',
        employmentType: 'parttime'
      };

      // CHỈ bỏ qua nhân viên fulltime KHÔNG thuộc team CS (fulltime MO)
      const isFulltime = meta.employmentType === 'fulltime';
      if (isFulltime && meta.team !== 'cs') {
        continue;
      }

      // Lọc theo team nếu có
      if (filterTeam && meta.team !== filterTeam) continue;

      const key = dateIso + '|' + shift;
      if (!result[key]) {
        result[key] = {
          date: dateIso,
          shift: shift,
          users: []
        };
      }

      result[key].users.push({
        email: meta.email,
        name: meta.name,
        team: meta.team
      });
    }

    const slots = Object.keys(result)
      .sort()
      .map(function (k) { return result[k]; });

    return jsonResponse({ success: true, slots: slots });
  } catch (e) {
    return jsonResponse({
      success: false,
      message: 'handleGetTeamAvailability error: ' + e.toString(),
      slots: []
    });
  }
}

// ===== SCHEDULE: TEAM VIEW & PHÂN CA (LEADER) =====
// Sheet: Schedule (weekStart, date, shift, email, name, team, note, updatedAt)

// Lấy lịch làm đã phân cho 1 tuần + team
function handleGetSchedule(weekStart, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Schedule');
  if (!sheet) {
    return jsonResponse({ success: true, schedule: [] });
  }

  const data = sheet.getDataRange().getValues();
  const inWeek = (weekStart || '').toString().trim();
  const filterTeam = (team || '').toString().trim().toLowerCase();
  const tz = Session.getScriptTimeZone();

  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // weekStart: chuẩn về YYYY-MM-DD
    let rowWeekStr = '';
    const weekCell = row[0];
    if (weekCell instanceof Date) {
      rowWeekStr = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
    } else {
      rowWeekStr = weekCell.toString().trim().substring(0, 10);
    }
    if (!rowWeekStr || rowWeekStr !== inWeek) continue;

    // lọc theo team (cs / mo / all)
    const rowTeamRaw = (row[5] || '').toString().trim();
    const rowTeam = rowTeamRaw.toLowerCase();
    if (filterTeam && filterTeam !== 'all' && rowTeam !== filterTeam) continue;

    // date: chuẩn về YYYY-MM-DD
    let dateIso = '';
    const dateCell = row[1];
    if (dateCell instanceof Date) {
      dateIso = Utilities.formatDate(dateCell, tz, 'yyyy-MM-dd');
    } else {
      dateIso = dateCell.toString().trim().substring(0, 10);
    }
    if (!dateIso) continue;

    // shift: chỉ nhận dạng HH-HH
    const shiftCell = row[2];
    if (shiftCell instanceof Date) {
      continue;
    }
    const shiftStr = shiftCell.toString().trim();
    if (!/^\d{2}-\d{2}$/.test(shiftStr)) {
      continue;
    }

    out.push({
      weekStart: rowWeekStr,
      date: dateIso,
      shift: shiftStr,
      email: (row[3] || '').toString().trim(),
      name: (row[4] || '').toString().trim(),
      team: rowTeamRaw,
      note: (row[6] || '').toString().trim()
    });
  }

  return jsonResponse({ success: true, schedule: out });
}

// Lưu lịch làm cho 1 tuần + team
// schedule: array [{date, shift, email, name, note}]
function handleSaveSchedule(weekStart, team, schedule) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Schedule');

  if (!sheet) {
    sheet = ss.insertSheet('Schedule');
    sheet.appendRow(['weekStart', 'date', 'shift', 'email', 'name', 'team', 'note', 'updatedAt']);
  }

  const inWeek = (weekStart || '').toString().trim();          // '2025-12-08'
  const targetTeam = (team || '').toString().trim();
  const targetTeamLower = targetTeam.toLowerCase();
  const tz = Session.getScriptTimeZone();

  const data = sheet.getDataRange().getValues();

  // Xoá lịch cũ của tuần + team (duyệt từ dưới lên)
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    // Chuẩn hoá weekStart trong sheet về YYYY-MM-DD
    let rowWeekStr = '';
    const weekCell = row[0];
    if (weekCell instanceof Date) {
      rowWeekStr = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
    } else {
      rowWeekStr = weekCell.toString().trim().substring(0, 10);
    }

    // Chuẩn hoá team trong sheet
    const rowTeamRaw = (row[5] || '').toString().trim();
    const rowTeamLower = rowTeamRaw.toLowerCase();

    // Điều kiện xoá:
    // - Cùng weekStart
    // - Và:
    //    + Nếu đang lưu cho 1 team cụ thể (cs/mo) thì xoá mọi dòng tuần đó của team đó
    //    + Đồng thời xoá luôn các dòng tuần đó nhưng chưa có team (các dữ liệu cũ)
    if (!rowWeekStr || rowWeekStr !== inWeek) {
      continue;
    }

    const matchTeam =
      !targetTeamLower ||                // nếu không truyền team -> xoá hết tuần đó
      rowTeamLower === targetTeamLower ||// đúng team cần lưu
      !rowTeamLower;                     // hoặc dòng cũ chưa có team

    if (matchTeam) {
      sheet.deleteRow(i + 1); // +1 vì index sheet bắt đầu từ 1
    }
  }

  // Nếu không có schedule mới => coi như chỉ xoá lịch tuần đó
  if (!schedule || schedule.length === 0) {
    return jsonResponse({
      success: true,
      message: 'Đã xoá lịch tuần này cho team ' + (targetTeam || '(tất cả)')
    });
  }

  // Chuẩn hoá dữ liệu để ghi xuống
  const rowsToAppend = schedule.map(function (item) {
    const dateStr = (item.date || '').toString().trim().substring(0, 10); // YYYY-MM-DD
    let shiftStr = (item.shift || '').toString().trim();

    // đảm bảo shift dạng HH-HH
    if (/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(shiftStr)) {
      // "09:00 - 10:00" -> "09-10"
      const parts = shiftStr.split('-');
      shiftStr = parts[0].trim().substring(0, 2) + '-' + parts[1].trim().substring(0, 2);
    }

    return [
      inWeek,
      dateStr,
      shiftStr,
      (item.email || '').toString().trim(),
      (item.name || '').toString().trim(),
      targetTeam || (item.team || ''),
      (item.note || ''),
      new Date().toISOString()
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 8).setValues(rowsToAppend);

  return jsonResponse({
    success: true,
    message: 'Đã lưu lịch làm cho tuần này.'
  });
}

// ===== SCHEDULE META: TRẠNG THÁI CHỐT / NHÁP =====
// Sheet: ScheduleMeta (weekStart, team, status, lockedByEmail, lockedByName, lockedAt, note)

function handleGetScheduleMeta(weekStart, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ScheduleMeta');

  // Chuẩn hoá input
  const tz = Session.getScriptTimeZone();
  const inWeekRaw = (weekStart || '').toString().trim();
  const inWeek    = inWeekRaw.substring(0, 10); // luôn dạng yyyy-MM-dd
  const inTeam    = (team || '').toString().trim().toLowerCase() || 'all';

  if (!inWeek) {
    return jsonResponse({ success: false, message: 'Missing weekStart' });
  }

  if (!sheet) {
    // Chưa có sheet => coi như draft
    return jsonResponse({
      success: true,
      meta: {
        weekStart: inWeek,
        team: inTeam,
        status: 'draft',
        lockedByEmail: '',
        lockedByName: '',
        lockedAt: '',
        note: ''
      }
    });
  }

  const data = sheet.getDataRange().getValues();
  let found = null;

  // Duyệt từ dưới lên để lấy bản ghi MỚI NHẤT cho tuần + team
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    // Chuẩn hoá weekStart trong sheet về yyyy-MM-dd
    let rowWeek = '';
    const weekCell = row[0];
    if (weekCell instanceof Date) {
      rowWeek = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
    } else if (weekCell != null) {
      rowWeek = weekCell.toString().trim().substring(0, 10);
    }

    // Chuẩn hoá team
    const rowTeam = (row[1] || '').toString().trim().toLowerCase() || 'all';

    if (rowWeek === inWeek && rowTeam === inTeam) {
      found = {
        weekStart: inWeek,
        team: rowTeam,
        status: (row[2] || 'draft').toString().trim() || 'draft',
        lockedByEmail: (row[3] || '').toString().trim(),
        lockedByName:  (row[4] || '').toString().trim(),
        lockedAt:      (row[5] || '').toString().trim(),
        note:          (row[6] || '').toString().trim()
      };
      break;
    }
  }

  if (!found) {
    found = {
      weekStart: inWeek,
      team: inTeam,
      status: 'draft',
      lockedByEmail: '',
      lockedByName: '',
      lockedAt: '',
      note: ''
    };
  }

  return jsonResponse({ success: true, meta: found });
}

function handleSetScheduleStatus(weekStart, team, status, userEmail, userName, note) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ScheduleMeta');

  if (!sheet) {
    sheet = ss.insertSheet('ScheduleMeta');
    sheet.appendRow([
      'weekStart',
      'team',
      'status',
      'lockedByEmail',
      'lockedByName',
      'lockedAt',
      'note'
    ]);
  }

  const tz = Session.getScriptTimeZone();

  // Chuẩn hoá input
  const inWeekRaw = (weekStart || '').toString().trim();
  const inWeek    = inWeekRaw.substring(0, 10); // yyyy-MM-dd
  const inTeam    = (team || '').toString().trim().toLowerCase() || 'all';
  const newStatus = (status || 'draft').toString().trim();

  if (!inWeek) {
    return jsonResponse({ success: false, message: 'Missing weekStart' });
  }

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;

  // tìm bản ghi cũ (nếu có) cho cùng weekStart + team
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Chuẩn hoá weekStart trong sheet
    let rowWeek = '';
    const weekCell = row[0];
    if (weekCell instanceof Date) {
      rowWeek = Utilities.formatDate(weekCell, tz, 'yyyy-MM-dd');
    } else if (weekCell != null) {
      rowWeek = weekCell.toString().trim().substring(0, 10);
    }

    const rowTeam = (row[1] || '').toString().trim().toLowerCase() || 'all';

    if (rowWeek === inWeek && rowTeam === inTeam) {
      foundRow = i + 1; // vì i bắt đầu từ 1 -> row index = i+1
      break;
    }
  }

  const nowIso = new Date().toISOString();
  const rowValues = [
    inWeek,
    inTeam,
    newStatus,
    (userEmail || '').toString().trim(),
    (userName || '').toString().trim(),
    nowIso,
    (note || '').toString().trim()
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return jsonResponse({
    success: true,
    meta: {
      weekStart: inWeek,
      team: inTeam,
      status: newStatus,
      lockedByEmail: rowValues[3],
      lockedByName:  rowValues[4],
      lockedAt:      rowValues[5],
      note:          rowValues[6]
    }
  });
}

// ===== HELPER =====

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON); // chuẩn để trả JSON cho web app
}

// ===== TEST FUNCTIONS =====

function testLogin() {
  const result = handleLogin('admin@crushroom.vn', 'admin123');
  Logger.log(result.getContent());
}

function testGetUsers() {
  const result = handleGetUsers();
  Logger.log(result.getContent());
}

function testGetStats() {
  const result = handleGetStats();
  Logger.log(result.getContent());
}

function testLoginAdmin() {
  const result = handleLogin('admin@crushroom.vn', 'admin123');
  Logger.log(result.getContent());
}

function testLoginCs() {
  const result = handleLogin('cs@crushroom.vn', 'cs123');
  Logger.log(result.getContent());
}

function testLoginNhuAdmin() {
  const result = handleLogin('nhu@crushroom.vn', '140320208888');
  Logger.log(result.getContent());
}

function testLoginNhuStaff() {
  const result = handleLogin('nhu98@crushroom.vn', '140320208888');
  Logger.log(result.getContent());
}

// Test API lịch làm (optional)
function testSaveAvailabilitySample() {
  const result = handleSaveAvailability(
    'test@crushroom.vn',
    'Test User',
    '2025-03-10',
    [
      { date: '2025-03-10', shift: '08-09' },
      { date: '2025-03-11', shift: '09-10' }
    ]
  );
  Logger.log(result.getContent());
}

function testGetAvailabilitySample() {
  const result = handleGetAvailability('test@crushroom.vn', '2025-03-10');
  Logger.log(result.getContent());
}

function testTeamAvailabilitySample() {
  const result = handleGetTeamAvailability('2025-12-08', 'cs');
  Logger.log(result.getContent());
}

function testSaveScheduleSample() {
  const result = handleSaveSchedule('2025-03-10', 'cs', [
    {
      date: '2025-03-10',
      shift: '08-09',
      email: 'test@crushroom.vn',
      name: 'Test User',
      note: 'Sample'
    }
  ]);
  Logger.log(result.getContent());
}

function testTeamAvailabilityMO() {
  const result = handleGetTeamAvailability('2025-12-08', 'mo');
  Logger.log(result.getContent());
}

// 🆕 Test getAllAvailability
function testGetAllAvailability() {
  const result = handleGetAllAvailability('2026-01-06', 'cs');
  Logger.log(result.getContent());
}
