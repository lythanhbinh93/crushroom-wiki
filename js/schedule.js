// js/schedule.js
// Logic đăng ký ca linh hoạt theo giờ cho nhân viên (CS / MO)

window.SchedulePage = {
  init() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const weekInput  = document.getElementById('week-start-input');
    const loadBtn    = document.getElementById('load-week-btn');
    const saveBtn    = document.getElementById('save-availability-btn');
    const tbody      = document.getElementById('availability-body');
    const messageEl  = document.getElementById('schedule-message');
    const teamLabelEl = document.getElementById('team-label'); // optional

    if (!weekInput || !loadBtn || !saveBtn || !tbody) {
      console.warn('Schedule elements not found, skip init');
      return;
    }

    // Xác định team dựa vào quyền
    const team = detectTeam(user); // 'cs' | 'mo' | 'other'
    const TIME_SLOTS = buildTimeSlots(team);

    if (teamLabelEl) {
      if (team === 'cs') {
        teamLabelEl.textContent = 'Bạn đang đăng ký ca theo giờ cho team: Customer Service (CS). Khung giờ: 08:00 - 24:00.';
      } else if (team === 'mo') {
        teamLabelEl.textContent = 'Bạn đang đăng ký ca theo giờ cho team: Marketing (MO). Khung giờ: 09:00 - 18:00.';
      } else {
        teamLabelEl.textContent = 'Bạn đang đăng ký ca theo giờ (khung mặc định).';
      }
    }

    // --- Khởi tạo tuần mặc định: Thứ 2 tuần sau ---
    weekInput.value = getNextMondayISO();
    buildGrid(weekInput.value);

    // Tự load đăng ký luôn
    loadAvailability();

    // Events
    loadBtn.addEventListener('click', () => {
      buildGrid(weekInput.value);
      loadAvailability();
    });

    saveBtn.addEventListener('click', saveAvailability);

    // ========== HÀM CHÍNH ==========

    async function loadAvailability() {
      clearMessage();
      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần bắt đầu.', true);
        return;
      }

      try {
        showMessage('Đang tải đăng ký...', false);
        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'getAvailability',
            email: user.email,
            weekStart
          })
        });

        const data = await res.json();
        if (!data.success) {
          showMessage('Lỗi tải dữ liệu: ' + (data.message || ''), true);
          return;
        }

        applyAvailabilityToGrid(data.availability || []);
        showMessage('Đã tải đăng ký ca.', false);
      } catch (err) {
        console.error('loadAvailability error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    async function saveAvailability() {
      clearMessage();
      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần bắt đầu.', true);
        return;
      }

      const availability = collectAvailabilityFromGrid();

      try {
        showMessage('Đang lưu...', false);
        const res = await fetch(Auth.API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'saveAvailability',
            email: user.email,
            name: user.name,
            weekStart,
            availability
          })
        });

        const data = await res.json();
        if (data.success) {
          showMessage('Đã lưu đăng ký ca cho tuần này.', false);
        } else {
          showMessage('Lỗi lưu đăng ký: ' + (data.message || ''), true);
        }
      } catch (err) {
        console.error('saveAvailability error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // ========== GRID ==========

    function buildGrid(weekStartISO) {
      tbody.innerHTML = '';
      if (!weekStartISO) return;

      const weekStart = new Date(weekStartISO + 'T00:00:00');
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        dates.push(toISODate(d)); // YYYY-MM-DD
      }

      TIME_SLOTS.forEach(slot => {
        const tr = document.createElement('tr');

        const th = document.createElement('th');
        th.textContent = slot.label; // ví dụ: "08:00 - 09:00"
        tr.appendChild(th);

        dates.forEach(dateISO => {
          const td = document.createElement('td');
          td.classList.add('schedule-cell');

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.classList.add('availability-checkbox');
          checkbox.dataset.date = dateISO;
          checkbox.dataset.shift = slot.key; // ví dụ: "08-09"

          const label = document.createElement('label');
          label.style.cursor = 'pointer';
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' Rảnh'));

          td.appendChild(label);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    function applyAvailabilityToGrid(availability) {
      const checkboxes = tbody.querySelectorAll('.availability-checkbox');
      checkboxes.forEach(cb => cb.checked = false);

      availability.forEach(item => {
        const date  = item.date;
        const shift = item.shift; // key: "08-09", "09-10", ...
        const selector = `.availability-checkbox[data-date="${date}"][data-shift="${shift}"]`;
        const cb = tbody.querySelector(selector);
        if (cb) cb.checked = true;
      });
    }

    function collectAvailabilityFromGrid() {
      const checkboxes = tbody.querySelectorAll('.availability-checkbox');
      const result = [];

      checkboxes.forEach(cb => {
        if (cb.checked) {
          result.push({
            date: cb.dataset.date,
            shift: cb.dataset.shift
          });
        }
      });

      return result;
    }

    // ========== UTILS ==========

    function detectTeam(user) {
      // Ưu tiên CS nếu có cả 2 quyền
      if (user.permissions) {
        if (user.permissions.cs) return 'cs';
        if (user.permissions.marketing) return 'mo';
      }
      return 'cs'; // fallback
    }

    function buildTimeSlots(team) {
      let startHour, endHour;

      if (team === 'cs') {
        // 08:00 - 24:00 -> slot cuối 23-24
        startHour = 8;
        endHour   = 24;
      } else if (team === 'mo') {
        // 09:00 - 18:00 -> slot cuối 17-18
        startHour = 9;
        endHour   = 18;
      } else {
        // fallback: giờ hành chính 08-18
        startHour = 8;
        endHour   = 18;
      }

      const slots = [];
      for (let h = startHour; h < endHour; h++) {
        const next = (h + 1) % 24;
        const key   = `${pad2(h)}-${pad2(next)}`;          // "08-09"
        const label = `${pad2(h)}:00 - ${pad2(next)}:00`;  // "08:00 - 09:00"
        slots.push({ key, label });
      }
      return slots;
    }

    function showMessage(text, isError) {
      if (!messageEl) return;
      messageEl.textContent = text || '';
      messageEl.style.color = isError ? '#d32f2f' : '#388e3c';
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

    // Thứ 2 tuần sau (mặc định)
    function getNextMondayISO() {
      const now = new Date();
      const day = now.getDay(); // 0=CN,1=Th2,...6=Th7
      const daysToNextMonday = ((8 - day) % 7) || 7;
      const nextMonday = addDays(now, daysToNextMonday);
      return toISODate(nextMonday);
    }
  }
};
