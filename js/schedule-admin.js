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

    // Màu cho từng nhân viên
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
    if (lockWeekBtn) {
      lockWeekBtn.addEventListener('click', onToggleLockClick);
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

    // ======================================================================
    // CẬP NHẬT GRID (SỐ LƯỢNG + TÊN)
    // ======================================================================

    function renderGridStats() {
      const cells = tbody.querySelectorAll('td.schedule-cell');

      cells.forEach(td => {
        const slotId  = td.dataset.slotId;
        const statsEl = td.querySelector('.slot-stats');
        const namesEl = td.querySelector('.slot-names');

        const availList    = availabilityMap[slotId] || [];
        const assignedList = scheduleMap[slotId] || [];

        const availCount    = new Set(availList.map(u => (u.email || '').toLowerCase())).size;
        const assignedCount = new Set(assignedList.map(u => (u.email || '').toLowerCase())).size;
        statsEl.textContent = `${assignedCount}/${availCount} người`;

        namesEl.innerHTML = '';
        if (availCount === 0) return;

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

          // render lại section tóm tắt theo meta mới
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
    // RENDER LỊCH ĐÃ CHỐT (TÓM TẮT) - DẠNG BẢNG GIỜ x NGÀY, GỘP CA LIÊN TIẾP
    // ======================================================================

    function renderFinalSchedule(dataSched) {
      if (!finalStatusEl || !finalWrapperEl || !finalBodyEl || !finalEmptyEl || !finalHeadRowEl) return;

      const isFinal  = currentMeta && currentMeta.status === 'final';
      const schedule = (dataSched && dataSched.schedule) || [];

      if (!isFinal) {
        finalWrapperEl.style.display = 'none';
        finalEmptyEl.style.display   = 'block';
        finalStatusEl.textContent =
          'Tuần này chưa chốt lịch chính thức. Nhân viên chỉ xem được lịch tạm thời (nếu có).';
        finalHeadRowEl.innerHTML = '';
        finalBodyEl.innerHTML    = '';
        return;
      }

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

      // ---- 1. Map: date -> slotIndex -> set(personKey) ----
      const slotIndexByKey = {};
      timeSlots.forEach((slot, idx) => {
        slotIndexByKey[slot.key] = idx;
      });

      const dateSlotPersons  = {}; // dateISO -> Array(timeSlots.length) of Set(personKey)
      const personMetaByDate = {}; // dateISO -> { personKey: {name, team, note, email} }

      schedule.forEach(item => {
        const dateISO  = (item.date || '').substring(0, 10);
        const shiftKey = item.shift || '';
        const idx      = slotIndexByKey[shiftKey];
        if (idx == null) return;

        if (!dateSlotPersons[dateISO]) {
          dateSlotPersons[dateISO]  = Array(timeSlots.length).fill(null).map(() => new Set());
          personMetaByDate[dateISO] = {};
        }

        const emailRaw = (item.email || '').toString().trim().toLowerCase();
        const email    = emailRaw || (item.email || '');
        const name     = item.name || item.email || '';
        const team     = (item.team || '').toUpperCase();
        const note     = item.note || '';
        const pKey     = email || name;

        dateSlotPersons[dateISO][idx].add(pKey);

        if (!personMetaByDate[dateISO][pKey]) {
          personMetaByDate[dateISO][pKey] = { name, team, note, email };
        }
      });

      // ---- 2. Tính block liên tiếp cho từng người trong 1 ngày,
      // tạo cấu trúc spanInfoByDate để dùng rowspan
      const spanInfoByDate = {};

      dates.forEach(dateISO => {
        const slotsArr = dateSlotPersons[dateISO];
        const spanInfo = Array(timeSlots.length).fill(null);

        if (!slotsArr) {
          spanInfoByDate[dateISO] = spanInfo;
          return;
        }

        const personMeta = personMetaByDate[dateISO] || {};
        const persons    = Object.keys(personMeta);

        persons.forEach(pKey => {
          let i = 0;
          while (i < timeSlots.length) {
            const hasHere = slotsArr[i] && slotsArr[i].has(pKey);
            if (!hasHere) {
              i++;
              continue;
            }

            const startIdx = i;
            let j = i + 1;
            while (j < timeSlots.length &&
                   slotsArr[j] &&
                   slotsArr[j].has(pKey)) {
              j++;
            }
            const endIdx = j - 1;

            let span = spanInfo[startIdx];
            if (!span) {
              const startHour = timeSlots[startIdx].key.split('-')[0];
              const endHour   = timeSlots[endIdx].key.split('-')[1];
              span = {
                rowspan: endIdx - startIdx + 1,
                persons: [],
                startIdx,
                endIdx,
                rangeLabel: `${startHour}:00 - ${endHour}:00`
              };
              spanInfo[startIdx] = span;

              for (let k = startIdx + 1; k <= endIdx; k++) {
                spanInfo[k] = 'skip';
              }
            }

            span.persons.push(personMeta[pKey]);
            i = j;
          }
        });

        spanInfoByDate[dateISO] = spanInfo;
      });

      // ---- 3. Header: Giờ / Ngày ----
      finalHeadRowEl.innerHTML = '';
      const thTime = document.createElement('th');
      thTime.textContent = 'Giờ / Ngày';
      finalHeadRowEl.appendChild(thTime);

      dates.forEach(dateISO => {
        const th = document.createElement('th');
        th.textContent = formatDateWithDow(dateISO);
        finalHeadRowEl.appendChild(th);
      });

      // ---- 4. Body: mỗi hàng = 1 slot giờ, mỗi cột = 1 ngày (dùng rowspan) ----
      finalBodyEl.innerHTML = '';

      timeSlots.forEach((slot, slotIndex) => {
        const tr = document.createElement('tr');

        const thSlot = document.createElement('th');
        thSlot.textContent = formatShiftLabel(slot.key);
        tr.appendChild(thSlot);

        dates.forEach(dateISO => {
          const span = (spanInfoByDate[dateISO] && spanInfoByDate[dateISO][slotIndex]) || null;

          if (span === 'skip') {
            // ô này đã được rowspan từ trên, không vẽ gì
            return;
          }

          const td = document.createElement('td');
          td.style.verticalAlign = 'middle';

          if (span && span.rowspan > 1) {
            td.rowSpan = span.rowspan;
          }

          if (span && span.persons && span.persons.length) {
            span.persons.forEach(info => {
              const pill = document.createElement('span');
              pill.textContent = info.name || '';
              pill.style.display      = 'inline-block';
              pill.style.padding      = '2px 8px';
              pill.style.borderRadius = '999px';
              pill.style.marginRight  = '4px';
              pill.style.marginBottom = '2px';
              pill.style.fontSize     = '12px';
              pill.style.fontWeight   = '500';

              const color = getColorForEmail(info.email || info.name || '');
              pill.style.background = color;
              pill.style.border     = '1px solid rgba(0,0,0,0.25)';

              let tip = span.rangeLabel || '';
              if (info.team) tip += (tip ? ' • ' : '') + info.team;
              if (info.note) tip += (tip ? ' • ' : '') + info.note;
              pill.title = tip;

              td.appendChild(pill);
            });
          }

          tr.appendChild(td);
        });

        finalBodyEl.appendChild(tr);
      });
    }

    function formatShiftLabel(shiftKey) {
      if (!/^\d{2}-\d{2}$/.test(shiftKey)) return shiftKey;
      const [h1, h2] = shiftKey.split('-');
      return `${h1}:00 - ${h2}:00`;
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
