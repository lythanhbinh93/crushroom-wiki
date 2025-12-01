// js/schedule-admin.js
// Trang leader xem đăng ký & phân ca theo giờ

window.ScheduleAdminPage = {
  init() {
    const weekInput   = document.getElementById('week-start-admin');
    const teamSelect  = document.getElementById('team-select-admin');
    const loadBtn     = document.getElementById('load-admin-btn');
    const tbody       = document.getElementById('schedule-admin-body');
    const adminMsgEl  = document.getElementById('admin-message');

    const slotEditorSection = document.getElementById('slot-editor-section');
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

    // State
    let dates = [];           // 7 ngày trong tuần
    let timeSlots = [];       // [{key, label}]
    let availabilityMap = {}; // slotId -> [{email,name,team}]
    let scheduleMap = {};     // slotId -> [{email,name,team}]
    let currentSlotId = null; // slot đang chỉnh

    // Tuần mặc định: thứ 2 tuần sau
    weekInput.value = getNextMondayISO();

    // Setup events
    loadBtn.addEventListener('click', () => {
      loadData();
    });

    teamSelect.addEventListener('change', () => {
      loadData(); // đổi team là load lại
    });

    slotSaveBtn.addEventListener('click', saveCurrentSlot);
    saveWeekBtn.addEventListener('click', saveWeekSchedule);

    // Lần đầu load
    loadData();

    // ========== MAIN FLOW ==========

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
        scheduleMap = buildScheduleMap(dataSched);

        renderGridStats();
        showAdminMessage('Đã tải dữ liệu đăng ký & lịch hiện tại.', false);
      } catch (err) {
        console.error('ScheduleAdmin loadData error', err);
        showAdminMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ========== BUILD STRUCTURE ==========

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
        const key = `${pad2(h)}-${pad2(next)}`; // 08-09
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
          statsEl.textContent = '-';

          const hintEl = document.createElement('div');
          hintEl.classList.add('slot-hint');
          hintEl.style.opacity = '0.7';
          hintEl.textContent = 'Click để phân ca';

          inner.appendChild(statsEl);
          inner.appendChild(hintEl);

          td.appendChild(inner);

          td.addEventListener('click', () => {
            onSlotClick(slotId, dateISO, slot);
          });

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    function renderGridStats() {
      const cells = tbody.querySelectorAll('td.schedule-cell');
      cells.forEach(td => {
        const slotId = td.dataset.slotId;
        const statsEl = td.querySelector('.slot-stats');

        const avail = (availabilityMap[slotId] || []).length;
        const assigned = (scheduleMap[slotId] || []).length;

        statsEl.textContent = `${assigned}/${avail} người`;
      });
    }

function buildAvailabilityMap(dataAvail) {
  const map = {};
  if (!dataAvail || !dataAvail.success || !dataAvail.slots) return map;

  dataAvail.slots.forEach(slot => {
    if (!slot) return;

    // Chuẩn hoá date về YYYY-MM-DD cho chắc
    const rawDate = String(slot.date || '').trim();
    const date = rawDate.substring(0, 10); // "2025-12-11"

    // Chuẩn hoá shift: chỉ lấy dạng HH-HH (09-10, 13-14, ...)
    const rawShift = String(slot.shift || '').trim();
    if (!/^\d{2}-\d{2}$/.test(rawShift)) {
      // Những slot cũ kiểu "Sat Aug 09 2025..." sẽ bị bỏ qua
      return;
    }
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
        map[key].push({
          email: item.email,
          name: item.name,
          team: item.team
        });
      });

      return map;
    }

    // ========== SLOT EDITOR ==========

    function onSlotClick(slotId, dateISO, slot) {
      currentSlotId = slotId;

      const [dYear, dMonth, dDay] = dateISO.split('-');
      const dateLabel = `${dDay}/${dMonth}/${dYear}`;
      slotTitleEl.textContent = `Slot ${slot.label} - Ngày ${dateLabel}`;

      const availList = availabilityMap[slotId] || [];
      const assignedList = scheduleMap[slotId] || [];
      const assignedEmails = new Set(assignedList.map(u => u.email));

      slotUsersEl.innerHTML = '';

      if (availList.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Không có ai đăng ký rảnh cho slot này.';
        p.style.fontSize = '14px';
        slotUsersEl.appendChild(p);
      } else {
        availList.forEach(u => {
          const wrapper = document.createElement('div');
          wrapper.style.marginBottom = '4px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.email = u.email;
          cb.dataset.name = u.name;
          cb.dataset.team = u.team || '';
          if (assignedEmails.has(u.email)) {
            cb.checked = true;
          }

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

      scheduleMap[currentSlotId] = selected;
      renderGridStats();
      showAdminMessage('Đã lưu slot tạm thời (chưa ghi xuống Google Sheet). Nhớ bấm "Lưu lịch tuần này".', false);
    }

    async function saveWeekSchedule() {
      clearSaveWeekMessage();

      const weekStart = weekInput.value;
      const team = teamSelect.value;

      if (!weekStart) {
        showSaveWeekMessage('Vui lòng chọn tuần.', true);
        return;
      }

      // Flatten scheduleMap thành array
      const schedule = [];
      Object.keys(scheduleMap).forEach(slotId => {
        const [dateISO, shiftKey] = slotId.split('|');
        const users = scheduleMap[slotId] || [];
        users.forEach(u => {
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

    // ========== UTILS ==========

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
