// js/schedule.js
document.addEventListener('DOMContentLoaded', () => {
  // Bắt buộc login
  if (!Auth.requireAuth()) return;
  Auth.renderAuthUI();

  const user = Auth.getCurrentUser();
  const weekInput = document.getElementById('week-start-input');
  const loadBtn = document.getElementById('load-week-btn');
  const saveBtn = document.getElementById('save-availability-btn');
  const tbody = document.getElementById('availability-body');
  const messageEl = document.getElementById('schedule-message');

  const SHIFTS = [
    { key: 'morning',   label: 'Ca sáng (08:00 - 12:00)' },
    { key: 'afternoon', label: 'Ca chiều (13:00 - 17:00)' },
    { key: 'evening',   label: 'Ca tối (17:00 - 21:00)' }
    // nếu bạn có ca khác thì thêm ở đây
  ];

  // --- Khởi tạo tuần mặc định: thứ 2 của tuần tới ---
  weekInput.value = getNextMondayISO();
  buildGrid(weekInput.value);

  // Tự load đăng ký luôn
  loadAvailability();

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

      applyAvailabilityToGrid(data.availability || [], weekStart);
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

    const availability = collectAvailabilityFromGrid(weekStart);

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

  // Vẽ bảng 7 ngày x số ca trong tuần
  function buildGrid(weekStartISO) {
    tbody.innerHTML = '';

    if (!weekStartISO) return;

    const weekStart = new Date(weekStartISO + 'T00:00:00'); // tránh timezone

    // tạo header ngày (text) nếu muốn có thêm line hiển thị ngày dạng dd/mm
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      dates.push(toISODate(d)); // YYYY-MM-DD
    }

    SHIFTS.forEach(shift => {
      const tr = document.createElement('tr');

      // cột tiêu đề ca
      const th = document.createElement('th');
      th.textContent = shift.label;
      tr.appendChild(th);

      // 7 cột ngày
      dates.forEach(dateISO => {
        const td = document.createElement('td');
        td.classList.add('schedule-cell');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('availability-checkbox');
        checkbox.dataset.date = dateISO;
        checkbox.dataset.shift = shift.key;

        const label = document.createElement('label');
        label.classList.add('checkbox-label');
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' Rảnh'));

        td.appendChild(label);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // Áp dữ liệu từ API vào grid (tích lại những ô đã đăng ký)
  function applyAvailabilityToGrid(availability, weekStartISO) {
    // safety: nếu tuần response khác tuần input thì bỏ
    const checkboxes = tbody.querySelectorAll('.availability-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });

    availability.forEach(item => {
      const { date, shift } = item;
      const selector = `.availability-checkbox[data-date="${date}"][data-shift="${shift}"]`;
      const cb = tbody.querySelector(selector);
      if (cb) cb.checked = true;
    });
  }

  // Thu thập dữ liệu từ grid để gửi lên server
  function collectAvailabilityFromGrid(weekStartISO) {
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

  function showMessage(text, isError) {
    messageEl.textContent = text || '';
    messageEl.classList.toggle('error', !!isError);
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

  // Thứ 2 tuần sau (dùng làm default weekStart)
  function getNextMondayISO() {
    const now = new Date();
    const day = now.getDay(); // 0=CN,1=Th2,...6=Th7
    const daysToNextMonday = ((8 - day) % 7) || 7; // ít nhất +1 ngày
    const nextMonday = addDays(now, daysToNextMonday);
    return toISODate(nextMonday);
  }
});
