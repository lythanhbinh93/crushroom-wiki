// js/schedule-admin.js
// Trang leader xem đăng ký & phân ca theo giờ

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

    if (!weekInput || !teamSelect || !loadBtn || !tbody) {
      console.warn('ScheduleAdmin: missing elements, skip init');
      return;
    }

        // ==== STATE ============================================================
    let dates = [];           // 7 ngày trong tuần
    let timeSlots = [];       // [{key, label}]
    let availabilityMap = {}; // slotId -> [{email,name,team}]
    let scheduleMap = {};     // slotId -> [{email,name,team}]
    let currentSlotId = null; // slot đang chỉnh trong editor

    // Màu cho từng nhân viên (mỗi email 1 màu cố định)
    const COLOR_PALETTE = [
      '#FFEBEE', '#E3F2FD', '#E8F5E9', '#FFF3E0',
      '#F3E5F5', '#E0F7FA', '#F9FBE7', '#FCE4EC'
    ];
    const colorByEmail = {};
    function getColorForEmail(email) {
      const key = (email || '').toLowerCase();
      if (!key) return '#f1f3f4';

      if (!colorByEmail[key]) {
        const index = Object.keys(colorByEmail).length % COLOR_PALETTE.length;
        colorByEmail[key] = COLOR_PALETTE[index];
      }
      return colorByEmail[key];
    }

    // Tuần mặc định: thứ 2 tuần sau
    weekInput.value = getNextMondayISO();

    // Events
    loadBtn.addEventListener('click', () => loadData());
    teamSelect.addEventListener('change', () => loadData());
    slotSaveBtn.addEventListener('click', saveCurrentSlot);
    saveWeekBtn.addEventListener('click', saveWeekSchedule);

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
      const team = teamSelect.value;

      if (!weekStart) {
        showAdminMessage('Vui lòng chọn tuần bắt đầu.', true);
        return;
      }

      buildDates(weekStart);
      buildTimeSlots(team);
      buildGrid(); // vẽ bảng trống trước

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

        const [resAvail, resSched] = await Promise.all([
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
          })
        ]);

        const dataAvail = await resAvail.json();
        const dataSched = await resSched.json();

        availabilityMap = buildAvailabilityMap(dataAvail);
        scheduleMap     = buildScheduleMap(dataSched);

        renderGridStats();
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
        const label = `${pad2(h)}:00 - ${pad2(next)}:00`;
        timeSlots.push({ key, label });
      }
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
          inner.style.fontSize = '12px';

          const statsEl = document.createElement('div');
          statsEl.classList.add('slot-stats');
          statsEl.textContent = '0/0 người';

          const hintEl = document.createElement('div');
          hintEl.classList.add('slot-hint');
          hintEl.style.opacity = '0.7';
          hintEl.textContent = 'Click để phân ca';

          const namesEl = document.createElement('div');
          namesEl.classList.add('slot-names');
          namesEl.style.fontSize = '11px';
          namesEl.style.marginTop = '2px';
          namesEl.style.color = '#555';

          inner.appendChild(statsEl);
          inner.appendChild(hintEl);
          inner.appendChild(namesEl);

          td.appendChild(inner);

          // Click cả ô: mở editor chi tiết
          td.addEventListener('click', () => {
            onSlotClick(slotId, dateISO, slot);
          });

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    // Cập nhật số lượng & danh sách tên trong từng ô
        function renderGridStats() {
      const cells = tbody.querySelectorAll('td.schedule-cell');

      cells.forEach(td => {
        const slotId  = td.dataset.slotId;
        const statsEl = td.querySelector('.slot-stats');
        const namesEl = td.querySelector('.slot-names');

        const availList    = availabilityMap[slotId] || [];
        const assignedList = scheduleMap[slotId] || [];

        // Đếm UNIQUE theo email để tránh trùng
        const availCount    = new Set(availList.map(u => (u.email || '').toLowerCase())).size;
        const assignedCount = new Set(assignedList.map(u => (u.email || '').toLowerCase())).size;
        statsEl.textContent = `${assignedCount}/${availCount} người`;

        // Hiển thị tên
        namesEl.innerHTML = '';
        if (availCount === 0) return;

        // Gom theo email (unique)
        const availByEmail = {};
        availList.forEach(u => {
          const key = (u.email || '').toLowerCase();
          if (!key) return;
          if (!availByEmail[key]) availByEmail[key] = u;
        });

        Object.values(availByEmail).forEach(u => {
          const emailKey   = (u.email || '').toLowerCase();
          const isAssigned = assignedList.some(
            a => (a.email || '').toLowerCase() === emailKey
          );

          const span = document.createElement('span');
          span.classList.add('slot-name-pill');
          span.style.display      = 'inline-block';
          span.style.padding      = '2px 8px';
          span.style.borderRadius = '999px';
          span.style.marginRight  = '4px';
          span.style.marginBottom = '2px';
          span.style.cursor       = 'pointer';

          // màu riêng cho từng nhân viên
          const baseColor = getColorForEmail(emailKey);
          span.style.background = baseColor;
          span.style.border     = isAssigned ? '1px solid rgba(0,0,0,0.35)'
                                             : '1px solid transparent';
          span.style.opacity    = isAssigned ? '1' : '0.5';
          span.style.fontWeight = isAssigned ? '600' : '400';

          span.dataset.slotId = slotId;
          span.dataset.email  = u.email;
          span.dataset.name   = u.name || '';
          span.dataset.team   = u.team || '';

          span.textContent = (isAssigned ? '✅ ' : '') + (u.name || u.email);

          // Click tên để toggle assign
          span.addEventListener('click', onNameClick);

          namesEl.appendChild(span);
        });
      });
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
        const date    = rawDate.substring(0, 10); // YYYY-MM-DD

        const rawShift = String(slot.shift || '').trim();
        if (!/^\d{2}-\d{2}$/.test(rawShift)) return; // chỉ nhận HH-HH
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
    // CLICK TRÊN TÊN (TOGGLE ASSIGN) – KHÔNG CẦN toggleAssignUser RIÊNG
    // ======================================================================

    function onNameClick(evt) {
      // Không cho lan lên td -> tránh mở editor
      evt.stopPropagation();

      const span   = evt.currentTarget;
      const slotId = span.dataset.slotId;
      const email  = span.dataset.email;
      const name   = span.dataset.name;
      const team   = span.dataset.team || '';

      let list = scheduleMap[slotId] || [];
      const idx = list.findIndex(u => (u.email || '').toLowerCase() === (email || '').toLowerCase());

      let nowAssigned;
      if (idx >= 0) {
        // Đang được xếp ca -> bỏ
        list.splice(idx, 1);
        nowAssigned = false;
      } else {
        // Chưa xếp -> thêm
        list.push({ email, name, team });
        nowAssigned = true;
      }
      scheduleMap[slotId] = list;

      // Cập nhật lại toàn bộ grid
      renderGridStats();

      // Đồng bộ checkbox trong editor nếu đang mở đúng slot
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
    // SLOT EDITOR (CHI TIẾT)
    // ======================================================================

    function onSlotClick(slotId, dateISO, slot) {
      currentSlotId = slotId;

      const [y, m, d] = dateISO.split('-');
      const dateLabel = `${d}/${m}/${y}`;
      slotTitleEl.textContent = `Slot ${slot.label} - Ngày ${dateLabel}`;

      const availList = availabilityMap[slotId] || [];
      const assignedList = scheduleMap[slotId] || [];
      const assignedEmails = new Set(
        assignedList.map(u => (u.email || '').toLowerCase())
      );

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

      slotEditorEmpty.style.display = 'none';
      slotEditor.style.display = 'block';

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
      slotEditorEmpty.style.display = 'block';
      slotEditor.style.display = 'none';
      slotUsersEl.innerHTML = '';
      slotTitleEl.textContent = '';
      highlightCurrentSlot(null);
    }

    function saveCurrentSlot() {
      if (!currentSlotId) return;

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

      // Loại trùng email (nếu có)
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

        // đảm bảo unique theo email trong 1 slot
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
  }
};
