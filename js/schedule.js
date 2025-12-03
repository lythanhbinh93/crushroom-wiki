// js/schedule.js
// Trang nhân viên: đăng ký lịch rảnh + xem lịch làm đã chốt

window.SchedulePage = {
  init() {
    const weekInput   = document.getElementById('week-start-input');
    const loadBtn     = document.getElementById('load-week-btn');
    const tbody       = document.getElementById('availability-body');
    const msgEl       = document.getElementById('schedule-message');
    const teamLabelEl = document.getElementById('team-label');
    const saveBtn     = document.getElementById('save-availability-btn');
    const availSection = document.getElementById('availability-section');

    // Final schedule elements
    const finalStatusEl   = document.getElementById('final-schedule-status');
    const finalWrapperEl  = document.getElementById('final-schedule-wrapper');
    const finalBodyEl     = document.getElementById('final-schedule-body');
    const finalSummaryEl  = document.getElementById('final-schedule-summary');

    if (!weekInput || !tbody) {
      console.warn('SchedulePage: missing elements');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) return;

    // employmentType: 'parttime' | 'fulltime' (default = parttime)
    const employmentType = (currentUser.employmentType || 'parttime').toLowerCase();
    const isCS  = currentUser.permissions && currentUser.permissions.cs;
    const team  = isCS ? 'cs' : 'mo';

    // Quy ước:
    // - Part-time: luôn được đăng ký
    // - Fulltime CS: vẫn được đăng ký
    // - Fulltime không CS (MO): KHÔNG được đăng ký
    const canUseAvailability =
      employmentType === 'parttime' ||
      (employmentType === 'fulltime' && isCS);

    const isFulltimeMO =
      employmentType === 'fulltime' && !isCS;

    // Label phía trên bảng
    if (teamLabelEl) {
      if (!canUseAvailability && isFulltimeMO) {
        teamLabelEl.textContent =
          'Bạn là nhân viên FULLTIME team Marketing/Operations – không cần đăng ký lịch rảnh trong hệ thống. Vui lòng xem lịch làm đã chốt ở trên 👇';
      } else if (employmentType === 'fulltime' && isCS) {
        teamLabelEl.textContent =
          'Bạn là nhân viên FULLTIME team CS – vui lòng đăng ký lịch rảnh theo từng tiếng (08:00 - 24:00).';
      } else {
        // part-time
        teamLabelEl.textContent = isCS
          ? 'Bạn thuộc team CS – Chọn ca theo từng tiếng (08:00 - 24:00). Đây là đăng ký cho nhân viên PART-TIME.'
          : 'Bạn thuộc team MO – Chọn ca theo từng tiếng (09:00 - 18:00). Đây là đăng ký cho nhân viên PART-TIME.';
      }
    }

    // Nếu fulltime MO: ẩn luôn cả khối đăng ký
    if (isFulltimeMO && availSection) {
      availSection.style.display = 'none';
    }

    // Nếu không được dùng form: ẩn nút lưu
    if (!canUseAvailability && saveBtn) {
      saveBtn.style.display = 'none';
    }

    // State
    let dates = [];       // 7 ngày của tuần
    let timeSlots = [];   // [{key, label}]
    let checkedMap = {};  // slotId -> true/false
    let canEditAvailability = canUseAvailability; // sẽ cập nhật lại theo trạng thái chốt lịch

    // Default tuần: thứ 2 tuần sau
    weekInput.value = getNextMondayISO();

    // Events
    loadBtn.addEventListener('click', () => loadWeek());
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveAvailability());
    }

    weekInput.addEventListener('change', () => {
      loadWeek();
    });

    // Lần đầu
    loadWeek();

    // =====================================================
    // MAIN FLOW
    // =====================================================

    async function loadWeek() {
      clearMessage();
      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần.', true);
        return;
      }

      // build dates & slots
      buildDates(weekStart);
      buildTimeSlots(team);

      try {
        showMessage(
          canUseAvailability
            ? 'Đang tải đăng ký rảnh & lịch làm đã chốt...'
            : 'Đang tải lịch làm đã chốt...',
          false
        );

        const bodyAvail = JSON.stringify({
          action: 'getAvailability',
          email: currentUser.email,
          weekStart
        });

        const bodyMeta = JSON.stringify({
          action: 'getScheduleMeta',
          weekStart,
          team
        });

        const bodySchedule = JSON.stringify({
          action: 'getSchedule',
          weekStart,
          team
        });

        const requests = [
          canUseAvailability
            ? fetch(Auth.API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyAvail
              })
            : Promise.resolve(null),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyMeta
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodySchedule
          })
        ];

        const [resAvail, resMeta, resSched] = await Promise.all(requests);

        // map availability (nếu được dùng form)
        checkedMap = {};
        if (canUseAvailability && resAvail) {
          const dataAvail = await resAvail.json();
          if (dataAvail && dataAvail.success && Array.isArray(dataAvail.availability)) {
            dataAvail.availability.forEach(item => {
              const date  = String(item.date || '').substring(0, 10);
              const shift = String(item.shift || '').trim();
              if (!date || !shift) return;
              const slotId = `${date}|${shift}`;
              checkedMap[slotId] = true;
            });
          }
        }

        const dataMeta  = await resMeta.json();
        const dataSched = await resSched.json();

        // Xác định trạng thái chốt lịch
        const meta   = (dataMeta && dataMeta.meta) || {};
        const status = (meta.status || 'draft').toLowerCase();

        // Chỉ được sửa nếu:
        // - Được phép dùng form, VÀ
        // - Tuần chưa chốt
        canEditAvailability = canUseAvailability && status !== 'final';

        // Vẽ bảng với trạng thái enable/disable đúng
        buildGrid();
        syncUIFromCheckedMap();

        // Ẩn/hiện nút lưu theo trạng thái
        if (saveBtn) {
          if (canEditAvailability) {
            saveBtn.style.display = 'inline-flex';
          } else {
            saveBtn.style.display = 'none';
          }
        }

        // render final schedule
        renderFinalSchedule(weekStart, team, dataMeta, dataSched, currentUser.email);

        if (!canEditAvailability && canUseAvailability) {
          // Tuần đã chốt, nhân viên không sửa lịch rảnh được nữa
          showMessage(
            'Tuần này đã được leader CHỐT LỊCH. Nếu cần đổi ca, vui lòng trao đổi với leader và các bạn trong team để sắp xếp lại.',
            false
          );
        } else if (!canUseAvailability) {
          showMessage('Đã tải lịch làm.', false);
        } else {
          showMessage('Đã tải dữ liệu.', false);
        }
      } catch (err) {
        console.error('loadWeek error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // =====================================================
    // BUILD STRUCTURE
    // =====================================================

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
        endHour   = 24; // 23-24
      } else {
        startHour = 9;
        endHour   = 18; // 17-18
      }

      timeSlots = [];
      for (let h = startHour; h < endHour; h++) {
        const next  = (h + 1) % 24;
        const key   = `${pad2(h)}-${pad2(next)}`;
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

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.slotId = slotId;

          if (canEditAvailability) {
            cb.addEventListener('change', () => {
              if (cb.checked) {
                checkedMap[slotId] = true;
              } else {
                delete checkedMap[slotId];
              }
            });
          } else {
            cb.disabled = true;
          }

          td.appendChild(cb);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    function syncUIFromCheckedMap() {
      const cbs = tbody.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(cb => {
        const slotId = cb.dataset.slotId;
        cb.checked = !!checkedMap[slotId];
      });
    }

    // =====================================================
    // SAVE AVAILABILITY
    // =====================================================

    async function saveAvailability() {
      clearMessage();

      // Chặn fulltime MO hoặc các loại không được dùng form
      if (!canUseAvailability) {
        showMessage('Bạn không cần đăng ký lịch rảnh trong hệ thống.', true);
        return;
      }

      if (!canEditAvailability) {
        showMessage(
          'Tuần này đã được leader CHỐT LỊCH. Bạn không thể chỉnh sửa lịch rảnh nữa. Nếu cần đổi ca, hãy trao đổi với leader và các bạn trong team.',
          true
        );
        return;
      }

      const weekStart = weekInput.value;
      if (!weekStart) {
        showMessage('Vui lòng chọn tuần.', true);
        return;
      }

      const availability = [];
      Object.keys(checkedMap).forEach(slotId => {
        const [date, shift] = slotId.split('|');
        availability.push({ date, shift });
      });

      try {
        showMessage('Đang lưu đăng ký ca rảnh...', false);

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
          showMessage('Đã lưu đăng ký ca rảnh.', false);
        } else {
          showMessage('Lỗi lưu đăng ký: ' + (data.message || ''), true);
        }
      } catch (err) {
        console.error('saveAvailability error', err);
        showMessage('Lỗi kết nối. Vui lòng thử lại.', true);
      }
    }

    // =====================================================
    // FINAL SCHEDULE (CHỐT)
    // =====================================================

    function renderFinalSchedule(weekStart, team, dataMeta, dataSched, userEmail) {
      if (!finalStatusEl || !finalWrapperEl || !finalBodyEl || !finalSummaryEl) return;

      const meta = (dataMeta && dataMeta.meta) || { status: 'draft' };

      finalWrapperEl.style.display  = 'none';
      finalSummaryEl.style.display  = 'none';
      finalBodyEl.innerHTML         = '';
      finalStatusEl.style.color     = '#555';

      const status = (meta.status || 'draft').toLowerCase();

      if (status !== 'final') {
        finalStatusEl.textContent = '⏳ Lịch làm tuần này chưa được chốt. Leader đang xếp lịch, vui lòng xem lại sau.';
        finalStatusEl.style.color = '#757575';
        return;
      }

      const schedArr = (dataSched && dataSched.schedule) || [];
      const emailKey = (userEmail || '').toLowerCase();

      const userSlots = schedArr.filter(item => {
        return (item.email || '').toLowerCase() === emailKey;
      });

      if (userSlots.length === 0) {
        finalStatusEl.textContent = '✅ Lịch đã chốt, tuần này bạn không có ca làm nào được xếp.';
        finalStatusEl.style.color = '#388e3c';
        return;
      }

      const byDate = {};
      userSlots.forEach(item => {
        const date = String(item.date || '').substring(0, 10);
        const shift = String(item.shift || '').trim();
        if (!date || !shift) return;
        if (!byDate[date]) byDate[date] = [];
        if (!byDate[date].includes(shift)) {
          byDate[date].push(shift);
        }
      });

      const rows = [];
      let totalHours = 0;
      let daysCount  = 0;

      const d0 = new Date(weekStart + 'T00:00:00');

      for (let i = 0; i < 7; i++) {
        const d = addDays(d0, i);
        const dateISO = toISODate(d);
        const weekdayLabel = getWeekdayLabel(d);

        const shifts = byDate[dateISO] || [];
        if (shifts.length === 0) {
          rows.push({
            dateLabel: `${weekdayLabel} (${formatVNDate(d)})`,
            text: '—'
          });
          continue;
        }

        shifts.sort((a, b) => {
          const ah = parseInt(a.split('-')[0], 10);
          const bh = parseInt(b.split('-')[0], 10);
          return ah - bh;
        });

        const merged = mergeShiftRanges(shifts);
        const labelParts = merged.map(r => {
          const start = r.start;
          const end   = r.end;
          const diff  = (end > start ? end - start : (24 - start + end));
          totalHours += diff;
          return `${pad2(start)}:00 - ${pad2(end)}:00`;
        });

        daysCount++;
        rows.push({
          dateLabel: `${weekdayLabel} (${formatVNDate(d)})`,
          text: labelParts.join(', ')
        });
      }

      rows.forEach(row => {
        const tr = document.createElement('tr');
        const tdDate = document.createElement('td');
        const tdShift = document.createElement('td');

        tdDate.textContent = row.dateLabel;
        tdShift.textContent = row.text;

        tr.appendChild(tdDate);
        tr.appendChild(tdShift);
        finalBodyEl.appendChild(tr);
      });

      finalWrapperEl.style.display = 'block';
      finalSummaryEl.style.display = 'block';

      finalStatusEl.textContent = '✅ Lịch làm tuần này đã được chốt.';
      finalStatusEl.style.color = '#388e3c';

      finalSummaryEl.textContent =
        `Tổng số giờ: khoảng ${totalHours}h, số ngày đi làm: ${daysCount} ngày.`;
    }

    function mergeShiftRanges(shifts) {
      const result = [];
      if (shifts.length === 0) return result;

      let current = null;

      shifts.forEach(s => {
        const parts = s.split('-');
        const start = parseInt(parts[0], 10);
        const end   = parseInt(parts[1], 10);

        if (!current) {
          current = { start, end };
        } else {
          if (start === current.end) {
            current.end = end;
          } else {
            result.push(current);
            current = { start, end };
          }
        }
      });

      if (current) result.push(current);
      return result;
    }

    // =====================================================
    // UTILS
    // =====================================================

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

    function getWeekdayLabel(date) {
      const day = date.getDay(); // 0 CN
      switch (day) {
        case 1: return 'Thứ 2';
        case 2: return 'Thứ 3';
        case 3: return 'Thứ 4';
        case 4: return 'Thứ 5';
        case 5: return 'Thứ 6';
        case 6: return 'Thứ 7';
        default: return 'Chủ nhật';
      }
    }

    function formatVNDate(d) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    }
  }
};
