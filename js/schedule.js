// js/schedule.js
// Trang nhân viên: đăng ký lịch rảnh + xem lịch làm đã chốt

window.SchedulePage = {
  init() {
    console.log('SchedulePage initializing...'); // Debug log

    const weekInput    = document.getElementById('week-start-input');
    const loadBtn      = document.getElementById('load-week-btn');
    const tbody        = document.getElementById('availability-body');
    const msgEl        = document.getElementById('schedule-message');
    const teamLabelEl  = document.getElementById('team-label');
    const saveBtn      = document.getElementById('save-availability-btn');
    const availSection = document.getElementById('availability-section');

    // Final schedule elements
    const finalStatusEl   = document.getElementById('final-schedule-status');
    const finalWrapperEl  = document.getElementById('final-schedule-wrapper');
    const finalBodyEl     = document.getElementById('final-schedule-body');
    const finalSummaryEl  = document.getElementById('final-schedule-summary');

    // FIX: Log warning nếu thiếu element quan trọng để dễ debug
    if (!weekInput || !tbody) {
      console.error('SchedulePage: Missing critical elements (week-start-input or availability-body)');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
        console.error('SchedulePage: No user logged in');
        return;
    }

    // employmentType: 'parttime' | 'fulltime'
    const employmentType = (currentUser.employmentType || 'parttime').toLowerCase();
    const isCS           = currentUser.permissions && currentUser.permissions.cs;
    const team           = isCS ? 'cs' : 'mo';

    // ❌ Rule: Full-time MO redirect
    if (employmentType === 'fulltime' && !isCS) {
      // window.location.href = '../index.html'; // Tạm comment để debug, uncomment khi chạy thật
      console.warn('Fulltime MO detected - Access restricted');
      // return; 
    }

    const canUseAvailability = employmentType === 'parttime' || (employmentType === 'fulltime' && isCS);
    const isFulltimeMO = employmentType === 'fulltime' && !isCS;

    // Label UI
    if (teamLabelEl) {
      if (!canUseAvailability && isFulltimeMO) {
        teamLabelEl.textContent = 'Nhân viên FULLTIME (Ops/Mkt) – Xem lịch làm đã chốt ở dưới 👇';
      } else if (employmentType === 'fulltime' && isCS) {
        teamLabelEl.textContent = 'Nhân viên FULLTIME CS – Đăng ký lịch rảnh (08:00 - 24:00).';
      } else {
        teamLabelEl.textContent = isCS
          ? 'Team CS (Part-time) – Chọn ca theo tiếng (08:00 - 24:00).'
          : 'Team Ops/Mkt (Part-time) – Chọn ca theo tiếng (09:00 - 18:00).';
      }
    }

    if (isFulltimeMO && availSection) availSection.style.display = 'none';
    if (!canUseAvailability && saveBtn) saveBtn.style.display = 'none';

    // State
    let dates = [];       
    let timeSlots = [];   
    let checkedMap = {};  
    let canEditAvailability = canUseAvailability; 

    // FIX: Nên để default là tuần hiện tại (This Monday) thay vì tuần sau để user thấy ngay lịch đang chạy
    // Nếu quy trình bên bạn bắt buộc vào là thấy tuần sau thì giữ nguyên getNextMondayISO()
    weekInput.value = getThisMondayISO(); 

    // Events
    loadBtn.addEventListener('click', () => loadWeek());
    if (saveBtn) saveBtn.addEventListener('click', () => saveAvailability());
    weekInput.addEventListener('change', () => loadWeek());

    // Init load
    loadWeek();

    // =====================================================
    // MAIN FLOW
    // =====================================================

    async function loadWeek() {
      clearMessage();
      const weekStart = weekInput.value;
      if (!weekStart) return showMessage('Vui lòng chọn tuần.', true);

      // build dates & slots
      buildDates(weekStart);
      buildTimeSlots(team);

      try {
        showMessage('Đang tải dữ liệu...', false);

        const requests = [
          canUseAvailability
            ? fetch(Auth.API_URL, {
                method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getAvailability', email: currentUser.email, weekStart })
              })
            : Promise.resolve(null),
          fetch(Auth.API_URL, {
            method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getScheduleMeta', weekStart, team })
          }),
          fetch(Auth.API_URL, {
            method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getSchedule', weekStart, team })
          })
        ];

        const [resAvail, resMeta, resSched] = await Promise.all(requests);

        // 1. Process Availability
        checkedMap = {};
        if (canUseAvailability && resAvail) {
          const dataAvail = await resAvail.json();
          if (dataAvail?.success && Array.isArray(dataAvail.availability)) {
            dataAvail.availability.forEach(item => {
              const date  = String(item.date || '').substring(0, 10);
              // FIX: Chuẩn hóa key (ví dụ: "8-9" thành "08-09") để khớp với bảng
              const shift = normalizeShiftKey(item.shift); 
              if (!date || !shift) return;
              checkedMap[`${date}|${shift}`] = true;
            });
          }
        }

        const dataMeta  = await resMeta.json();
        const dataSched = await resSched.json();

        // 2. Check Status
        const meta   = dataMeta?.meta || {};
        const status = (meta.status || 'draft').toLowerCase();
        
        canEditAvailability = canUseAvailability && status !== 'final';

        // 3. Render Views
        buildGrid(); // Vẽ bảng đăng ký
        syncUIFromCheckedMap(); // Tick các ô đã chọn

        if (saveBtn) saveBtn.style.display = canEditAvailability ? 'inline-flex' : 'none';

        // 4. Render Final Schedule
        renderFinalSchedule(weekStart, team, dataMeta, dataSched, currentUser.email);

        // Messages
        if (!canEditAvailability && canUseAvailability) {
          showMessage('Tuần này đã CHỐT LỊCH. Liên hệ Leader nếu cần đổi ca.', false);
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
        dates.push(toISODate(addDays(d0, i)));
      }
    }

    function buildTimeSlots(team) {
      let startHour = 9, endHour = 18;
      if (team === 'cs') { startHour = 8; endHour = 24; }

      timeSlots = [];
      for (let h = startHour; h < endHour; h++) {
        const next  = (h + 1) % 24;
        const key   = `${pad2(h)}-${pad2(next)}`;
        const label = `${pad2(h)}:00 - ${pad2(next)}:00`;
        timeSlots.push({ key, label });
      }
    }

    function buildGrid() {
      if (!tbody) return;
      tbody.innerHTML = '';

      timeSlots.forEach(slot => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = slot.label;
        tr.appendChild(th);

        dates.forEach(dateISO => {
          const td = document.createElement('td');
          td.className = 'schedule-cell'; 
          
          const slotId = `${dateISO}|${slot.key}`;
          td.dataset.slotId = slotId;

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.slotId = slotId;
          
          // Thêm style cho checkbox to dễ bấm
          cb.style.width = '18px'; 
          cb.style.height = '18px';
          cb.style.cursor = canEditAvailability ? 'pointer' : 'not-allowed';

          if (canEditAvailability) {
            cb.addEventListener('change', () => {
              if (cb.checked) checkedMap[slotId] = true;
              else delete checkedMap[slotId];
            });
            // Click vào ô td cũng toggle checkbox
            td.onclick = (e) => {
                if (e.target !== cb) {
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            };
            td.style.cursor = 'pointer';
          } else {
            cb.disabled = true;
            td.style.backgroundColor = '#f5f5f5';
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
      if (!canUseAvailability) return showMessage('Bạn không cần đăng ký lịch rảnh.', true);
      if (!canEditAvailability) return showMessage('Tuần này đã chốt, không thể chỉnh sửa.', true);

      const weekStart = weekInput.value;
      if (!weekStart) return showMessage('Vui lòng chọn tuần.', true);

      const availability = [];
      Object.keys(checkedMap).forEach(slotId => {
        const [date, shift] = slotId.split('|');
        availability.push({ date, shift });
      });

      try {
        showMessage('Đang lưu...', false);
        const res = await fetch(Auth.API_URL, {
          method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveAvailability', email: currentUser.email, name: currentUser.name, weekStart, availability })
        });

        const data = await res.json();
        if (data.success) showMessage('Đã lưu thành công.', false);
        else showMessage('Lỗi lưu: ' + (data.message || ''), true);
      } catch (err) {
        console.error(err);
        showMessage('Lỗi kết nối.', true);
      }
    }

    // =====================================================
    // FINAL SCHEDULE (CHỐT)
    // =====================================================

    function renderFinalSchedule(weekStart, team, dataMeta, dataSched, userEmail) {
      // FIX: Kiểm tra element an toàn hơn. Nếu thiếu element nào đó thì log lỗi chứ không return im lặng.
      if (!finalStatusEl || !finalWrapperEl || !finalBodyEl) {
          console.error('SchedulePage: Missing Final Schedule HTML elements (status, wrapper, or body)');
          return;
      }

      const meta = (dataMeta && dataMeta.meta) || { status: 'draft' };
      const status = (meta.status || 'draft').toLowerCase();

      // Reset UI
      finalWrapperEl.style.display  = 'none';
      if(finalSummaryEl) finalSummaryEl.style.display  = 'none';
      finalBodyEl.innerHTML         = '';
      finalStatusEl.style.color     = '#555';

      if (status !== 'final') {
        finalStatusEl.innerHTML = '<span class="status-badge status-draft">⏳ Lịch chưa chốt.</span>';
        return;
      }

      const schedArr = (dataSched && dataSched.schedule) || [];
      const emailKey = (userEmail || '').toLowerCase();

      const userSlots = schedArr.filter(item => (item.email || '').toLowerCase() === emailKey);

      if (userSlots.length === 0) {
        finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch đã chốt: Bạn không có ca làm tuần này.</span>';
        return;
      }

      // Grouping logic
      const byDate = {};
      userSlots.forEach(item => {
        const date = String(item.date || '').substring(0, 10);
        // FIX: Normalize key
        const shift = normalizeShiftKey(item.shift); 
        if (!date || !shift) return;
        if (!byDate[date]) byDate[date] = [];
        if (!byDate[date].includes(shift)) byDate[date].push(shift);
      });

      let totalHours = 0;
      let daysCount  = 0;
      const d0 = new Date(weekStart + 'T00:00:00');

      for (let i = 0; i < 7; i++) {
        const d = addDays(d0, i);
        const dateISO = toISODate(d);
        const weekdayLabel = getWeekdayLabel(d);

        const shifts = byDate[dateISO] || [];
        if (shifts.length === 0) continue; // Không hiển thị ngày nghỉ cho gọn

        // Sort shifts
        shifts.sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));

        const merged = mergeShiftRanges(shifts);
        const labelParts = merged.map(r => {
          const diff  = (r.end > r.start ? r.end - r.start : (24 - r.start + r.end));
          totalHours += diff;
          return `${pad2(r.start)}:00-${pad2(r.end)}:00`;
        });

        daysCount++;
        const tr = document.createElement('tr');
        
        const tdDate = document.createElement('td');
        tdDate.innerHTML = `<b>${weekdayLabel}</b> <br> <span style="font-size:0.9em;color:#666">${formatVNDate(d)}</span>`;
        
        const tdShift = document.createElement('td');
        tdShift.textContent = labelParts.join(', ');

        tr.appendChild(tdDate);
        tr.appendChild(tdShift);
        finalBodyEl.appendChild(tr);
      }

      finalWrapperEl.style.display = 'block';
      if (finalSummaryEl) {
        finalSummaryEl.style.display = 'block';
        finalSummaryEl.textContent = `Tổng cộng: ${totalHours} giờ / ${daysCount} ngày.`;
      }

      finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch làm đã chốt</span>';
      finalStatusEl.style.color = '#388e3c';
    }

    function mergeShiftRanges(shifts) {
      // Input: ['08-09', '09-10'] -> Output: [{start:8, end:10}]
      const parsed = shifts.map(s => {
          const parts = s.split('-');
          return { start: parseInt(parts[0], 10), end: parseInt(parts[1], 10) };
      });

      const result = [];
      if (parsed.length === 0) return result;

      let current = parsed[0];
      for(let i = 1; i < parsed.length; i++) {
          if (current.end === parsed[i].start) {
              current.end = parsed[i].end; // Merge
          } else {
              result.push(current);
              current = parsed[i];
          }
      }
      result.push(current);
      return result;
    }

    // =====================================================
    // UTILS
    // =====================================================

    // FIX: Hàm chuẩn hóa key shift. 
    // Data trả về có thể là "8-9", code tạo ra "08-09". Hàm này đưa hết về "08-09"
    function normalizeShiftKey(shift) {
        if (!shift) return '';
        const parts = shift.split('-');
        if (parts.length !== 2) return shift;
        return `${pad2(parseInt(parts[0]))}-${pad2(parseInt(parts[1]))}`;
    }

    function showMessage(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.style.color = isError ? '#d32f2f' : '#2e7d32'; // Xanh lá nếu success
      msgEl.style.fontWeight = '500';
    }

    function clearMessage() { showMessage('', false); }

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

    function pad2(n) { return String(n).padStart(2, '0'); }

    // FIX: Đổi về lấy Monday tuần này để user vào là thấy ngay trạng thái hiện tại
    function getThisMondayISO() {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const d = new Date(now.setDate(diff));
      return toISODate(d);
    }
    
    // Nếu muốn giữ logic tuần sau thì dùng hàm cũ bên dưới (tôi đã comment lại)
    /*
    function getNextMondayISO() {
      const now = new Date();
      const day = now.getDay(); 
      const daysToNextMonday = ((8 - day) % 7) || 7;
      const nextMonday = addDays(now, daysToNextMonday);
      return toISODate(nextMonday);
    }
    */

    function getWeekdayLabel(date) {
      const day = date.getDay();
      const map = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      return map[day];
    }

    function formatVNDate(d) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    }
  }
};
