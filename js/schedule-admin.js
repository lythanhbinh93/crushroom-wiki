// js/schedule-admin.js
// Trang leader xem đăng ký & phân ca theo giờ + trạng thái chốt lịch (ScheduleMeta)

window.ScheduleAdminPage = {
  init() {
    const weekInput   = document.getElementById('week-start-admin');
    const teamSelect  = document.getElementById('team-select-admin');
    const loadBtn     = document.getElementById('load-admin-btn');
    const tbody       = document.getElementById('schedule-admin-body');
    const adminMsgEl  = document.getElementById('admin-message');

    const slotEditorEmpty   = document.getElementById('slot-editor-empty');
    const slotEditor        = document.getElementById('slot-editor');
    const slotTitleEl       = document.getElementById('slot-title');
    const slotUsersEl       = document.getElementById('slot-available-users');
    const slotSaveBtn       = document.getElementById('slot-save-btn');

    const saveWeekBtn       = document.getElementById('save-week-schedule-btn');
    const saveWeekMsgEl     = document.getElementById('save-week-message');

    // Thanh trạng thái & nút chốt/mở
    const weekStatusTextEl  = document.getElementById('week-status-text');
    const lockWeekBtn       = document.getElementById('lock-week-btn');

    // Section lịch đã chốt (tóm tắt)
    const finalStatusEl     = document.getElementById('final-schedule-admin-status');
    const finalWrapperEl    = document.getElementById('final-schedule-admin-wrapper');
    const finalBodyEl       = document.getElementById('final-schedule-admin-body');
    const finalEmptyEl      = document.getElementById('final-schedule-admin-empty');
    const finalHeadRowEl    = document.getElementById('final-schedule-admin-head-row');

    // Các ô hiển thị ngày ở header Bảng ca theo giờ
    const mainHeaderDateEls = [
      document.getElementById('schedule-main-date-0'),
      document.getElementById('schedule-main-date-1'),
      document.getElementById('schedule-main-date-2'),
      document.getElementById('schedule-main-date-3'),
      document.getElementById('schedule-main-date-4'),
      document.getElementById('schedule-main-date-5'),
      document.getElementById('schedule-main-date-6')
    ];

    if (!weekInput || !teamSelect || !loadBtn || !tbody) {
      console.warn('ScheduleAdmin: missing elements, skip init');
      return;
    }

    const currentUser = (window.Auth && typeof Auth.getCurrentUser === 'function')
      ? Auth.getCurrentUser()
      : null;

    // ==== STATE ============================================================
    let dates = [];           // 7 ngày trong tuần
    let timeSlots = [];       // [{key, label}]
    let availabilityMap = {}; // slotId -> [{email,name,team}]
    let scheduleMap = {};     // slotId -> [{email,name,team}]
    let currentSlotId = null; // slot đang chỉnh trong editor
    let currentMeta = null;   // trạng thái tuần (draft/final)
    let lastScheduleRaw = null; // dữ liệu thô từ API getSchedule (dùng cho section tóm tắt)

    // ==== QUICK ASSIGNMENT STATE ===========================================
    let selectedCells = new Set(); // Set of slotIds
    let allEmployees = [];         // [{email, name, team}]

    // ==== VIEW MODE STATE ==================================================
    let viewMode = 'overview'; // 'overview' or 'detail'

    // Màu tương phản cao cho từng nhân viên (vivid colors)
    const COLOR_PALETTE = [
      { bg: '#FF5252', text: '#FFFFFF' }, // Red
      { bg: '#2196F3', text: '#FFFFFF' }, // Blue
      { bg: '#4CAF50', text: '#FFFFFF' }, // Green
      { bg: '#FF9800', text: '#000000' }, // Orange
      { bg: '#9C27B0', text: '#FFFFFF' }, // Purple
      { bg: '#00BCD4', text: '#000000' }, // Cyan
      { bg: '#FFEB3B', text: '#000000' }, // Yellow
      { bg: '#E91E63', text: '#FFFFFF' }, // Pink
      { bg: '#3F51B5', text: '#FFFFFF' }, // Indigo
      { bg: '#009688', text: '#FFFFFF' }, // Teal
      { bg: '#FF5722', text: '#FFFFFF' }, // Deep Orange
      { bg: '#795548', text: '#FFFFFF' }, // Brown
      { bg: '#607D8B', text: '#FFFFFF' }, // Blue Grey
      { bg: '#FFC107', text: '#000000' }, // Amber
      { bg: '#8BC34A', text: '#000000' }  // Light Green
    ];
    const colorByEmail = {};
    function getColorForEmail(email) {
      const key = (email || '').toLowerCase();
      if (!key) return { bg: '#f1f3f4', text: '#000000' };

      if (!colorByEmail[key]) {
        const index = Object.keys(colorByEmail).length % COLOR_PALETTE.length;
        colorByEmail[key] = COLOR_PALETTE[index];
      }
      return colorByEmail[key];
    }

    // Helper: Get short name (first name or initials)
    function getShortName(fullName) {
      if (!fullName) return '';

      const parts = fullName.trim().split(/\s+/);

      // If single word, return as is (max 8 chars)
      if (parts.length === 1) {
        return parts[0].substring(0, 8);
      }

      // If multiple words, return first name
      // If first name is too long, return initials
      const firstName = parts[parts.length - 1]; // Vietnamese: last part is first name
      if (firstName.length <= 6) {
        return firstName;
      }

      // Return initials (e.g., "Nguyễn Văn An" -> "NVA")
      return parts.map(p => p[0]).join('').toUpperCase();
    }

    // Tuần mặc định: thứ 2 tuần sau
    weekInput.value = getNextMondayISO();

    // Quick Assignment Panel elements
    const qaEmployeeSelect = document.getElementById('qa-employee-select');
    const qaAssignBtn = document.getElementById('qa-assign-btn');
    const qaClearBtn = document.getElementById('qa-clear-selection-btn');
    const qaCountValue = document.getElementById('qa-count-value');

    // View Mode Toggle elements
    const toggleOverviewBtn = document.getElementById('toggle-overview-mode');
    const toggleDetailBtn = document.getElementById('toggle-detail-mode');

    // Events
    loadBtn.addEventListener('click', () => loadData());
    teamSelect.addEventListener('change', () => loadData());
    slotSaveBtn && slotSaveBtn.addEventListener('click', saveCurrentSlot);
    saveWeekBtn && saveWeekBtn.addEventListener('click', saveWeekSchedule);
    if (lockWeekBtn) {
      lockWeekBtn.addEventListener('click', onToggleLockClick);
    }

    // Quick Assignment events
    if (qaEmployeeSelect) {
      qaEmployeeSelect.addEventListener('change', onQAEmployeeChange);
    }
    if (qaAssignBtn) {
      qaAssignBtn.addEventListener('click', onQAAssign);
    }
    if (qaClearBtn) {
      qaClearBtn.addEventListener('click', onQAClearSelection);
    }

    // View Mode Toggle events
    if (toggleOverviewBtn) {
      toggleOverviewBtn.addEventListener('click', () => switchViewMode('overview'));
    }
    if (toggleDetailBtn) {
      toggleDetailBtn.addEventListener('click', () => switchViewMode('detail'));
    }

    // Lần đầu load
    loadData();

    // ======================================================================
    // MAIN FLOW
    // ======================================================================

    async function loadData() {
      clearAdminMessage();
      clearSaveWeekMessage();
      resetSlotEditor();

      const weekStart = weekInput.value;
      const team      = teamSelect.value;

      if (!weekStart) {
        showAdminMessage('Vui lòng chọn tuần bắt đầu.', true);
        return;
      }

      buildDates(weekStart);
      buildTimeSlots(team);
      updateMainHeaderDates();   // 👈 cập nhật ngày ở header Thứ 2,3,...
      buildGrid();               // vẽ bảng trống trước

      try {
        showAdminMessage('Đang tải dữ liệu...', false);

        const bodyAvailability = JSON.stringify({
          action: 'getTeamAvailability',
          weekStart,
          team
        });

        const bodySchedule = JSON.stringify({
          action: 'getSchedule',
          weekStart,
          team
        });

        const bodyMeta = JSON.stringify({
          action: 'getScheduleMeta',
          weekStart,
          team
        });

        const [resAvail, resSched, resMeta] = await Promise.all([
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyAvailability
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodySchedule
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyMeta
          })
        ]);

        const dataAvail = await resAvail.json();
        const dataSched = await resSched.json();
        const dataMeta  = await resMeta.json();

        availabilityMap = buildAvailabilityMap(dataAvail);
        scheduleMap     = buildScheduleMap(dataSched);
        lastScheduleRaw = dataSched; // lưu lại cho section tóm tắt

        // chỉ cập nhật currentMeta khi API trả về thành công
        if (dataMeta && dataMeta.success && dataMeta.meta) {
          currentMeta = dataMeta.meta;
        } else if (!currentMeta) {
          // fallback nếu chưa có gì
          currentMeta = {
            weekStart,
            team: (team || '').toLowerCase(),
            status: 'draft',
            lockedByEmail: '',
            lockedByName: '',
            lockedAt: '',
            note: ''
          };
        }

        renderGridStats();
        updateWeekStatusUI();
        renderFinalSchedule(lastScheduleRaw);
        updateQuickAssignmentPanel(); // Populate employee list

        showAdminMessage('Đã tải dữ liệu đăng ký & lịch hiện tại.', false);
      } catch (err) {
        console.error('ScheduleAdmin loadData error', err);
        showAdminMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ======================================================================
    // BUILD STRUCTURE
    // ======================================================================

    function buildDates(weekStartISO) {
      dates = [];
      const d0 = new Date(weekStartISO + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const d = addDays(d0, i);
        dates.push(toISODate(d));
      }
    }

    function buildTimeSlots(team) {
      let startHour, endHour;
      if (team === 'cs') {
        startHour = 8;
        endHour   = 24; // slot cuối 23-24
      } else {
        startHour = 9;
        endHour   = 18; // slot cuối 17-18
      }
  timeSlots = [];
  for (let h = startHour; h < endHour; h++) {
    const next = (h + 1) % 24;
    const key = `${pad2(h)}-${pad2(next)}`;
    // label chỉ là giờ bắt đầu ca, ví dụ "08:00"
    const label = `${pad2(h)}:00`;
    timeSlots.push({ key, label });
  }

    }

    // cập nhật ngày cho header Bảng ca theo giờ
    function updateMainHeaderDates() {
      if (!mainHeaderDateEls || !mainHeaderDateEls.length) return;
      dates.forEach((dateISO, idx) => {
        if (!mainHeaderDateEls[idx]) return;
        mainHeaderDateEls[idx].textContent = formatDateShort(dateISO);
      });
    }

    function buildGrid() {
      tbody.innerHTML = '';

      timeSlots.forEach(slot => {
        const tr = document.createElement('tr');

        const th = document.createElement('th');
        th.textContent = slot.label;
        tr.appendChild(th);

        dates.forEach(dateISO => {
          const td = document.createElement('td');
          td.classList.add('schedule-cell');
          const slotId = `${dateISO}|${slot.key}`;
          td.dataset.slotId = slotId;

          const inner = document.createElement('div');
          inner.classList.add('slot-cell-inner');
          inner.style.cursor = 'pointer';

          const statsEl = document.createElement('div');
          statsEl.classList.add('slot-stats');
          statsEl.textContent = '0/0 người';

          const namesEl = document.createElement('div');
          namesEl.classList.add('slot-names');

          inner.appendChild(statsEl);
          inner.appendChild(namesEl);

          td.appendChild(inner);

          // Click cả ô: toggle multi-select for Quick Assignment
          td.addEventListener('click', (evt) => {
            // Check if click on name pill (skip selection)
            if (evt.target.classList.contains('slot-name-pill')) {
              return; // Let onNameClick handle it
            }
            onCellClickForSelection(slotId, td);
          });

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    // ======================================================================
    // CẬP NHẬT GRID (SỐ LƯỢNG + TÊN)
    // ======================================================================

    function renderGridStats() {
      if (viewMode === 'overview') {
        renderGridOverview();
      } else {
        renderGridDetail();
      }
    }

    // Overview Mode: Compact view with dots/checkmarks
    function renderGridOverview() {
      const cells = tbody.querySelectorAll('td.schedule-cell');

      cells.forEach(td => {
        const slotId  = td.dataset.slotId;
        const statsEl = td.querySelector('.slot-stats');
        const namesEl = td.querySelector('.slot-names');

        const availList    = availabilityMap[slotId] || [];
        const assignedList = scheduleMap[slotId] || [];

        const availCount    = new Set(availList.map(u => (u.email || '').toLowerCase())).size;
        const assignedCount = new Set(assignedList.map(u => (u.email || '').toLowerCase())).size;

        // Hide count for cleaner view
        statsEl.style.display = 'none';

        namesEl.innerHTML = '';

        // Build combined list for compact badges
        const peopleByEmail = {};
        availList.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!key) return;
          if (!peopleByEmail[key]) {
            peopleByEmail[key] = {
              email: u.email,
              name: u.name || u.email,
              team: u.team || '',
              isAvailable: true
            };
          }
        });

        assignedList.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!key) return;
          if (!peopleByEmail[key]) {
            peopleByEmail[key] = {
              email: u.email,
              name: u.name || u.email,
              team: u.team || '',
              isAvailable: false
            };
          }
        });

        // Render compact name badges (Quick View) - Column-wise layout
        const badgesContainer = document.createElement('div');
        badgesContainer.style.display = 'flex';
        badgesContainer.style.flexDirection = 'column'; // Vertical stacking first
        badgesContainer.style.flexWrap = 'wrap'; // Wrap to next column when needed
        badgesContainer.style.gap = '2px';
        badgesContainer.style.alignItems = 'stretch';
        badgesContainer.style.alignContent = 'flex-start';
        badgesContainer.style.maxHeight = '80px'; // Limit height to trigger column wrapping
        badgesContainer.classList.add('quick-view-badges');

        Object.values(peopleByEmail).forEach(u => {
          const emailKey   = (u.email || '').toLowerCase();
          const isAssigned = assignedList.some(
            a => (a.email || '').toLowerCase() === emailKey
          );

          const badge = document.createElement('span');
          badge.classList.add('quick-view-badge');
          badge.style.display = 'block';
          badge.style.padding = '2px 6px';
          badge.style.borderRadius = '3px';
          badge.style.fontSize = '10px';
          badge.style.fontWeight = '600';
          badge.style.cursor = 'pointer';
          badge.style.whiteSpace = 'nowrap';
          badge.style.textAlign = 'center';
          badge.style.overflow = 'hidden';
          badge.style.textOverflow = 'ellipsis';
          badge.style.minWidth = '45px'; // Minimum width for readability
          badge.title = `${u.name || u.email} ${isAssigned ? '✓ Đã phân ca' : '○ Rảnh'}`;

          const colors = getColorForEmail(emailKey);

          if (isAssigned) {
            // Assigned: vivid color background
            badge.style.background = colors.bg;
            badge.style.color = colors.text;
            badge.style.border = 'none';
            badge.style.opacity = '1';
          } else {
            // Available but not assigned: light background
            badge.style.background = 'transparent';
            badge.style.color = colors.bg;
            badge.style.border = `1.5px solid ${colors.bg}`;
            badge.style.opacity = '0.6';
          }

          badge.dataset.slotId = slotId;
          badge.dataset.email  = u.email;
          badge.dataset.name   = u.name || '';
          badge.dataset.team   = u.team || '';

          badge.textContent = getShortName(u.name || u.email);

          badge.addEventListener('click', onNameClick);

          badgesContainer.appendChild(badge);
        });

        namesEl.appendChild(badgesContainer);
      });
    }

    // Detail Mode: Full names with badges (original view)
    function renderGridDetail() {
      const cells = tbody.querySelectorAll('td.schedule-cell');

      cells.forEach(td => {
        const slotId  = td.dataset.slotId;
        const statsEl = td.querySelector('.slot-stats');
        const namesEl = td.querySelector('.slot-names');

        const availList    = availabilityMap[slotId] || [];
        const assignedList = scheduleMap[slotId] || [];

        const availCount    = new Set(availList.map(u => (u.email || '').toLowerCase())).size;
        const assignedCount = new Set(assignedList.map(u => (u.email || '').toLowerCase())).size;

        // Hide count for cleaner view
        statsEl.style.display = 'none';

        namesEl.innerHTML = '';

        // Build combined list of all people (from both availability and assigned)
        const peopleByEmail = {};

        // Add people from availability list
        availList.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!key) return;
          if (!peopleByEmail[key]) {
            peopleByEmail[key] = {
              email: u.email,
              name: u.name || u.email,
              team: u.team || '',
              isAvailable: true
            };
          }
        });

        // Add people from assigned list (even if not available)
        assignedList.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!key) return;
          if (!peopleByEmail[key]) {
            peopleByEmail[key] = {
              email: u.email,
              name: u.name || u.email,
              team: u.team || '',
              isAvailable: false
            };
          }
        });

        // Render all people
        Object.values(peopleByEmail).forEach(u => {
          const emailKey   = (u.email || '').toLowerCase();
          const isAssigned = assignedList.some(
            a => (a.email || '').toLowerCase() === emailKey
          );

          const span = document.createElement('span');
          span.classList.add('slot-name-pill');

          // Basic styling (responsive handled by CSS)
          span.style.display      = 'inline-block';
          span.style.padding      = '3px 8px';
          span.style.borderRadius = '999px';
          span.style.marginRight  = '3px';
          span.style.marginBottom = '3px';
          span.style.cursor       = 'pointer';

          const colors = getColorForEmail(emailKey);

          if (isAssigned) {
            // Assigned: vivid color background with contrast text
            span.style.background = colors.bg;
            span.style.color = colors.text;
            span.style.border = 'none';
            span.style.opacity = '1';
            span.style.fontWeight = '600';
          } else {
            // Available but not assigned: transparent with colored border
            span.style.background = 'transparent';
            span.style.color = colors.bg;
            span.style.border = `1.5px solid ${colors.bg}`;
            span.style.opacity = '0.6';
            span.style.fontWeight = '500';
          }

          span.dataset.slotId = slotId;
          span.dataset.email  = u.email;
          span.dataset.name   = u.name || '';
          span.dataset.team   = u.team || '';

          span.textContent = u.name || u.email;

          span.addEventListener('click', onNameClick);

          namesEl.appendChild(span);
        });
      });
    }

    // Switch between Overview and Detail view modes
    function switchViewMode(mode) {
      viewMode = mode;

      // Update toggle button states
      if (toggleOverviewBtn && toggleDetailBtn) {
        if (mode === 'overview') {
          toggleOverviewBtn.classList.add('active');
          toggleOverviewBtn.style.background = '#ffffff';
          toggleOverviewBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          toggleOverviewBtn.style.color = '';

          toggleDetailBtn.classList.remove('active');
          toggleDetailBtn.style.background = 'transparent';
          toggleDetailBtn.style.boxShadow = 'none';
          toggleDetailBtn.style.color = '#666';
        } else {
          toggleDetailBtn.classList.add('active');
          toggleDetailBtn.style.background = '#ffffff';
          toggleDetailBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          toggleDetailBtn.style.color = '';

          toggleOverviewBtn.classList.remove('active');
          toggleOverviewBtn.style.background = 'transparent';
          toggleOverviewBtn.style.boxShadow = 'none';
          toggleOverviewBtn.style.color = '#666';
        }
      }

      // Re-render the grid with new mode
      renderGridStats();
    }

    // ======================================================================
    // MAP BUILDERS (từ API)
    // ======================================================================

    function buildAvailabilityMap(dataAvail) {
      const map = {};
      if (!dataAvail || !dataAvail.success || !dataAvail.slots) return map;

      dataAvail.slots.forEach(slot => {
        if (!slot) return;

        const rawDate = String(slot.date || '').trim();
        const date    = rawDate.substring(0, 10);

        const rawShift = String(slot.shift || '').trim();
        if (!/^\d{2}-\d{2}$/.test(rawShift)) return;
        const shift = rawShift;

        const key = `${date}|${shift}`;
        map[key] = slot.users || [];
      });

      return map;
    }

    function buildScheduleMap(dataSched) {
      const map = {};
      if (!dataSched || !dataSched.success || !dataSched.schedule) return map;

      dataSched.schedule.forEach(item => {
        const key = `${item.date}|${item.shift}`;
        if (!map[key]) map[key] = [];

        const email = (item.email || '').toLowerCase();
        const exists = map[key].some(u => (u.email || '').toLowerCase() === email);
        if (!exists) {
          map[key].push({
            email: item.email,
            name: item.name,
            team: item.team
          });
        }
      });

      return map;
    }

    // ======================================================================
    // CLICK TRÊN TÊN (TOGGLE ASSIGN)
    // ======================================================================

    function onNameClick(evt) {
      evt.stopPropagation();

      const span   = evt.currentTarget;
      const slotId = span.dataset.slotId;
      const email  = span.dataset.email;
      const name   = span.dataset.name;
      const team   = span.dataset.team || '';

      let list = scheduleMap[slotId] || [];
      const idx = list.findIndex(
        u => (u.email || '').toLowerCase() === (email || '').toLowerCase()
      );

      let nowAssigned;
      if (idx >= 0) {
        list.splice(idx, 1);
        nowAssigned = false;
      } else {
        list.push({ email, name, team });
        nowAssigned = true;
      }
      scheduleMap[slotId] = list;

      renderGridStats();

      if (currentSlotId === slotId) {
        const cbs = slotUsersEl.querySelectorAll('input[type="checkbox"]');
        cbs.forEach(cb => {
          if (cb.dataset.email === email) {
            cb.checked = nowAssigned;
          }
        });
      }

      showAdminMessage(
        'Đã cập nhật phân ca tạm thời. Nhớ bấm "Lưu lịch tuần này" để ghi xuống Google Sheet.',
        false
      );
    }

    // ======================================================================
    // SLOT EDITOR (CHI TIẾT) – vẫn giữ logic nhưng section đang ẩn
    // ======================================================================

    function onSlotClick(slotId, dateISO, slot) {
      currentSlotId = slotId;

      const [y, m, d] = dateISO.split('-');
      const dateLabel = `${d}/${m}/${y}`;
      if (slotTitleEl) {
        slotTitleEl.textContent = `Slot ${slot.label} - Ngày ${dateLabel}`;
      }

      const availList = availabilityMap[slotId] || [];
      const assignedList = scheduleMap[slotId] || [];
      const assignedEmails = new Set(
        assignedList.map(u => (u.email || '').toLowerCase())
      );

      if (!slotUsersEl) return;
      slotUsersEl.innerHTML = '';

      if (availList.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Không có ai đăng ký rảnh cho slot này.';
        p.style.fontSize = '14px';
        slotUsersEl.appendChild(p);
      } else {
        availList.forEach(u => {
          const emailKey = (u.email || '').toLowerCase();

          const wrapper = document.createElement('div');
          wrapper.style.marginBottom = '4px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.email = u.email;
          cb.dataset.name  = u.name;
          cb.dataset.team  = u.team || '';
          if (assignedEmails.has(emailKey)) cb.checked = true;

          const label = document.createElement('label');
          label.style.cursor = 'pointer';
          label.style.fontSize = '14px';
          label.appendChild(cb);
          label.appendChild(document.createTextNode(` ${u.name} (${u.email})`));

          wrapper.appendChild(label);
          slotUsersEl.appendChild(wrapper);
        });
      }

      if (slotEditorEmpty) slotEditorEmpty.style.display = 'none';
      if (slotEditor)      slotEditor.style.display = 'block';

      highlightCurrentSlot(slotId);
    }

    function highlightCurrentSlot(slotId) {
      const cells = tbody.querySelectorAll('td.schedule-cell');
      cells.forEach(td => {
        if (td.dataset.slotId === slotId) {
          td.style.background = '#fff3e0';
        } else {
          td.style.background = '';
        }
      });
    }

    function resetSlotEditor() {
      currentSlotId = null;
      if (slotEditorEmpty) slotEditorEmpty.style.display = 'block';
      if (slotEditor)      slotEditor.style.display = 'none';
      if (slotUsersEl)     slotUsersEl.innerHTML = '';
      if (slotTitleEl)     slotTitleEl.textContent = '';
      highlightCurrentSlot(null);
    }

    function saveCurrentSlot() {
      if (!currentSlotId || !slotUsersEl) return;

      const checkboxes = slotUsersEl.querySelectorAll('input[type="checkbox"]');
      const selected = [];

      checkboxes.forEach(cb => {
        if (cb.checked) {
          selected.push({
            email: cb.dataset.email,
            name: cb.dataset.name,
            team: cb.dataset.team || ''
          });
        }
      });

      const byEmail = {};
      selected.forEach(u => {
        const key = (u.email || '').toLowerCase();
        if (!byEmail[key]) byEmail[key] = u;
      });

      scheduleMap[currentSlotId] = Object.values(byEmail);
      renderGridStats();
      showAdminMessage(
        'Đã lưu slot tạm thời (chưa ghi xuống Google Sheet). Nhớ bấm "Lưu lịch tuần này".',
        false
      );
    }

    // ======================================================================
    // LƯU CẢ TUẦN
    // ======================================================================

    async function saveWeekSchedule() {
      clearSaveWeekMessage();

      const weekStart = weekInput.value;
      const team      = teamSelect.value;

      if (!weekStart) {
        showSaveWeekMessage('Vui lòng chọn tuần.', true);
        return;
      }

      const schedule = [];
      Object.keys(scheduleMap).forEach(slotId => {
        const [dateISO, shiftKey] = slotId.split('|');
        const users = scheduleMap[slotId] || [];

        const byEmail = {};
        users.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!byEmail[key]) byEmail[key] = u;
        });

        Object.values(byEmail).forEach(u => {
          schedule.push({
            date: dateISO,
            shift: shiftKey,
            email: u.email,
            name: u.name,
            team: u.team || team,
            note: ''
          });
        });
      });

      try {
        showSaveWeekMessage('Đang lưu lịch...', false);
        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveSchedule',
            weekStart,
            team,
            schedule
          })
        });

        const data = await res.json();
        if (data.success) {
          showSaveWeekMessage('Đã lưu lịch làm xuống Google Sheet.', false);
        } else {
          showSaveWeekMessage('Lỗi lưu lịch: ' + (data.message || ''), true);
        }
      } catch (err) {
        console.error('saveWeekSchedule error', err);
        showSaveWeekMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ======================================================================
    // TRẠNG THÁI TUẦN (ScheduleMeta) + NÚT CHỐT/MỞ
    // ======================================================================

    function updateWeekStatusUI() {
      if (!weekStatusTextEl || !lockWeekBtn) return;

      const weekStart = weekInput.value;
      const team      = teamSelect.value;
      const teamLabel = (team || '').toUpperCase();

      if (!currentMeta || !currentMeta.status || currentMeta.status === 'draft') {
        weekStatusTextEl.textContent =
          `Trạng thái tuần ${weekStart || ''} (${teamLabel}): ĐANG SOẠN. ` +
          'Nhân viên chưa thấy lịch chính thức.';

        lockWeekBtn.textContent = '✅ Chốt lịch tuần này';
        lockWeekBtn.disabled = false;
        lockWeekBtn.style.opacity = '1';
      } else {
        const lockedByName  = currentMeta.lockedByName || '';
        const lockedByEmail = currentMeta.lockedByEmail || '';
        const lockedAt      = currentMeta.lockedAt || '';
        const who = lockedByName || lockedByEmail || '';

        weekStatusTextEl.textContent =
          `Trạng thái tuần ${weekStart || ''} (${teamLabel}): ĐÃ CHỐT.` +
          (lockedAt ? ` Lúc: ${lockedAt}.` : '') +
          (who ? ` Bởi: ${who}.` : '');

        lockWeekBtn.textContent = '🔓 Mở lại để chỉnh sửa';
        lockWeekBtn.disabled = false;
        lockWeekBtn.style.opacity = '1';
      }
    }

    async function onToggleLockClick() {
      const weekStart = weekInput.value;
      const team      = teamSelect.value;

      if (!weekStart) {
        showAdminMessage('Vui lòng chọn tuần trước khi chốt/mở.', true);
        return;
      }

      try {
        lockWeekBtn.disabled = true;
        lockWeekBtn.style.opacity = '0.7';

        const isFinal   = currentMeta && currentMeta.status === 'final';
        const newStatus = isFinal ? 'draft' : 'final';

        const body = {
          action: 'setScheduleStatus',
          weekStart,
          team,
          status: newStatus,
          userEmail: currentUser ? (currentUser.email || '') : '',
          userName: currentUser ? (currentUser.name || '') : '',
          note: ''
        };

        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!data.success) {
          showAdminMessage('Lỗi cập nhật trạng thái lịch: ' + (data.message || ''), true);
        } else {
          currentMeta = data.meta || { status: newStatus };
          updateWeekStatusUI();

          const effectiveStatus = (currentMeta && currentMeta.status) || 'draft';
          if (effectiveStatus === 'final') {
            showAdminMessage('Đã chốt lịch tuần này.', false);
          } else {
            showAdminMessage('Đã mở lại lịch để chỉnh sửa.', false);
          }

          // chỉ render lại section tóm tắt, dùng dữ liệu lịch đang có
          renderFinalSchedule(lastScheduleRaw);
        }
      } catch (err) {
        console.error('onToggleLockClick error', err);
        showAdminMessage('Lỗi kết nối khi chốt/mở lịch. Vui lòng thử lại.', true);
      } finally {
        lockWeekBtn.disabled = false;
        lockWeekBtn.style.opacity = '1';
      }
    }

    // ======================================================================
    // RENDER LỊCH ĐÃ CHỐT (TÓM TẮT) - DẠNG BẢNG GIỜ x NGÀY
    // ======================================================================

    function renderFinalSchedule(dataSched) {
      if (!finalStatusEl || !finalWrapperEl || !finalBodyEl || !finalEmptyEl || !finalHeadRowEl) return;

      const isFinal  = currentMeta && currentMeta.status === 'final';
      const schedule = (dataSched && dataSched.schedule) || [];

      // Chưa chốt -> ẩn bảng, hiện message
      if (!isFinal) {
        finalWrapperEl.style.display = 'none';
        finalEmptyEl.style.display   = 'block';
        finalStatusEl.textContent =
          'Tuần này chưa chốt lịch chính thức. Nhân viên chỉ xem được lịch tạm thời (nếu có).';
        finalHeadRowEl.innerHTML = '';
        finalBodyEl.innerHTML    = '';
        return;
      }

      // Đã chốt nhưng chưa có dòng lịch
      if (!schedule.length) {
        finalWrapperEl.style.display = 'none';
        finalEmptyEl.style.display   = 'block';
        finalStatusEl.textContent =
          'Tuần này đã chốt lịch nhưng chưa có dòng lịch nào trong sheet Schedule.';
        finalHeadRowEl.innerHTML = '';
        finalBodyEl.innerHTML    = '';
        return;
      }

      finalWrapperEl.style.display = 'block';
      finalEmptyEl.style.display   = 'none';
      finalStatusEl.textContent    = 'Đây là lịch làm chính thức (đã chốt) cho tuần này.';

      // ---- 1. Chuẩn bị map: date -> slotIndex -> set(personKey) ----
      const slotIndexByKey = {};
      timeSlots.forEach((slot, idx) => {
        slotIndexByKey[slot.key] = idx;
      });

      const dateSlotPersons   = {}; // dateISO -> Array(timeSlots.length) of Set(personKey)
      const personMetaByDate  = {}; // dateISO -> { personKey: {name, team, note} }

      schedule.forEach(item => {
        const dateISO  = (item.date || '').substring(0, 10);
        const shiftKey = item.shift || '';
        const idx      = slotIndexByKey[shiftKey];
        if (idx == null) return; // shift ko nằm trong timeSlots -> bỏ

        if (!dateSlotPersons[dateISO]) {
          dateSlotPersons[dateISO]  = Array(timeSlots.length).fill(null).map(() => new Set());
          personMetaByDate[dateISO] = {};
        }

        const email   = (item.email || '').toString().trim().toLowerCase();
        const name    = item.name || item.email || '';
        const team    = (item.team || '').toUpperCase();
        const note    = item.note || '';
        const pKey    = email || name; // fallback nếu ko có email

        dateSlotPersons[dateISO][idx].add(pKey);

        if (!personMetaByDate[dateISO][pKey]) {
          personMetaByDate[dateISO][pKey] = { name, team, note };
        }
      });

      // ---- 2. Tính label theo slot cho từng ngày ----
      const labelsByDateSlot = {};
      dates.forEach(dateISO => {
        labelsByDateSlot[dateISO] = Array(timeSlots.length).fill(null).map(() => []);

        const slotsArr   = dateSlotPersons[dateISO];
        if (!slotsArr) return;

        const personMeta = personMetaByDate[dateISO] || {};
        const persons    = Object.keys(personMeta);

        persons.forEach(pKey => {
          for (let i = 0; i < timeSlots.length; i++) {
            const hasHere = slotsArr[i] && slotsArr[i].has(pKey);
            if (!hasHere) continue;

            const meta = personMeta[pKey];
            const text = meta.name; // chỉ hiện tên trong từng ô
            labelsByDateSlot[dateISO][i].push(text);
          }
        });
      });

      // ---- 3. Header: Giờ / Ngày + 7 ngày trong tuần ----
      finalHeadRowEl.innerHTML = '';
      const thTime = document.createElement('th');
      thTime.textContent = 'Giờ / Ngày';
      finalHeadRowEl.appendChild(thTime);

      dates.forEach(dateISO => {
        const th = document.createElement('th');
        th.textContent = formatDateWithDow(dateISO);
        finalHeadRowEl.appendChild(th);
      });

      // ---- 4. Body: mỗi hàng = 1 slot giờ, mỗi cột = 1 ngày ----
      finalBodyEl.innerHTML = '';

      timeSlots.forEach((slot, slotIndex) => {
        const tr = document.createElement('tr');

        const thSlot = document.createElement('th');
        thSlot.textContent = formatShiftLabel(slot.key); // "09:00 - 10:00"
        tr.appendChild(thSlot);

        dates.forEach(dateISO => {
          const td = document.createElement('td');
          const labels = (labelsByDateSlot[dateISO] && labelsByDateSlot[dateISO][slotIndex]) || [];

          if (labels.length) {
            labels.forEach(text => {
              const span = document.createElement('span');
              span.textContent = text;
              span.style.display = 'inline-block';
              span.style.fontSize = '11px';
              span.style.padding = '2px 8px';
              span.style.borderRadius = '999px';
              span.style.marginRight = '4px';
              span.style.marginBottom = '2px';

              // Use new color palette for finalized schedule
              const colors = getColorForEmail(text);
              span.style.background = colors.bg;
              span.style.color = colors.text;

              td.appendChild(span);
            });
          }

          tr.appendChild(td);
        });

        finalBodyEl.appendChild(tr);
      });
    }

function formatShiftLabel(shiftKey) {
  if (!/^\d{2}-\d{2}$/.test(shiftKey)) return shiftKey;
  const [h1] = shiftKey.split('-');
  // chỉ giờ bắt đầu, ví dụ "08:00"
  return `${h1}:00`;
}


    function formatDateWithDow(dateISO) {
      if (!dateISO) return '';
      const d = new Date(dateISO + 'T00:00:00');
      if (isNaN(d.getTime())) return dateISO;

      const dow = d.getDay(); // 0=CN
      const dowMap = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const labelDow = dowMap[dow] || '';

      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();

      return `${dd}/${mm}/${yyyy} (${labelDow})`;
    }

    function formatDateShort(dateISO) {
      if (!dateISO) return '';
      const d = new Date(dateISO + 'T00:00:00');
      if (isNaN(d.getTime())) return dateISO;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    // ======================================================================
    // UTILS
    // ======================================================================

    function showAdminMessage(text, isError) {
      if (!adminMsgEl) return;
      adminMsgEl.textContent = text || '';
      adminMsgEl.style.color = isError ? '#d32f2f' : '#455a64';
    }

    function clearAdminMessage() {
      showAdminMessage('', false);
    }

    function showSaveWeekMessage(text, isError) {
      if (!saveWeekMsgEl) return;
      saveWeekMsgEl.textContent = text || '';
      saveWeekMsgEl.style.color = isError ? '#d32f2f' : '#388e3c';
    }

    function clearSaveWeekMessage() {
      showSaveWeekMessage('', false);
    }

    function addDays(date, days) {
      const d = new Date(date.getTime());
      d.setDate(d.getDate() + days);
      return d;
    }

    function toISODate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function pad2(n) {
      return String(n).padStart(2, '0');
    }

    function getNextMondayISO() {
      const now = new Date();
      const day = now.getDay(); // 0=CN,1=2,...6=7
      const daysToNextMonday = ((8 - day) % 7) || 7;
      const nextMonday = addDays(now, daysToNextMonday);
      return toISODate(nextMonday);
    }

    // ======================================================================
    // QUICK ASSIGNMENT PANEL FUNCTIONS
    // ======================================================================

    /**
     * Update Quick Assignment Panel với employee list
     */
    function updateQuickAssignmentPanel() {
      // Extract all unique employees from availabilityMap
      const employeeSet = new Map(); // email -> {email, name, team}

      Object.values(availabilityMap).forEach(userList => {
        userList.forEach(u => {
          const email = (u.email || '').toLowerCase();
          if (email && !employeeSet.has(email)) {
            employeeSet.set(email, {
              email: u.email,
              name: u.name || u.email,
              team: u.team || ''
            });
          }
        });
      });

      allEmployees = Array.from(employeeSet.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );

      // Populate dropdown
      if (qaEmployeeSelect) {
        qaEmployeeSelect.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
        allEmployees.forEach(emp => {
          const option = document.createElement('option');
          option.value = emp.email;
          option.textContent = `${emp.name} (${emp.team.toUpperCase()})`;
          qaEmployeeSelect.appendChild(option);
        });
      }

      // Populate employee list (for reference)
      const qaEmployeeList = document.getElementById('qa-employee-list');
      if (qaEmployeeList) {
        if (allEmployees.length === 0) {
          qaEmployeeList.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-style:italic;">Chưa có nhân viên nào đăng ký</div>';
        } else {
          qaEmployeeList.innerHTML = '';
          allEmployees.forEach(emp => {
            const div = document.createElement('div');
            div.style.padding = '8px 6px';
            div.style.borderRadius = '4px';
            div.style.marginBottom = '4px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'space-between';
            div.style.transition = 'all 0.2s ease';
            div.style.cursor = 'default';

            div.addEventListener('mouseenter', () => {
              div.style.background = '#f8f9fa';
              div.style.transform = 'translateX(2px)';
            });

            div.addEventListener('mouseleave', () => {
              div.style.background = 'transparent';
              div.style.transform = 'translateX(0)';
            });

            const nameWrapper = document.createElement('div');
            nameWrapper.style.display = 'flex';
            nameWrapper.style.alignItems = 'center';
            nameWrapper.style.gap = '6px';

            const span = document.createElement('span');
            span.style.display = 'inline-block';
            span.style.padding = '3px 8px';
            span.style.borderRadius = '6px';
            span.style.background = getColorForEmail(emp.email);
            span.style.fontSize = '11px';
            span.style.fontWeight = '500';
            span.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            span.textContent = emp.name;

            const teamBadge = document.createElement('span');
            teamBadge.style.fontSize = '9px';
            teamBadge.style.padding = '2px 6px';
            teamBadge.style.borderRadius = '4px';
            teamBadge.style.background = emp.team.toLowerCase() === 'cs' ? '#e3f2fd' : '#fce4ec';
            teamBadge.style.color = emp.team.toLowerCase() === 'cs' ? '#1976d2' : '#c2185b';
            teamBadge.style.fontWeight = '600';
            teamBadge.textContent = emp.team.toUpperCase();

            nameWrapper.appendChild(span);
            div.appendChild(nameWrapper);
            div.appendChild(teamBadge);
            qaEmployeeList.appendChild(div);
          });
        }
      }

      // Reset selection
      selectedCells.clear();
      updateQACountDisplay();
      updateQAAssignButtonState();
      clearCellSelectionHighlights();
    }

    /**
     * Handle cell click for multi-selection
     */
    function onCellClickForSelection(slotId, tdElement) {
      if (selectedCells.has(slotId)) {
        selectedCells.delete(slotId);
        tdElement.classList.remove('qa-selected');
      } else {
        selectedCells.add(slotId);
        tdElement.classList.add('qa-selected');
      }

      updateQACountDisplay();
      updateQAAssignButtonState();
    }

    /**
     * Update selected count display
     */
    function updateQACountDisplay() {
      if (qaCountValue) {
        qaCountValue.textContent = selectedCells.size;
      }
    }

    /**
     * Update assign button state (enabled/disabled)
     */
    function updateQAAssignButtonState() {
      if (!qaAssignBtn) return;

      const hasEmployee = qaEmployeeSelect && qaEmployeeSelect.value;
      const hasCells = selectedCells.size > 0;

      qaAssignBtn.disabled = !(hasEmployee && hasCells);
    }

    /**
     * Handle employee selection change
     */
    function onQAEmployeeChange() {
      updateQAAssignButtonState();
    }

    /**
     * Handle Quick Assign button click
     */
    function onQAAssign() {
      if (!qaEmployeeSelect) return;

      const selectedEmail = qaEmployeeSelect.value;
      if (!selectedEmail || selectedCells.size === 0) {
        showAdminMessage('Vui lòng chọn nhân viên và ít nhất 1 slot.', true);
        return;
      }

      const employee = allEmployees.find(e => e.email === selectedEmail);
      if (!employee) {
        showAdminMessage('Không tìm thấy thông tin nhân viên.', true);
        return;
      }

      // Assign employee to all selected cells
      let assignedCount = 0;
      selectedCells.forEach(slotId => {
        let list = scheduleMap[slotId] || [];

        // Check if already assigned
        const idx = list.findIndex(
          u => (u.email || '').toLowerCase() === (employee.email || '').toLowerCase()
        );

        if (idx < 0) {
          // Not assigned yet -> add
          list.push({
            email: employee.email,
            name: employee.name,
            team: employee.team
          });
          assignedCount++;
        }

        scheduleMap[slotId] = list;
      });

      // Re-render grid
      renderGridStats();

      // Clear selection
      selectedCells.clear();
      clearCellSelectionHighlights();
      updateQACountDisplay();
      updateQAAssignButtonState();

      showAdminMessage(
        `Đã phân ca ${employee.name} vào ${assignedCount} slot. Nhớ bấm "Lưu lịch tuần này".`,
        false
      );
    }

    /**
     * Handle clear selection button click
     */
    function onQAClearSelection() {
      selectedCells.clear();
      clearCellSelectionHighlights();
      updateQACountDisplay();
      updateQAAssignButtonState();
    }

    /**
     * Clear all cell selection highlights
     */
    function clearCellSelectionHighlights() {
      const cells = tbody.querySelectorAll('td.schedule-cell');
      cells.forEach(td => {
        td.classList.remove('qa-selected');
      });
    }
  }
};
