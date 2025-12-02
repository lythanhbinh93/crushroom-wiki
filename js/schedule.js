// js/schedule.js
// Trang nhân viên đăng ký lịch rảnh theo giờ

window.SchedulePage = {
  init() {
    const weekInput   = document.getElementById('week-start-input');
    const loadWeekBtn = document.getElementById('load-week-btn');
    const tbody       = document.getElementById('availability-body');
    const msgEl       = document.getElementById('schedule-message');
    const teamLabelEl = document.getElementById('team-label');

    const editBtn     = document.getElementById('edit-availability-btn');
    const cancelBtn   = document.getElementById('cancel-edit-availability-btn');
    const saveBtn     = document.getElementById('save-availability-btn');

    if (!weekInput || !tbody || !loadWeekBtn || !saveBtn) {
      console.warn('SchedulePage: missing elements, skip init');
      return;
    }

    const currentUser = Auth.getCurrentUser && Auth.getCurrentUser();
    if (!currentUser) {
      console.warn('SchedulePage: no currentUser');
      return;
    }

    // ===== State =====
    let dates = [];           // 7 ngày trong tuần
    let timeSlots = [];       // [{key, label}]
    let selectedSlots = new Set(); // "YYYY-MM-DD|HH-HH"
    let mode = 'view';        // 'view' | 'edit'
    let userTeam = 'mo';      // 'cs' | 'mo'

    // Xác định team từ quyền user
    if (currentUser.permissions && currentUser.permissions.cs) {
      userTeam = 'cs';
    } else {
      userTeam = 'mo';
    }

    if (teamLabelEl) {
      if (userTeam === 'cs') {
        teamLabelEl.textContent =
          'Bạn thuộc team Customer Service (CS). Khung giờ đăng ký: 08:00 – 24:00, từng giờ một.';
      } else {
        teamLabelEl.textContent =
          'Bạn thuộc team Marketing / khác (MO). Khung giờ đăng ký: 09:00 – 18:00, từng giờ một.';
      }
    }

    // Tuần mặc định = thứ 2 tuần sau
    weekInput.value = getNextMondayISO();

    // ===== Events =====
    loadWeekBtn.addEventListener('click', () => {
      loadWeek();
    });

    weekInput.addEventListener('change', () => {
      loadWeek();
    });

    editBtn.addEventListener('click', () => {
      setMode('edit');
      showMessage('Bạn đang chỉnh sửa lịch rảnh. Nhấn vào ô để bật / tắt.', false);
    });

    cancelBtn.addEventListener('click', () => {
      // Load lại lịch đã lưu từ server
      loadWeek();
    });

    saveBtn.addEventListener('click', () => {
      saveAvailability();
    });

    // Lần đầu
    loadWeek();

    // ========= MAIN FLOW =========

    async function loadWeek() {
      clearMessage();
      selectedSlots.clear();

      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần bắt đầu.', true);
        return;
      }

      buildDates(weekStart);
      buildTimeSlotsForUserTeam(userTeam);
      buildGrid(); // vẽ bảng trống

      try {
        showMessage('Đang tải lịch rảnh đã đăng ký...', false);

        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'getAvailability',
            email: currentUser.email,
            weekStart
          })
        });

        const data = await res.json();

        if (data.success && Array.isArray(data.availability)) {
          data.availability.forEach(item => {
            const date = String(item.date || '').trim().substring(0, 10);
            const shift = String(item.shift || '').trim();
            if (/^\d{2}-\d{2}$/.test(shift)) {
              selectedSlots.add(`${date}|${shift}`);
            }
          });
        }

        renderSelectedSlots();
        setMode('view');

        if (selectedSlots.size > 0) {
          showMessage(
            'Đây là lịch rảnh bạn đã lưu. Bấm "Sửa lịch rảnh" nếu muốn thay đổi.',
            false
          );
        } else {
          showMessage(
            'Bạn chưa đăng ký lịch rảnh cho tuần này. Bấm "Sửa lịch rảnh" để bắt đầu đăng ký.',
            false
          );
        }
      } catch (err) {
        console.error('loadWeek error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ========= BUILD STRUCTURE =========

    function buildDates(weekStartISO) {
      dates = [];
      const d0 = new Date(weekStartISO + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const d = addDays(d0, i);
        dates.push(toISODate(d));
      }
    }

    function buildTimeSlotsForUserTeam(team) {
      let startHour, endHour;
      if (team === 'cs') {
        startHour = 8;
        endHour   = 24; // 23-24
      } else {
        startHour = 9;
        endHour   = 18; // 17-18
      }

      timeSlots = [];
      for (let h = startHour; h < endHour; h++) {
        const next = (h + 1) % 24;
        const key = `${pad2(h)}-${pad2(next)}`; // 09-10
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
          inner.textContent = ''; // sẽ được set trong renderSelectedSlots

          td.appendChild(inner);

          td.addEventListener('click', () => {
            onSlotClick(slotId);
          });

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      renderSelectedSlots();
    }

    function renderSelectedSlots() {
      const cells = tbody.querySelectorAll('td.schedule-cell');
      cells.forEach(td => {
        const slotId = td.dataset.slotId;
        const inner = td.querySelector('.slot-cell-inner');
        if (!inner) return;

        if (selectedSlots.has(slotId)) {
          td.style.background = '#e3f2fd';
          if (mode === 'edit') {
            inner.textContent = 'Đã chọn (bấm để bỏ)';
          } else {
            inner.textContent = 'Đã chọn';
          }
        } else {
          td.style.background = '';
          if (mode === 'edit') {
            inner.textContent = 'Nhấn để chọn';
          } else {
            inner.textContent = '';
          }
        }
      });
    }

    function onSlotClick(slotId) {
      if (mode !== 'edit') return; // chỉ cho click khi đang sửa

      if (selectedSlots.has(slotId)) {
        selectedSlots.delete(slotId);
      } else {
        selectedSlots.add(slotId);
      }
      renderSelectedSlots();
    }

    // ========= SAVE =========

    async function saveAvailability() {
      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần.', true);
        return;
      }

      const availability = Array.from(selectedSlots).map(slotId => {
        const [date, shift] = slotId.split('|');
        return { date, shift };
      });

      try {
        showMessage('Đang lưu lịch rảnh...', false);

        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveAvailability',
            email: currentUser.email,
            name: currentUser.name,
            weekStart,
            availability
          })
        });

        const data = await res.json();
        if (data.success) {
          showMessage(
            'Đã lưu lịch rảnh. Bạn có thể quay lại trang này và bấm "Sửa lịch rảnh" để chỉnh sửa bất cứ lúc nào trước deadline.',
            false
          );
          setMode('view');
        } else {
          showMessage('Lỗi lưu lịch: ' + (data.message || ''), true);
        }
      } catch (err) {
        console.error('saveAvailability error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ========= MODE & UTILS =========

    function setMode(newMode) {
      mode = newMode;

      if (editBtn && cancelBtn && saveBtn) {
        if (mode === 'view') {
          editBtn.style.display = 'inline-block';
          cancelBtn.style.display = 'none';
          saveBtn.style.display = 'none';
        } else {
          editBtn.style.display = 'inline-block'; // vẫn cho thấy nút, nhưng optional
          cancelBtn.style.display = 'inline-block';
          saveBtn.style.display = 'inline-block';
        }
      }

      renderSelectedSlots();
    }

    function showMessage(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.style.color = isError ? '#d32f2f' : '#455a64';
    }

    function clearMessage() {
      showMessage('', false);
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
