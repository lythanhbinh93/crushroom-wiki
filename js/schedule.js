// js/schedule.js
// Trang nhân viên: đăng ký lịch rảnh + xem lịch làm đã chốt

window.SchedulePage = {
  init() {
    const weekInput    = document.getElementById('week-start-input');
    const loadBtn      = document.getElementById('load-week-btn');
    const tbody        = document.getElementById('availability-body');
    const msgEl        = document.getElementById('schedule-message');
    const teamLabelEl  = document.getElementById('team-label');
    const saveBtn      = document.getElementById('save-availability-btn');
    const availSection = document.getElementById('availability-section');

    // Final schedule elements (personal)
    const finalStatusEl   = document.getElementById('final-schedule-status');
    const finalWrapperEl  = document.getElementById('final-schedule-wrapper');
    const finalBodyEl     = document.getElementById('final-schedule-body');
    const finalSummaryEl  = document.getElementById('final-schedule-summary');

    // Team schedule elements (all team members)
    const teamStatusEl    = document.getElementById('team-schedule-status');
    const teamWrapperEl   = document.getElementById('team-schedule-wrapper');
    const teamHeadRowEl   = document.getElementById('team-schedule-head-row');
    const teamBodyEl      = document.getElementById('team-schedule-body');
    const teamEmptyEl     = document.getElementById('team-schedule-empty');

    // Team filter buttons
    const filterAllBtn    = document.getElementById('filter-all-btn');
    const filterCsBtn     = document.getElementById('filter-cs-btn');
    const filterMoBtn     = document.getElementById('filter-mo-btn');

    if (!weekInput || !tbody) {
      console.warn('SchedulePage: missing elements');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) return;

    // employmentType: 'parttime' | 'fulltime' (default = parttime)
    const employmentType = (currentUser.employmentType || 'parttime').toLowerCase();
    const isCS           = currentUser.permissions && currentUser.permissions.cs;
    const team           = isCS ? 'cs' : 'mo';

    // ❌ Rule: Full-time MO không được truy cập trang đăng ký lịch làm
    // -> Nếu lách URL vào pages/schedule.html thì redirect về trang chủ
    if (employmentType === 'fulltime' && !isCS) {
      window.location.href = '../index.html';
      return;
    }

    // Quy ước:
    // - Part-time: luôn được đăng ký
    // - Fulltime CS: vẫn được đăng ký
    // - Fulltime không CS (MO): KHÔNG được đăng ký (đã redirect ở trên)
    const canUseAvailability =
      employmentType === 'parttime' ||
      (employmentType === 'fulltime' && isCS);

    const isFulltimeMO =
      employmentType === 'fulltime' && !isCS;

    // Label phía trên bảng
    if (teamLabelEl) {
      if (!canUseAvailability && isFulltimeMO) {
        // trường hợp này thực tế không xảy ra vì đã redirect, nhưng để phòng hờ
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

    // Nếu fulltime MO: ẩn luôn cả khối đăng ký (phòng trường hợp load script ở trang khác)
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
    let allAvailabilityMap = {}; // slotId -> [{email, name}] - all team members who checked this slot
    let canEditAvailability = canUseAvailability; // sẽ cập nhật lại theo trạng thái chốt lịch
    let currentTeamFilter = 'all'; // 'all', 'cs', 'mo' - filter for company schedule

    // Default tuần: thứ 2 tuần này
    weekInput.value = getThisMondayISO();

    // Events
    loadBtn.addEventListener('click', () => loadWeek());
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveAvailability());
    }

    weekInput.addEventListener('change', () => {
      loadWeek();
    });

    // Team filter event listeners
    if (filterAllBtn && filterCsBtn && filterMoBtn) {
      filterAllBtn.addEventListener('click', () => {
        currentTeamFilter = 'all';
        filterAllBtn.classList.add('active');
        filterCsBtn.classList.remove('active');
        filterMoBtn.classList.remove('active');
        renderCompanySchedule(weekInput.value, currentTeamFilter);
      });

      filterCsBtn.addEventListener('click', () => {
        currentTeamFilter = 'cs';
        filterAllBtn.classList.remove('active');
        filterCsBtn.classList.add('active');
        filterMoBtn.classList.remove('active');
        renderCompanySchedule(weekInput.value, currentTeamFilter);
      });

      filterMoBtn.addEventListener('click', () => {
        currentTeamFilter = 'mo';
        filterAllBtn.classList.remove('active');
        filterCsBtn.classList.remove('active');
        filterMoBtn.classList.add('active');
        renderCompanySchedule(weekInput.value, currentTeamFilter);
      });
    }

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

        // NEW: Get all team availability to show who else is available
        const bodyAllAvail = JSON.stringify({
          action: 'getAllAvailability',
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
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyAllAvail
          })
        ];

        const [resAvail, resMeta, resSched, resAllAvail] = await Promise.all(requests);

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
        const dataAllAvail = await resAllAvail.json();

        // Process all team availability
        allAvailabilityMap = {};
        if (dataAllAvail && dataAllAvail.success && Array.isArray(dataAllAvail.availability)) {
          dataAllAvail.availability.forEach(item => {
            const date  = String(item.date || '').substring(0, 10);
            const shift = String(item.shift || '').trim();
            const email = String(item.email || '').toLowerCase();
            const name  = String(item.name || email);

            if (!date || !shift) return;

            // Skip current user - we'll show their checkbox instead
            if (email === currentUser.email.toLowerCase()) return;

            const slotId = `${date}|${shift}`;
            if (!allAvailabilityMap[slotId]) {
              allAvailabilityMap[slotId] = [];
            }

            // Avoid duplicates
            const exists = allAvailabilityMap[slotId].some(u => u.email === email);
            if (!exists) {
              allAvailabilityMap[slotId].push({ email, name });
            }
          });
        }

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

        // render final schedule (personal)
        renderFinalSchedule(weekStart, team, dataMeta, dataSched, currentUser.email);

        // render company schedule (all part-time employees from both teams)
        renderCompanySchedule(weekStart, currentTeamFilter);

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
          td.style.verticalAlign = 'top';
          td.style.padding = '8px';

          const slotId = `${dateISO}|${slot.key}`;
          td.dataset.slotId = slotId;

          // Checkbox container
          const checkboxContainer = document.createElement('div');
          checkboxContainer.style.marginBottom = '6px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.slotId = slotId;
          cb.style.cursor = canEditAvailability ? 'pointer' : 'not-allowed';

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

          checkboxContainer.appendChild(cb);

          // Show other team members who checked this slot (muted style)
          const othersInSlot = allAvailabilityMap[slotId] || [];
          if (othersInSlot.length > 0) {
            const othersDiv = document.createElement('div');
            othersDiv.classList.add('other-availability');
            othersDiv.style.fontSize = '11px';
            othersDiv.style.color = '#999';
            othersDiv.style.marginTop = '4px';
            othersDiv.style.lineHeight = '1.4';

            const names = othersInSlot.map(u => {
              // Extract first name (last word for Vietnamese names)
              const parts = u.name.trim().split(/\s+/);
              return parts[parts.length - 1];
            });

            othersDiv.textContent = `✓ ${names.join(', ')}`;
            othersDiv.title = `Đã tick: ${othersInSlot.map(u => u.name).join(', ')}`;

            checkboxContainer.appendChild(othersDiv);
          }

          td.appendChild(checkboxContainer);
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

      // Chặn tất cả đối tượng không được dùng form (bao gồm fulltime MO)
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
      finalStatusEl.innerHTML       = '';

      const status = (meta.status || 'draft').toLowerCase();

      if (status !== 'final') {
        finalStatusEl.innerHTML = '<span class="status-badge status-draft">⏳ Lịch làm tuần này chưa được chốt. Leader đang xếp lịch, vui lòng xem lại sau.</span>';
        return;
      }

      const schedArr = (dataSched && dataSched.schedule) || [];
      const emailKey = (userEmail || '').toLowerCase();

      const userSlots = schedArr.filter(item => {
        return (item.email || '').toLowerCase() === emailKey;
      });

      if (userSlots.length === 0) {
        finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch đã chốt, tuần này bạn không có ca làm nào được xếp</span>';
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

      finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch làm tuần này đã được chốt</span>';

      const summaryTextEl = document.getElementById('final-schedule-summary-text');
      if (summaryTextEl) {
        summaryTextEl.textContent = `Tổng số giờ: khoảng ${totalHours}h, số ngày đi làm: ${daysCount} ngày.`;
      }
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
      if (!text) {
        msgEl.textContent = '';
        msgEl.className = 'alert-message';
        return;
      }
      msgEl.textContent = text;
      msgEl.className = isError ? 'alert-message alert-error' : 'alert-message alert-success';
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

    function getThisMondayISO() {
      const now = new Date();
      const day = now.getDay(); // 0=CN,1=2,...6=7
      // Get Monday of current week (0 if today is Monday, otherwise days back to Monday)
      const daysFromMonday = (day + 6) % 7;
      const thisMonday = addDays(now, -daysFromMonday);
      return toISODate(thisMonday);
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

    // =====================================================
    // RENDER COMPANY SCHEDULE (ALL PART-TIME EMPLOYEES)
    // =====================================================

    async function renderCompanySchedule(weekStart, teamFilter = 'all') {
      if (!teamStatusEl || !teamWrapperEl || !teamHeadRowEl || !teamBodyEl || !teamEmptyEl) {
        return; // Elements not found
      }

      try {
        // Fetch schedule for both teams
        const bodyCS = JSON.stringify({
          action: 'getSchedule',
          weekStart,
          team: 'cs'
        });

        const bodyMO = JSON.stringify({
          action: 'getSchedule',
          weekStart,
          team: 'mo'
        });

        const bodyMetaCS = JSON.stringify({
          action: 'getScheduleMeta',
          weekStart,
          team: 'cs'
        });

        const bodyMetaMO = JSON.stringify({
          action: 'getScheduleMeta',
          weekStart,
          team: 'mo'
        });

        const [resSchedCS, resSchedMO, resMetaCS, resMetaMO] = await Promise.all([
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyCS
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyMO
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyMetaCS
          }),
          fetch(Auth.API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyMetaMO
          })
        ]);

        const dataSchedCS = await resSchedCS.json();
        const dataSchedMO = await resSchedMO.json();
        const dataMetaCS = await resMetaCS.json();
        const dataMetaMO = await resMetaMO.json();

        const metaCS = (dataMetaCS && dataMetaCS.meta) || {};
        const metaMO = (dataMetaMO && dataMetaMO.meta) || {};
        const statusCS = (metaCS.status || 'draft').toLowerCase();
        const statusMO = (metaMO.status || 'draft').toLowerCase();

        const scheduleCS = (dataSchedCS && dataSchedCS.schedule) || [];
        const scheduleMO = (dataSchedMO && dataSchedMO.schedule) || [];

        // Combine both schedules, filter out fulltime employees
        let combinedSchedule = [...scheduleCS, ...scheduleMO];

        // Filter to only show part-time employees
        // Backend should include employmentType field in schedule data
        combinedSchedule = combinedSchedule.filter(item => {
          const empType = (item.employmentType || 'parttime').toLowerCase();
          return empType === 'parttime' || empType === 'part-time';
        });

        // Apply team filter
        if (teamFilter === 'cs') {
          combinedSchedule = combinedSchedule.filter(item => {
            const team = (item.team || '').toLowerCase();
            return team === 'cs';
          });
        } else if (teamFilter === 'mo') {
          combinedSchedule = combinedSchedule.filter(item => {
            const team = (item.team || '').toLowerCase();
            return team === 'mo';
          });
        }
        // If teamFilter === 'all', show all teams (no additional filtering)

        const schedule = combinedSchedule;

        // If neither team is finalized
        if (statusCS !== 'final' && statusMO !== 'final') {
          teamStatusEl.innerHTML = '<span class="status-badge status-draft">⏳ Tuần này chưa chốt lịch làm chính thức</span>';
          teamWrapperEl.style.display = 'none';
          teamEmptyEl.style.display = 'block';
          teamHeadRowEl.innerHTML = '';
          teamBodyEl.innerHTML = '';
          return;
        }

        // Finalized but no schedule entries
        if (!schedule.length) {
          teamWrapperEl.style.display = 'none';
          teamEmptyEl.style.display = 'block';
          teamStatusEl.innerHTML = '<span class="status-badge status-final">✅ Tuần này đã chốt lịch nhưng chưa có ca làm nào cho nhân viên part-time</span>';
          teamHeadRowEl.innerHTML = '';
          teamBodyEl.innerHTML = '';
          return;
        }

        teamWrapperEl.style.display = 'block';
        teamEmptyEl.style.display = 'none';
        teamStatusEl.innerHTML = `<span class="status-badge status-final">✅ Lịch làm chính thức của công ty (${schedule.length} ca part-time đã chốt)</span>`;

        // Build dates array
        const d0 = new Date(weekStart + 'T00:00:00');
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(d0, i);
          dates.push(toISODate(d));
        }

        // Build time slots covering both CS and MO hours (8:00 - 24:00)
        const timeSlots = [];
        const startHour = 8;
        const endHour = 24;

        for (let h = startHour; h < endHour; h++) {
          const next = (h + 1) % 24;
          const key = `${pad2(h)}-${pad2(next)}`;
          const label = `${pad2(h)}:00`;
          timeSlots.push({ key, label });
        }

      // Map slots by key
      const slotIndexByKey = {};
      timeSlots.forEach((slot, idx) => {
        slotIndexByKey[slot.key] = idx;
      });

      // Build data structure: date -> slot -> people
      const dateSlotPersons = {}; // dateISO -> Array(timeSlots.length) of Set(personKey)
      const personMetaByDate = {}; // dateISO -> { personKey: {email, name} }

        schedule.forEach(item => {
          const dateISO = (item.date || '').substring(0, 10);
          const shiftKey = item.shift || '';
          const idx = slotIndexByKey[shiftKey];
          if (idx == null) return;

          if (!dateSlotPersons[dateISO]) {
            dateSlotPersons[dateISO] = Array(timeSlots.length).fill(null).map(() => new Set());
            personMetaByDate[dateISO] = {};
          }

          const email = (item.email || '').toString().trim().toLowerCase();
          const name = item.name || item.email || '';
          const team = (item.team || '').toUpperCase();
          const pKey = email || name;

          dateSlotPersons[dateISO][idx].add(pKey);

          if (!personMetaByDate[dateISO][pKey]) {
            personMetaByDate[dateISO][pKey] = { email, name, team };
          }
        });

      // Build labels by date/slot
      const labelsByDateSlot = {};
      dates.forEach(dateISO => {
        labelsByDateSlot[dateISO] = Array(timeSlots.length).fill(null).map(() => []);

        const slotsArr = dateSlotPersons[dateISO];
        if (!slotsArr) return;

        const personMeta = personMetaByDate[dateISO] || {};
        const persons = Object.keys(personMeta);

          persons.forEach(pKey => {
            for (let i = 0; i < timeSlots.length; i++) {
              const hasHere = slotsArr[i] && slotsArr[i].has(pKey);
              if (!hasHere) continue;

              const meta = personMeta[pKey];
              labelsByDateSlot[dateISO][i].push({
                email: meta.email || pKey,
                name: meta.name,
                team: meta.team || ''
              });
            }
          });
      });

      // Render header
      teamHeadRowEl.innerHTML = '';
      const thTime = document.createElement('th');
      thTime.className = 'th-time';
      thTime.textContent = 'Giờ / Ngày';
      teamHeadRowEl.appendChild(thTime);

      dates.forEach((dateISO, index) => {
        const th = document.createElement('th');
        th.className = index === 6 ? 'th-day th-sunday' : 'th-day';

        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        const d = new Date(dateISO + 'T00:00:00');
        dayName.textContent = getWeekdayLabel(d);

        const dayDate = document.createElement('div');
        dayDate.className = 'day-date';
        dayDate.textContent = formatVNDate(d);

        th.appendChild(dayName);
        th.appendChild(dayDate);
        teamHeadRowEl.appendChild(th);
      });

      // Render body
      teamBodyEl.innerHTML = '';

      timeSlots.forEach((slot, slotIndex) => {
        const tr = document.createElement('tr');

        const thSlot = document.createElement('th');
        thSlot.textContent = slot.label;
        tr.appendChild(thSlot);

        dates.forEach(dateISO => {
          const td = document.createElement('td');
          const labels = (labelsByDateSlot[dateISO] && labelsByDateSlot[dateISO][slotIndex]) || [];

          if (labels.length) {
            labels.forEach(person => {
              const container = document.createElement('div');
              container.style.display = 'inline-flex';
              container.style.alignItems = 'center';
              container.style.gap = '4px';
              container.style.marginRight = '6px';
              container.style.marginBottom = '2px';

              const nameSpan = document.createElement('span');
              nameSpan.textContent = person.name;
              nameSpan.style.display = 'inline-block';
              nameSpan.style.fontSize = '11px';
              nameSpan.style.padding = '3px 8px';
              nameSpan.style.borderRadius = '4px';
              nameSpan.style.fontWeight = '600';

              // Use consistent color palette
              const colors = getColorForEmail(person.email);
              nameSpan.style.background = colors.bg;
              nameSpan.style.color = colors.text;

              container.appendChild(nameSpan);

              // Add team badge
              if (person.team) {
                const teamBadge = document.createElement('span');
                teamBadge.textContent = person.team;
                teamBadge.style.fontSize = '9px';
                teamBadge.style.padding = '2px 6px';
                teamBadge.style.borderRadius = '3px';
                teamBadge.style.fontWeight = '700';
                teamBadge.style.backgroundColor = person.team === 'CS' ? '#E3F2FD' : '#FFF3E0';
                teamBadge.style.color = person.team === 'CS' ? '#1976D2' : '#F57C00';
                teamBadge.style.border = `1px solid ${person.team === 'CS' ? '#BBDEFB' : '#FFE0B2'}`;

                container.appendChild(teamBadge);
              }

              td.appendChild(container);
            });
          }

          tr.appendChild(td);
        });

        teamBodyEl.appendChild(tr);
        });
      } catch (error) {
        console.error('Error rendering company schedule:', error);
        teamStatusEl.innerHTML = '<span class="status-badge status-error">❌ Lỗi khi tải lịch làm của công ty</span>';
        teamWrapperEl.style.display = 'none';
        teamEmptyEl.style.display = 'block';
      }
    }

    // Color palette for consistent employee colors
    const COLOR_PALETTE = [
      { bg: '#FF5252', text: '#FFFFFF' },
      { bg: '#2196F3', text: '#FFFFFF' },
      { bg: '#4CAF50', text: '#FFFFFF' },
      { bg: '#FF9800', text: '#000000' },
      { bg: '#9C27B0', text: '#FFFFFF' },
      { bg: '#00BCD4', text: '#000000' },
      { bg: '#FFEB3B', text: '#000000' },
      { bg: '#E91E63', text: '#FFFFFF' },
      { bg: '#3F51B5', text: '#FFFFFF' },
      { bg: '#009688', text: '#FFFFFF' },
      { bg: '#FF5722', text: '#FFFFFF' },
      { bg: '#795548', text: '#FFFFFF' },
      { bg: '#607D8B', text: '#FFFFFF' },
      { bg: '#FFC107', text: '#000000' },
      { bg: '#8BC34A', text: '#000000' }
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
  }
};
