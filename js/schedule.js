// js/schedule.js
// Trang nhân viên: đăng ký lịch rảnh + xem lịch làm đã chốt

window.SchedulePage = {
  init() {
    console.log('SchedulePage: init started');

    // 1. Get Elements
    const weekInput = document.getElementById('week-start-input');
    const loadBtn = document.getElementById('load-week-btn');
    const tbody = document.getElementById('availability-body');
    const msgEl = document.getElementById('schedule-message');
    const teamLabelEl = document.getElementById('team-label');
    const saveBtn = document.getElementById('save-availability-btn');
    const availSection = document.getElementById('availability-section');

    // Final schedule elements (personal)
    const finalStatusEl = document.getElementById('final-schedule-status');
    const finalWrapperEl = document.getElementById('final-schedule-wrapper');
    const finalBodyEl = document.getElementById('final-schedule-body');
    const finalSummaryEl = document.getElementById('final-schedule-summary');

    // Team schedule elements (all team members)
    const teamStatusEl = document.getElementById('team-schedule-status');
    const teamWrapperEl = document.getElementById('team-schedule-wrapper');
    const teamHeadRowEl = document.getElementById('team-schedule-head-row');
    const teamBodyEl = document.getElementById('team-schedule-body');
    const teamEmptyEl = document.getElementById('team-schedule-empty');

    // Team filter buttons
    const filterAllBtn = document.getElementById('filter-all-btn');
    const filterCsBtn = document.getElementById('filter-cs-btn');
    const filterMoBtn = document.getElementById('filter-mo-btn');

    // 2. Validate Critical Elements
    if (!weekInput || !tbody) {
      console.error('SchedulePage: Critical elements missing (week-start-input or availability-body)');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      console.error('SchedulePage: No user logged in');
      return;
    }

    // 3. Setup User Permissions
    const employmentType = (currentUser.employmentType || 'parttime').toLowerCase();
    const isCS = currentUser.permissions && currentUser.permissions.cs;
    const team = isCS ? 'cs' : 'mo';
    const isFulltimeMO = employmentType === 'fulltime' && !isCS;
    
    // Logic: Fulltime MO không được dùng form đăng ký
    const canUseAvailability = employmentType === 'parttime' || (employmentType === 'fulltime' && isCS);

    if (employmentType === 'fulltime' && !isCS) {
      // Redirect nếu cần, hoặc chỉ ẩn UI
      // window.location.href = '../index.html'; 
    }

    // 4. Update UI Messages based on Role
    if (teamLabelEl) {
      if (isFulltimeMO) {
        teamLabelEl.textContent = 'Bạn là nhân viên FULLTIME (Ops/Marketing) – Vui lòng xem lịch làm đã chốt ở bên dưới 👇';
      } else if (employmentType === 'fulltime' && isCS) {
        teamLabelEl.textContent = 'Bạn là nhân viên FULLTIME CS – Vui lòng đăng ký lịch rảnh (08:00 - 24:00).';
      } else {
        teamLabelEl.textContent = isCS
          ? 'Team CS (Part-time) – Chọn ca theo từng tiếng (08:00 - 24:00).'
          : 'Team Ops/Mkt (Part-time) – Chọn ca theo từng tiếng (09:00 - 18:00).';
      }
    }

    if (isFulltimeMO && availSection) availSection.style.display = 'none';
    if (!canUseAvailability && saveBtn) saveBtn.style.display = 'none';

    // 5. State Variables
    let dates = [];       
    let timeSlots = [];   
    let checkedMap = {};  
    let allAvailabilityMap = {}; 
    let canEditAvailability = canUseAvailability;
    let currentTeamFilter = 'all';

    // Default Week
    weekInput.value = getThisMondayISO();

    // 6. Event Listeners
    loadBtn.addEventListener('click', () => loadWeek());
    if (saveBtn) saveBtn.addEventListener('click', () => saveAvailability());
    weekInput.addEventListener('change', () => loadWeek());

    if (filterAllBtn && filterCsBtn && filterMoBtn) {
      const setFilter = (type, btn) => {
        currentTeamFilter = type;
        [filterAllBtn, filterCsBtn, filterMoBtn].forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCompanySchedule(weekInput.value, currentTeamFilter);
      };
      filterAllBtn.addEventListener('click', () => setFilter('all', filterAllBtn));
      filterCsBtn.addEventListener('click', () => setFilter('cs', filterCsBtn));
      filterMoBtn.addEventListener('click', () => setFilter('mo', filterMoBtn));
    }

    // Initial Load
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

      // Rebuild structure
      buildDates(weekStart);
      buildTimeSlots(team); // Xây dựng timeSlots cho availability grid

      try {
        showMessage('Đang tải dữ liệu...', false);

        // Prepare request bodies
        const bodyAvail = JSON.stringify({ action: 'getAvailability', email: currentUser.email, weekStart });
        const bodyMeta = JSON.stringify({ action: 'getScheduleMeta', weekStart, team });
        const bodySchedule = JSON.stringify({ action: 'getSchedule', weekStart, team });
        const bodyAllAvail = JSON.stringify({ action: 'getAllAvailability', weekStart, team });

        // Fetch Data
        const requests = [
          canUseAvailability 
            ? fetch(Auth.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: bodyAvail })
            : Promise.resolve(null),
          fetch(Auth.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: bodyMeta }),
          fetch(Auth.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: bodySchedule }),
          fetch(Auth.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: bodyAllAvail })
        ];

        const [resAvail, resMeta, resSched, resAllAvail] = await Promise.all(requests);

        // Process Personal Availability
        checkedMap = {};
        if (canUseAvailability && resAvail) {
          const dataAvail = await resAvail.json();
          if (dataAvail?.success && Array.isArray(dataAvail.availability)) {
            dataAvail.availability.forEach(item => {
              const date = String(item.date || '').substring(0, 10);
              const shift = normalizeShiftKey(item.shift); // FIX: Normalize key
              if (!date || !shift) return;
              checkedMap[`${date}|${shift}`] = true;
            });
          }
        }

        const dataMeta = await resMeta.json();
        const dataSched = await resSched.json();
        const dataAllAvail = await resAllAvail.json();

        // Process All Team Availability
        allAvailabilityMap = {};
        if (dataAllAvail?.success && Array.isArray(dataAllAvail.availability)) {
          dataAllAvail.availability.forEach(item => {
            const date = String(item.date || '').substring(0, 10);
            const shift = normalizeShiftKey(item.shift); // FIX: Normalize key
            const email = String(item.email || '').toLowerCase();
            const name = String(item.name || email);
            
            if (!date || !shift || email === currentUser.email.toLowerCase()) return;

            const slotId = `${date}|${shift}`;
            if (!allAvailabilityMap[slotId]) allAvailabilityMap[slotId] = [];
            if (!allAvailabilityMap[slotId].some(u => u.email === email)) {
              allAvailabilityMap[slotId].push({ email, name });
            }
          });
        }

        // Determine Status
        const meta = dataMeta?.meta || {};
        const status = (meta.status || 'draft').toLowerCase();
        canEditAvailability = canUseAvailability && status !== 'final';

        // Render Views
        buildGrid(); // Render Availability Grid
        syncUIFromCheckedMap();
        
        // Cập nhật nút Lưu
        if (saveBtn) saveBtn.style.display = canEditAvailability ? 'inline-flex' : 'none';

        // Render Schedules
        renderFinalSchedule(weekStart, team, dataMeta, dataSched, currentUser.email);
        renderCompanySchedule(weekStart, currentTeamFilter);

        // Final Message
        if (!canEditAvailability && canUseAvailability) {
          showMessage('Tuần này đã CHỐT LỊCH. Vui lòng liên hệ Leader nếu cần thay đổi.', false);
        } else {
          showMessage('Đã tải dữ liệu thành công.', false);
        }

      } catch (err) {
        console.error('loadWeek error', err);
        showMessage('Lỗi kết nối hoặc xử lý dữ liệu. Xem console để biết thêm.', true);
      }
    }

    // =====================================================
    // BUILD GRID (AVAILABILITY)
    // =====================================================

    function buildDates(weekStartISO) {
      dates = [];
      const d0 = new Date(weekStartISO + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        dates.push(toISODate(addDays(d0, i)));
      }
    }

    function buildTimeSlots(teamArg) {
      let startHour = 9, endHour = 18;
      if (teamArg === 'cs') { startHour = 8; endHour = 24; }
      
      timeSlots = [];
      for (let h = startHour; h < endHour; h++) {
        const next = (h + 1) % 24;
        timeSlots.push({ key: `${pad2(h)}-${pad2(next)}`, label: `${pad2(h)}:00 - ${pad2(next)}:00` });
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
          td.className = 'schedule-cell availability-cell';
          td.style.verticalAlign = 'middle';
          td.style.padding = '12px 8px';
          td.style.textAlign = 'center';
          
          const slotId = `${dateISO}|${slot.key}`;
          td.dataset.slotId = slotId;

          if (canEditAvailability) {
            td.style.cursor = 'pointer';
            td.classList.add('clickable-cell');
            td.onclick = () => {
              checkedMap[slotId] = !checkedMap[slotId];
              updateCellVisualState(td, slotId);
            };
          } else {
            td.classList.add('disabled-cell');
            td.style.cursor = 'not-allowed';
            td.style.backgroundColor = '#f5f5f5';
          }

          // Check Icon
          const checkIcon = document.createElement('div');
          checkIcon.className = 'check-icon';
          checkIcon.innerHTML = '✓';
          checkIcon.style.cssText = 'font-size: 28px; font-weight: bold; color: #fff; display: none;';
          td.appendChild(checkIcon);

          // Others Availability
          const others = allAvailabilityMap[slotId] || [];
          if (others.length > 0) {
            const othersDiv = document.createElement('div');
            othersDiv.className = 'other-availability';
            othersDiv.style.cssText = 'font-size: 10px; color: #666; margin-top: 4px;';
            const names = others.map(u => u.name.trim().split(/\s+/).pop()); // Last name
            othersDiv.textContent = names.join(', ');
            othersDiv.title = `Đã tick: ${others.map(u => u.name).join(', ')}`;
            td.appendChild(othersDiv);
          }

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    function updateCellVisualState(cell, slotId) {
      const isChecked = !!checkedMap[slotId];
      const checkIcon = cell.querySelector('.check-icon');
      if (isChecked) {
        cell.style.backgroundColor = '#4CAF50';
        if (checkIcon) checkIcon.style.display = 'block';
      } else {
        cell.style.backgroundColor = canEditAvailability ? '' : '#f5f5f5';
        if (checkIcon) checkIcon.style.display = 'none';
      }
    }

    function syncUIFromCheckedMap() {
      tbody.querySelectorAll('.availability-cell').forEach(cell => {
        updateCellVisualState(cell, cell.dataset.slotId);
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
      const availability = Object.keys(checkedMap).map(id => {
        const [date, shift] = id.split('|');
        return { date, shift };
      });

      try {
        showMessage('Đang lưu...', false);
        const res = await fetch(Auth.API_URL, {
          method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveAvailability', email: currentUser.email, name: currentUser.name, weekStart, availability })
        });
        const data = await res.json();
        showMessage(data.success ? 'Đã lưu đăng ký ca rảnh.' : 'Lỗi lưu: ' + data.message, !data.success);
      } catch (err) {
        showMessage('Lỗi kết nối khi lưu.', true);
      }
    }

    // =====================================================
    // FINAL SCHEDULE (PERSONAL)
    // =====================================================

    function renderFinalSchedule(weekStart, team, dataMeta, dataSched, userEmail) {
      if (!finalStatusEl || !finalWrapperEl || !finalBodyEl) return;

      const meta = dataMeta?.meta || { status: 'draft' };
      const status = (meta.status || 'draft').toLowerCase();

      // Reset UI
      finalBodyEl.innerHTML = '';
      finalStatusEl.innerHTML = '';

      if (status !== 'final') {
        finalStatusEl.innerHTML = '<span class="status-badge status-draft">⏳ Lịch làm tuần này chưa được chốt.</span>';
        finalWrapperEl.style.display = 'none'; // Ẩn bảng, nhưng hiện status
        return;
      }

      // Filter user slots
      const schedArr = dataSched?.schedule || [];
      const userSlots = schedArr.filter(i => (i.email || '').toLowerCase() === (userEmail || '').toLowerCase());

      if (userSlots.length === 0) {
        finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch đã chốt: Tuần này bạn không có ca.</span>';
        finalWrapperEl.style.display = 'none';
        return;
      }

      // Group by Date
      const byDate = {};
      userSlots.forEach(item => {
        const date = String(item.date).substring(0, 10);
        const shift = normalizeShiftKey(item.shift); // FIX: Normalize
        if (!byDate[date]) byDate[date] = [];
        if (!byDate[date].includes(shift)) byDate[date].push(shift);
      });

      let totalHours = 0, daysCount = 0;
      const d0 = new Date(weekStart + 'T00:00:00');

      for (let i = 0; i < 7; i++) {
        const d = addDays(d0, i);
        const dateISO = toISODate(d);
        const shifts = byDate[dateISO] || [];
        
        if (shifts.length > 0) {
          daysCount++;
          shifts.sort(); // Sort 08-09 before 09-10
          
          // Merge logic (simplified)
          const ranges = mergeShifts(shifts);
          ranges.forEach(r => totalHours += (r.end - r.start));
          
          const tr = document.createElement('tr');
          const tdDate = document.createElement('td');
          tdDate.textContent = `${getWeekdayLabel(d)} (${formatVNDate(d)})`;
          const tdShift = document.createElement('td');
          tdShift.textContent = ranges.map(r => `${pad2(r.start)}:00 - ${pad2(r.end)}:00`).join(', ');
          
          tr.appendChild(tdDate);
          tr.appendChild(tdShift);
          finalBodyEl.appendChild(tr);
        }
      }

      finalWrapperEl.style.display = 'block';
      if (finalSummaryEl) {
        finalSummaryEl.style.display = 'block';
        const txt = document.getElementById('final-schedule-summary-text');
        if(txt) txt.textContent = `Tổng: ${totalHours}h / ${daysCount} ngày.`;
      }
      finalStatusEl.innerHTML = '<span class="status-badge status-final">✅ Lịch làm tuần này đã được chốt</span>';
    }

    function mergeShifts(shifts) {
      // Input: ['08-09', '09-10', '13-14'] -> Output: [{start:8, end:10}, {start:13, end:14}]
      const parsed = shifts.map(s => {
        const [st, en] = s.split('-').map(n => parseInt(n, 10));
        return { start: st, end: en };
      }).sort((a,b) => a.start - b.start);

      const res = [];
      let curr = null;
      parsed.forEach(p => {
        if(!curr) curr = p;
        else if(p.start === curr.end) curr.end = p.end;
        else { res.push(curr); curr = p; }
      });
      if(curr) res.push(curr);
      return res;
    }

    // =====================================================
    // RENDER COMPANY SCHEDULE
    // =====================================================

    async function renderCompanySchedule(weekStart, teamFilter = 'all') {
      // FIX 1: Check elements exist before rendering
      if (!teamStatusEl || !teamWrapperEl || !teamHeadRowEl || !teamBodyEl || !teamEmptyEl) {
        console.warn('SchedulePage: Missing Company Schedule HTML elements. ID check failed.');
        return;
      }

      try {
        teamStatusEl.innerHTML = '⏳ Đang tải lịch toàn công ty...';
        
        // Fetch All
        const [resCS, resMO, mCS, mMO] = await Promise.all([
          fetch(Auth.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSchedule', weekStart, team: 'cs' }) }),
          fetch(Auth.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSchedule', weekStart, team: 'mo' }) }),
          fetch(Auth.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getScheduleMeta', weekStart, team: 'cs' }) }),
          fetch(Auth.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getScheduleMeta', weekStart, team: 'mo' }) })
        ]);

        const [sCS, sMO, mtCS, mtMO] = await Promise.all([resCS.json(), resMO.json(), mCS.json(), mMO.json()]);
        
        const isFinalCS = (mtCS.meta?.status || '').toLowerCase() === 'final';
        const isFinalMO = (mtMO.meta?.status || '').toLowerCase() === 'final';

        if (!isFinalCS && !isFinalMO) {
          teamStatusEl.innerHTML = '<span class="status-badge status-draft">⏳ Lịch công ty chưa chốt.</span>';
          teamWrapperEl.style.display = 'none';
          return;
        }

        // Combine Data
        let allSched = [...(sCS.schedule || []), ...(sMO.schedule || [])];
        
        // Filter: Only Part-time
        allSched = allSched.filter(i => {
            const type = (i.employmentType || 'parttime').toLowerCase();
            return type.includes('part');
        });

        // Filter: By Team Button
        if (teamFilter !== 'all') {
          allSched = allSched.filter(i => (i.team || '').toLowerCase() === teamFilter);
        }

        if (allSched.length === 0) {
          teamStatusEl.innerHTML = '<span class="status-badge status-final">✅ Đã chốt nhưng chưa có ca part-time nào.</span>';
          teamWrapperEl.style.display = 'none';
          return;
        }

        // Render Logic
        teamWrapperEl.style.display = 'block';
        teamEmptyEl.style.display = 'none';
        teamStatusEl.innerHTML = `<span class="status-badge status-final">✅ Lịch toàn công ty (${allSched.length} ca)</span>`;

        // Create Grid: 08:00 - 24:00
        const compSlots = [];
        for (let h = 8; h < 24; h++) compSlots.push({ key: `${pad2(h)}-${pad2((h+1)%24)}`, label: `${pad2(h)}:00` });

        // Map Data
        // Structure: map[date][slotIndex] = [People]
        const mapData = {}; 
        
        allSched.forEach(item => {
          const d = String(item.date).substring(0, 10);
          const s = normalizeShiftKey(item.shift); // FIX: Normalize key
          const slotIdx = compSlots.findIndex(sl => sl.key === s);
          
          if (slotIdx === -1) return;
          if (!mapData[d]) mapData[d] = {};
          if (!mapData[d][slotIdx]) mapData[d][slotIdx] = [];
          
          mapData[d][slotIdx].push({
            name: item.name || item.email,
            email: item.email,
            team: (item.team || '').toUpperCase()
          });
        });

        // Draw Header
        const datesArr = [];
        const d0 = new Date(weekStart + 'T00:00:00');
        for(let i=0; i<7; i++) datesArr.push(toISODate(addDays(d0, i)));

        teamHeadRowEl.innerHTML = '<th>Giờ</th>';
        datesArr.forEach(dISO => {
          const d = new Date(dISO + 'T00:00:00');
          const th = document.createElement('th');
          th.innerHTML = `<div>${getWeekdayLabel(d)}</div><small>${formatVNDate(d)}</small>`;
          if(d.getDay()===0) th.classList.add('th-sunday'); // CSS for Sunday
          teamHeadRowEl.appendChild(th);
        });

        // Draw Body
        teamBodyEl.innerHTML = '';
        compSlots.forEach((slot, idx) => {
          const tr = document.createElement('tr');
          const th = document.createElement('th');
          th.textContent = slot.label;
          tr.appendChild(th);

          datesArr.forEach(dISO => {
            const td = document.createElement('td');
            const people = (mapData[dISO] && mapData[dISO][idx]) || [];
            
            // Remove duplicates by email
            const uniquePeople = [];
            const seen = new Set();
            people.forEach(p => {
              if(!seen.has(p.email)) { seen.add(p.email); uniquePeople.push(p); }
            });

            uniquePeople.forEach(p => {
               const tag = document.createElement('span');
               const colors = getColorForEmail(p.email);
               tag.textContent = p.name;
               tag.style.cssText = `display:inline-block; margin:1px; padding:2px 5px; font-size:10px; border-radius:3px; background:${colors.bg}; color:${colors.text};`;
               td.appendChild(tag);
            });
            tr.appendChild(td);
          });
          teamBodyEl.appendChild(tr);
        });

      } catch (e) {
        console.error('RenderCompanySchedule Error:', e);
        teamStatusEl.textContent = '❌ Lỗi hiển thị lịch công ty.';
      }
    }

    // =====================================================
    // UTILS
    // =====================================================
    function normalizeShiftKey(shift) {
      // Input "8-9" -> "08-09". Input "08-09" -> "08-09"
      if (!shift) return '';
      return shift.split('-').map(s => pad2(parseInt(s))).join('-');
    }

    function showMessage(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.className = text ? (isError ? 'alert-message alert-error' : 'alert-message alert-success') : 'alert-message';
    }
    function clearMessage() { showMessage('', false); }
    function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function toISODate(d) { return d.toISOString().split('T')[0]; }
    function pad2(n) { return String(n).padStart(2, '0'); }
    function getWeekdayLabel(d) { return ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()]; }
    function formatVNDate(d) { return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`; }
    function getThisMondayISO() {
      const d = new Date();
      const day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6:1);
      return toISODate(new Date(d.setDate(diff)));
    }
    
    // Color Palette Utils
    const COLOR_PALETTE = [{ bg: '#FF5252', text: '#fff' }, { bg: '#2196F3', text: '#fff' }, { bg: '#4CAF50', text: '#fff' }, { bg: '#FF9800', text: '#000' }, { bg: '#9C27B0', text: '#fff' }];
    const colorByEmail = {};
    function getColorForEmail(email) {
      if (!email) return { bg: '#ccc', text: '#000' };
      if (!colorByEmail[email]) colorByEmail[email] = COLOR_PALETTE[Object.keys(colorByEmail).length % COLOR_PALETTE.length];
      return colorByEmail[email];
    }
  }
};
